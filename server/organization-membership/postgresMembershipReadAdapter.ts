import type { ReadonlyPostgresPort, ReadonlyPostgresRow } from "../infrastructure/readonlyPostgres.js";
import { createOrganizationId } from "../organization-registry/index.js";
import {
  createOrganizationMembership,
} from "./membership.js";
import type {
  ExactOrganizationMembershipQuery,
  OrganizationMembershipReadPort,
  OrganizationMembershipResolution,
} from "./ports.js";

const SELECT_EXACT_MEMBERSHIP = `/* organization-membership:resolve-exact */
SELECT membership_id, user_id, organization_id, role, status,
       membership_version, effective_from, created_at, updated_at,
       provenance_reference, integrity_reference, membership_fingerprint
FROM public.organization_memberships
WHERE membership_id = $1 AND user_id = $2 AND organization_id = $3`;

function text(row: ReadonlyPostgresRow, field: string): string | undefined {
  const value = row[field];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function integer(row: ReadonlyPostgresRow, field: string): number | undefined {
  const value = row[field];
  return typeof value === "number" && Number.isSafeInteger(value)
    ? value
    : undefined;
}

function timestamp(row: ReadonlyPostgresRow, field: string): string | undefined {
  const value = row[field];
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : undefined;
}

function integrityFailure(): OrganizationMembershipResolution {
  return Object.freeze({ status: "integrity_failure" });
}

export function createPostgresOrganizationMembershipReadAdapter(
  database: ReadonlyPostgresPort,
): OrganizationMembershipReadPort {
  return Object.freeze({
    async resolveExactMembership(query: ExactOrganizationMembershipQuery) {
      const result = await database.query(SELECT_EXACT_MEMBERSHIP, [
        query.membershipId,
        query.userId,
        query.organizationId,
      ]);
      if (result.rowCount === 0) {
        return Object.freeze({ status: "not_found" as const });
      }
      if (result.rowCount !== 1 || result.rows.length !== 1) {
        return integrityFailure();
      }
      const row = result.rows[0];
      const organizationId = createOrganizationId(text(row, "organization_id"));
      const membershipVersion = integer(row, "membership_version");
      const effectiveFrom = timestamp(row, "effective_from");
      const createdAt = timestamp(row, "created_at");
      const updatedAt = timestamp(row, "updated_at");
      const role = text(row, "role");
      const status = text(row, "status");
      if (
        !organizationId.ok ||
        membershipVersion === undefined ||
        effectiveFrom === undefined ||
        createdAt === undefined ||
        updatedAt === undefined ||
        (role !== "owner" && role !== "member") ||
        (status !== "active" && status !== "inactive")
      ) {
        return integrityFailure();
      }
      const membership = createOrganizationMembership({
        membershipId: text(row, "membership_id") ?? "",
        userId: text(row, "user_id") ?? "",
        organizationId: organizationId.value,
        role,
        status,
        membershipVersion,
        effectiveFrom,
        createdAt,
        updatedAt,
        provenanceReference: text(row, "provenance_reference") ?? "",
        integrityReference: text(row, "integrity_reference") ?? "",
      });
      if (
        !membership.ok ||
        membership.value.membershipFingerprint !==
          text(row, "membership_fingerprint") ||
        membership.value.membershipId !== query.membershipId ||
        membership.value.userId !== query.userId ||
        membership.value.organizationId !== query.organizationId
      ) {
        return integrityFailure();
      }
      return Object.freeze({
        status: "resolved" as const,
        membership: membership.value,
      });
    },
  });
}
