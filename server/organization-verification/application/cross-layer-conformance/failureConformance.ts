import {
  ORGANIZATION_VERIFICATION_PERSISTENCE_FAILURE_MAPPING,
  ORGANIZATION_VERIFICATION_REPLAY_FAILURE_MAPPING,
  ORGANIZATION_VERIFICATION_WORKFLOW_FAILURE_STAGE_MAPPING,
  type OrganizationVerificationApplicationFailureCode,
} from "../application-service-contract/index.js";

export type OrganizationVerificationFailureOriginLayer =
  | "persistence"
  | "replay"
  | "workflow_runtime";

export interface OrganizationVerificationFailureLineageEntry {
  readonly originLayer: OrganizationVerificationFailureOriginLayer;
  readonly lowerLayerFailure: string;
  readonly applicationFailure: OrganizationVerificationApplicationFailureCode;
  readonly qualifiedOrigin: string;
}

function failureEntries(
  originLayer: OrganizationVerificationFailureOriginLayer,
  mapping: Readonly<
    Record<string, OrganizationVerificationApplicationFailureCode>
  >,
): readonly OrganizationVerificationFailureLineageEntry[] {
  return Object.freeze(
    Object.entries(mapping)
      .map(([lowerLayerFailure, applicationFailure]) =>
        Object.freeze({
          originLayer,
          lowerLayerFailure,
          applicationFailure,
          qualifiedOrigin: `${originLayer}:${lowerLayerFailure}`,
        }),
      )
      .sort((left, right) =>
        left.qualifiedOrigin.localeCompare(right.qualifiedOrigin),
      ),
  );
}

export const ORGANIZATION_VERIFICATION_FAILURE_LINEAGE = Object.freeze([
  ...failureEntries(
    "persistence",
    ORGANIZATION_VERIFICATION_PERSISTENCE_FAILURE_MAPPING,
  ),
  ...failureEntries(
    "replay",
    ORGANIZATION_VERIFICATION_REPLAY_FAILURE_MAPPING,
  ),
  ...failureEntries(
    "workflow_runtime",
    ORGANIZATION_VERIFICATION_WORKFLOW_FAILURE_STAGE_MAPPING,
  ),
]);

export const ORGANIZATION_VERIFICATION_APPLICATION_OWNED_FAILURES =
  Object.freeze([
    "invalid_application_request",
    "unauthentic_application_request",
    "malformed_application_metadata",
    "verification_stream_already_exists",
    "invalid_start_expected_version",
    "invalid_workflow_genesis",
    "start_persistence_conflict",
    "current_state_replay_failed",
    "expected_workflow_version_conflict",
    "expected_workflow_stage_conflict",
    "requested_step_not_allowed",
    "workflow_already_completed",
  ] as const satisfies readonly OrganizationVerificationApplicationFailureCode[]);
