import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AdminSession } from "../adminAuth.js";
import type { PlatformPermission } from "../platform-authority/index.js";
import { satisfiesAdminActionAssurance } from "../admin-security/policy.js";
import { createEvidenceCollectionRequest, createLocalPlatformEvidenceProvider } from "../evidence-provider/index.js";
import { parseOrganizationProfileRevisionContract } from "../organization-registry/index.js";
import { ORGANIZATION_VERIFICATION_POLICY_V2 } from "../trade-trust-policy/organizationVerificationPolicy.js";
import { contentDigest, loadV2Activation, type VreQuery } from "./verificationReview.js";

export interface VrePool { connect(): Promise<VreQuery & { release(): void }>; }
export interface CommandContext { admin: AdminSession; requestId: string; correlationId: string; }
export class VreError extends Error {
  constructor(public code: string, public status = 409) { super(code); }
}
const text = z.string().trim().min(1).max(1000);
const reference = z.string().trim().min(1).max(500);
const id = z.string().trim().min(1).max(200);
const uuid = z.string().uuid();
// Other approved scopes are reserved, not silently mapped to unrelated legacy IDs.
export const scopeSchema = z.enum(["USER", "ORGANIZATION"]);
export const states = ["NORMAL","MONITORED","RESTRICTED","SUSPENDED","BLOCKED","TERMINATED"] as const;
export const restrictedTradeActions = ["offer.create","offer.edit","offer.submit","order.create","order.accept","contract.create"] as const;
export const reviewSchema = z.object({ organizationId: id, profileRevisionId: id,
  evidenceId: id, evidenceVersion: id, evidenceDigest: z.string().regex(/^[a-f0-9]{64}$/),
  outcome: z.enum(["confirmed","revision_requested","inconclusive"]), reason: text, sourceReference: reference }).strict();
export const signalSchema = z.object({ scope: scopeSchema, subjectId: id, signalType: z.string().trim().min(1).max(100),
  sourceReference: reference, severity: z.enum(["low","medium","high","critical"]), evidenceReference: reference,
  observedAt: z.string().datetime(), reason: text }).strict();
export const assessmentSchema = z.object({ signalId: uuid, conclusion: z.enum(["unsubstantiated","needs_review","substantiated"]), reason: text }).strict();
export const dispositionSchema = z.object({ assessmentId: uuid, disposition: z.enum(["closed","monitor","refer_for_case_review"]), reason: text }).strict();
export const caseSchema = z.object({ scope: scopeSchema, subjectId: id, riskAssessmentId: uuid.nullable(), evidenceReference: reference, reason: text }).strict();
export const decisionSchema = z.object({ caseId: uuid, expectedActionId: uuid.nullable(), state: z.enum(states),
  restrictedActions:z.array(z.enum(restrictedTradeActions)).max(restrictedTradeActions.length).default([]),
  reason: text, remediation: text, reviewAt: z.string().datetime() }).strict().superRefine((value,ctx)=>{
    if(value.state==="RESTRICTED"&&value.restrictedActions.length===0)ctx.addIssue({code:z.ZodIssueCode.custom,path:["restrictedActions"],message:"Explicit restricted actions are required."});
    if(value.state!=="RESTRICTED"&&value.restrictedActions.length>0)ctx.addIssue({code:z.ZodIssueCode.custom,path:["restrictedActions"],message:"Restrictions apply only to RESTRICTED."});
  });
export const reevaluateSchema = z.object({ organizationId: id, profileRevisionId: id,
  trigger: z.enum(["reverification","verification_expiry","material_evidence_change","material_organization_change","remediation"]), reason: text }).strict();

export function authorizeVre(context: CommandContext, permission: PlatformPermission): void {
  if (!context.admin.principalId || !context.admin.permissions.includes(permission)) throw new VreError("permission_denied",403);
  if (!satisfiesAdminActionAssurance(permission,context.admin.assurance)) throw new VreError("additional_assurance_required",403);
  if (!uuid.safeParse(context.requestId).success || !uuid.safeParse(context.correlationId).success) throw new VreError("invalid_command_context",400);
}
export function assertTransition(previous: string, next: string): void {
  if (!states.includes(previous as typeof states[number]) || !states.includes(next as typeof states[number]) || previous === next)
    throw new VreError("invalid_enforcement_transition");
  // Reversals, including termination, require a new explicit case and decision.
  // No implicit expiration: a review date is a review reminder, not automatic lifting.
}

export async function loadReviewContext(db: VreQuery, organizationId: string, profileRevisionId: string) {
  const profileRows = await db.query(`SELECT contract_payload FROM public.organization_registry_profile_revisions
    WHERE organization_id=$1 AND organization_profile_revision_id=$2`,[organizationId,profileRevisionId]);
  const payload = profileRows.rows[0]?.contract_payload;
  const parsed = parseOrganizationProfileRevisionContract(payload);
  if (!parsed.ok) throw new VreError("organization_profile_unavailable",404);
  const evidenceRows = await db.query(`SELECT evidence_id,evidence_version,subject_id,subject_version,assertions,
    submitted_by,submitted_at,provenance_reference,integrity_reference,evidence_fingerprint FROM public.platform_submitted_evidence
    WHERE subject_kind='organization' AND subject_id=$1 AND subject_version=$2
    ORDER BY submitted_at DESC,evidence_id DESC LIMIT 1`,[organizationId,profileRevisionId]);
  const row = evidenceRows.rows[0];
  if (!row) throw new VreError("organization_evidence_unavailable",409);
  const provider = createLocalPlatformEvidenceProvider({ async resolveSubmittedEvidence() { return {
    evidenceId: row.evidence_id, evidenceVersion: row.evidence_version, subjectId: row.subject_id, subjectVersion: row.subject_version,
    assertions: row.assertions, submittedAt: new Date(row.submitted_at).toISOString(),
    provenanceReference: row.provenance_reference, integrityReference: row.integrity_reference,
  }; } });
  const request = createEvidenceCollectionRequest({ requestId: randomUUID(), providerKind:"platform_submitted",
    subject:{subjectKind:"organization",subjectId:organizationId,subjectVersion:profileRevisionId}, requestedAt:new Date().toISOString() });
  if (!request) throw new VreError("evidence_request_invalid");
  const resolved = await provider.collectEvidence(request);
  if (resolved.status !== "evidence_available") throw new VreError("evidence_integrity_failure");
  if (resolved.evidence.evidenceFingerprint !== row.evidence_fingerprint) throw new VreError("evidence_integrity_failure");
  return { profile: parsed.value, payload, evidence: resolved.evidence, submittedBy: String(row.submitted_by), provider };
}

export function createVreService(pool: VrePool) {
  async function commit<T>(context: CommandContext, permission: PlatformPermission, action: string, reason: string,
    operation: (db: VreQuery) => Promise<{ value: T; targetType: string; targetId: string; before: unknown; after: unknown }>): Promise<T> {
    authorizeVre(context,permission);
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const actor = await db.query("SELECT id FROM public.platform_principals WHERE id=$1 AND user_id=$2 AND status='active' FOR SHARE",[context.admin.principalId,context.admin.userId]);
      if (actor.rows.length !== 1) throw new VreError("principal_inactive",403);
      const result = await operation(db);
      await db.query(`INSERT INTO public.security_audit_events
        (id,request_id,correlation_id,actor_user_id,actor_principal_id,actor_roles,effective_permission,session_assurance,
         action,target_type,target_id,before_value,after_value,reason,severity,occurred_at)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,'high',now())`,
      [randomUUID(),context.requestId,context.correlationId,context.admin.userId,context.admin.principalId,
        JSON.stringify(context.admin.roles),permission,context.admin.assurance,action,result.targetType,result.targetId,
        JSON.stringify(result.before),JSON.stringify(result.after),reason]);
      await db.query("COMMIT");
      return result.value;
    } catch (error) { await db.query("ROLLBACK"); throw error; }
    finally { db.release(); }
  }
  async function subject(db: VreQuery, scope: string, subjectId: string) {
    const result = scope === "USER"
      ? await db.query("SELECT id FROM public.users WHERE id=$1",[subjectId])
      : scope === "ORGANIZATION" ? await db.query("SELECT organization_id FROM public.organization_registry_profile_revisions WHERE organization_id=$1 LIMIT 1",[subjectId]) : null;
    if (!result || result.rows.length !== 1) throw new VreError("scope_subject_unavailable",404);
  }
  const fact = <T>(value: T, targetType: string, targetId: string, after: unknown, before: unknown = null) => ({value,targetType,targetId,before,after});
  return Object.freeze({
    async recordReview(context: CommandContext, raw: unknown) {
      const input = reviewSchema.parse(raw);
      return commit(context,"verification.review.submit","vre.verification.review_recorded",input.reason,async db => {
        await loadV2Activation(db);
        await db.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`verification-review:${input.organizationId}`]);
        const source = await loadReviewContext(db,input.organizationId,input.profileRevisionId);
        const membership = await db.query("SELECT 1 FROM public.organization_memberships WHERE organization_id=$1 AND user_id=$2 AND status='active' FOR SHARE",[input.organizationId,context.admin.userId]);
        if (membership.rows.length > 0 || source.submittedBy === context.admin.userId) throw new VreError("independent_reviewer_required",403);
        if (source.evidence.evidenceId !== input.evidenceId || source.evidence.evidenceVersion !== input.evidenceVersion || contentDigest(source.evidence) !== input.evidenceDigest)
          throw new VreError("evidence_changed_refresh_required");
        const reviewId = randomUUID();
        await db.query(`INSERT INTO public.vre_verification_reviews
          (id,organization_id,profile_revision_id,profile_fingerprint,evidence_id,evidence_version,evidence_digest,policy_version,
           method,outcome,reviewer_principal_id,reason,source_reference,request_id,correlation_id,created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'independent_human',$9,$10,$11,$12,$13,$14,clock_timestamp())`,
        [reviewId,input.organizationId,input.profileRevisionId,source.profile.organizationProfileFingerprint,input.evidenceId,input.evidenceVersion,
          input.evidenceDigest,ORGANIZATION_VERIFICATION_POLICY_V2,input.outcome,context.admin.principalId,input.reason,input.sourceReference,context.requestId,context.correlationId]);
        return fact({id:reviewId,outcome:input.outcome,policyVersion:ORGANIZATION_VERIFICATION_POLICY_V2},"verification_review",reviewId,{outcome:input.outcome,organizationId:input.organizationId,policyVersion:ORGANIZATION_VERIFICATION_POLICY_V2});
      });
    },
    async createSignal(context: CommandContext, raw: unknown) {
      const input = signalSchema.parse(raw);
      if (Date.parse(input.observedAt) > Date.now()) throw new VreError("observation_in_future",400);
      if (/^(unverified|not_verified|verification_missing|lack_of_verification)$/i.test(input.signalType)) throw new VreError("lack_of_verification_is_not_misconduct",400);
      return commit(context,"risk.signal.create","vre.risk.signal_recorded",input.reason,async db => {
        await subject(db,input.scope,input.subjectId);
        const signalId = randomUUID();
        await db.query(`INSERT INTO public.vre_risk_signals
          (id,scope,subject_id,signal_type,source,source_reference,severity,evidence_reference,reason,observed_at,created_by,request_id,correlation_id)
          VALUES ($1,$2,$3,$4,'manual',$5,$6,$7,$8,$9,$10,$11,$12)`,
        [signalId,input.scope,input.subjectId,input.signalType,input.sourceReference,input.severity,input.evidenceReference,input.reason,input.observedAt,context.admin.principalId,context.requestId,context.correlationId]);
        return fact({id:signalId},"risk_signal",signalId,{scope:input.scope,subjectId:input.subjectId,source:"manual",severity:input.severity});
      });
    },
    async assess(context: CommandContext, raw: unknown) {
      const input = assessmentSchema.parse(raw);
      return commit(context,"risk.assess","vre.risk.assessed",input.reason,async db => {
        const signal = await db.query("SELECT id FROM public.vre_risk_signals WHERE id=$1",[input.signalId]);
        if (!signal.rows.length) throw new VreError("signal_not_found",404);
        const assessmentId = randomUUID();
        await db.query(`INSERT INTO public.vre_risk_assessments(id,signal_id,conclusion,reason,assessed_by,request_id,correlation_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7)`,[assessmentId,input.signalId,input.conclusion,input.reason,context.admin.principalId,context.requestId,context.correlationId]);
        return fact({id:assessmentId},"risk_assessment",assessmentId,{signalId:input.signalId,conclusion:input.conclusion});
      });
    },
    async dispose(context: CommandContext, raw: unknown) {
      const input = dispositionSchema.parse(raw);
      return commit(context,"risk.dispose","vre.risk.disposition_recorded",input.reason,async db => {
        const assessment = await db.query("SELECT conclusion FROM public.vre_risk_assessments WHERE id=$1",[input.assessmentId]);
        if (!assessment.rows.length) throw new VreError("assessment_not_found",404);
        if (assessment.rows[0].conclusion === "unsubstantiated" && input.disposition === "refer_for_case_review") throw new VreError("unsubstantiated_case_referral_denied");
        const dispositionId = randomUUID();
        await db.query(`INSERT INTO public.vre_risk_dispositions(id,assessment_id,disposition,reason,reviewed_by,request_id,correlation_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7)`,[dispositionId,input.assessmentId,input.disposition,input.reason,context.admin.principalId,context.requestId,context.correlationId]);
        return fact({id:dispositionId},"risk_disposition",dispositionId,{assessmentId:input.assessmentId,disposition:input.disposition});
      });
    },
    async openCase(context: CommandContext, raw: unknown) {
      const input = caseSchema.parse(raw);
      return commit(context,"enforcement.case.open","vre.enforcement.case_opened",input.reason,async db => {
        await subject(db,input.scope,input.subjectId);
        if (input.riskAssessmentId) {
          const assessment = await db.query(`SELECT s.scope,s.subject_id,a.conclusion FROM public.vre_risk_assessments a
            JOIN public.vre_risk_signals s ON s.id=a.signal_id WHERE a.id=$1`,[input.riskAssessmentId]);
          const row = assessment.rows[0];
          if (!row || row.scope !== input.scope || row.subject_id !== input.subjectId || row.conclusion === "unsubstantiated") throw new VreError("assessment_scope_or_conclusion_invalid");
        }
        const caseId = randomUUID();
        await db.query(`INSERT INTO public.vre_enforcement_cases(id,scope,subject_id,risk_assessment_id,evidence_reference,reason,opened_by,request_id,correlation_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[caseId,input.scope,input.subjectId,input.riskAssessmentId,input.evidenceReference,input.reason,context.admin.principalId,context.requestId,context.correlationId]);
        return fact({id:caseId},"enforcement_case",caseId,{scope:input.scope,subjectId:input.subjectId,status:"open"});
      });
    },
    async decide(context: CommandContext, raw: unknown) {
      const input = decisionSchema.parse(raw);
      if (Date.parse(input.reviewAt) <= Date.now()) throw new VreError("future_review_date_required",400);
      return commit(context,"enforcement.decide","vre.enforcement.decision_and_action",input.reason,async db => {
        const cases = await db.query("SELECT scope,subject_id FROM public.vre_enforcement_cases WHERE id=$1 FOR UPDATE",[input.caseId]);
        const target = cases.rows[0];
        if (!target) throw new VreError("case_not_found",404);
        await db.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`vre-enforcement:${target.scope}:${target.subject_id}`]);
        const decided = await db.query("SELECT id FROM public.vre_enforcement_decisions WHERE case_id=$1",[input.caseId]);
        if (decided.rows.length) throw new VreError("case_already_decided");
        const previous = await db.query("SELECT id,state FROM public.vre_enforcement_actions WHERE scope=$1 AND subject_id=$2 ORDER BY effective_at DESC,id DESC LIMIT 1",[target.scope,target.subject_id]);
        const prior = previous.rows[0];
        if ((prior?.id ?? null) !== input.expectedActionId) throw new VreError("enforcement_state_changed_refresh_required");
        // An initial NORMAL decision closes a case with no restriction. A later
        // same-state action is rejected; lifting requires an explicit new fact.
        if (prior || input.state !== "NORMAL") assertTransition(prior?.state ?? "NORMAL",input.state);
        const decisionId = randomUUID(), actionId = randomUUID();
        await db.query(`INSERT INTO public.vre_enforcement_decisions(id,case_id,state,reason,remediation,decided_by,request_id,correlation_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,[decisionId,input.caseId,input.state,input.reason,input.remediation,context.admin.principalId,context.requestId,context.correlationId]);
        await db.query(`INSERT INTO public.vre_enforcement_actions(id,decision_id,predecessor_action_id,scope,subject_id,state,review_at,effective_at,integration_status)
          VALUES ($1,$2,$3,$4,$5,$6,$7,clock_timestamp(),'ACTIVE_V2_COMMAND_GUARD')`,[actionId,decisionId,input.expectedActionId,target.scope,target.subject_id,input.state,input.reviewAt]);
        for(const actionKind of input.restrictedActions)await db.query(`INSERT INTO public.vre_enforcement_action_restrictions(id,action_id,action_kind) VALUES($1,$2,$3)`,[randomUUID(),actionId,actionKind]);
        return fact({id:actionId,decisionId,state:input.state,restrictedActions:input.restrictedActions,integrationStatus:"ACTIVE_V2_COMMAND_GUARD"},"enforcement_action",actionId,
          {caseId:input.caseId,state:input.state,restrictedActions:input.restrictedActions,integrationStatus:"ACTIVE_V2_COMMAND_GUARD"},prior ?? {state:"NORMAL"});
      });
    },
    commit,
  });
}
