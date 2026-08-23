import assert from "node:assert/strict";
import test from "node:test";

import { createOrganizationId } from "../organization-registry/index.js";
import {
  createOrganizationMembership,
  isOrganizationMembership,
} from "./index.js";

function organizationId(value = "membership-org-1") {
  const result = createOrganizationId(value);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

function membershipInput(overrides: Record<string, unknown> = {}) {
  return {
    membershipId: "membership-1",
    userId: "user-1",
    organizationId: organizationId(),
    role: "owner" as const,
    status: "active" as const,
    membershipVersion: 1,
    effectiveFrom: "2026-09-01T00:00:00.000Z",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    provenanceReference: "membership-provenance-1",
    integrityReference: "membership-integrity-1",
    ...overrides,
  };
}

test("creates a minimal authentic active Organization Membership", () => {
  const result = createOrganizationMembership(membershipInput());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(isOrganizationMembership(result.value), true);
  assert.equal(result.value.role, "owner");
  assert.equal(result.value.status, "active");
  assert.match(result.value.membershipFingerprint, /^sha256:[0-9a-f]{64}$/);
  assert.equal(Object.isFrozen(result.value), true);
});

test("keeps organization scope explicit and distinct from the user identity", () => {
  const result = createOrganizationMembership(
    membershipInput({ organizationId: organizationId("membership-org-2") }),
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.notEqual(result.value.userId, result.value.organizationId);
  assert.equal(result.value.organizationId, "membership-org-2");
});

test("represents inactive membership without granting implied authority", () => {
  const result = createOrganizationMembership(
    membershipInput({ status: "inactive", role: "member" }),
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.status, "inactive");
  assert.equal(result.value.role, "member");
});

test("rejects unsupported roles, statuses, versions, and timestamps", () => {
  assert.equal(
    createOrganizationMembership(membershipInput({ role: "trader" }) as never)
      .ok,
    false,
  );
  assert.equal(
    createOrganizationMembership(membershipInput({ status: "pending" }) as never)
      .ok,
    false,
  );
  assert.equal(
    createOrganizationMembership(membershipInput({ membershipVersion: 0 }) as never)
      .ok,
    false,
  );
  assert.equal(
    createOrganizationMembership(membershipInput({ updatedAt: "invalid" }) as never)
      .ok,
    false,
  );
});

test("rejects structural impersonation and object-spread copies", () => {
  const result = createOrganizationMembership(membershipInput());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(isOrganizationMembership({ ...result.value }), false);
  assert.equal(
    isOrganizationMembership(Object.freeze({ ...result.value })),
    false,
  );
  assert.equal(isOrganizationMembership(JSON.parse(JSON.stringify(result.value))), false);
});

test("membership creation is deterministic and contains no hidden clock", () => {
  const first = createOrganizationMembership(membershipInput());
  const second = createOrganizationMembership(membershipInput());
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) return;
  assert.equal(
    first.value.membershipFingerprint,
    second.value.membershipFingerprint,
  );
  assert.notEqual(first.value, second.value);
});
