import { createOrganizationVerificationWorkflowStreamIdentity } from "../organization-verification/application/persistence-contract/index.js";
import { createPostgresOrganizationVerificationPersistenceAdapter, type OrganizationVerificationPostgresDatabase } from "../organization-verification/infrastructure/persistence/postgres/index.js";
import { createOrganizationVerificationParticipationStateAdapter } from "../organization-participation-eligibility/postgresRuntime.js";
import type { VreQuery } from "../vre/verificationReview.js";

/** Keeps canonical replay/persistence details inside the approved production integration boundary. */
export function createTransactionalVerificationDatabase(db: VreQuery): OrganizationVerificationPostgresDatabase {
  const port = { async query(sql: string, values: readonly unknown[] = []) {
    const result = await db.query(sql,[...values]);
    return { rows: result.rows, rowCount: result.rowCount ?? result.rows.length };
  } };
  return { ...port, async transaction(operation) { return operation(port); } };
}

export async function replayVerificationHistory(db: VreQuery, organizationId: string) {
  const streams = await db.query(`SELECT workflow_execution_id,organization_id,record_id,revision_id,attempt_id,created_at
    FROM public.organization_verification_persistence_streams WHERE organization_id=$1
    ORDER BY created_at DESC,workflow_execution_id DESC LIMIT 20`,[organizationId]);
  const clock = await db.query("SELECT clock_timestamp() AS replay_at");
  const replayAt = new Date(clock.rows[0].replay_at).toISOString();
  const adapter = createOrganizationVerificationParticipationStateAdapter(
    createPostgresOrganizationVerificationPersistenceAdapter(createTransactionalVerificationDatabase(db)),{now:()=>replayAt});
  const decisions = [];
  for (const row of streams.rows) {
    const identity = createOrganizationVerificationWorkflowStreamIdentity({workflowExecutionId:row.workflow_execution_id,
      organizationId:row.organization_id,recordId:row.record_id,revisionId:row.revision_id,attemptId:row.attempt_id});
    if (!identity.ok) throw new Error("VERIFICATION_HISTORY_INVALID");
    const replay = await adapter.resolveAuthoritativeReplay({streamIdentity:identity.value});
    if (replay.status !== "resolved") {
      decisions.push({id:row.workflow_execution_id,createdAt:row.created_at,status:"unavailable"}); continue;
    }
    const workflow = replay.replayExecution.reconstructedWorkflowExecution;
    const integration = workflow.decisionTrustIntegrationExecution;
    decisions.push({id:row.workflow_execution_id,createdAt:row.created_at,status:workflow.workflowStage,
      decision:integration?.decision.outcome,policyVersion:integration?.decision.policyProvenance.policySetVersion,
      trust:integration?.trustStatus.status,decisionId:integration?.decision.decisionId,
      replayFingerprint:replay.replayExecution.replayFingerprint});
  }
  return decisions;
}
