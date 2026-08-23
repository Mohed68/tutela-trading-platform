import type { QueryResultRow } from "pg";
import { createHash } from "node:crypto";

import { pool } from "../db.js";
import {
  deriveAuthoritativeOfferVerificationEligibility,
  type OfferVerificationEligibilityReadPort,
  type OfferVerificationEligibilityResolution,
} from "./eligibilityReadModel.js";

interface CurrentVerificationRow extends QueryResultRow {
  offer_id: string;
  submission_revision: number;
  attempt_id: string;
  process_state: "queued" | "running" | "completed";
  decision: "approved" | "revision_required" | "manual_review" | null;
  completed_at: Date | string | null;
  engine_version: string;
  technical_policy_version: string;
  commercial_policy_version: string;
  input_fingerprint: string;
  binding_id:string;evidence_id:string;evidence_version:string;evidence_assurance_level:"documentary"|"source_confirmed"|"independently_inspected";evidence_fingerprint:string;persisted_evidence_fingerprint:string;bound_at:Date|string;binding_fingerprint:string;
}

function isoTimestamp(value: Date | string | null): string | null {
  if (value === null) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function resolveCurrentOfferVerificationEligibility(
  offerId: string,
): Promise<OfferVerificationEligibilityResolution> {
  if (typeof offerId !== "string" || offerId.trim().length === 0) {
    return Object.freeze({ status: "integrity_failure" });
  }
  try {
    const result = await pool.query<CurrentVerificationRow>(
      `
      WITH current_submission AS (
        SELECT max(revision)::int AS revision
        FROM public.offer_submission_revisions
        WHERE offer_id = $1
      )
      SELECT
        attempt.offer_id,
        attempt.submission_revision,
        attempt.id AS attempt_id,
        attempt.process_state,
        attempt.decision,
        attempt.completed_at,
        attempt.engine_version,
        attempt.technical_policy_version,
        attempt.commercial_policy_version,
        attempt.input_fingerprint,binding.binding_id,binding.evidence_id,
        binding.evidence_version,binding.evidence_assurance_level,
        binding.evidence_fingerprint,evidence.evidence_fingerprint AS persisted_evidence_fingerprint,
        binding.bound_at,binding.binding_fingerprint
      FROM public.offer_verification_attempts AS attempt
      INNER JOIN current_submission
        ON current_submission.revision = attempt.submission_revision
      INNER JOIN public.offer_verification_evidence_bindings binding ON binding.attempt_id=attempt.id AND binding.offer_id=attempt.offer_id AND binding.submission_revision=attempt.submission_revision
      INNER JOIN public.platform_submitted_evidence evidence ON evidence.evidence_id=binding.evidence_id AND evidence.evidence_version=binding.evidence_version AND evidence.subject_kind='offer' AND evidence.subject_id=attempt.offer_id
      WHERE attempt.offer_id = $1
      ORDER BY attempt.attempt_sequence DESC, attempt.created_at DESC
      LIMIT 1
    `,
      [offerId],
    );
    const row = result.rows[0];
    if (!row) return Object.freeze({ status: "not_found" });
    const boundAt=isoTimestamp(row.bound_at),expected=boundAt?`sha256:${createHash("sha256").update(JSON.stringify({scope:"offer-verification-evidence-binding/v1",bindingId:row.binding_id,attemptId:row.attempt_id,offerId:row.offer_id,submissionRevision:row.submission_revision,evidenceId:row.evidence_id,evidenceVersion:row.evidence_version,evidenceAssuranceLevel:row.evidence_assurance_level,evidenceFingerprint:row.evidence_fingerprint,boundAt})).digest("hex")}`:null;
    if(!expected||expected!==row.binding_fingerprint||row.evidence_fingerprint!==row.persisted_evidence_fingerprint)return Object.freeze({status:"integrity_failure"});
    const projection = deriveAuthoritativeOfferVerificationEligibility({
      offerId: row.offer_id,
      submissionRevision: row.submission_revision,
      attemptId: row.attempt_id,
      processState: row.process_state,
      decision: row.decision,
      completedAt: isoTimestamp(row.completed_at),
      engineVersion: row.engine_version,
      technicalPolicyVersion: row.technical_policy_version,
      commercialPolicyVersion: row.commercial_policy_version,
      inputFingerprint: row.input_fingerprint,
      evidenceSource: "platform_submitted",
      evidenceAssuranceLevel: row.evidence_assurance_level,
    });
    return projection
      ? Object.freeze({ status: "resolved", projection })
      : Object.freeze({ status: "integrity_failure" });
  } catch {
    return Object.freeze({ status: "unavailable" });
  }
}

export const offerVerificationEligibilityReadRepository: OfferVerificationEligibilityReadPort =
  Object.freeze({
    resolveCurrentOfferVerificationEligibility,
  });
