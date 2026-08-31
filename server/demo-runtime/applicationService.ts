import { createHash } from "node:crypto";
import { z } from "zod";

import {
  normalizedEmailDomain,
  usesBlockedPublicEmailDomain,
} from "../../shared/businessEmail.js";
import {
  DEMO_HERO_MISSIONS,
  DEMO_OFFER_CATALOG,
  DEMO_ORGANIZATIONS,
  advanceDemoHeroMission,
  createDemoContract,
  createDemoHeroMission,
  createDemoOrder,
  createDemoOrderAcceptance,
  createDemoSession,
  createDemoSessionReset,
  isDemoIdOfKind,
  type DemoContract,
  type DemoHeroMission,
  type DemoId,
  type DemoMissionStep,
  type DemoOfferFixture,
  type DemoOrder,
  type DemoOrderAcceptance,
  type DemoOrganizationFixture,
} from "./index.js";
import {
  DEMO_ACCESS_GRANT_TTL_DAYS,
  DEMO_ACCESS_TOKEN_TTL_HOURS,
  DEMO_DEFAULT_SESSION_TTL_MINUTES,
  type DemoAccessGrantStore,
  type DemoAnalyticsPort,
  type DemoClock,
  type DemoIdGenerator,
  type DemoSessionRuntimeState,
  type DemoSessionStore,
  type DemoVerificationEmailSender,
  type DemoVerificationTokenPort,
  type PendingDemoAccessGrant,
} from "./ports.js";

const qualificationSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  businessEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  company: z.string().trim().min(1).max(160),
  country: z.string().trim().min(2).max(100),
  jobRole: z.string().trim().min(1).max(120),
  tradeRole: z.enum(["buyer", "seller", "both"]),
  primaryInterest: z.string().trim().min(1).max(160),
}).strict();

export type DemoQualificationInput = z.input<typeof qualificationSchema>;
export type DemoOfferFilter = Readonly<{
  category?: DemoOfferFixture["category"];
  side?: DemoOfferFixture["side"];
  query?: string;
}>;

export type DemoApplicationFailure =
  | "invalid_request"
  | "business_email_required"
  | "delivery_unavailable"
  | "invalid_or_expired_token"
  | "verified_grant_required"
  | "grant_expired"
  | "session_required"
  | "session_expired"
  | "session_forbidden"
  | "not_found"
  | "invalid_quantity"
  | "mission_sequence_violation"
  | "order_not_accepted";

export type DemoResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; code: DemoApplicationFailure }>;

export interface DemoApplicationContext {
  readonly grantId?: string;
  readonly demoSessionId?: string;
}

export interface DemoSimulationApplicationServiceDependencies {
  readonly accessGrants: DemoAccessGrantStore;
  readonly sessions: DemoSessionStore;
  readonly analytics: DemoAnalyticsPort;
  readonly clock: DemoClock;
  readonly ids: DemoIdGenerator;
  readonly tokens: DemoVerificationTokenPort;
  readonly emailSender: DemoVerificationEmailSender;
}

const ok = <T>(value: T): DemoResult<T> => Object.freeze({ ok: true, value });
const fail = <T = never>(code: DemoApplicationFailure): DemoResult<T> =>
  Object.freeze({ ok: false, code });

function digestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function plusMilliseconds(iso: string, milliseconds: number): string {
  return new Date(Date.parse(iso) + milliseconds).toISOString();
}

function freezeState(input: DemoSessionRuntimeState): DemoSessionRuntimeState {
  return Object.freeze({
    session: input.session,
    visitor: input.visitor,
    missions: Object.freeze([...input.missions]),
    orders: Object.freeze([...input.orders]),
    acceptances: Object.freeze([...input.acceptances]),
    contracts: Object.freeze([...input.contracts]),
    lastReset: input.lastReset,
  });
}

function bumpSession(state: DemoSessionRuntimeState): DemoSessionRuntimeState["session"] {
  return Object.freeze({
    ...state.session,
    stateVersion: state.session.stateVersion + 1,
  });
}

function decimal(value: string): { coefficient: bigint; scale: number } | undefined {
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return undefined;
  const [whole, fraction = ""] = value.split(".");
  const coefficient = BigInt(`${whole}${fraction}`);
  return coefficient > 0n ? { coefficient, scale: fraction.length } : undefined;
}

function compareDecimal(left: string, right: string): number | undefined {
  const a = decimal(left);
  const b = decimal(right);
  if (!a || !b) return undefined;
  const scale = Math.max(a.scale, b.scale);
  const av = a.coefficient * 10n ** BigInt(scale - a.scale);
  const bv = b.coefficient * 10n ** BigInt(scale - b.scale);
  return av < bv ? -1 : av > bv ? 1 : 0;
}

function multiplyDecimal(left: string, right: string): string | undefined {
  const a = decimal(left);
  const b = decimal(right);
  if (!a || !b) return undefined;
  const scale = a.scale + b.scale;
  const digits = (a.coefficient * b.coefficient).toString().padStart(scale + 1, "0");
  if (scale === 0) return digits;
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}

function sessionParticipantOrganizationId(
  sessionId: DemoId<"session">,
): DemoId<"org"> {
  return `demo:org:session-${sessionId.slice("demo:session:".length)}`;
}

function missionDefinitionForOffer(offerId: DemoId<"offer">) {
  return DEMO_HERO_MISSIONS.find((mission) => mission.offerId === offerId);
}

export function createDemoSimulationApplicationService(
  dependencies: DemoSimulationApplicationServiceDependencies,
) {
  async function loadActiveState(
    context: DemoApplicationContext,
  ): Promise<DemoResult<DemoSessionRuntimeState>> {
    if (
      !isDemoIdOfKind(context.grantId, "access-grant") ||
      !isDemoIdOfKind(context.demoSessionId, "session")
    ) {
      return fail("session_required");
    }
    const state = await dependencies.sessions.load(context.demoSessionId);
    if (!state) return fail("session_required");
    if (state.session.grantId !== context.grantId) return fail("session_forbidden");
    const now = dependencies.clock.now();
    if (Date.parse(state.session.expiresAt) <= Date.parse(now)) {
      await dependencies.analytics.emit({
        event: "demo_expired",
        occurredAt: now,
        demoSessionId: state.session.demoSessionId,
      });
      return fail("session_expired");
    }
    return ok(state);
  }

  async function saveMutation(
    state: DemoSessionRuntimeState,
    patch: Partial<Omit<DemoSessionRuntimeState, "session">>,
  ): Promise<DemoSessionRuntimeState> {
    const next = freezeState({
      ...state,
      ...patch,
      session: bumpSession(state),
    });
    await dependencies.sessions.save(next);
    return next;
  }

  async function advanceForAction(
    state: DemoSessionRuntimeState,
    offerId: DemoId<"offer">,
    step: DemoMissionStep,
  ): Promise<DemoSessionRuntimeState> {
    const definition = missionDefinitionForOffer(offerId);
    if (!definition) return state;
    const current = state.missions.find((mission) => mission.missionId === definition.missionId);
    if (!current || current.currentStep !== step) return state;
    const nextMission = advanceDemoHeroMission(current, step);
    if (!nextMission) return state;
    return saveMutation(state, {
      missions: state.missions.map((mission) =>
        mission.missionId === nextMission.missionId ? nextMission : mission,
      ),
    });
  }

  return Object.freeze({
    async requestAccess(input: DemoQualificationInput): Promise<DemoResult<{ accepted: true }>> {
      const parsed = qualificationSchema.safeParse(input);
      if (!parsed.success || !normalizedEmailDomain(parsed.data?.businessEmail ?? "")) {
        return fail("invalid_request");
      }
      if (usesBlockedPublicEmailDomain(parsed.data.businessEmail)) {
        return fail("business_email_required");
      }
      const requestedAt = dependencies.clock.now();
      const existing = await dependencies.accessGrants.findByNormalizedEmail(parsed.data.businessEmail);
      await dependencies.analytics.emit({
        event: "demo_requested",
        occurredAt: requestedAt,
        subjectReference: digestToken(parsed.data.businessEmail),
      });
      if (existing?.status === "verified") return ok({ accepted: true });

      const rawToken = dependencies.tokens.next();
      if (rawToken.length < 32) return fail("delivery_unavailable");
      const pending: PendingDemoAccessGrant = Object.freeze({
        grantId: dependencies.ids.next("access-grant"),
        normalizedBusinessEmail: parsed.data.businessEmail,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        company: parsed.data.company,
        country: parsed.data.country,
        jobRole: parsed.data.jobRole,
        tradeRole: parsed.data.tradeRole,
        primaryInterest: parsed.data.primaryInterest,
        tokenDigest: digestToken(rawToken),
        tokenExpiresAt: plusMilliseconds(requestedAt, DEMO_ACCESS_TOKEN_TTL_HOURS * 60 * 60 * 1000),
        requestedAt,
        status: "pending",
      });
      await dependencies.accessGrants.savePending(pending);
      try {
        await dependencies.emailSender.send({
          recipient: pending.normalizedBusinessEmail,
          token: rawToken,
        });
      } catch {
        await dependencies.accessGrants.removePending(pending.grantId);
        if (existing?.status === "pending") {
          await dependencies.accessGrants.savePending(existing);
        }
        return fail("delivery_unavailable");
      }
      return ok({ accepted: true });
    },

    async verifyAccess(token: unknown): Promise<DemoResult<{ grantId: DemoId<"access-grant"> }>> {
      if (typeof token !== "string" || token.length < 32 || token.length > 512) {
        return fail("invalid_or_expired_token");
      }
      const consumedAt = dependencies.clock.now();
      const verified = await dependencies.accessGrants.consumeVerificationToken({
        tokenDigest: digestToken(token),
        consumedAt,
        grantExpiresAt: plusMilliseconds(consumedAt, DEMO_ACCESS_GRANT_TTL_DAYS * 24 * 60 * 60 * 1000),
      });
      if (!verified) return fail("invalid_or_expired_token");
      await dependencies.analytics.emit({
        event: "email_verified",
        occurredAt: consumedAt,
        subjectReference: verified.grant.grantId,
      });
      return ok({ grantId: verified.grant.grantId });
    },

    async createSession(grantId: unknown): Promise<DemoResult<DemoSessionRuntimeState>> {
      if (!isDemoIdOfKind(grantId, "access-grant")) return fail("verified_grant_required");
      const record = await dependencies.accessGrants.getById(grantId);
      if (!record || record.status !== "verified") return fail("verified_grant_required");
      const startedAt = dependencies.clock.now();
      if (Date.parse(record.grant.expiresAt) <= Date.parse(startedAt)) return fail("grant_expired");
      const existing = await dependencies.sessions.findByGrantId(grantId);
      if (existing && Date.parse(existing.session.expiresAt) > Date.parse(startedAt)) return ok(existing);
      const session = createDemoSession({
        demoSessionId: dependencies.ids.next("session"),
        grantId,
        ownerUserReference: record.grant.userReference,
        startedAt,
        expiresAt: plusMilliseconds(startedAt, DEMO_DEFAULT_SESSION_TTL_MINUTES * 60 * 1000),
        ttlMinutes: DEMO_DEFAULT_SESSION_TTL_MINUTES,
      });
      if (!session) return fail("invalid_request");
      const state = freezeState({
        session,
        visitor: Object.freeze({
          firstName: record.grant.firstName,
          lastName: record.grant.lastName,
          company: record.grant.company,
          tradeRole: record.grant.participantIntent,
        }),
        missions: Object.freeze([]),
        orders: Object.freeze([]),
        acceptances: Object.freeze([]),
        contracts: Object.freeze([]),
        lastReset: null,
      });
      await dependencies.sessions.save(state);
      await dependencies.analytics.emit({
        event: "demo_started",
        occurredAt: startedAt,
        demoSessionId: session.demoSessionId,
      });
      return ok(state);
    },

    async getSession(context: DemoApplicationContext) {
      return loadActiveState(context);
    },

    async listOffers(context: DemoApplicationContext, filter: DemoOfferFilter = {}): Promise<DemoResult<readonly DemoOfferFixture[]>> {
      const loaded = await loadActiveState(context);
      if (!loaded.ok) return loaded;
      const query = filter.query?.trim().toLowerCase();
      const offers = DEMO_OFFER_CATALOG.filter((offer) =>
        (!filter.category || offer.category === filter.category) &&
        (!filter.side || offer.side === filter.side) &&
        (!query || offer.commodity.toLowerCase().includes(query) || offer.location.toLowerCase().includes(query)),
      );
      await dependencies.analytics.emit({
        event: "marketplace_viewed",
        occurredAt: dependencies.clock.now(),
        demoSessionId: loaded.value.session.demoSessionId,
      });
      return ok(Object.freeze(offers));
    },

    async getOffer(context: DemoApplicationContext, offerId: unknown): Promise<DemoResult<DemoOfferFixture>> {
      const loaded = await loadActiveState(context);
      if (!loaded.ok) return loaded;
      if (!isDemoIdOfKind(offerId, "offer")) return fail("not_found");
      const offer = DEMO_OFFER_CATALOG.find((candidate) => candidate.offerId === offerId);
      if (!offer) return fail("not_found");
      await advanceForAction(loaded.value, offer.offerId, "review_offer");
      await dependencies.analytics.emit({ event:"offer_viewed", occurredAt:dependencies.clock.now(), demoSessionId:loaded.value.session.demoSessionId, subjectReference:offer.offerId });
      return ok(offer);
    },

    async getOrganization(context: DemoApplicationContext, organizationId: unknown): Promise<DemoResult<DemoOrganizationFixture>> {
      const loaded = await loadActiveState(context);
      if (!loaded.ok) return loaded;
      if (!isDemoIdOfKind(organizationId, "org")) return fail("not_found");
      const organization = DEMO_ORGANIZATIONS.find((candidate) => candidate.organizationId === organizationId);
      if (!organization) return fail("not_found");
      const mission = loaded.value.missions.find((candidate) => candidate.currentStep === "review_organization" && DEMO_OFFER_CATALOG.find((offer) => offer.offerId === candidate.offerId)?.organizationId === organizationId);
      if (mission) await advanceForAction(loaded.value, mission.offerId, "review_organization");
      return ok(organization);
    },

    async getOfferEvidence(context: DemoApplicationContext, offerId: unknown) {
      const loaded = await loadActiveState(context);
      if (!loaded.ok) return loaded;
      if (!isDemoIdOfKind(offerId, "offer")) return fail("not_found");
      const offer = DEMO_OFFER_CATALOG.find((candidate) => candidate.offerId === offerId);
      if (!offer) return fail("not_found");
      await advanceForAction(loaded.value, offer.offerId, "review_evidence");
      await dependencies.analytics.emit({ event:"evidence_viewed", occurredAt:dependencies.clock.now(), demoSessionId:loaded.value.session.demoSessionId, subjectReference:offer.offerId });
      return ok(Object.freeze({ simulation:true as const, canonicalEvidence:false as const, offerId:offer.offerId, assuranceLevel:offer.assuranceLevel, assuranceLabel:offer.assuranceLabel, specifications:offer.specifications }));
    },

    async listMissions(context: DemoApplicationContext) {
      const loaded = await loadActiveState(context);
      if (!loaded.ok) return loaded;
      return ok(Object.freeze(DEMO_HERO_MISSIONS.map((definition) => Object.freeze({ definition, progress: loaded.value.missions.find((mission) => mission.missionId === definition.missionId) ?? null }))));
    },

    async getMission(context: DemoApplicationContext, missionId: unknown) {
      const loaded = await loadActiveState(context);
      if (!loaded.ok) return loaded;
      if (!isDemoIdOfKind(missionId, "mission")) return fail("not_found");
      const definition = DEMO_HERO_MISSIONS.find((mission) => mission.missionId === missionId);
      if (!definition) return fail("not_found");
      return ok(Object.freeze({ definition, progress: loaded.value.missions.find((mission) => mission.missionId === missionId) ?? null }));
    },

    async startMission(context: DemoApplicationContext, missionId: unknown): Promise<DemoResult<DemoHeroMission>> {
      const loaded = await loadActiveState(context);
      if (!loaded.ok) return loaded;
      if (!isDemoIdOfKind(missionId, "mission")) return fail("not_found");
      const existing = loaded.value.missions.find((mission) => mission.missionId === missionId);
      if (existing) return ok(existing);
      const definition = DEMO_HERO_MISSIONS.find((mission) => mission.missionId === missionId);
      if (!definition) return fail("not_found");
      const mission = createDemoHeroMission(definition, loaded.value.session.demoSessionId);
      if (!mission) return fail("invalid_request");
      await saveMutation(loaded.value, { missions: [...loaded.value.missions, mission] });
      return ok(mission);
    },

    async createOrder(context: DemoApplicationContext, input: { offerId: unknown; quantity: unknown }): Promise<DemoResult<DemoOrder>> {
      const loaded = await loadActiveState(context);
      if (!loaded.ok) return loaded;
      if (!isDemoIdOfKind(input.offerId, "offer") || typeof input.quantity !== "string") return fail("invalid_request");
      const offer = DEMO_OFFER_CATALOG.find((candidate) => candidate.offerId === input.offerId);
      if (!offer) return fail("not_found");
      const minimum = compareDecimal(input.quantity, offer.minimumQuantity);
      const available = compareDecimal(input.quantity, offer.quantity);
      if (minimum === undefined || minimum < 0 || available === undefined || available > 0) return fail("invalid_quantity");
      const mission = loaded.value.missions.find(
        (candidate) => candidate.offerId === offer.offerId,
      );
      const scenarioId = mission?.missionId;
      const participant = sessionParticipantOrganizationId(loaded.value.session.demoSessionId);
      const order = createDemoOrder({
        orderId: dependencies.ids.next("order"),
        demoSessionId: loaded.value.session.demoSessionId,
        ...(scenarioId ? { scenarioId } : {}),
        offerId: offer.offerId,
        buyerOrganizationId: offer.side === "sell" ? participant : offer.organizationId,
        sellerOrganizationId: offer.side === "sell" ? offer.organizationId : participant,
        quantity: input.quantity,
        unit: offer.unit,
        pricePerUnit: offer.pricePerUnit,
        currency: offer.currency,
        submittedAt: dependencies.clock.now(),
      });
      if (!order) return fail("invalid_request");
      await dependencies.analytics.emit({ event:"order_started", occurredAt:order.submittedAt, demoSessionId:order.demoSessionId, scenarioId:order.scenarioId });
      let next = await saveMutation(loaded.value, { orders: [...loaded.value.orders, order] });
      next = await advanceForAction(next, offer.offerId, "place_order");
      await dependencies.analytics.emit({ event:"order_submitted", occurredAt:order.submittedAt, demoSessionId:order.demoSessionId, scenarioId:order.scenarioId, subjectReference:order.orderId });
      return ok(order);
    },

    async acceptOrder(context: DemoApplicationContext, orderId: unknown): Promise<DemoResult<DemoOrderAcceptance>> {
      const loaded = await loadActiveState(context);
      if (!loaded.ok) return loaded;
      if (!isDemoIdOfKind(orderId, "order")) return fail("not_found");
      const order = loaded.value.orders.find((candidate) => candidate.orderId === orderId);
      if (!order) return fail("not_found");
      const existing = loaded.value.acceptances.find((candidate) => candidate.orderId === orderId);
      if (existing) return ok(existing);
      const acceptance = createDemoOrderAcceptance({
        acceptanceId: dependencies.ids.next("acceptance"),
        demoSessionId: order.demoSessionId,
        ...(order.scenarioId ? { scenarioId: order.scenarioId } : {}),
        orderId: order.orderId,
        acceptedAt: dependencies.clock.now(),
      });
      if (!acceptance) return fail("invalid_request");
      const acceptedOrder: DemoOrder = Object.freeze({ ...order, status:"accepted" });
      let next = await saveMutation(loaded.value, {
        orders: loaded.value.orders.map((candidate) =>
          candidate.orderId === order.orderId ? acceptedOrder : candidate,
        ),
        acceptances: [...loaded.value.acceptances, acceptance],
      });
      next = await advanceForAction(next, order.offerId, "seller_acceptance");
      await dependencies.analytics.emit({ event:"seller_acceptance_simulated", occurredAt:acceptance.acceptedAt, demoSessionId:acceptance.demoSessionId, scenarioId:acceptance.scenarioId, subjectReference:acceptance.orderId });
      return ok(acceptance);
    },

    async getOrder(context: DemoApplicationContext, orderId: unknown): Promise<DemoResult<DemoOrder>> {
      const loaded = await loadActiveState(context);
      if (!loaded.ok) return loaded;
      if (!isDemoIdOfKind(orderId, "order")) return fail("not_found");
      const order = loaded.value.orders.find((candidate) => candidate.orderId === orderId);
      return order ? ok(order) : fail("not_found");
    },

    async createContract(context: DemoApplicationContext, orderId: unknown): Promise<DemoResult<DemoContract>> {
      const loaded = await loadActiveState(context);
      if (!loaded.ok) return loaded;
      if (!isDemoIdOfKind(orderId, "order")) return fail("not_found");
      const order = loaded.value.orders.find((candidate) => candidate.orderId === orderId);
      if (!order) return fail("not_found");
      const acceptance = loaded.value.acceptances.find((candidate) => candidate.orderId === orderId);
      if (!acceptance || order.status !== "accepted") return fail("order_not_accepted");
      const existing = loaded.value.contracts.find((candidate) => candidate.orderId === orderId);
      if (existing) return ok(existing);
      const totalAmount = multiplyDecimal(order.quantity, order.pricePerUnit);
      if (!totalAmount) return fail("invalid_request");
      const contract = createDemoContract({
        contractId: dependencies.ids.next("contract"),
        demoSessionId: order.demoSessionId,
        ...(order.scenarioId ? { scenarioId: order.scenarioId } : {}),
        orderId: order.orderId,
        acceptanceId: acceptance.acceptanceId,
        offerId: order.offerId,
        buyerOrganizationId: order.buyerOrganizationId,
        sellerOrganizationId: order.sellerOrganizationId,
        quantity: order.quantity,
        unit: order.unit,
        pricePerUnit: order.pricePerUnit,
        totalAmount,
        currency: order.currency,
        createdAt: dependencies.clock.now(),
      });
      if (!contract) return fail("invalid_request");
      await saveMutation(loaded.value, { contracts: [...loaded.value.contracts, contract] });
      return ok(contract);
    },

    async getContract(context: DemoApplicationContext, contractId: unknown): Promise<DemoResult<DemoContract>> {
      const loaded = await loadActiveState(context);
      if (!loaded.ok) return loaded;
      if (!isDemoIdOfKind(contractId, "contract")) return fail("not_found");
      const contract = loaded.value.contracts.find((candidate) => candidate.contractId === contractId);
      if (!contract) return fail("not_found");
      await advanceForAction(loaded.value, contract.offerId, "view_contract");
      await dependencies.analytics.emit({ event:"contract_reached", occurredAt:dependencies.clock.now(), demoSessionId:contract.demoSessionId, scenarioId:contract.scenarioId, subjectReference:contract.contractId });
      return ok(contract);
    },

    async resetSession(context: DemoApplicationContext) {
      const loaded = await loadActiveState(context);
      if (!loaded.ok) return loaded;
      const resetAt = dependencies.clock.now();
      const reset = createDemoSessionReset(loaded.value.session, {
        ownerUserReference: loaded.value.session.ownerUserReference,
        resetAt,
      });
      if (!reset) return fail("session_forbidden");
      const next = freezeState({
        session: Object.freeze({ ...loaded.value.session, stateVersion: reset.nextStateVersion }),
        visitor: loaded.value.visitor,
        missions: Object.freeze([]),
        orders: Object.freeze([]),
        acceptances: Object.freeze([]),
        contracts: Object.freeze([]),
        lastReset: reset,
      });
      await dependencies.sessions.save(next);
      await dependencies.analytics.emit({ event:"demo_reset", occurredAt:resetAt, demoSessionId:next.session.demoSessionId });
      return ok(next);
    },
  });
}

export type DemoSimulationApplicationService = ReturnType<
  typeof createDemoSimulationApplicationService
>;
