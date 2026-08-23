import assert from "node:assert/strict";
import test from "node:test";

import {
  createEvidenceCollectionRequest,
  createLocalPlatformEvidenceProvider,
} from "../evidence-provider/index.js";
import { createMinimumTradeTrustProductionWiring } from "./productionWiring.js";

test("production wiring collects authentic platform evidence without an external provider", async () => {
  const provider = createLocalPlatformEvidenceProvider({
    async resolveSubmittedEvidence(input) {
      return {
        evidenceId: "organization-document-1",
        evidenceVersion: "document-version-1",
        subjectId: input.subjectId,
        subjectVersion: input.subjectVersion,
        assertions: [
          { assertionCode: "evidence_category", value: "organization_existence" },
          { assertionCode: "document_type", value: "business_registration" },
          { assertionCode: "registration_identifier", value: "license:123" },
        ],
        submittedAt: "2026-08-23T09:00:00.000Z",
        provenanceReference: "platform-upload-1",
        integrityReference: "platform-upload-integrity-1",
      };
    },
  });
  const request = createEvidenceCollectionRequest({
    requestId: "organization-evidence-request-1",
    providerKind: "platform_submitted",
    subject: {
      subjectKind: "organization",
      subjectId: "organization-1",
      subjectVersion: "profile-version-1",
    },
    requestedAt: "2026-08-23T10:00:00.000Z",
  });
  assert.ok(request);
  const wiring = createMinimumTradeTrustProductionWiring(provider);
  const result = await wiring.collectOrganizationEvidence({
    request,
    category: "organization_existence",
    revisionEvidenceReferenceId: "revision-evidence-1",
    correlationReference: "correlation-1",
  });
  assert.equal(result.ok, true);
  assert.equal(wiring.organizationVerificationPolicy.policySet.status, "active");
});

test("production wiring fails closed when platform evidence is unavailable", async () => {
  const request = createEvidenceCollectionRequest({
    requestId: "missing-evidence-request-1",
    providerKind: "platform_submitted",
    subject: {
      subjectKind: "organization",
      subjectId: "organization-1",
      subjectVersion: "profile-version-1",
    },
    requestedAt: "2026-08-23T10:00:00.000Z",
  });
  assert.ok(request);
  const wiring = createMinimumTradeTrustProductionWiring(
    createLocalPlatformEvidenceProvider({
      async resolveSubmittedEvidence() {
        return null;
      },
    }),
  );
  assert.deepEqual(
    await wiring.collectOrganizationEvidence({
      request,
      category: "organization_existence",
      revisionEvidenceReferenceId: "revision-evidence-1",
      correlationReference: "correlation-1",
    }),
    { ok: false, code: "evidence_unavailable" },
  );
});
