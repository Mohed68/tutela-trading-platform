import type { ReadonlyPostgresPort } from "../infrastructure/readonlyPostgres.js";
import {
  parseOrganizationProfileRevisionContract,
} from "./contracts.js";
import type {
  ExactProfileRevisionQuery,
  OrganizationRegistryProfileRevisionPort,
  ProfileRevisionResolution,
} from "./ports.js";

const SELECT_EXACT_PROFILE_REVISION = `/* organization-registry:resolve-exact-profile-revision */
SELECT contract_payload
FROM public.organization_registry_profile_revisions
WHERE organization_id = $1
  AND organization_profile_revision_id = $2
  AND registry_contract_version = $3`;

function integrityFailure(): ProfileRevisionResolution {
  return Object.freeze({
    status: "integrity_failure",
    code: "profile_revision_integrity_failure",
  });
}

export function createPostgresOrganizationRegistryProfileRevisionAdapter(
  database: ReadonlyPostgresPort,
): OrganizationRegistryProfileRevisionPort {
  return Object.freeze({
    async resolveExactProfileRevision(query: ExactProfileRevisionQuery) {
      const result = await database.query(SELECT_EXACT_PROFILE_REVISION, [
        query.organizationId,
        query.organizationProfileRevisionId,
        query.expectedRegistryContractVersion,
      ]);
      if (result.rowCount === 0) {
        return Object.freeze({
          status: "not_found" as const,
          code: "profile_revision_not_found" as const,
        });
      }
      if (result.rowCount !== 1 || result.rows.length !== 1) {
        return integrityFailure();
      }
      const parsed = parseOrganizationProfileRevisionContract(
        result.rows[0].contract_payload,
      );
      if (!parsed.ok) return integrityFailure();
      if (
        parsed.value.organizationId !== query.organizationId ||
        parsed.value.organizationProfileRevisionId !==
          query.organizationProfileRevisionId ||
        parsed.value.registryContractVersion !== query.expectedRegistryContractVersion
      ) {
        return integrityFailure();
      }
      return Object.freeze({
        status: "resolved" as const,
        contract: parsed.value,
      });
    },
  });
}
