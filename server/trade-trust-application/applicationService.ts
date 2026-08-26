import { createHash, randomUUID } from "node:crypto";
import { createActivityEligibilityRequest } from "../activity-eligibility/index.js";
import { createEvidenceCollectionRequest, createLocalPlatformEvidenceProvider, type ProviderEvidenceAssertion } from "../evidence-provider/index.js";
import { createOrganizationMembership } from "../organization-membership/index.js";
import { productionOrganizationParticipationEligibilityReadAdapter } from "../organization-participation-eligibility/productionRuntime.js";
import { REGISTRY_CONTRACT_VERSION, createOrganizationId, parseOrganizationProfileRevisionContract } from "../organization-registry/index.js";
import { createMinimumTradeTrustProductionWiring } from "../trade-trust-policy/productionWiring.js";
import * as repository from "./postgresRepository.js";
import { executeProductionOrganizationVerification } from "./organizationVerificationOrchestrator.js";
import type { CurrentOrganizationContextDto } from "@shared/organizationOnboarding";

export interface RegistrationInput { legalName:string; tradingNames:readonly string[]; organizationType:string; jurisdiction:string; registrationIdentifiers:readonly {scheme:string;value:string}[]; declaredActivities:readonly {code:string;description?:string}[]; }
export interface EvidenceInput { readonly assertions: readonly ProviderEvidenceAssertion[]; }
const hash=(value:unknown)=>`sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
const id=(scope:string)=>`${scope}-${randomUUID()}`;
const now=()=>new Date().toISOString();

function membership(input: Parameters<typeof createOrganizationMembership>[0]) {
  const result=createOrganizationMembership(input);
  if(!result.ok) throw new Error(`INVALID_MEMBERSHIP:${result.code}`);
  return result.value;
}

function evidenceFingerprint(input: Omit<repository.PlatformEvidenceRecord,"evidenceFingerprint">){
  return hash({contractVersion:"evidence-provider/v1",evidenceId:input.evidenceId,
    evidenceVersion:input.evidenceVersion,providerKind:"platform_submitted",
    subject:{subjectKind:input.subjectKind,subjectId:input.subjectId,subjectVersion:input.subjectVersion},
    assuranceLevel:"documentary",assertions:[...input.assertions].sort((a,b)=>a.assertionCode.localeCompare(b.assertionCode)),
    capturedAt:input.submittedAt,provenanceReference:input.provenanceReference,integrityReference:input.integrityReference});
}

async function submitEvidence(actorUserId:string,subjectKind:"organization"|"offer",subjectId:string,subjectVersion:string,assertions:readonly ProviderEvidenceAssertion[]){
  const submittedAt=now();
  const unsigned:Omit<repository.PlatformEvidenceRecord,"evidenceFingerprint">={
    evidenceId:id("platform-evidence"),evidenceVersion:"evidence-version-1",subjectKind,subjectId,subjectVersion,
    assertions:Object.freeze(assertions.map(item=>Object.freeze({...item}))),submittedBy:actorUserId,submittedAt,
    provenanceReference:`platform-submission:${actorUserId}:${submittedAt}`,
    integrityReference:hash({actorUserId,subjectKind,subjectId,subjectVersion,assertions}),
  };
  const record=Object.freeze({...unsigned,evidenceFingerprint:evidenceFingerprint(unsigned)});
  return {status:await repository.persistPlatformEvidence(record),record} as const;
}

const provider=createLocalPlatformEvidenceProvider(repository.platformEvidenceReadPort);
const tradeTrust=createMinimumTradeTrustProductionWiring(provider);

export const productionTradeTrustApplicationService=Object.freeze({
  async getCurrentOrganization(
    actorUserId: string,
  ): Promise<CurrentOrganizationContextDto> {
    const current = await repository.loadCurrentOrganizationContext(actorUserId);
    if (current.status === "not_found") {
      return Object.freeze({ state: "setup_required", organization: null });
    }
    if (current.status !== "resolved") {
      return Object.freeze({ state: "unavailable", organization: null });
    }
    const profile = parseOrganizationProfileRevisionContract(
      current.record.profilePayload,
    );
    if (
      !profile.ok ||
      profile.value.organizationId !== current.record.organizationId ||
      profile.value.organizationProfileRevisionId !==
        current.record.profileRevisionId
    ) {
      return Object.freeze({ state: "unavailable", organization: null });
    }

    const participation =
      await productionOrganizationParticipationEligibilityReadAdapter.resolveCurrentOrganizationParticipationEligibility(
        {
          organizationId: current.record.organizationId,
          userId: actorUserId,
        },
      );
    const verificationReference =
      participation.status === "resolved"
        ? participation.result.verificationReference
        : undefined;
    const verification = verificationReference
      ? Object.freeze({
          phase: "completed" as const,
          canonicalTrustStatus: verificationReference.trustStatus,
        })
      : participation.status === "unavailable" ||
          participation.status === "integrity_failure"
        ? Object.freeze({
            phase: "unavailable" as const,
            canonicalTrustStatus: null,
          })
        : current.record.verificationStreamExists
          ? Object.freeze({
              phase: "in_progress" as const,
              canonicalTrustStatus: null,
            })
          : Object.freeze({
              phase: "not_started" as const,
              canonicalTrustStatus: null,
            });

    return Object.freeze({
      state: "available" as const,
      organization: Object.freeze({
        organizationId: current.record.organizationId,
        profileRevisionId: current.record.profileRevisionId,
        displayName: profile.value.legalIdentityProjection.legalName,
        jurisdiction:
          profile.value.legalIdentityProjection.registrationJurisdiction,
        registrationIdentifiers: Object.freeze(
          profile.value.legalIdentityProjection.registrationIdentifiers.map(
            (identifier) => Object.freeze({ ...identifier }),
          ),
        ),
        lifecycle: profile.value.organizationLifecycle,
        membership: Object.freeze({
          membershipId: current.record.membershipId,
          role: current.record.membershipRole,
          status: "active" as const,
        }),
        verification,
      }),
    });
  },
  async createOrganization(actorUserId:string,input:RegistrationInput){
    const at=now(),organizationId=id("organization"),revisionId=id("organization-profile-revision");
    const semantic={legal_identity_projection:{legal_name:input.legalName,trading_names:[...input.tradingNames],registration_jurisdiction:input.jurisdiction,registration_identifiers:input.registrationIdentifiers.map(v=>({...v}))},organization_type:input.organizationType,jurisdiction:input.jurisdiction,declared_activity_projection:{activities:input.declaredActivities.map(v=>({...v}))},organization_lifecycle:"active"} as const;
    const payload={organization_id:organizationId,organization_profile_revision_id:revisionId,organization_profile_revision_sequence:1,organization_profile_fingerprint:hash({scope:REGISTRY_CONTRACT_VERSION,organizationId,revisionId,semantic}),...semantic,registry_contract_version:REGISTRY_CONTRACT_VERSION,published_at:at};
    const profile=parseOrganizationProfileRevisionContract(payload);
    if(!profile.ok) throw new Error(`INVALID_PROFILE:${profile.code}`);
    const owner=membership({membershipId:id("organization-membership"),userId:actorUserId,organizationId:profile.value.organizationId,role:"owner",status:"active",membershipVersion:1,effectiveFrom:at,createdAt:at,updatedAt:at,provenanceReference:`organization-registration:${actorUserId}`,integrityReference:hash({actorUserId,organizationId,revisionId,at})});
    const status=await repository.registerOrganizationAndOwner({actorUserId,profile:profile.value,profilePayload:payload,membership:owner});
    return Object.freeze({status,...(status==="created"?{organizationId,profileRevisionId:revisionId,lifecycle:"active",membershipId:owner.membershipId,membershipRole:"owner",membershipStatus:"active"}: {})});
  },
  async addMembership(actorUserId:string,input:{organizationId:string;userId:string;role:"owner"|"member"}){
    const organizationId=createOrganizationId(input.organizationId); if(!organizationId.ok)return Object.freeze({status:"invalid_organization"});
    const at=now(),value=membership({membershipId:id("organization-membership"),userId:input.userId,organizationId:organizationId.value,role:input.role,status:"active",membershipVersion:1,effectiveFrom:at,createdAt:at,updatedAt:at,provenanceReference:`membership-owner:${actorUserId}`,integrityReference:hash({actorUserId,input,at})});
    const status=await repository.addOrganizationMembership(actorUserId,value); return Object.freeze({status,...(status==="created"?{membershipId:value.membershipId}:{})});
  },
  async changeMembership(actorUserId:string,input:{organizationId:string;membershipId:string;role:"owner"|"member";status:"active"|"inactive"}){
    const row=await repository.loadMembership(input.organizationId,input.membershipId); if(!row)return Object.freeze({status:"not_found"});
    const organizationId=createOrganizationId(input.organizationId);if(!organizationId.ok)return Object.freeze({status:"invalid_organization"});
    const at=now(),value=membership({membershipId:input.membershipId,userId:String(row.user_id),organizationId:organizationId.value,role:input.role,status:input.status,membershipVersion:Number(row.membership_version)+1,effectiveFrom:at,createdAt:new Date(row.created_at).toISOString(),updatedAt:at,provenanceReference:`membership-owner:${actorUserId}`,integrityReference:hash({actorUserId,input,previous:row.membership_fingerprint,at})});
    return Object.freeze({status:await repository.changeOrganizationMembership(actorUserId,value),membershipVersion:value.membershipVersion});
  },
  async submitOrganizationEvidence(actorUserId:string,organizationId:string,profileRevisionId:string,input:EvidenceInput){
    if(!await repository.isActiveOwner(organizationId,actorUserId))return Object.freeze({status:"forbidden"});
    if(!await repository.loadOrganizationProfile(organizationId,profileRevisionId))return Object.freeze({status:"not_found"});
    const result=await submitEvidence(actorUserId,"organization",organizationId,profileRevisionId,input.assertions);
    return Object.freeze({status:result.status,...(result.status==="created"?{evidenceId:result.record.evidenceId,evidenceVersion:result.record.evidenceVersion}:{})});
  },
  async initiateOrganizationVerification(actorUserId:string,organizationId:string,profileRevisionId:string){
    if(!await repository.isActiveOwner(organizationId,actorUserId))return Object.freeze({status:"forbidden"});
    const profilePayload=await repository.loadOrganizationProfile(organizationId,profileRevisionId);if(!profilePayload)return Object.freeze({status:"not_found"});
    const execution=await executeProductionOrganizationVerification({actorUserId,organizationId,profileRevisionId,profilePayload});
    await repository.bindParticipationRuntime({organizationId,userId:actorUserId,profileRevisionId,streamIdentity:execution.streamIdentity});
    return Object.freeze({status:"completed",workflowStage:execution.workflowExecution.workflowStage,trustState:execution.trustStatus?.status??"unknown",replayFingerprint:execution.replayExecution.replayFingerprint});
  },
  async submitOfferEvidence(actorUserId:string,offerId:string,input:EvidenceInput){
    const offer=await repository.loadOwnedDraft(offerId,actorUserId);if(!offer||offer.status!=="draft")return Object.freeze({status:"not_found"});
    const result=await submitEvidence(actorUserId,"offer",offerId,offer.updatedAt,input.assertions);
    return Object.freeze({status:result.status,...(result.status==="created"?{evidenceId:result.record.evidenceId,subjectVersion:offer.updatedAt}:{})});
  },
  async evaluateTradeParticipation(input:{organizationId:string;userId:string;profileRevisionId:string;activityCode:string;commodity:{commodityId:string;commodityClassification:string|null;jurisdiction:string|null}|null}){
    const at=now(),request=createEvidenceCollectionRequest({requestId:id("activity-evidence-request"),providerKind:"platform_submitted",subject:{subjectKind:"organization",subjectId:input.organizationId,subjectVersion:input.profileRevisionId},requestedAt:at});if(!request)return null;
    const evidence=await provider.collectEvidence(request);if(evidence.status!=="evidence_available")return null;
    const activityRequest=createActivityEligibilityRequest({evaluationId:id("activity-evaluation"),organizationId:input.organizationId,context:{activityCode:input.activityCode,contextVersion:input.profileRevisionId,commodity:input.commodity},evaluatedAt:at});if(!activityRequest.ok)return null;
    const activity=tradeTrust.evaluateActivity({request:activityRequest.value,evidence:[evidence.evidence]});if(!activity)return null;
    const participation=activity.outcome==="eligible"?await productionOrganizationParticipationEligibilityReadAdapter.resolveCurrentOrganizationParticipationEligibility({organizationId:input.organizationId,userId:input.userId}):Object.freeze({status:"unavailable" as const});
    return Object.freeze({activity,participation});
  },
});

export const productionActivityAwareParticipationAdapter=Object.freeze({
  async resolveCurrentOrganizationParticipationEligibility(input:{organizationId:string;userId:string;activityContext?:{activityCode:string;commodityId:string;commodityClassification:string|null;jurisdiction:string|null}}){
    if(!input.activityContext)return Object.freeze({status:"unavailable" as const});
    const profile=await repository.loadParticipationProfile(input.organizationId,input.userId);if(!profile)return Object.freeze({status:"not_found" as const});
    const result=await productionTradeTrustApplicationService.evaluateTradeParticipation({organizationId:input.organizationId,userId:input.userId,profileRevisionId:profile.profileRevisionId,activityCode:input.activityContext.activityCode,commodity:{commodityId:input.activityContext.commodityId,commodityClassification:input.activityContext.commodityClassification,jurisdiction:input.activityContext.jurisdiction}});
    return result?.activity.outcome==="eligible"?result.participation:Object.freeze({status:"unavailable" as const});
  },
});
