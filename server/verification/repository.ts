import crypto from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type {
  SubmittedOfferVerificationSnapshot,
  VerificationDecision,
  VerificationSystemCondition,
} from "../../shared/verification.js";
import { pool } from "../db.js";
import {
  type VerificationEngineCompletion,
  readVerificationEngineCompletion,
} from "./engine.js";
import {
  currentVerificationPolicies,
  VERIFICATION_CONFIDENCE_MODEL_VERSION,
  VERIFICATION_ENGINE_VERSION,
} from "./policy.js";
import {
  fingerprintVerificationSnapshot,
  immutableVerificationSnapshot,
} from "./snapshot.js";

const CLAIM_DURATION_MS = 30_000;

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function asSnapshot(value: unknown): SubmittedOfferVerificationSnapshot {
  if (typeof value === "string") {
    return immutableVerificationSnapshot(
      JSON.parse(value) as SubmittedOfferVerificationSnapshot,
    );
  }
  return immutableVerificationSnapshot(
    value as SubmittedOfferVerificationSnapshot,
  );
}

export interface QueuedVerification {
  attemptId: string;
  correlationId: string;
}

export async function queueVerificationAttempt(
  client: PoolClient,
  snapshot: SubmittedOfferVerificationSnapshot,
): Promise<QueuedVerification> {
  const policies = currentVerificationPolicies();
  const attemptId = crypto.randomUUID();
  const submissionId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const commandId = crypto.randomUUID();
  const correlationId = crypto.randomUUID();
  const idempotencyKey =
    `offer-verification:${snapshot.offerId}:` +
    `${snapshot.submissionRevision}:1`;
  const fingerprint = fingerprintVerificationSnapshot(snapshot);

  await client.query(
    `
      INSERT INTO public.offer_submission_revisions (
        id,
        offer_id,
        revision,
        submitted_record_version,
        input_snapshot,
        input_fingerprint,
        snapshot_schema_version,
        submitted_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $4)
    `,
    [
      submissionId,
      snapshot.offerId,
      snapshot.submissionRevision,
      snapshot.submittedRecordVersion,
      JSON.stringify(snapshot),
      fingerprint,
      snapshot.snapshotSchemaVersion,
    ],
  );

  await client.query(
    `
      INSERT INTO public.offer_verification_attempts (
        id,
        offer_id,
        submission_revision,
        attempt_sequence,
        idempotency_key,
        submitted_record_version,
        input_snapshot,
        input_fingerprint,
        snapshot_schema_version,
        process_state,
        confidence_model_version,
        engine_version,
        technical_policy_version,
        commercial_policy_version
      )
      VALUES (
        $1, $2, $3, 1, $4, $5, $6::jsonb, $7, $8, 'queued',
        $9, $10, $11, $12
      )
    `,
    [
      attemptId,
      snapshot.offerId,
      snapshot.submissionRevision,
      idempotencyKey,
      snapshot.submittedRecordVersion,
      JSON.stringify(snapshot),
      fingerprint,
      snapshot.snapshotSchemaVersion,
      VERIFICATION_CONFIDENCE_MODEL_VERSION,
      VERIFICATION_ENGINE_VERSION,
      policies.technical.version,
      policies.commercial.version,
    ],
  );

  await client.query(
    `
      INSERT INTO public.offer_verification_events (
        id,
        attempt_id,
        event_type,
        actor_type,
        correlation_id,
        metadata
      )
      VALUES (
        $1, $2, 'verification_queued', 'system', $3,
        jsonb_build_object('submissionRevision', $4::int)
      )
    `,
    [eventId, attemptId, correlationId, snapshot.submissionRevision],
  );

  await client.query(
    `
      INSERT INTO public.offer_verification_commands (
        id,
        attempt_id,
        offer_id,
        submission_revision,
        idempotency_key,
        correlation_id
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      commandId,
      attemptId,
      snapshot.offerId,
      snapshot.submissionRevision,
      idempotencyKey,
      correlationId,
    ],
  );

  return { attemptId, correlationId };
}

interface ClaimedRow extends QueryResultRow {
  command_id: string;
  attempt_id: string;
  correlation_id: string;
  input_snapshot: unknown;
  technical_policy_version: string;
  commercial_policy_version: string;
  engine_version: string;
  input_fingerprint: string;
}

export interface ClaimedVerification {
  commandId: string;
  attemptId: string;
  correlationId: string;
  claimToken: string;
  snapshot: SubmittedOfferVerificationSnapshot;
  inputFingerprint: string;
  recordedVersions: {
    engineVersion: string;
    technicalPolicyVersion: string;
    commercialPolicyVersion: string;
  };
}

async function recoverExpiredClaims(client: PoolClient): Promise<void> {
  const expired = await client.query<{
    command_id: string;
    attempt_id: string;
    correlation_id: string;
  }>(`
    SELECT
      command.id AS command_id,
      command.attempt_id,
      command.correlation_id
    FROM public.offer_verification_commands AS command
    INNER JOIN public.offer_verification_attempts AS attempt
      ON attempt.id = command.attempt_id
    WHERE command.command_state = 'processing'
      AND command.claim_expires_at <= now()
      AND attempt.process_state = 'running'
    ORDER BY command.created_at, command.id
    FOR UPDATE OF command, attempt SKIP LOCKED
  `);

  for (const row of expired.rows) {
    await client.query(
      `
        UPDATE public.offer_verification_attempts
        SET
          process_state = 'queued',
          claim_token_hash = NULL,
          claim_expires_at = NULL
        WHERE id = $1
          AND process_state = 'running'
      `,
      [row.attempt_id],
    );
    await client.query(
      `
        UPDATE public.offer_verification_commands
        SET
          command_state = 'pending',
          claim_token_hash = NULL,
          claim_expires_at = NULL,
          available_at = now()
        WHERE id = $1
          AND command_state = 'processing'
      `,
      [row.command_id],
    );
    await client.query(
      `
        INSERT INTO public.offer_verification_events (
          id,
          attempt_id,
          event_type,
          actor_type,
          correlation_id,
          metadata
        )
        VALUES (
          $1, $2, 'verification_claim_expired', 'system', $3, '{}'::jsonb
        )
      `,
      [crypto.randomUUID(), row.attempt_id, row.correlation_id],
    );
  }
}

export async function claimNextVerification(): Promise<
  ClaimedVerification | undefined
> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await recoverExpiredClaims(client);
    const claimed = await client.query<ClaimedRow>(`
      SELECT
        command.id AS command_id,
        command.attempt_id,
        command.correlation_id,
        attempt.input_snapshot,
        attempt.input_fingerprint,
        attempt.technical_policy_version,
        attempt.commercial_policy_version,
        attempt.engine_version
      FROM public.offer_verification_commands AS command
      INNER JOIN public.offer_verification_attempts AS attempt
        ON attempt.id = command.attempt_id
      WHERE command.command_state = 'pending'
        AND command.available_at <= now()
        AND attempt.process_state = 'queued'
      ORDER BY command.created_at, command.id
      LIMIT 1
      FOR UPDATE OF command, attempt SKIP LOCKED
    `);
    const row = claimed.rows[0];
    if (!row) {
      await client.query("COMMIT");
      return undefined;
    }

    const claimToken = crypto.randomUUID();
    const claimHash = sha256(claimToken);
    const claimExpiresAt = new Date(Date.now() + CLAIM_DURATION_MS);
    await client.query(
      `
        UPDATE public.offer_verification_attempts
        SET
          process_state = 'running',
          claim_token_hash = $2,
          claim_expires_at = $3,
          started_at = COALESCE(started_at, now())
        WHERE id = $1
          AND process_state = 'queued'
      `,
      [row.attempt_id, claimHash, claimExpiresAt],
    );
    await client.query(
      `
        UPDATE public.offer_verification_commands
        SET
          command_state = 'processing',
          claim_token_hash = $2,
          claim_expires_at = $3
        WHERE id = $1
          AND command_state = 'pending'
      `,
      [row.command_id, claimHash, claimExpiresAt],
    );
    await client.query(
      `
        INSERT INTO public.offer_verification_events (
          id,
          attempt_id,
          event_type,
          actor_type,
          correlation_id,
          metadata
        )
        VALUES (
          $1, $2, 'verification_claimed', 'system', $3, '{}'::jsonb
        )
      `,
      [crypto.randomUUID(), row.attempt_id, row.correlation_id],
    );
    await client.query("COMMIT");
    return {
      commandId: row.command_id,
      attemptId: row.attempt_id,
      correlationId: row.correlation_id,
      claimToken,
      snapshot: asSnapshot(row.input_snapshot),
      inputFingerprint: row.input_fingerprint,
      recordedVersions: {
        engineVersion: row.engine_version,
        technicalPolicyVersion: row.technical_policy_version,
        commercialPolicyVersion: row.commercial_policy_version,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function sameConditions(
  left: readonly VerificationSystemCondition[],
  right: readonly VerificationSystemCondition[],
): boolean {
  return (
    left.length === right.length &&
    left.every((condition, index) => condition === right[index])
  );
}

export type PersistEngineCompletionResult =
  | {
      readonly status: "completed";
      readonly decision: VerificationDecision;
    }
  | {
      readonly status: "reevaluation_required";
      readonly systemConditions: readonly VerificationSystemCondition[];
    };

export async function persistEngineCompletion(
  claim: ClaimedVerification,
  completion: VerificationEngineCompletion,
): Promise<PersistEngineCompletionResult | undefined> {
  const completionPayload = readVerificationEngineCompletion(completion);
  if (completionPayload.attemptId !== claim.attemptId) {
    throw new Error("VERIFICATION_COMPLETION_ATTEMPT_MISMATCH");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const attempt = (
      await client.query<{
        offer_id: string;
        submission_revision: number;
        process_state: string;
        claim_token_hash: string | null;
        claim_expires_at: Date | string | null;
        input_snapshot: unknown;
        input_fingerprint: string;
        engine_version: string;
        technical_policy_version: string;
        commercial_policy_version: string;
      }>(
        `
          SELECT
            offer_id,
            submission_revision,
            process_state,
            claim_token_hash,
            claim_expires_at,
            input_snapshot,
            input_fingerprint,
            engine_version,
            technical_policy_version,
            commercial_policy_version
          FROM public.offer_verification_attempts
          WHERE id = $1
          FOR UPDATE
        `,
        [claim.attemptId],
      )
    ).rows[0];
    if (
      !attempt ||
      attempt.process_state !== "running" ||
      attempt.claim_token_hash !== sha256(claim.claimToken) ||
      attempt.claim_expires_at === null ||
      new Date(attempt.claim_expires_at).getTime() <= Date.now()
    ) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const current = (
      await client.query<{ status: string; revision: number | null }>(
        `
          SELECT
            offer.status::text AS status,
            (
              SELECT max(revision)
              FROM public.offer_submission_revisions
              WHERE offer_id = offer.id
            )::int AS revision
          FROM public.offers AS offer
          WHERE offer.id = $1
          FOR UPDATE
        `,
        [attempt.offer_id],
      )
    ).rows[0];
    const storedSnapshot = asSnapshot(attempt.input_snapshot);
    const actualFingerprint =
      fingerprintVerificationSnapshot(storedSnapshot);
    const systemConditions: VerificationSystemCondition[] = [];
    if (
      actualFingerprint !== attempt.input_fingerprint ||
      actualFingerprint !== claim.inputFingerprint ||
      actualFingerprint !== completionPayload.inputFingerprint
    ) {
      systemConditions.push("snapshot_integrity_mismatch");
    }
    if (
      current?.status !== "submitted" ||
      current.revision !== attempt.submission_revision
    ) {
      systemConditions.push("offer_state_conflict");
    }
    const sortedConditions = systemConditions.sort();
    const completionDatabaseConditions =
      completionPayload.systemConditions
        .filter(
          (condition) =>
            condition !== "policy_configuration_unavailable",
        )
        .sort();
    if (!sameConditions(sortedConditions, completionDatabaseConditions)) {
      await client.query("ROLLBACK");
      return {
        status: "reevaluation_required",
        systemConditions: Object.freeze(sortedConditions),
      };
    }
    const result = completionPayload.result;
    if (
      result.engineVersion !== attempt.engine_version ||
      result.technicalPolicyVersion !==
        attempt.technical_policy_version ||
      result.commercialPolicyVersion !==
        attempt.commercial_policy_version
    ) {
      throw new Error("VERIFICATION_COMPLETION_VERSION_MISMATCH");
    }

    for (const finding of result.findings) {
      await client.query(
        `
          INSERT INTO public.offer_verification_findings (
            id,
            attempt_id,
            evaluation_order,
            rule_id,
            reason_code,
            severity,
            disposition,
            policy_family,
            policy_version
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          crypto.randomUUID(),
          claim.attemptId,
          finding.evaluationOrder,
          finding.ruleId,
          finding.reasonCode,
          finding.severity,
          finding.disposition,
          finding.policyFamily,
          finding.policyVersion,
        ],
      );
    }

    const completed = await client.query(
      `
        UPDATE public.offer_verification_attempts
        SET
          process_state = 'completed',
          decision = $2,
          confidence = $3,
          claim_token_hash = NULL,
          claim_expires_at = NULL,
          completed_at = now()
        WHERE id = $1
          AND process_state = 'running'
          AND claim_token_hash = $4
      `,
      [
        claim.attemptId,
        result.decision,
        result.confidence,
        sha256(claim.claimToken),
      ],
    );
    if (completed.rowCount !== 1) {
      throw new Error("VERIFICATION_COMPLETION_CONFLICT");
    }
    const delivered = await client.query(
      `
        UPDATE public.offer_verification_commands
        SET
          command_state = 'delivered',
          claim_token_hash = NULL,
          claim_expires_at = NULL,
          delivered_at = now()
        WHERE id = $1
          AND command_state = 'processing'
          AND claim_token_hash = $2
      `,
      [claim.commandId, sha256(claim.claimToken)],
    );
    if (delivered.rowCount !== 1) {
      throw new Error("VERIFICATION_COMMAND_DELIVERY_CONFLICT");
    }
    await client.query(
      `
        INSERT INTO public.offer_verification_events (
          id,
          attempt_id,
          event_type,
          actor_type,
          correlation_id,
          metadata
        )
        VALUES (
          $1, $2, 'verification_completed', 'system', $3,
          jsonb_build_object(
            'decision', $4::text,
            'confidence', $5::text,
            'engineVersion', $6::text,
            'technicalPolicyVersion', $7::text,
            'commercialPolicyVersion', $8::text
          )
        )
      `,
      [
        crypto.randomUUID(),
        claim.attemptId,
        claim.correlationId,
        result.decision,
        result.confidence,
        result.engineVersion,
        result.technicalPolicyVersion,
        result.commercialPolicyVersion,
      ],
    );
    await client.query("COMMIT");
    return { status: "completed", decision: result.decision };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
