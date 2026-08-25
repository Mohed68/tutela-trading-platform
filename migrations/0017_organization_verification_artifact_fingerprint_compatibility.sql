-- Phase 8G staging compatibility: domain artifacts use both the canonical
-- 64-character SHA-256 representation and the explicitly prefixed form.
-- This changes validation only; it does not rewrite durable evidence.
ALTER TABLE public.organization_verification_durable_evidence
  DROP CONSTRAINT organization_verification_evidence_artifact_fingerprint_check;

ALTER TABLE public.organization_verification_durable_evidence
  ADD CONSTRAINT organization_verification_evidence_artifact_fingerprint_check
  CHECK (artifact_fingerprint ~ '^(sha256:)?[0-9a-f]{64}$');
