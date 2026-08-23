import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { ReadonlyPostgresPort, ReadonlyPostgresRow } from "../infrastructure/readonlyPostgres.js";
import { buildPublishedMarketplaceOfferRecords, type PublishedOfferRow } from "../marketplace/publicMarketplace.js";
import { createOrganizationMembership } from "../organization-membership/index.js";
import {
  REGISTRY_CONTRACT_VERSION,
  createOrganizationId,
} from "../organization-registry/index.js";
import {
  createOrganizationVerificationEvidenceStream,
  type OrganizationVerificationEvidenceStream,
} from "../organization-verification/application/persistence-contract/index.js";
import { buildEvidenceChain } from "../organization-verification/infrastructure/persistence/in-memory/persistenceAdapterConformance.test.js";
import { deriveAuthoritativeOfferVerificationEligibility } from "../verification/eligibilityReadModel.js";
import {
  createPostgresMarketplaceOrganizationParticipationEligibilityAdapter,
  fingerprintOrganizationParticipationRuntimeBinding,
} from "./index.js";

const CLOCK = Object.freeze({ now: () => "2026-09-08T00:00:00.000Z" });
const PROFILE_REVISION_ID = "runtime-profile-revision-1";
const MEMBERSHIP_ID = "runtime-membership-1";
const USER_ID = "runtime-user-1";

function must<T>(
  result: Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; code: string }>,
): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

function evidenceStream(entryCount?: number): OrganizationVerificationEvidenceStream {
  const chain = buildEvidenceChain();
  return must(
    createOrganizationVerificationEvidenceStream({
      streamIdentity: chain.streamIdentity,
      entries:
        entryCount === undefined
          ? chain.entries
          : chain.entries.slice(0, entryCount),
    }),
  );
}

function profilePayload(organizationId: string) {
  return {
    organization_id: organizationId,
    organization_profile_revision_id: PROFILE_REVISION_ID,
    organization_profile_revision_sequence: 1,
    organization_profile_fingerprint:
      "sha256:runtime-organization-profile-fingerprint",
    legal_identity_projection: {
      legal_name: "Runtime Test Organization",
      trading_names: [],
      registration_jurisdiction: "US",
      registration_identifiers: [{ scheme: "test", value: "runtime-1" }],
    },
    organization_type: "company",
    jurisdiction: "US",
    declared_activity_projection: { activities: [] },
    organization_lifecycle: "active",
    registry_contract_version: REGISTRY_CONTRACT_VERSION,
    published_at: "2026-09-01T00:00:00.000Z",
  };
}

function membershipRow(
  organizationId: string,
  status: "active" | "inactive" = "active",
): ReadonlyPostgresRow {
  const membership = must(
    createOrganizationMembership({
      membershipId: MEMBERSHIP_ID,
      userId: USER_ID,
      organizationId: must(createOrganizationId(organizationId)),
      role: "owner",
      status,
      membershipVersion: status === "active" ? 1 : 2,
      effectiveFrom: "2026-09-01T00:00:00.000Z",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt:
        status === "active"
          ? "2026-09-01T00:00:00.000Z"
          : "2026-09-02T00:00:00.000Z",
      provenanceReference: "runtime-membership-provenance",
      integrityReference: "runtime-membership-integrity",
    }),
  );
  return Object.freeze({
    membership_id: membership.membershipId,
    user_id: membership.userId,
    organization_id: membership.organizationId,
    role: membership.role,
    status: membership.status,
    membership_version: membership.membershipVersion,
    effective_from: membership.effectiveFrom,
    created_at: membership.createdAt,
    updated_at: membership.updatedAt,
    provenance_reference: membership.provenanceReference,
    integrity_reference: membership.integrityReference,
    membership_fingerprint: membership.membershipFingerprint,
    legacy_verified: true,
    legacy_kyb_status: "verified",
  });
}

function database(
  stream: OrganizationVerificationEvidenceStream,
  membershipMode: "active" | "inactive" | "invalid" = "active",
): ReadonlyPostgresPort {
  const organizationId = stream.streamIdentity.organizationId;
  const bindingInput = {
    bindingId: "runtime-binding-1",
    organizationId,
    userId: USER_ID,
    membershipId: MEMBERSHIP_ID,
    organizationProfileRevisionId: PROFILE_REVISION_ID,
    verificationStreamIdentityFingerprint:
      stream.streamIdentity.streamIdentityFingerprint,
    bindingVersion: 1,
    integrityReference: "runtime-binding-integrity",
  };
  const bindingRow = Object.freeze({
    binding_id: bindingInput.bindingId,
    organization_id: organizationId,
    user_id: USER_ID,
    membership_id: MEMBERSHIP_ID,
    organization_profile_revision_id: PROFILE_REVISION_ID,
    binding_version: 1,
    integrity_reference: bindingInput.integrityReference,
    binding_fingerprint:
      fingerprintOrganizationParticipationRuntimeBinding(bindingInput),
    workflow_execution_id: stream.streamIdentity.workflowExecutionId,
    record_id: stream.streamIdentity.recordId,
    revision_id: stream.streamIdentity.revisionId,
    attempt_id: stream.streamIdentity.attemptId,
    stream_identity_fingerprint:
      stream.streamIdentity.streamIdentityFingerprint,
  });
  return Object.freeze({
    async query(statement: string) {
      let rows: readonly ReadonlyPostgresRow[] = [];
      if (statement.includes("organization-participation:resolve-runtime-binding")) {
        rows = [bindingRow];
      } else if (statement.includes("organization-membership:resolve-exact")) {
        const row = membershipRow(
          organizationId,
          membershipMode === "inactive" ? "inactive" : "active",
        );
        rows = membershipMode === "invalid"
          ? [Object.freeze({ ...row, membership_fingerprint: `sha256:${"0".repeat(64)}` })]
          : [row];
      } else if (statement.includes("organization-registry:resolve-exact-profile-revision")) {
        rows = [Object.freeze({ contract_payload: profilePayload(organizationId) })];
      }
      return Object.freeze({ rowCount: rows.length, rows });
    },
  });
}

function runtime(
  stream: OrganizationVerificationEvidenceStream,
  membershipMode: "active" | "inactive" | "invalid" = "active",
) {
  return createPostgresMarketplaceOrganizationParticipationEligibilityAdapter({
    database: database(stream, membershipMode),
    evidenceStream: Object.freeze({
      async loadOrganizationVerificationEvidenceStream() {
        return Object.freeze({ status: "found" as const, stream });
      },
    }),
    clock: CLOCK,
  });
}

function verifiedOfferRow(organizationId: string): PublishedOfferRow {
  return {
    id: "runtime-offer-1",
    user_id: USER_ID,
    seller_organization_id: organizationId,
    offer_type: "sell",
    quantity: "10.00",
    unit: "MT",
    price_per_unit: "100.00",
    currency: "USD",
    location: "Runtime test location",
    status: "verified",
    valid_until: null,
    minimum_quantity: null,
    delivery_terms: null,
    payment_terms: null,
    created_at: null,
    updated_at: null,
    commodity_id: "runtime-commodity",
    commodity_name: "Runtime commodity",
    commodity_category: "agricultural",
  };
}

test("authoritative Registry, Membership, Replay, and Trust produce eligibility", async () => {
  const stream = evidenceStream();
  const result = await runtime(stream).resolveCurrentOrganizationParticipationEligibility({
    organizationId: stream.streamIdentity.organizationId,
    userId: USER_ID,
  });
  assert.equal(result.status, "resolved");
  if (result.status !== "resolved") return;
  assert.equal(result.result.outcome, "eligible");
  assert.equal(result.result.membershipReference?.membershipStatus, "active");
  assert.equal(result.result.verificationReference?.source, "organization_verification_replay");
  assert.equal(result.result.verificationReference?.trustStatus, "trusted");
});

test("inactive authoritative Membership remains ineligible despite legacy flags", async () => {
  const stream = evidenceStream();
  const result = await runtime(stream, "inactive").resolveCurrentOrganizationParticipationEligibility({
    organizationId: stream.streamIdentity.organizationId,
    userId: USER_ID,
  });
  assert.equal(result.status, "resolved");
  if (result.status !== "resolved") return;
  assert.equal(result.result.outcome, "ineligible");
  assert.deepEqual(result.result.reasonCodes, ["membership_inactive"]);
});

test("invalid Membership integrity remains ineligible", async () => {
  const stream = evidenceStream();
  const result = await runtime(stream, "invalid").resolveCurrentOrganizationParticipationEligibility({
    organizationId: stream.streamIdentity.organizationId,
    userId: USER_ID,
  });
  assert.equal(result.status, "resolved");
  if (result.status !== "resolved") return;
  assert.equal(result.result.outcome, "ineligible");
  assert.deepEqual(result.result.reasonCodes, ["membership_integrity_failure"]);
});

test("incomplete Replay cannot manufacture authoritative Trust", async () => {
  const stream = evidenceStream(1);
  const result = await runtime(stream).resolveCurrentOrganizationParticipationEligibility({
    organizationId: stream.streamIdentity.organizationId,
    userId: USER_ID,
  });
  assert.equal(result.status, "resolved");
  if (result.status !== "resolved") return;
  assert.equal(result.result.outcome, "ineligible");
  assert.ok(
    result.result.reasonCodes.includes("organization_verification_incomplete") ||
      result.result.reasonCodes.includes("organization_verification_unavailable"),
  );
});

test("Marketplace publishes when every authoritative gate passes", async () => {
  const stream = evidenceStream();
  const offer = verifiedOfferRow(stream.streamIdentity.organizationId);
  const projection = deriveAuthoritativeOfferVerificationEligibility({
    offerId: offer.id,
    submissionRevision: 1,
    attemptId: "runtime-offer-attempt-1",
    processState: "completed",
    decision: "approved",
    completedAt: CLOCK.now(),
    engineVersion: "verification-engine/v1",
    technicalPolicyVersion: "technical/v1",
    commercialPolicyVersion: "commercial/v1",
    inputFingerprint: "d".repeat(64),
  });
  assert.ok(projection);
  const records = await buildPublishedMarketplaceOfferRecords([offer], {
    organizationParticipationEligibility: runtime(stream),
    offerVerificationEligibility: Object.freeze({
      async resolveCurrentOfferVerificationEligibility() {
        return Object.freeze({ status: "resolved" as const, projection });
      },
    }),
  });
  assert.equal(records.length, 1);
  assert.equal(records[0].offer.id, offer.id);
});

test("runtime persistence is additive and never infers authority from legacy flags", () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const migration = fs.readFileSync(
    path.join(root, "migrations/0013_organization_participation_runtime.sql"),
    "utf8",
  );
  const sources = [
    "server/organization-membership/postgresMembershipReadAdapter.ts",
    "server/organization-registry/postgresProfileRevisionReadAdapter.ts",
    "server/organization-participation-eligibility/postgresRuntime.ts",
  ]
    .map((file) => fs.readFileSync(path.join(root, file), "utf8"))
    .join("\n");
  assert.match(migration, /CREATE TABLE public\.organization_memberships/);
  assert.match(
    migration,
    /CREATE TABLE public\.organization_registry_profile_revisions/,
  );
  assert.match(
    migration,
    /CREATE TABLE public\.organization_participation_runtime_bindings/,
  );
  assert.match(
    migration,
    /REFERENCES public\.organization_verification_persistence_streams/,
  );
  assert.equal(/users\.verified|kyb_status|seller_org_verified/.test(sources), false);
  assert.equal(/partner_relations/.test(sources), false);
});
