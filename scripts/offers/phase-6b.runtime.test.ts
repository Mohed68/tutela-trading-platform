import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { Client, type QueryResultRow } from "pg";
import { pool } from "../../server/db.js";
import {
  createOwnedDraftOffer,
  submitOwnedDraftOffer,
  updateOwnedDraftOffer,
} from "../../server/drafts/storage.js";
import { getPublishedMarketplaceOfferRecords } from "../../server/marketplace/publicMarketplace.js";
import { coordinateVerificationDecision } from "../../server/verification/coordinator.js";
import { evaluateAndCompleteClaimedVerification } from "../../server/verification/orchestrator.js";
import {
  claimNextVerification,
} from "../../server/verification/repository.js";
import { processNextVerificationCommand } from "../../server/verification/worker.js";
import {
  applicationSchemaFingerprint,
  requireRawDatabaseUrl,
  verifyRecoveryMarker,
} from "../migrations/rehearsal-lib.js";

const EXPECTED_FINGERPRINT =
  "aeb77478a423b407e5e69705f78b7948e8020411b7defa26f605568f616fc401";
const EXPECTED_LEGACY_USER_HASH =
  "3369cf18c0fb7ffa5881cdd4a6c25c2da11ef489c46e7b9e52f5d28f41288bbc";
const EXPECTED_LEGACY_OFFER_HASH =
  "b9492303d4d3bb157941fd3ed609438761eb85396e83861af4cfb5f77664c2fc";

const VERIFICATION_TABLES = [
  "offer_submission_revisions",
  "offer_verification_attempts",
  "offer_verification_findings",
  "offer_verification_events",
  "offer_verification_commands",
  "offer_workflow_transitions",
] as const;

function snapshotHash(rows: QueryResultRow[]): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(rows.map((row) => row.record)))
    .digest("hex");
}

async function tableSnapshot(
  client: Client,
  table: "users" | "offers",
  where = "",
): Promise<string> {
  const rows = (
    await client.query<QueryResultRow>(
      `SELECT to_jsonb(source) AS record
       FROM public.${table} AS source
       ${where}
       ORDER BY source.id`,
    )
  ).rows;
  return snapshotHash(rows);
}

async function count(client: Client, table: string): Promise<number> {
  const safe = `"${table.replaceAll('"', '""')}"`;
  return (
    await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM public.${safe}`,
    )
  ).rows[0].count;
}

async function cleanupOffer(client: Client, offerId: string): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(
      "SELECT set_config('tutela.verification_maintenance', 'on', true)",
    );
    await client.query(
      "DELETE FROM public.offer_workflow_transitions WHERE offer_id = $1",
      [offerId],
    );
    await client.query(
      `
        DELETE FROM public.offer_verification_events
        WHERE attempt_id IN (
          SELECT id
          FROM public.offer_verification_attempts
          WHERE offer_id = $1
        )
      `,
      [offerId],
    );
    await client.query(
      `
        DELETE FROM public.offer_verification_findings
        WHERE attempt_id IN (
          SELECT id
          FROM public.offer_verification_attempts
          WHERE offer_id = $1
        )
      `,
      [offerId],
    );
    await client.query(
      "DELETE FROM public.offer_verification_commands WHERE offer_id = $1",
      [offerId],
    );
    await client.query(
      "DELETE FROM public.offer_verification_attempts WHERE offer_id = $1",
      [offerId],
    );
    await client.query(
      "DELETE FROM public.offer_submission_revisions WHERE offer_id = $1",
      [offerId],
    );
    await client.query("DELETE FROM public.offers WHERE id = $1", [offerId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

test(
  "Phase 6B verifies immutable revisions and preserves protected data",
  { timeout: 300_000 },
  async (context) => {
    const fixtureProbe = new Client({
      connectionString: requireRawDatabaseUrl(process.env.DATABASE_URL),
    });
    await fixtureProbe.connect();
    const legacyRecoveryMarker = await fixtureProbe.query<{ marker: string | null }>(
      "SELECT to_regclass('public.recovery_environment_marker')::text AS marker",
    );
    await fixtureProbe.end();
    if (legacyRecoveryMarker.rows[0]?.marker === null) {
      context.skip("Phase 6B legacy recovery fixture is not the active staging schema");
      return;
    }
    assert.equal(process.env.TUTELA_RECOVERY_MODE, "true");
    assert.notEqual(process.env.NODE_ENV, "production");
    assert.equal(Boolean(process.env.RENDER), false);

    const client = new Client({
      connectionString: requireRawDatabaseUrl(process.env.DATABASE_URL),
    });
    const cleanupIds: string[] = [];
    try {
      await client.connect();
      await client.query("BEGIN READ ONLY");
      await verifyRecoveryMarker(client);
      assert.equal(
        await applicationSchemaFingerprint(client),
        EXPECTED_FINGERPRINT,
      );
      assert.equal(
        await tableSnapshot(
          client,
          "users",
          "WHERE source.recovery_provenance IS NULL",
        ),
        EXPECTED_LEGACY_USER_HASH,
      );
      assert.equal(
        await tableSnapshot(client, "offers"),
        EXPECTED_LEGACY_OFFER_HASH,
      );
      for (const table of VERIFICATION_TABLES) {
        assert.equal(await count(client, table), 0);
      }
      assert.equal(await count(client, "sessions"), 0);
      await client.query("ROLLBACK");

      const owner = (
        await client.query<{ id: string }>(`
          SELECT id
          FROM public.users
          WHERE recovery_provenance = 'tutela-recovery-test'
          ORDER BY id
          LIMIT 1
        `)
      ).rows[0];
      assert.ok(owner);
      const commodity = (
        await client.query<{ id: string }>(`
          SELECT id
          FROM public.commodities
          WHERE lower(name) = 'west texas intermediate (wti) crude oil'
          LIMIT 1
        `)
      ).rows[0];
      assert.ok(commodity);

      const approvedDraft = await createOwnedDraftOffer(owner.id, {
        offerType: "sell",
        commodityId: commodity.id,
        quantity: "100.00",
        unit: "bbl",
        amountPerUnit: "75.50",
        currency: "USD",
        location: "Phase 6B Recovery Test",
        validUntil: "2026-12-31T00:00:00.000Z",
      });
      cleanupIds.push(approvedDraft.id);
      const submitted = await submitOwnedDraftOffer(
        owner.id,
        approvedDraft.id,
      );
      assert.equal(submitted?.status, "submitted");
      const queued = (
        await client.query<{
          process_state: string;
          decision: string | null;
        }>(
          `
            SELECT process_state, decision
            FROM public.offer_verification_attempts
            WHERE offer_id = $1
          `,
          [approvedDraft.id],
        )
      ).rows[0];
      assert.deepEqual(queued, {
        process_state: "queued",
        decision: null,
      });

      const approvedWork = await processNextVerificationCommand();
      assert.equal(approvedWork?.decision, "approved");
      assert.equal(approvedWork?.workflowResult, "applied");
      const approvedState = (
        await client.query<{
          status: string;
          process_state: string;
          decision: string;
          confidence: string;
          findings: number;
          events: number;
          command_state: string;
          transition_result: string;
        }>(
          `
            SELECT
              offer.status::text AS status,
              attempt.process_state,
              attempt.decision,
              attempt.confidence,
              (
                SELECT count(*)::int
                FROM public.offer_verification_findings
                WHERE attempt_id = attempt.id
              ) AS findings,
              (
                SELECT count(*)::int
                FROM public.offer_verification_events
                WHERE attempt_id = attempt.id
              ) AS events,
              command.command_state,
              transition.transition_result
            FROM public.offers AS offer
            INNER JOIN public.offer_verification_attempts AS attempt
              ON attempt.offer_id = offer.id
            INNER JOIN public.offer_verification_commands AS command
              ON command.attempt_id = attempt.id
            INNER JOIN public.offer_workflow_transitions AS transition
              ON transition.attempt_id = attempt.id
            WHERE offer.id = $1
          `,
          [approvedDraft.id],
        )
      ).rows[0];
      assert.deepEqual(approvedState, {
        status: "verified",
        process_state: "completed",
        decision: "approved",
        confidence: "HIGH",
        findings: 0,
        events: 3,
        command_state: "delivered",
        transition_result: "applied",
      });
      await assert.rejects(
        () =>
          client.query(
            `
              UPDATE public.offer_verification_attempts
              SET decision = 'manual_review'
              WHERE id = $1
            `,
            [approvedWork.attemptId],
          ),
        (error: unknown) => {
          assert.equal(
            (error as { code?: string }).code,
            "55000",
          );
          return true;
        },
      );
      assert.equal(await processNextVerificationCommand(), undefined);
      assert.equal(
        await coordinateVerificationDecision(approvedWork.attemptId),
        "applied",
      );

      const revisionDraft = await createOwnedDraftOffer(owner.id, {
        offerType: "sell",
        commodityId: commodity.id,
        quantity: "0",
        unit: "bbl",
        amountPerUnit: "75.50",
        currency: "USD",
        location: "Phase 6B Revision Test",
      });
      cleanupIds.push(revisionDraft.id);
      await submitOwnedDraftOffer(owner.id, revisionDraft.id);
      const revisionWork = await processNextVerificationCommand();
      assert.equal(revisionWork?.decision, "revision_required");
      assert.equal(revisionWork?.workflowResult, "applied");
      const revisionState = (
        await client.query<{
          status: string;
          reason_code: string;
          rule_id: string;
          severity: string;
        }>(
          `
            SELECT
              offer.status::text AS status,
              finding.reason_code,
              finding.rule_id,
              finding.severity
            FROM public.offers AS offer
            INNER JOIN public.offer_verification_attempts AS attempt
              ON attempt.offer_id = offer.id
            INNER JOIN public.offer_verification_findings AS finding
              ON finding.attempt_id = attempt.id
            WHERE offer.id = $1
              AND attempt.submission_revision = 1
          `,
          [revisionDraft.id],
        )
      ).rows[0];
      assert.deepEqual(revisionState, {
        status: "draft",
        reason_code: "INVALID_QUANTITY",
        rule_id: "TECHNICAL-004",
        severity: "ERROR",
      });

      const corrected = await updateOwnedDraftOffer(
        owner.id,
        revisionDraft.id,
        { quantity: "100.00" },
      );
      assert.equal(corrected?.status, "draft");
      await submitOwnedDraftOffer(owner.id, revisionDraft.id);
      const correctedWork = await processNextVerificationCommand();
      assert.equal(correctedWork?.decision, "approved");
      const history = (
        await client.query<{
          submission_revision: number;
          decision: string;
        }>(
          `
            SELECT submission_revision, decision
            FROM public.offer_verification_attempts
            WHERE offer_id = $1
            ORDER BY submission_revision
          `,
          [revisionDraft.id],
        )
      ).rows;
      assert.deepEqual(history, [
        { submission_revision: 1, decision: "revision_required" },
        { submission_revision: 2, decision: "approved" },
      ]);

      const conflictDraft = await createOwnedDraftOffer(owner.id, {
        offerType: "sell",
        commodityId: commodity.id,
        quantity: "100.00",
        unit: "bbl",
        amountPerUnit: "75.50",
        currency: "USD",
        location: "Phase 6B Conflict Test",
      });
      cleanupIds.push(conflictDraft.id);
      await submitOwnedDraftOffer(owner.id, conflictDraft.id);
      const conflictClaim = await claimNextVerification();
      assert.equal(conflictClaim?.snapshot.offerId, conflictDraft.id);
      assert.ok(conflictClaim);
      await client.query(
        `
          UPDATE public.offers
          SET status = 'draft'::public.offer_status, updated_at = now()
          WHERE id = $1
        `,
        [conflictDraft.id],
      );
      const conflictDecision =
        await evaluateAndCompleteClaimedVerification(conflictClaim);
      assert.equal(conflictDecision, "manual_review");
      assert.equal(
        await coordinateVerificationDecision(conflictClaim.attemptId),
        "stale",
      );
      const conflictState = (
        await client.query<{
          status: string;
          decision: string;
          reason_code: string;
          rule_id: string;
          confidence: string;
          transition_result: string;
        }>(
          `
            SELECT
              offer.status::text AS status,
              attempt.decision,
              finding.reason_code,
              finding.rule_id,
              attempt.confidence,
              transition.transition_result
            FROM public.offers AS offer
            INNER JOIN public.offer_verification_attempts AS attempt
              ON attempt.offer_id = offer.id
            INNER JOIN public.offer_verification_findings AS finding
              ON finding.attempt_id = attempt.id
            INNER JOIN public.offer_workflow_transitions AS transition
              ON transition.attempt_id = attempt.id
            WHERE offer.id = $1
              AND finding.rule_id = 'SYSTEM-003'
          `,
          [conflictDraft.id],
        )
      ).rows[0];
      assert.deepEqual(conflictState, {
        status: "draft",
        decision: "manual_review",
        reason_code: "OFFER_STATE_CONFLICT",
        rule_id: "SYSTEM-003",
        confidence: "LOW",
        transition_result: "stale",
      });

      const integrityDraft = await createOwnedDraftOffer(owner.id, {
        offerType: "sell",
        commodityId: commodity.id,
        quantity: "100.00",
        unit: "bbl",
        amountPerUnit: "75.50",
        currency: "USD",
        location: "Phase 6D Integrity Test",
      });
      cleanupIds.push(integrityDraft.id);
      await submitOwnedDraftOffer(owner.id, integrityDraft.id);
      await client.query(
        "SELECT set_config('tutela.verification_maintenance', 'on', false)",
      );
      try {
        await client.query(
          `
            UPDATE public.offer_verification_attempts
            SET input_snapshot =
              jsonb_set(input_snapshot, '{quantity}', '"101.00"'::jsonb)
            WHERE offer_id = $1
          `,
          [integrityDraft.id],
        );
      } finally {
        await client.query(
          "SELECT set_config('tutela.verification_maintenance', 'off', false)",
        );
      }
      const integrityWork = await processNextVerificationCommand();
      assert.equal(integrityWork?.decision, "manual_review");
      assert.equal(integrityWork?.workflowResult, "applied");
      const integrityState = (
        await client.query<{
          status: string;
          decision: string;
          reason_code: string;
          rule_id: string;
        }>(
          `
            SELECT
              offer.status::text AS status,
              attempt.decision,
              finding.reason_code,
              finding.rule_id
            FROM public.offers AS offer
            INNER JOIN public.offer_verification_attempts AS attempt
              ON attempt.offer_id = offer.id
            INNER JOIN public.offer_verification_findings AS finding
              ON finding.attempt_id = attempt.id
            WHERE offer.id = $1
          `,
          [integrityDraft.id],
        )
      ).rows[0];
      assert.deepEqual(integrityState, {
        status: "submitted",
        decision: "manual_review",
        reason_code: "SCHEMA_INCONSISTENCY",
        rule_id: "TECHNICAL-011",
      });

      assert.deepEqual(await getPublishedMarketplaceOfferRecords(), []);
    } finally {
      for (const offerId of cleanupIds.reverse()) {
        await cleanupOffer(client, offerId).catch(() => undefined);
      }
      if ((client as unknown as { _ending?: boolean })._ending !== true) {
        await client.query("BEGIN READ ONLY").catch(() => undefined);
        await verifyRecoveryMarker(client);
        assert.equal(
          await applicationSchemaFingerprint(client),
          EXPECTED_FINGERPRINT,
        );
        assert.equal(
          await tableSnapshot(
            client,
            "users",
            "WHERE source.recovery_provenance IS NULL",
          ),
          EXPECTED_LEGACY_USER_HASH,
        );
        assert.equal(
          await tableSnapshot(client, "offers"),
          EXPECTED_LEGACY_OFFER_HASH,
        );
        for (const table of VERIFICATION_TABLES) {
          assert.equal(await count(client, table), 0);
        }
        assert.equal(await count(client, "sessions"), 0);
        await client.query("ROLLBACK").catch(() => undefined);
      }
      await client.end().catch(() => undefined);
      await pool.end().catch(() => undefined);
    }
  },
);
