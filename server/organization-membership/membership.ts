import { createHash } from "node:crypto";

import type { OrganizationId } from "../organization-registry/index.js";

export const ORGANIZATION_MEMBERSHIP_ROLES = ["owner", "member"] as const;
export const ORGANIZATION_MEMBERSHIP_STATUSES = ["active", "inactive"] as const;
export const ORGANIZATION_MEMBERSHIP_CONTRACT_VERSION =
  "organization-membership/v1" as const;

export type OrganizationMembershipRole =
  (typeof ORGANIZATION_MEMBERSHIP_ROLES)[number];
export type OrganizationMembershipStatus =
  (typeof ORGANIZATION_MEMBERSHIP_STATUSES)[number];
export type OrganizationMembershipContractVersion =
  typeof ORGANIZATION_MEMBERSHIP_CONTRACT_VERSION;

export interface CreateOrganizationMembershipInput {
  readonly membershipId: string;
  readonly userId: string;
  readonly organizationId: OrganizationId;
  readonly role: OrganizationMembershipRole;
  readonly status: OrganizationMembershipStatus;
  readonly membershipVersion: number;
  readonly effectiveFrom: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly provenanceReference: string;
  readonly integrityReference: string;
}

export interface OrganizationMembership
  extends Readonly<CreateOrganizationMembershipInput> {
  readonly contractVersion: OrganizationMembershipContractVersion;
  readonly membershipFingerprint: string;
}

export type OrganizationMembershipCreationResult =
  | Readonly<{ ok: true; value: OrganizationMembership }>
  | Readonly<{
      ok: false;
      code:
        | "invalid_membership_identity"
        | "invalid_membership_role"
        | "invalid_membership_status"
        | "invalid_membership_version"
        | "invalid_membership_timestamp"
        | "unknown_membership_field";
    }>;

const authenticMemberships = new WeakSet<object>();
const INPUT_FIELDS = new Set([
  "membershipId",
  "userId",
  "organizationId",
  "role",
  "status",
  "membershipVersion",
  "effectiveFrom",
  "createdAt",
  "updatedAt",
  "provenanceReference",
  "integrityReference",
]);

function identity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["latest", "current", "head", "default"].includes(
      value.trim().toLowerCase(),
    )
  );
}

function timestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function fingerprint(input: CreateOrganizationMembershipInput): string {
  return `sha256:${createHash("sha256")
    .update(
      JSON.stringify({
        scope: ORGANIZATION_MEMBERSHIP_CONTRACT_VERSION,
        membershipId: input.membershipId,
        userId: input.userId,
        organizationId: input.organizationId,
        role: input.role,
        status: input.status,
        membershipVersion: input.membershipVersion,
        effectiveFrom: input.effectiveFrom,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
        provenanceReference: input.provenanceReference,
        integrityReference: input.integrityReference,
      }),
    )
    .digest("hex")}`;
}

export function createOrganizationMembership(
  input: CreateOrganizationMembershipInput,
): OrganizationMembershipCreationResult {
  if (
    typeof input !== "object" ||
    input === null ||
    Object.keys(input).some((key) => !INPUT_FIELDS.has(key))
  ) {
    return Object.freeze({ ok: false, code: "unknown_membership_field" });
  }
  if (
    !identity(input.membershipId) ||
    !identity(input.userId) ||
    !identity(input.organizationId) ||
    !identity(input.provenanceReference) ||
    !identity(input.integrityReference)
  ) {
    return Object.freeze({ ok: false, code: "invalid_membership_identity" });
  }
  if (!ORGANIZATION_MEMBERSHIP_ROLES.includes(input.role)) {
    return Object.freeze({ ok: false, code: "invalid_membership_role" });
  }
  if (!ORGANIZATION_MEMBERSHIP_STATUSES.includes(input.status)) {
    return Object.freeze({ ok: false, code: "invalid_membership_status" });
  }
  if (!Number.isSafeInteger(input.membershipVersion) || input.membershipVersion < 1) {
    return Object.freeze({ ok: false, code: "invalid_membership_version" });
  }
  if (
    !timestamp(input.effectiveFrom) ||
    !timestamp(input.createdAt) ||
    !timestamp(input.updatedAt) ||
    Date.parse(input.updatedAt) < Date.parse(input.createdAt)
  ) {
    return Object.freeze({ ok: false, code: "invalid_membership_timestamp" });
  }

  const membership: OrganizationMembership = Object.freeze({
    membershipId: input.membershipId,
    userId: input.userId,
    organizationId: input.organizationId,
    role: input.role,
    status: input.status,
    membershipVersion: input.membershipVersion,
    effectiveFrom: input.effectiveFrom,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    provenanceReference: input.provenanceReference,
    integrityReference: input.integrityReference,
    contractVersion: ORGANIZATION_MEMBERSHIP_CONTRACT_VERSION,
    membershipFingerprint: fingerprint(input),
  });
  authenticMemberships.add(membership);
  return Object.freeze({ ok: true, value: membership });
}

export function isOrganizationMembership(
  value: unknown,
): value is OrganizationMembership {
  return (
    typeof value === "object" &&
    value !== null &&
    authenticMemberships.has(value) &&
    Object.isFrozen(value)
  );
}
