import { executeProductionOrganizationVerification } from "../trade-trust-application/organizationVerificationOrchestrator.js";
import { bindParticipationRuntimeInTransaction } from "../trade-trust-application/postgresRepository.js";
import { createTransactionalVerificationDatabase } from "../trade-trust-application/verificationReadModelAdapter.js";
import { createVreService, loadReviewContext, reevaluateSchema, VreError, type CommandContext } from "./service.js";

export async function reevaluateOrganization(service: ReturnType<typeof createVreService>,context: CommandContext,raw: unknown) {
  const input = reevaluateSchema.parse(raw);
  return service.commit(context,"verification.reevaluate","vre.verification.reevaluated",input.reason,async db => {
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`verification-review:${input.organizationId}`]);
    const source = await loadReviewContext(db,input.organizationId,input.profileRevisionId);
    const latest = await db.query(`SELECT organization_profile_revision_id FROM public.organization_registry_profile_revisions
      WHERE organization_id=$1 ORDER BY created_at DESC,organization_profile_revision_id DESC LIMIT 1`,[input.organizationId]);
    if (latest.rows[0]?.organization_profile_revision_id !== input.profileRevisionId) throw new VreError("profile_changed_refresh_required");
    const result = await executeProductionOrganizationVerification({actorUserId:context.admin.userId,
      organizationId:input.organizationId,profileRevisionId:input.profileRevisionId,profilePayload:source.payload,
      actorAuthorityKind:"independent_reviewer"},{database:createTransactionalVerificationDatabase(db),query:db,evidenceProvider:source.provider});
    const owners = await db.query("SELECT user_id FROM public.organization_memberships WHERE organization_id=$1 AND role='owner' AND status='active' ORDER BY user_id FOR SHARE",[input.organizationId]);
    for (const owner of owners.rows) await bindParticipationRuntimeInTransaction(db,{organizationId:input.organizationId,
      userId:owner.user_id,profileRevisionId:input.profileRevisionId,streamIdentity:result.streamIdentity});
    const value = {workflowExecutionId:result.workflowExecution.workflowExecutionId,
      workflowStage:result.workflowExecution.workflowStage,trust:result.trustStatus?.status,
      replayFingerprint:result.replayExecution.replayFingerprint};
    return {value,targetType:"organization_verification",targetId:input.organizationId,before:null,
      after:{...value,trigger:input.trigger,policyVersion:"minimum-trade-trust-organization-policy/v2"}};
  });
}
