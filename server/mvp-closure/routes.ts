import type { Express, RequestHandler } from "express";
import { z } from "zod";
import type { Pool } from "pg";
import { isAuthenticated } from "../auth.js";
import { hasRecentStepUp } from "../session-assurance/sessionAssurance.js";
import { INCOTERMS_2020 } from "./domain.js";
import { createMvpClosureService, type ClosureFailureCode } from "./service.js";

const bounded=(max=500)=>z.string().trim().min(1).max(max);
const specification=z.object({code:bounded(50),label:bounded(100),value:bounded(200),unit:bounded(50).optional(),tolerance:bounded(100).optional(),sourceReference:bounded(300)}).strict();
const address=z.object({countryCode:z.string().trim().regex(/^[A-Z]{2}$/),administrativeArea:bounded(200).optional(),locality:bounded(200),postalCode:bounded(30).optional(),addressLines:z.array(bounded(300)).min(1).max(5)}).strict();
const preparation=z.object({
  preparedAt:z.string().datetime().optional(),effectiveDate:z.string().datetime().nullable().optional(),sellerRepresentative:bounded(200),buyerRepresentative:bounded(200),sellerAuthorizedSignatory:bounded(200).optional(),buyerAuthorizedSignatory:bounded(200).optional(),sellerAddress:address,buyerAddress:address,grade:bounded(100),form:bounded(100).optional(),productDescription:bounded(2000),origin:bounded(200),producer:bounded(200).optional(),customsClassification:z.object({scheme:bounded(50),code:bounded(100),applicabilityBasis:bounded(500)}).strict().optional(),specifications:z.array(specification).min(1).max(40),
  quantityTolerancePercent:z.string().regex(/^\d{1,2}(?:\.\d{1,2})?$/),measurementBasis:bounded(500).optional(),pricingBasis:bounded(500),incoterm:z.enum(INCOTERMS_2020),namedPlace:bounded(300),shipmentWindowStart:z.string().datetime(),shipmentWindowEnd:z.string().datetime(),laycanSemantics:bounded(1000).optional(),packaging:bounded(500),shipmentMode:bounded(200).optional(),partialShipmentPolicy:z.enum(["ALLOWED","NOT_ALLOWED","BY_WRITTEN_AGREEMENT"]),
  inspection:z.object({required:z.boolean(),bodyOrMethod:z.string().trim().max(500),inspectionPoint:z.string().trim().max(500),quantityDetermination:z.string().trim().max(500),qualityDetermination:z.string().trim().max(500),finalityAndClaims:z.string().trim().max(1000),claimsNoticePeriod:bounded(500).optional()}).strict(),
  payment:z.object({method:bounded(300),methodCode:z.enum(["OPEN_ACCOUNT","ADVANCE","DOCUMENTARY_COLLECTION","LETTER_OF_CREDIT","OTHER"]).optional(),timing:bounded(500),dueTrigger:bounded(500).optional(),currency:z.string().trim().regex(/^[A-Z]{3}$/),bankDocumentConditions:z.string().trim().max(1000)}).strict(),requiredDocuments:z.array(bounded(200)).min(1).max(30),
  legal:z.object({riskTransfer:bounded(1000),titleTransfer:bounded(1000),governingLaw:bounded(300),cisgTreatment:z.enum(["APPLIES_WHERE_LEGALLY_APPLICABLE","EXPRESSLY_INCLUDED","EXPRESSLY_EXCLUDED","LEGAL_REVIEW_REQUIRED"]),disputeResolution:z.enum(["ICC_ARBITRATION","COURTS"]),arbitrationInstitution:z.literal("ICC").optional(),arbitrationSeat:bounded(200).optional(),arbitrationLanguage:bounded(100).optional(),arbitratorCount:z.union([z.literal(1),z.literal(3)]).optional(),forceMajeureTreatment:bounded(2000),hardshipTreatment:bounded(2000),claimsTreatment:bounded(2000).optional(),defaultTreatment:bounded(2000).optional(),liabilityTreatment:bounded(2000).optional(),tradeComplianceTreatment:bounded(2000).optional()}).strict(),
  platformFeeTreatment:bounded(500),specialConditions:z.array(bounded(1000)).max(20),
}).strict().refine(v=>Date.parse(v.shipmentWindowEnd)>=Date.parse(v.shipmentWindowStart),{message:"Shipment window end must not precede start."});
const approve=z.object({snapshotId:z.string().uuid(),contractVersion:z.number().int().positive()}).strict();
const sign=approve.extend({previewSha256:z.string().regex(/^sha256:[0-9a-f]{64}$/),explicitConsent:z.literal(true)}).strict();
const transition=z.object({command:z.enum(["START_EXECUTION","CONFIRM_DELIVERY","CONFIRM_SETTLEMENT","CLOSE_TRADE"]),reason:bounded(1000)}).strict();
const evidence=z.object({evidenceType:z.enum(["COMMERCIAL_INVOICE","BILL_OF_LADING","CERTIFICATE_OF_ORIGIN","QUALITY_CERTIFICATE","QUANTITY_CERTIFICATE","PACKING_LIST","INSURANCE_CERTIFICATE","SETTLEMENT_CONFIRMATION","OTHER"]),reference:bounded(500),description:z.string().trim().max(2000).optional()}).strict();
const dispute=z.object({reason:z.string().trim().min(10).max(2000)}).strict();
const grant=z.object({userId:bounded(200)}).strict();
function status(code:ClosureFailureCode){if(code==="not_found")return 404;if(["participant_authority_required","owner_authority_required","signing_authority_required","recent_step_up_required","enforcement_denied"].includes(code))return 403;if(["invalid_request","not_ready"].includes(code))return 400;return 409}
function actor(req:any){return String(req.user?.claims?.sub??"")}
function send(res:any,result:any,success=200){return result.ok?res.status(success).json(result.value):res.status(status(result.code)).json({message:"Contract operation could not be completed.",code:result.code,...(result.missing?{missing:result.missing}:{})})}

export function registerMvpClosureRoutes(app:Express,pool:Pool):ReturnType<typeof createMvpClosureService>{
  const service=createMvpClosureService(pool);const auth=isAuthenticated as RequestHandler;
  app.get("/api/contracts/:id/closure",auth,async(req,res)=>send(res,await service.get(req.params.id,actor(req))));
  app.post("/api/contracts/:id/closure/prepare",auth,async(req,res)=>{const parsed=preparation.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:"Invalid contract terms.",issues:parsed.error.issues.map(i=>i.path.join("."))});return send(res,await service.prepare(req.params.id,actor(req),parsed.data),201)});
  app.post("/api/contracts/:id/closure/approve",auth,async(req,res)=>{const parsed=approve.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:"Invalid approval."});return send(res,await service.approveTerms(req.params.id,actor(req),parsed.data.snapshotId,parsed.data.contractVersion))});
  app.post("/api/organizations/:organizationId/contract-signing-authorities",auth,async(req:any,res)=>{const parsed=grant.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:"Invalid signing authority grant."});return send(res,await service.grantSigningAuthority(req.params.organizationId,actor(req),parsed.data.userId,hasRecentStepUp(req.session)),201)});
  app.post("/api/contracts/:id/closure/sign",auth,async(req:any,res)=>{const parsed=sign.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:"Invalid signature request."});return send(res,await service.sign(req.params.id,actor(req),{...parsed.data,recentStepUp:hasRecentStepUp(req.session)}))});
  app.post("/api/contracts/:id/closure/transition",auth,async(req,res)=>{const parsed=transition.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:"Invalid execution transition."});return send(res,await service.transition(req.params.id,actor(req),parsed.data.command,parsed.data.reason))});
  app.post("/api/contracts/:id/closure/evidence",auth,async(req,res)=>{const parsed=evidence.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:"Invalid evidence metadata."});return send(res,await service.addEvidence(req.params.id,actor(req),parsed.data),201)});
  app.post("/api/contracts/:id/closure/disputes",auth,async(req,res)=>{const parsed=dispute.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:"Invalid dispute entry."});return send(res,await service.openDispute(req.params.id,actor(req),parsed.data.reason),201)});
  app.get("/api/contracts/:id/closure/artifacts/:kind",auth,async(req,res)=>{const kind=req.params.kind==="executed"?"EXECUTED":req.params.kind==="preview"?"PREVIEW":null;if(!kind)return res.status(404).end();const result=await service.artifact(req.params.id,actor(req),kind);if(!result.ok)return send(res,result);res.setHeader("Content-Type","application/pdf");res.setHeader("Content-Disposition",`inline; filename=\"TUTELA-${req.params.id}-${kind.toLowerCase()}.pdf\"`);res.setHeader("ETag",`\"${result.value.document_sha256}\"`);return res.send(result.value.document_bytes)});
  return service;
}
