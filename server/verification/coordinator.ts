import crypto from "node:crypto";
import type { VerificationDecision } from "../../shared/verification.js";
import { pool } from "../db.js";

function lifecycleTarget(
  decision: VerificationDecision,
): "verified" | "draft" | "submitted" {
  if (decision === "approved") return "verified";
  if (decision === "revision_required") return "draft";
  return "submitted";
}

export async function coordinateVerificationDecision(
  attemptId: string,
): Promise<"applied" | "already_applied" | "stale"> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const attempt = (
      await client.query<{
        offer_id: string;
        submission_revision: number;
        process_state: string;
        decision: VerificationDecision | null;
      }>(
        `
          SELECT
            offer_id,
            submission_revision,
            process_state,
            decision
          FROM public.offer_verification_attempts
          WHERE id = $1
          FOR UPDATE
        `,
        [attemptId],
      )
    ).rows[0];
    if (
      !attempt ||
      attempt.process_state !== "completed" ||
      attempt.decision === null
    ) {
      throw new Error("COMPLETED_VERIFICATION_ATTEMPT_REQUIRED");
    }

    const existing = (
      await client.query<{
        transition_result: "applied" | "already_applied" | "stale";
      }>(
        `
          SELECT transition_result
          FROM public.offer_workflow_transitions
          WHERE attempt_id = $1
        `,
        [attemptId],
      )
    ).rows[0];
    if (existing) {
      await client.query("COMMIT");
      return existing.transition_result;
    }

    const offer = (
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
    const target = lifecycleTarget(attempt.decision);
    let transitionResult: "applied" | "already_applied" | "stale";

    if (
      offer?.revision === attempt.submission_revision &&
      offer.status === "submitted"
    ) {
      if (target !== "submitted") {
        const updated = await client.query(
          `
            UPDATE public.offers
            SET
              status = $2::public.offer_status,
              updated_at = now()
            WHERE id = $1
              AND status::text = 'submitted'
          `,
          [attempt.offer_id, target],
        );
        if (updated.rowCount !== 1) {
          throw new Error("WORKFLOW_TRANSITION_CONFLICT");
        }
      }
      transitionResult = "applied";
    } else if (
      offer?.revision === attempt.submission_revision &&
      offer.status === target
    ) {
      transitionResult = "already_applied";
    } else {
      transitionResult = "stale";
    }

    await client.query(
      `
        INSERT INTO public.offer_workflow_transitions (
          id,
          operation_key,
          attempt_id,
          offer_id,
          submission_revision,
          consumed_decision,
          from_status,
          to_status,
          transition_result
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'submitted', $7, $8)
      `,
      [
        crypto.randomUUID(),
        `verification-workflow:${attemptId}`,
        attemptId,
        attempt.offer_id,
        attempt.submission_revision,
        attempt.decision,
        target,
        transitionResult,
      ],
    );
    await client.query("COMMIT");
    return transitionResult;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
