import type { Express, RequestHandler } from "express";
import type { Pool } from "pg";
import { z } from "zod";

import { isAuthenticated } from "../auth.js";
import { hasRecentStepUp } from "../session-assurance/sessionAssurance.js";
import { normalizeDomain, ORGANIZATION_CAPABILITIES, requiredSignatureSlots } from "./domain.js";
import { createOrganizationAuthorityService } from "./service.js";

const text = (max = 500) => z.string().trim().min(1).max(max);
const organizationId = text(255);
const resolution = z.object({ legalName: z.string().trim().max(255).optional(), jurisdiction: z.string().trim().max(100).optional(), registrationIdentifier: z.string().trim().max(255).optional() }).strict();
const domainRequest = z.object({ domain: text(253).transform((value, context) => { const normalized = normalizeDomain(value); if (!normalized) { context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid domain" }); return z.NEVER; } return normalized; }), verificationMethod: z.enum(["DNS_CHALLENGE","CONTROLLED_EMAIL_CHALLENGE","AUTHORIZED_INTERNAL_REVIEW","INDEPENDENT_PROVIDER"]), reason: text(1000) }).strict();
const invite = z.object({ email: z.string().trim().email().transform((value) => value.toLowerCase()), expiresInHours: z.number().int().min(1).max(720).default(72) }).strict();
const redeem = z.object({ token: z.string().min(32).max(500) }).strict();
const membershipDecision = z.object({ decision: z.enum(["APPROVED","REJECTED"]), reason: text(1000) }).strict();
const capabilityGrant = z.object({ userId: text(255), capability: z.enum(ORGANIZATION_CAPABILITIES), validUntil: z.string().datetime().optional() }).strict();
const mandate = z.object({ userId: text(255), actionScope: z.array(text(100)).min(1).max(20), contractTypeScope: z.array(text(150)).min(1).max(20), commodityScope: z.array(text(150)).max(100).optional(), maximumTransactionValue: z.string().regex(/^\d+(?:\.\d{1,8})?$/).optional(), valueCurrency: z.string().regex(/^[A-Z]{3}$/).optional(), signatureEligibility: z.enum(["INDIVIDUAL","JOINT","BOTH"]), validFrom: z.string().datetime(), validUntil: z.string().datetime().optional(), reason: text(1000) }).strict().refine((value) => Boolean(value.maximumTransactionValue) === Boolean(value.valueCurrency), { message: "Value and currency must be scoped together." }).refine((value) => !value.validUntil || Date.parse(value.validUntil) > Date.parse(value.validFrom), { message: "Mandate validity interval is invalid." });
const revocation = z.object({ reason: text(1000) }).strict();
const band = z.object({ minimumInclusive: z.string().regex(/^\d+(?:\.\d{1,8})?$/).optional(), maximumExclusive: z.string().regex(/^\d+(?:\.\d{1,8})?$/).optional(), requiredSignatures: z.number().int().min(1).max(10), signatureMode: z.enum(["INDIVIDUAL","JOINT"]) }).strict();
const signingPolicy = z.discriminatedUnion("policyKind", [
  z.object({ policyKind: z.literal("COMPATIBILITY_SINGLE"), policyPayload: z.object({ requiredSignatures: z.literal(1) }).strict() }).strict(),
  z.object({ policyKind: z.literal("VALUE_BANDS"), policyPayload: z.object({ currency: z.string().regex(/^[A-Z]{3}$/), bands: z.array(band).min(1).max(20) }).strict() }).strict(),
]).superRefine((value, context) => { if (value.policyKind === "VALUE_BANDS") for (const [index, item] of value.policyPayload.bands.entries()) { const evaluated = requiredSignatureSlots({ kind: "VALUE_BANDS", bands: [item] }, item.minimumInclusive ?? "0"); if (!evaluated.ok) context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid signing-policy band", path: ["policyPayload","bands",index] }); } });

function actor(req: any) { return String(req.user?.claims?.sub ?? ""); }
function codeStatus(code: string) { if (code === "not_found" || code === "invalid_invitation") return 404; if (code.includes("authority") || code === "active_membership_required" || code === "verified_email_required") return 403; if (code.includes("exists") || code.includes("pending") || code === "replayed") return 409; return 400; }
function send(res: any, result: any, success = 200) { return result.ok ? res.status(success).json(result.value) : res.status(codeStatus(result.code)).json({ message: "Organization operation could not be completed.", code: result.code }); }

export function registerOrganizationAuthorityRoutes(app: Express, pool: Pool) {
  const service = createOrganizationAuthorityService(pool); const auth = isAuthenticated as RequestHandler;
  app.post("/api/organization-resolution", auth, async (req, res) => { const parsed = resolution.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: "Invalid organization resolution request." }); return send(res, await service.resolve(actor(req), parsed.data)); });
  app.post("/api/organizations/:organizationId/join", auth, async (req, res) => { const id = organizationId.safeParse(req.params.organizationId); if (!id.success) return res.status(400).json({ message: "Invalid organization." }); return send(res, await service.join(actor(req), id.data), 201); });
  app.get("/api/organizations/:organizationId/workspace", auth, async (req, res) => send(res, await service.workspace(actor(req), req.params.organizationId)));
  app.post("/api/organizations/:organizationId/domains", auth, async (req, res) => { const parsed = domainRequest.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: "Invalid domain-verification request." }); return send(res, await service.requestDomain(actor(req), req.params.organizationId, parsed.data), 201); });
  app.put("/api/organizations/:organizationId/membership-policy", auth, async (req, res) => { const parsed = z.object({ policyKind: z.enum(["APPROVAL_REQUIRED","VERIFIED_DOMAIN_AUTO_JOIN"]) }).strict().safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: "Invalid membership policy." }); return send(res, await service.setMembershipPolicy(actor(req), req.params.organizationId, parsed.data.policyKind)); });
  app.post("/api/organizations/:organizationId/invitations", auth, async (req, res) => { const parsed = invite.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: "Invalid invitation." }); return send(res, await service.invite(actor(req), req.params.organizationId, parsed.data.email, parsed.data.expiresInHours), 201); });
  app.post("/api/organization-invitations/redeem", auth, async (req, res) => { const parsed = redeem.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: "Invalid invitation." }); return send(res, await service.redeemInvitation(actor(req), parsed.data.token)); });
  app.post("/api/organizations/:organizationId/membership-requests/:requestId/decision", auth, async (req, res) => { const parsed = membershipDecision.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: "Invalid membership decision." }); return send(res, await service.decideMembership(actor(req), req.params.organizationId, req.params.requestId, parsed.data.decision, parsed.data.reason)); });
  app.post("/api/organizations/:organizationId/capability-grants", auth, async (req: any, res) => { const parsed = capabilityGrant.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: "Invalid capability grant." }); if (!hasRecentStepUp(req.session)) return res.status(403).json({ message: "Recent MFA verification is required.", code: "recent_step_up_required" }); return send(res, await service.grantCapability(actor(req), req.params.organizationId, parsed.data.userId, parsed.data.capability, parsed.data.validUntil), 201); });
  app.post("/api/organizations/:organizationId/signing-mandates", auth, async (req: any, res) => { const parsed = mandate.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: "Invalid signing mandate." }); if (!hasRecentStepUp(req.session)) return res.status(403).json({ message: "Recent MFA verification is required.", code: "recent_step_up_required" }); return send(res, await service.grantMandate(actor(req), req.params.organizationId, parsed.data), 201); });
  app.post("/api/organizations/:organizationId/signing-mandates/:mandateId/revoke", auth, async (req: any, res) => { const parsed = revocation.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: "Invalid mandate revocation." }); if (!hasRecentStepUp(req.session)) return res.status(403).json({ message: "Recent MFA verification is required.", code: "recent_step_up_required" }); return send(res, await service.revokeMandate(actor(req), req.params.organizationId, req.params.mandateId, parsed.data.reason)); });
  app.put("/api/organizations/:organizationId/signing-policy", auth, async (req: any, res) => { const parsed = signingPolicy.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: "Invalid signing policy." }); if (!hasRecentStepUp(req.session)) return res.status(403).json({ message: "Recent MFA verification is required.", code: "recent_step_up_required" }); return send(res, await service.setSigningPolicy(actor(req), req.params.organizationId, parsed.data)); });
  app.get("/api/action-center", auth, async (req, res) => send(res, await service.actionCenter(actor(req))));
  app.get("/api/platform/foundations", auth, async (req, res) => send(res, await service.foundations(actor(req))));
  return service;
}
