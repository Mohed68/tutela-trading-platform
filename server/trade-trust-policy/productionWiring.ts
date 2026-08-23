import {
  createMinimumTradeActivityEligibilityService,
  type ActivityEligibilityRequest,
  type ActivityEligibilityResult,
} from "../activity-eligibility/index.js";
import {
  evaluateComplianceTrigger,
  type ComplianceTriggerContext,
  type ComplianceTriggerResult,
} from "../compliance-trigger/index.js";
import {
  isEvidenceCollectionRequest,
  type EvidenceCollectionRequest,
  type EvidenceProviderPort,
  type ProviderEvidenceEnvelope,
} from "../evidence-provider/index.js";
import {
  adaptPlatformEvidenceToOrganizationVerificationReference,
  type PlatformOrganizationEvidenceAdaptation,
  type PlatformOrganizationEvidenceCategory,
} from "../organization-verification/application/production-evidence-adapter/platformEvidenceAdapter.js";
import {
  createMinimumTradeTrustOrganizationPolicyBundle,
  type MinimumTradeTrustOrganizationPolicyBundle,
} from "./organizationVerificationPolicy.js";

export type OrganizationEvidenceCollectionResult =
  | PlatformOrganizationEvidenceAdaptation
  | Readonly<{
      ok: false;
      code: "invalid_collection_request" | "evidence_unavailable";
    }>;

export interface CollectOrganizationEvidenceInput {
  readonly request: EvidenceCollectionRequest;
  readonly category: PlatformOrganizationEvidenceCategory;
  readonly revisionEvidenceReferenceId: string;
  readonly correlationReference: string;
}

export interface EvaluateTradeActivityInput {
  readonly request: ActivityEligibilityRequest;
  readonly evidence: readonly ProviderEvidenceEnvelope[];
}

export interface MinimumTradeTrustProductionWiring {
  readonly organizationVerificationPolicy: MinimumTradeTrustOrganizationPolicyBundle;
  collectOrganizationEvidence(
    input: CollectOrganizationEvidenceInput,
  ): Promise<OrganizationEvidenceCollectionResult>;
  evaluateActivity(
    input: EvaluateTradeActivityInput,
  ): ActivityEligibilityResult | undefined;
  evaluateCompliance(
    context: ComplianceTriggerContext,
  ): ComplianceTriggerResult | undefined;
}

export function createMinimumTradeTrustProductionWiring(
  platformEvidenceProvider: EvidenceProviderPort,
): MinimumTradeTrustProductionWiring {
  const activity = createMinimumTradeActivityEligibilityService();
  return Object.freeze({
    organizationVerificationPolicy:
      createMinimumTradeTrustOrganizationPolicyBundle(),
    async collectOrganizationEvidence(
      input: CollectOrganizationEvidenceInput,
    ) {
      if (
        !isEvidenceCollectionRequest(input.request) ||
        input.request.providerKind !== "platform_submitted" ||
        input.request.subject.subjectKind !== "organization"
      ) {
        return Object.freeze({
          ok: false as const,
          code: "invalid_collection_request" as const,
        });
      }
      const resolution = await platformEvidenceProvider.collectEvidence(
        input.request,
      );
      if (resolution.status !== "evidence_available") {
        return Object.freeze({
          ok: false as const,
          code: "evidence_unavailable" as const,
        });
      }
      return adaptPlatformEvidenceToOrganizationVerificationReference({
        evidence: resolution.evidence,
        organizationId: input.request.subject.subjectId,
        organizationVersion: input.request.subject.subjectVersion,
        category: input.category,
        revisionEvidenceReferenceId: input.revisionEvidenceReferenceId,
        correlationReference: input.correlationReference,
      });
    },
    evaluateActivity: (input: EvaluateTradeActivityInput) =>
      activity.evaluate(input),
    evaluateCompliance: (context: ComplianceTriggerContext) =>
      evaluateComplianceTrigger(context),
  });
}
