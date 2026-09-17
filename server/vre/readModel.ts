import { replayVerificationHistory } from "../trade-trust-application/verificationReadModelAdapter.js";
import type { VreQuery } from "./verificationReview.js";

export function createVreReadModel(db: VreQuery) {
  return {
    async verificationQueue() {
      const result = await db.query(`SELECT p.organization_id AS "organizationId",
        p.organization_profile_revision_id AS "profileRevisionId",
        p.contract_payload->'legal_identity_projection'->>'legal_name' AS "legalName",
        p.created_at AS "submittedAt",e.evidence_id AS "evidenceId",e.evidence_version AS "evidenceVersion",
        r.outcome AS "reviewOutcome",r.policy_version AS "reviewPolicyVersion",r.created_at AS "reviewedAt",
        r.evidence_id=e.evidence_id AND r.evidence_version=e.evidence_version AS "reviewMatchesEvidence"
        FROM (SELECT DISTINCT ON (organization_id) * FROM public.organization_registry_profile_revisions
          ORDER BY organization_id,created_at DESC,organization_profile_revision_id DESC) p
        LEFT JOIN LATERAL (SELECT evidence_id,evidence_version FROM public.platform_submitted_evidence
          WHERE subject_kind='organization' AND subject_id=p.organization_id AND subject_version=p.organization_profile_revision_id
          ORDER BY submitted_at DESC,evidence_id DESC LIMIT 1) e ON true
        LEFT JOIN LATERAL (SELECT outcome,policy_version,created_at,evidence_id,evidence_version FROM public.vre_verification_reviews
          WHERE organization_id=p.organization_id AND profile_revision_id=p.organization_profile_revision_id
          ORDER BY created_at DESC,id DESC LIMIT 1) r ON true
        ORDER BY p.created_at DESC,p.organization_id LIMIT 100`);
      return result.rows;
    },
    async verificationHistory(organizationId: string) {
      const decisions = await replayVerificationHistory(db,organizationId);
      const reviews = await db.query(`SELECT id,outcome,method,policy_version AS "policyVersion",
        reviewer_principal_id AS "reviewerPrincipalId",created_at AS "createdAt",reason,source_reference AS "sourceReference",
        evidence_id AS "evidenceId",profile_revision_id AS "profileRevisionId"
        FROM public.vre_verification_reviews WHERE organization_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50`,[organizationId]);
      return {decisions,reviews:reviews.rows};
    },
    async risk() {
      const signals = await db.query(`SELECT s.id,s.scope,s.subject_id AS "subjectId",s.signal_type AS "signalType",
        CASE WHEN s.scope='USER' THEN (SELECT email FROM public.users WHERE id=s.subject_id)
          WHEN s.scope='ORGANIZATION' THEN (SELECT contract_payload->'legal_identity_projection'->>'legal_name'
            FROM public.organization_registry_profile_revisions WHERE organization_id=s.subject_id ORDER BY created_at DESC,organization_profile_revision_id DESC LIMIT 1) END AS "subjectName",
        s.source,s.source_reference AS "sourceReference",s.severity,s.evidence_reference AS "evidenceReference",s.reason,
        s.observed_at AS "observedAt",s.created_at AS "createdAt",s.created_by AS "createdBy",
        a.id AS "assessmentId",a.conclusion,d.disposition
        FROM public.vre_risk_signals s
        LEFT JOIN LATERAL (SELECT id,conclusion FROM public.vre_risk_assessments WHERE signal_id=s.id ORDER BY created_at DESC,id DESC LIMIT 1) a ON true
        LEFT JOIN LATERAL (SELECT disposition FROM public.vre_risk_dispositions WHERE assessment_id=a.id ORDER BY created_at DESC,id DESC LIMIT 1) d ON true
        ORDER BY s.created_at DESC,s.id DESC LIMIT 100`);
      return signals.rows;
    },
    async riskHistory(signalId: string) {
      const assessments = await db.query(`SELECT id,conclusion,reason,assessed_by AS "assessedBy",created_at AS "createdAt"
        FROM public.vre_risk_assessments WHERE signal_id=$1 ORDER BY created_at,id`,[signalId]);
      const dispositions = await db.query(`SELECT d.id,d.assessment_id AS "assessmentId",d.disposition,d.reason,
        d.reviewed_by AS "reviewedBy",d.created_at AS "createdAt" FROM public.vre_risk_dispositions d
        JOIN public.vre_risk_assessments a ON a.id=d.assessment_id WHERE a.signal_id=$1 ORDER BY d.created_at,d.id`,[signalId]);
      return {assessments:assessments.rows,dispositions:dispositions.rows};
    },
    async enforcement() {
      const cases = await db.query(`SELECT c.id,c.scope,c.subject_id AS "subjectId",c.reason,c.evidence_reference AS "evidenceReference",
        CASE WHEN c.scope='USER' THEN (SELECT email FROM public.users WHERE id=c.subject_id)
          WHEN c.scope='ORGANIZATION' THEN (SELECT contract_payload->'legal_identity_projection'->>'legal_name'
            FROM public.organization_registry_profile_revisions WHERE organization_id=c.subject_id ORDER BY created_at DESC,organization_profile_revision_id DESC LIMIT 1) END AS "subjectName",
        c.risk_assessment_id AS "riskAssessmentId",c.created_at AS "createdAt",c.opened_by AS "openedBy",
        d.id AS "decisionId",d.state AS "decidedState",d.remediation,d.reason AS "decisionReason",d.decided_by AS "decidedBy",
        a.id AS "currentActionId",COALESCE(a.state,'NORMAL') AS "currentState",a.review_at AS "reviewAt",COALESCE(a.integration_status,'ACTIVE_V2_COMMAND_GUARD') AS "integrationStatus",
        COALESCE((SELECT jsonb_agg(r.action_kind ORDER BY r.action_kind) FROM public.vre_enforcement_action_restrictions r WHERE r.action_id=a.id),'[]'::jsonb) AS "restrictedActions"
        FROM public.vre_enforcement_cases c LEFT JOIN public.vre_enforcement_decisions d ON d.case_id=c.id
        LEFT JOIN LATERAL (SELECT id,state,review_at,integration_status FROM public.vre_enforcement_actions
          WHERE scope=c.scope AND subject_id=c.subject_id ORDER BY effective_at DESC,id DESC LIMIT 1) a ON true
        ORDER BY c.created_at DESC,c.id DESC LIMIT 100`);
      return cases.rows;
    },
    async enforcementHistory(scope: string, subjectId: string) {
      const rows = await db.query(`SELECT a.id,a.state,a.predecessor_action_id AS "predecessorActionId",a.effective_at AS "effectiveAt",
        a.review_at AS "reviewAt",d.case_id AS "caseId",d.reason,d.remediation,d.decided_by AS "decidedBy",a.integration_status AS "integrationStatus",
        COALESCE((SELECT jsonb_agg(r.action_kind ORDER BY r.action_kind) FROM public.vre_enforcement_action_restrictions r WHERE r.action_id=a.id),'[]'::jsonb) AS "restrictedActions"
        FROM public.vre_enforcement_actions a JOIN public.vre_enforcement_decisions d ON d.id=a.decision_id
        WHERE a.scope=$1 AND a.subject_id=$2 ORDER BY a.effective_at DESC,a.id DESC LIMIT 100`,[scope,subjectId]);
      return rows.rows;
    },
  };
}
