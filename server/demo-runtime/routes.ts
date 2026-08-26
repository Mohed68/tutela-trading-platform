import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import type {
  DemoApplicationContext,
  DemoApplicationFailure,
  DemoSimulationApplicationService,
} from "./applicationService.js";

const accessLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many demo access attempts. Please try again later." },
});

const qualificationSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  businessEmail: z.string(),
  company: z.string(),
  country: z.string(),
  jobRole: z.string(),
  tradeRole: z.enum(["buyer", "seller", "both"]),
  primaryInterest: z.string(),
}).strict();

function context(req: Request): DemoApplicationContext {
  return {
    grantId: req.session.demoAccessGrantId,
    demoSessionId: req.session.demoSessionId,
  };
}

function failureStatus(code: DemoApplicationFailure): number {
  if (code === "session_expired" || code === "grant_expired") return 410;
  if (code === "session_required" || code === "verified_grant_required") return 401;
  if (code === "session_forbidden") return 404;
  if (code === "not_found") return 404;
  if (code === "delivery_unavailable") return 503;
  if (code === "invalid_request" || code === "business_email_required" || code === "invalid_or_expired_token") return 400;
  return 409;
}

function respond<T>(res: Response, result: { ok: true; value: T } | { ok: false; code: DemoApplicationFailure }, created = false) {
  if (!result.ok) {
    return res.status(failureStatus(result.code)).json({
      message: result.code === "session_expired"
        ? "The interactive demo session has expired."
        : result.code === "business_email_required"
          ? "A valid business email is required for qualified demo access."
          : "The demo request could not be completed.",
      code: result.code,
    });
  }
  return res.status(created ? 201 : 200).json(result.value);
}

function sessionDto(value: Awaited<ReturnType<DemoSimulationApplicationService["getSession"]>>) {
  if (!value.ok) return value;
  const state = value.value;
  return {
    ok: true as const,
    value: Object.freeze({
      demoSessionId: state.session.demoSessionId,
      startedAt: state.session.startedAt,
      expiresAt: state.session.expiresAt,
      ttlMinutes: state.session.ttlMinutes,
      state: state.session.state,
      stateVersion: state.session.stateVersion,
      simulation: true as const,
      visitor: state.visitor,
      missionCount: state.missions.length,
      orderCount: state.orders.length,
      contractCount: state.contracts.length,
    }),
  };
}

export function registerDemoRuntimeRoutes(
  app: Express,
  service: DemoSimulationApplicationService,
): void {
  app.post("/api/demo/access/request", accessLimiter, async (req, res) => {
    const parsed = qualificationSchema.safeParse(req.body);
    if (!parsed.success) return respond(res, { ok:false, code:"invalid_request" });
    const result = await service.requestAccess(parsed.data);
    if (!result.ok) return respond(res, result);
    return res.status(202).json({
      accepted: true,
      message: "If the business address is eligible, a verification email will arrive shortly.",
    });
  });

  const verify = async (req: Request, res: Response) => {
    const token = req.method === "GET" ? req.query.token : req.body?.token;
    const result = await service.verifyAccess(token);
    if (!result.ok) return respond(res, result);
    req.session.demoAccessGrantId = result.value.grantId;
    delete req.session.demoSessionId;
    return res.json({ verified: true, next: "/api/demo/sessions" });
  };
  app.get("/api/demo/access/verify", accessLimiter, verify);
  app.post("/api/demo/access/verify", accessLimiter, verify);

  app.post("/api/demo/sessions", async (req, res) => {
    const result = await service.createSession(req.session.demoAccessGrantId);
    if (!result.ok) return respond(res, result);
    req.session.demoSessionId = result.value.session.demoSessionId;
    return respond(res, sessionDto({ ok:true, value:result.value }), true);
  });

  app.get("/api/demo/session", async (req, res) =>
    respond(res, sessionDto(await service.getSession(context(req)))),
  );
  app.post("/api/demo/session/reset", async (req, res) =>
    respond(res, sessionDto(await service.resetSession(context(req)))),
  );

  app.get("/api/demo/offers", async (req, res) => {
    const category = z.enum(["energy","chemicals","metals","agriculture"]).safeParse(req.query.category);
    const side = z.enum(["buy","sell"]).safeParse(req.query.side);
    const query = typeof req.query.q === "string" ? req.query.q : undefined;
    return respond(res, await service.listOffers(context(req), {
      ...(category.success ? { category:category.data } : {}),
      ...(side.success ? { side:side.data } : {}),
      ...(query ? { query } : {}),
    }));
  });
  app.get("/api/demo/offers/:offerId", async (req, res) =>
    respond(res, await service.getOffer(context(req), req.params.offerId)),
  );
  app.get("/api/demo/offers/:offerId/evidence", async (req, res) =>
    respond(res, await service.getOfferEvidence(context(req), req.params.offerId)),
  );
  app.get("/api/demo/organizations/:organizationId", async (req, res) =>
    respond(res, await service.getOrganization(context(req), req.params.organizationId)),
  );
  app.get("/api/demo/missions", async (req, res) =>
    respond(res, await service.listMissions(context(req))),
  );
  app.get("/api/demo/missions/:missionId", async (req, res) =>
    respond(res, await service.getMission(context(req), req.params.missionId)),
  );
  app.post("/api/demo/missions/:missionId/start", async (req, res) =>
    respond(res, await service.startMission(context(req), req.params.missionId), true),
  );
  app.post("/api/demo/orders", async (req, res) =>
    respond(res, await service.createOrder(context(req), {
      offerId:req.body?.offerId,
      quantity:req.body?.quantity,
    }), true),
  );
  app.post("/api/demo/orders/:orderId/accept", async (req, res) =>
    respond(res, await service.acceptOrder(context(req), req.params.orderId)),
  );
  app.get("/api/demo/orders/:orderId", async (req, res) =>
    respond(res, await service.getOrder(context(req), req.params.orderId)),
  );
  app.post("/api/demo/orders/:orderId/contract", async (req, res) =>
    respond(res, await service.createContract(context(req), req.params.orderId), true),
  );
  app.get("/api/demo/contracts/:contractId", async (req, res) =>
    respond(res, await service.getContract(context(req), req.params.contractId)),
  );
}
