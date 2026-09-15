import { createHash } from "node:crypto";
import { ORGANIZATION_VERIFICATION_POLICY_V2 } from "../trade-trust-policy/organizationVerificationPolicy.js";
import type { ProviderEvidenceEnvelope } from "../evidence-provider/index.js";

export interface VreQuery {
  query(sql: string, values?: any[]): Promise<{ rows: any[]; rowCount?: number | null }>;
}
export interface IndependentReview {
  id: string; organization_id: string; profile_revision_id: string; profile_fingerprint: string;
  evidence_id: string; evidence_version: string; evidence_digest: string; policy_version: string;
  method: string; outcome: string; reviewer_principal_id: string; created_at: Date | string;
}
export const contentDigest = (evidence: ProviderEvidenceEnvelope) =>
  createHash("sha256").update(evidence.evidenceFingerprint).digest("hex");

export async function loadV2Activation(db: VreQuery): Promise<string> {
  const result = await db.query("SELECT activated_at FROM public.vre_policy_activations WHERE policy_version=$1", [ORGANIZATION_VERIFICATION_POLICY_V2]);
  if (result.rows.length !== 1) throw new Error("VERIFICATION_POLICY_ACTIVATION_REQUIRED");
  return new Date(result.rows[0].activated_at).toISOString();
}

export async function loadBoundReview(db: VreQuery, organizationId: string, profileRevisionId: string,
  profileFingerprint: string, evidence: ProviderEvidenceEnvelope): Promise<IndependentReview | null> {
  const result = await db.query(`SELECT id,organization_id,profile_revision_id,profile_fingerprint,evidence_id,
    evidence_version,evidence_digest,policy_version,method,outcome,reviewer_principal_id,created_at
    FROM public.vre_verification_reviews WHERE organization_id=$1 AND profile_revision_id=$2
    AND policy_version=$3 ORDER BY created_at DESC,id DESC LIMIT 1`,
  [organizationId,profileRevisionId,ORGANIZATION_VERIFICATION_POLICY_V2]);
  const review = result.rows[0] as IndependentReview | undefined;
  if (!review || review.profile_fingerprint !== profileFingerprint || review.evidence_id !== evidence.evidenceId ||
    review.evidence_version !== evidence.evidenceVersion || review.evidence_digest !== contentDigest(evidence)) return null;
  return review;
}
