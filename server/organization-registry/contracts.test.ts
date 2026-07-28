import assert from "node:assert/strict";
import test from "node:test";
import {
  ORGANIZATION_LIFECYCLES,
  REGISTRY_CONTRACT_VERSION,
  createOrganizationId,
  createOrganizationProfileRevisionId,
  createOrganizationProfileRevisionSequence,
  parseActorAuthorityReference,
  parseOrganizationProfileRevisionContract,
  parseRegistryContractVersion,
} from "./index.js";
import { mapRegistryRevisionToVerificationInput } from "../organization-verification/integration/organizationRegistryAcl.js";

function validContract(): Record<string, unknown> {
  return {
    organization_id: "org-synthetic-001",
    organization_profile_revision_id: "profile-revision-001",
    organization_profile_revision_sequence: 1,
    organization_profile_fingerprint: "opaque-fingerprint-001",
    legal_identity_projection: {
      legal_name: "Synthetic Trading Entity",
      trading_names: ["Synthetic Trade"],
      registration_jurisdiction: "synthetic-jurisdiction",
      registration_identifiers: [
        { scheme: "synthetic-register", value: "REG-001" },
      ],
      legal_form: "synthetic-legal-form",
      incorporation_date: "2025-01-02",
      registered_address: {
        country_code: "ZZ",
        locality: "Synthetic City",
        address_lines: ["Synthetic address line"],
      },
    },
    organization_type: "synthetic-organization-type",
    jurisdiction: "synthetic-jurisdiction",
    declared_activity_projection: {
      activities: [
        { code: "synthetic.activity", description: "Synthetic activity" },
      ],
    },
    approved_disclosure_projection: {
      legal_name: "Synthetic Trading Entity",
      trading_names: ["Synthetic Trade"],
      organization_type: "synthetic-organization-type",
      jurisdiction: "synthetic-jurisdiction",
    },
    organization_lifecycle: "active",
    registry_contract_version: REGISTRY_CONTRACT_VERSION,
    published_at: "2026-07-28T00:00:00.000Z",
  };
}

function expectedIdentity() {
  const organizationId = createOrganizationId("org-synthetic-001");
  const revisionId = createOrganizationProfileRevisionId(
    "profile-revision-001",
  );
  assert.equal(organizationId.ok, true);
  assert.equal(revisionId.ok, true);
  if (!organizationId.ok || !revisionId.ok) {
    throw new Error("synthetic identity construction failed");
  }
  return {
    organizationId: organizationId.value,
    organizationProfileRevisionId: revisionId.value,
    expectedRegistryContractVersion: REGISTRY_CONTRACT_VERSION,
  };
}

test("constructs one valid immutable allowlisted Profile Revision contract", () => {
  const result = parseOrganizationProfileRevisionContract(validContract());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.organizationId, "org-synthetic-001");
  assert.equal(result.value.organizationProfileRevisionSequence, 1);
  assert.equal(result.value.organizationLifecycle, "active");
  assert.deepEqual(result.value.legalIdentityProjection.tradingNames, [
    "Synthetic Trade",
  ]);
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(result.value.legalIdentityProjection), true);
  assert.equal(
    Object.isFrozen(result.value.legalIdentityProjection.tradingNames),
    true,
  );
});

test("rejects empty Organization and Profile Revision identifiers", () => {
  assert.deepEqual(createOrganizationId("  "), {
    ok: false,
    code: "organization_id_mismatch",
  });
  assert.deepEqual(createOrganizationProfileRevisionId(""), {
    ok: false,
    code: "profile_revision_id_mismatch",
  });
  for (const mutablePointer of ["current", "latest", "head"]) {
    assert.deepEqual(createOrganizationProfileRevisionId(mutablePointer), {
      ok: false,
      code: "profile_revision_id_mismatch",
    });
  }
});

test("rejects invalid revision sequences and missing fingerprints", () => {
  for (const sequence of [0, -1, 1.2, Number.NaN]) {
    assert.equal(createOrganizationProfileRevisionSequence(sequence).ok, false);
    const input = validContract();
    input.organization_profile_revision_sequence = sequence;
    const result = parseOrganizationProfileRevisionContract(input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid_revision_sequence");
  }
  const input = validContract();
  input.organization_profile_fingerprint = " ";
  const result = parseOrganizationProfileRevisionContract(input);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "missing_profile_fingerprint");
});

test("accepts only the exact Registry contract version with no fallback", () => {
  assert.equal(parseRegistryContractVersion(REGISTRY_CONTRACT_VERSION).ok, true);
  for (const version of [
    "organization_registry_profile_revision.v0",
    "organization_registry_profile_revision.v2",
    "",
    undefined,
  ]) {
    const result = parseRegistryContractVersion(version);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "unsupported_registry_contract_version");
    }
  }
});

test("rejects unknown top-level and nested authority-bearing fields", () => {
  for (const field of [
    "verified",
    "trust_status",
    "decision",
    "eligibility",
    "publish_allowed",
    "compliance_passed",
    "sanctions_clear",
    "aml_passed",
    "raw_documents",
    "passwords",
    "sessions",
    "tokens",
  ]) {
    const input = validContract();
    input[field] = true;
    const result = parseOrganizationProfileRevisionContract(input);
    assert.equal(result.ok, false, field);
    if (!result.ok) assert.equal(result.code, "unknown_contract_field", field);
  }

  const input = validContract();
  const identity = input.legal_identity_projection as Record<string, unknown>;
  identity.verified = true;
  const nested = parseOrganizationProfileRevisionContract(input);
  assert.equal(nested.ok, false);
  if (!nested.ok) assert.equal(nested.code, "unknown_contract_field");
});

test("defensively copies and freezes every accepted nested value", () => {
  const input = validContract();
  const result = parseOrganizationProfileRevisionContract(input);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const identity = input.legal_identity_projection as {
    trading_names: string[];
    registration_identifiers: Array<{ scheme: string; value: string }>;
  };
  identity.trading_names.push("Mutation");
  identity.registration_identifiers[0]!.value = "MUTATED";
  const activities = input.declared_activity_projection as {
    activities: Array<{ code: string }>;
  };
  activities.activities[0]!.code = "mutated";

  assert.deepEqual(result.value.legalIdentityProjection.tradingNames, [
    "Synthetic Trade",
  ]);
  assert.equal(
    result.value.legalIdentityProjection.registrationIdentifiers[0]!.value,
    "REG-001",
  );
  assert.equal(
    result.value.declaredActivityProjection.activities[0]!.code,
    "synthetic.activity",
  );
});

test("supports only the approved Registry Lifecycle projection vocabulary", () => {
  for (const lifecycle of ORGANIZATION_LIFECYCLES) {
    const input = validContract();
    input.organization_lifecycle = lifecycle;
    const result = parseOrganizationProfileRevisionContract(input);
    assert.equal(result.ok, true, lifecycle);
    if (result.ok) {
      assert.equal("trustStatus" in result.value, false);
      assert.equal("decision" in result.value, false);
    }
  }
  const input = validContract();
  input.organization_lifecycle = "trusted";
  const result = parseOrganizationProfileRevisionContract(input);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "malformed_lifecycle_projection");
});

test("ACL maps only the allowlisted Registry contract and preserves provenance", () => {
  const result = mapRegistryRevisionToVerificationInput(
    validContract(),
    expectedIdentity(),
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(
    result.value.sourceKind,
    "verification_input_derived_from_registry_contract",
  );
  assert.equal(
    result.value.registryContractVersion,
    REGISTRY_CONTRACT_VERSION,
  );
  assert.equal(result.value.organizationLifecycle, "active");
  assert.equal("decision" in result.value, false);
  assert.equal("trustStatus" in result.value, false);
  assert.equal("evidence" in result.value, false);
  assert.equal(Object.isFrozen(result.value), true);
});

test("ACL fails closed on Organization ID and Profile Revision mismatches", () => {
  const expected = expectedIdentity();
  const otherOrganization = createOrganizationId("org-other");
  const otherRevision = createOrganizationProfileRevisionId("revision-other");
  assert.equal(otherOrganization.ok, true);
  assert.equal(otherRevision.ok, true);
  if (!otherOrganization.ok || !otherRevision.ok) return;

  const organizationMismatch = mapRegistryRevisionToVerificationInput(
    validContract(),
    { ...expected, organizationId: otherOrganization.value },
  );
  assert.equal(organizationMismatch.ok, false);
  if (!organizationMismatch.ok) {
    assert.equal(organizationMismatch.code, "organization_id_mismatch");
  }

  const revisionMismatch = mapRegistryRevisionToVerificationInput(
    validContract(),
    {
      ...expected,
      organizationProfileRevisionId: otherRevision.value,
    },
  );
  assert.equal(revisionMismatch.ok, false);
  if (!revisionMismatch.ok) {
    assert.equal(revisionMismatch.code, "profile_revision_id_mismatch");
  }
});

test("validates an immutable authority reference without roles, tokens, or sessions", () => {
  const input = {
    actor_id: "actor-synthetic-001",
    authority_reference_id: "authority-synthetic-001",
    authority_version: "authority.v1",
    organization_scope: "org-synthetic-001",
    issued_at: "2026-07-28T00:00:00.000Z",
    delegated_scopes: ["organization.verification.submit"],
  };
  const result = parseActorAuthorityReference(input);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  input.delegated_scopes.push("mutation");
  assert.deepEqual(result.value.delegatedScopes, [
    "organization.verification.submit",
  ]);
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(result.value.delegatedScopes), true);

  const withRole = { ...input, role: "admin" };
  const invalid = parseActorAuthorityReference(withRole);
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.code, "unknown_contract_field");
});

test("legacy-shaped data and company-name or user-ID inference cannot satisfy the contract", () => {
  for (const legacy of [
    { company_name: "Legacy Company", verified: true },
    { user_id: "user-123", role: "seller", seller: true },
    { offer_owner_id: "user-123", document_present: true },
    { seed_label: "demo", ui_verified: true },
    { organization_id: "user-123", company_name: "Legacy Company" },
  ]) {
    const result = parseOrganizationProfileRevisionContract(legacy);
    assert.equal(result.ok, false);
  }

  assert.equal(
    "fromCompanyName" in
      ({ createOrganizationId } as Record<string, unknown>),
    false,
  );
  assert.equal(
    "fromUserId" in ({ createOrganizationId } as Record<string, unknown>),
    false,
  );
});
