import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { ZodError } from "zod";
import { requireAdminAuth, requirePermission, type AdminSession } from "../adminAuth.js";
import type { PlatformPermission } from "../platform-authority/index.js";
import { createSecurityAuditWriter } from "../admin-security/securityAudit.js";
import { createVreService, loadReviewContext, VreError, type CommandContext, type VrePool } from "./service.js";
import { contentDigest, type VreQuery } from "./verificationReview.js";
import { createVreReadModel } from "./readModel.js";
import { reevaluateOrganization } from "./reevaluate.js";

type AdminRequest = Request & { adminSession?: AdminSession };
export function registerVreRoutes(app: Express,pool: VrePool & VreQuery) {
  const service = createVreService(pool), reads = createVreReadModel(pool), audit = createSecurityAuditWriter(pool);
  const context = (req: AdminRequest): CommandContext => {
    if (!req.adminSession) throw new VreError("permission_denied",403);
    return {admin:req.adminSession,requestId:randomUUID(),correlationId:randomUUID()};
  };
  const errorResponse = (res: Response,error: unknown) => {
    if (error instanceof ZodError) return res.status(400).json({code:"invalid_request",message:"Check the required fields and supported scope."});
    if (error instanceof VreError) return res.status(error.status).json({code:error.code,message:"The operation could not be completed. Refresh the case and check your authority and evidence."});
    return res.status(503).json({code:"vre_unavailable",message:"The operation could not be completed safely. Refresh before trying again."});
  };
  const get = (path: string,permission: PlatformPermission,load: (req: AdminRequest)=>Promise<unknown>) =>
    app.get(path,requireAdminAuth,requirePermission(permission),async(req:AdminRequest,res)=>{
      try { const result = await load(req); res.json(result); } catch(error) { errorResponse(res,error); }
    });
  const post = (path: string,permission: PlatformPermission,command: (ctx:CommandContext,raw:unknown)=>Promise<unknown>) =>
    app.post(path,requireAdminAuth,requirePermission(permission),async(req:AdminRequest,res)=>{
      try { res.status(201).json(await command(context(req),req.body)); } catch(error) { errorResponse(res,error); }
    });
  app.get('/admin/vre/status',requireAdminAuth,(_req,res)=>res.json({health:'operational',modules:[
    {id:'verification',maturity:'ACTIVE_BASELINE'},{id:'risk',maturity:'ACTIVE_BASELINE'},{id:'enforcement',maturity:'ACTIVE_BASELINE'},
  ]}));
  get('/admin/vre/subjects','risk.view',async req=>{
    if(req.query.scope==='USER') return (await pool.query(`SELECT id,email AS label FROM public.users ORDER BY email,id LIMIT 100`)).rows;
    if(req.query.scope==='ORGANIZATION') return (await pool.query(`SELECT DISTINCT ON (organization_id) organization_id AS id,
      contract_payload->'legal_identity_projection'->>'legal_name' AS label FROM public.organization_registry_profile_revisions
      ORDER BY organization_id,created_at DESC,organization_profile_revision_id DESC LIMIT 100`)).rows;
    throw new VreError('unsupported_scope',400);
  });
  get('/admin/vre/verification','verification.queue.view',()=>reads.verificationQueue());
  get('/admin/vre/verification/:organizationId/history','verification.queue.view',req=>reads.verificationHistory(req.params.organizationId));
  get('/admin/vre/verification/:organizationId/profiles/:profileRevisionId/evidence','verification.evidence.view',async req=>{
    const ctx = context(req);
    const source = await loadReviewContext(pool,req.params.organizationId,req.params.profileRevisionId);
    await audit.recordAccess({...ctx,permission:'verification.evidence.view',action:'vre.verification.evidence_accessed',
      targetType:'organization_evidence',targetId:source.evidence.evidenceId,reason:'Authorized independent review evidence inspection'});
    return {organizationId:req.params.organizationId,profileRevisionId:req.params.profileRevisionId,
      legalName:source.profile.legalIdentityProjection.legalName,evidenceId:source.evidence.evidenceId,evidenceVersion:source.evidence.evidenceVersion,
      evidenceDigest:contentDigest(source.evidence),source:'organization_self_attestation',assertions:source.evidence.assertions,
      capturedAt:source.evidence.capturedAt,notice:'Assertions are Evidence, not independent verification. Confirm against an independent source.'};
  });
  get('/admin/vre/risk','risk.view',()=>reads.risk());
  get('/admin/vre/risk/:signalId/history','risk.view',req=>reads.riskHistory(req.params.signalId));
  get('/admin/vre/enforcement','enforcement.view',()=>reads.enforcement());
  get('/admin/vre/enforcement/:scope/:subjectId/history','enforcement.view',req=>reads.enforcementHistory(req.params.scope,req.params.subjectId));
  post('/admin/vre/verification/reviews','verification.review.submit',service.recordReview);
  post('/admin/vre/verification/reevaluate','verification.reevaluate',(ctx,raw)=>reevaluateOrganization(service,ctx,raw));
  post('/admin/vre/risk/signals','risk.signal.create',service.createSignal);
  post('/admin/vre/risk/assessments','risk.assess',service.assess);
  post('/admin/vre/risk/dispositions','risk.dispose',service.dispose);
  post('/admin/vre/enforcement/cases','enforcement.case.open',service.openCase);
  post('/admin/vre/enforcement/decisions','enforcement.decide',service.decide);
}
