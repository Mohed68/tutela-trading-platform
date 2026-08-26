import { isDemoIdOfKind, type DemoId } from "./ids.js";

export const DEMO_RUNTIME_CONTRACT_VERSION = "demo-runtime/v1" as const;
export const DEMO_SESSION_TTL_MINUTES = Object.freeze({ min: 60, max: 120 });
export const DEMO_CONTRACT_LEGAL_MARKER = "SIMULATION — NON-BINDING" as const;

export type DemoParticipantIntent = "buyer" | "seller" | "both";
export type DemoMissionStep =
  | "review_organization"
  | "review_offer"
  | "review_evidence"
  | "place_order"
  | "seller_acceptance"
  | "view_contract";

export const DEMO_MISSION_STEPS: readonly DemoMissionStep[] = Object.freeze([
  "review_organization",
  "review_offer",
  "review_evidence",
  "place_order",
  "seller_acceptance",
  "view_contract",
]);

export interface DemoAccessGrant {
  readonly contractVersion: typeof DEMO_RUNTIME_CONTRACT_VERSION;
  readonly grantId: DemoId<"access-grant">;
  readonly userReference: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly verifiedBusinessEmail: string;
  readonly company: string;
  readonly country: string;
  readonly jobRole: string;
  readonly participantIntent: DemoParticipantIntent;
  readonly primaryInterest: string;
  readonly grantedAt: string;
  readonly expiresAt: string;
  readonly simulation: true;
  readonly productionAuthority: false;
}

export interface DemoSession {
  readonly contractVersion: typeof DEMO_RUNTIME_CONTRACT_VERSION;
  readonly demoSessionId: DemoId<"session">;
  readonly grantId: DemoId<"access-grant">;
  readonly ownerUserReference: string;
  readonly startedAt: string;
  readonly expiresAt: string;
  readonly ttlMinutes: number;
  readonly stateVersion: number;
  readonly state: "active" | "expired" | "reset";
  readonly simulation: true;
  readonly productionAuthority: false;
}

export interface DemoSessionReset {
  readonly contractVersion: typeof DEMO_RUNTIME_CONTRACT_VERSION;
  readonly demoSessionId: DemoId<"session">;
  readonly ownerUserReference: string;
  readonly previousStateVersion: number;
  readonly nextStateVersion: number;
  readonly resetAt: string;
  readonly result: "baseline_restored";
  readonly clearsSessionOrders: true;
  readonly clearsSessionContracts: true;
  readonly clearsMissionProgress: true;
  readonly simulation: true;
}

export interface DemoHeroMissionDefinition {
  readonly missionId: DemoId<"mission">;
  readonly title: string;
  readonly purpose: string;
  readonly commodity: string;
  readonly offerId: DemoId<"offer">;
  readonly estimatedMinutes: number;
  readonly steps: readonly DemoMissionStep[];
}

export interface DemoHeroMission {
  readonly contractVersion: typeof DEMO_RUNTIME_CONTRACT_VERSION;
  readonly demoSessionId: DemoId<"session">;
  readonly missionId: DemoId<"mission">;
  readonly title: string;
  readonly commodity: string;
  readonly offerId: DemoId<"offer">;
  readonly estimatedMinutes: number;
  readonly steps: readonly DemoMissionStep[];
  readonly currentStep: DemoMissionStep | null;
  readonly completedSteps: readonly DemoMissionStep[];
  readonly completionState: "not_started" | "in_progress" | "completed";
  readonly simulation: true;
}

export interface DemoOrder {
  readonly contractVersion: typeof DEMO_RUNTIME_CONTRACT_VERSION;
  readonly orderId: DemoId<"order">;
  readonly demoSessionId: DemoId<"session">;
  readonly scenarioId: DemoId<"mission">;
  readonly offerId: DemoId<"offer">;
  readonly buyerOrganizationId: DemoId<"org">;
  readonly sellerOrganizationId: DemoId<"org">;
  readonly quantity: string;
  readonly unit: string;
  readonly pricePerUnit: string;
  readonly currency: string;
  readonly status: "submitted" | "accepted";
  readonly submittedAt: string;
  readonly simulation: true;
  readonly nonBinding: true;
}

export interface DemoOrderAcceptance {
  readonly contractVersion: typeof DEMO_RUNTIME_CONTRACT_VERSION;
  readonly acceptanceId: DemoId<"acceptance">;
  readonly demoSessionId: DemoId<"session">;
  readonly scenarioId: DemoId<"mission">;
  readonly orderId: DemoId<"order">;
  readonly acceptedAt: string;
  readonly mode: "deterministic_simulation";
  readonly simulation: true;
  readonly nonBinding: true;
}

export interface DemoContract {
  readonly contractVersion: typeof DEMO_RUNTIME_CONTRACT_VERSION;
  readonly contractId: DemoId<"contract">;
  readonly demoSessionId: DemoId<"session">;
  readonly scenarioId: DemoId<"mission">;
  readonly orderId: DemoId<"order">;
  readonly acceptanceId: DemoId<"acceptance">;
  readonly offerId: DemoId<"offer">;
  readonly buyerOrganizationId: DemoId<"org">;
  readonly sellerOrganizationId: DemoId<"org">;
  readonly quantity: string;
  readonly unit: string;
  readonly pricePerUnit: string;
  readonly totalAmount: string;
  readonly currency: string;
  readonly createdAt: string;
  readonly legalMarker: typeof DEMO_CONTRACT_LEGAL_MARKER;
  readonly simulation: true;
  readonly nonBinding: true;
}

function validIso(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function positiveDecimal(value: string): boolean {
  return /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) && Number(value) > 0;
}

export function createDemoSession(input: {
  demoSessionId: DemoId<"session">;
  grantId: DemoId<"access-grant">;
  ownerUserReference: string;
  startedAt: string;
  expiresAt: string;
  ttlMinutes: number;
}): DemoSession | undefined {
  if (
    !isDemoIdOfKind(input.demoSessionId, "session") ||
    !isDemoIdOfKind(input.grantId, "access-grant") ||
    !input.ownerUserReference.trim() ||
    !validIso(input.startedAt) ||
    !validIso(input.expiresAt) ||
    input.ttlMinutes < DEMO_SESSION_TTL_MINUTES.min ||
    input.ttlMinutes > DEMO_SESSION_TTL_MINUTES.max ||
    Date.parse(input.expiresAt) <= Date.parse(input.startedAt)
  ) {
    return undefined;
  }
  return Object.freeze({
    contractVersion: DEMO_RUNTIME_CONTRACT_VERSION,
    ...input,
    stateVersion: 1,
    state: "active",
    simulation: true,
    productionAuthority: false,
  });
}

export function createDemoHeroMission(
  definition: DemoHeroMissionDefinition,
  demoSessionId: DemoId<"session">,
): DemoHeroMission | undefined {
  if (
    !isDemoIdOfKind(demoSessionId, "session") ||
    !isDemoIdOfKind(definition.missionId, "mission") ||
    !isDemoIdOfKind(definition.offerId, "offer") ||
    definition.steps.length === 0
  ) {
    return undefined;
  }
  return Object.freeze({
    contractVersion: DEMO_RUNTIME_CONTRACT_VERSION,
    demoSessionId,
    missionId: definition.missionId,
    title: definition.title,
    commodity: definition.commodity,
    offerId: definition.offerId,
    estimatedMinutes: definition.estimatedMinutes,
    steps: Object.freeze([...definition.steps]),
    currentStep: definition.steps[0] ?? null,
    completedSteps: Object.freeze([]),
    completionState: "not_started",
    simulation: true,
  });
}

export function advanceDemoHeroMission(
  mission: DemoHeroMission,
  completedStep: DemoMissionStep,
): DemoHeroMission | undefined {
  if (
    mission.completionState === "completed" ||
    mission.currentStep !== completedStep
  ) {
    return undefined;
  }
  const completedSteps = Object.freeze([
    ...mission.completedSteps,
    completedStep,
  ]);
  const nextStep = mission.steps[completedSteps.length] ?? null;
  return Object.freeze({
    ...mission,
    currentStep: nextStep,
    completedSteps,
    completionState: nextStep === null ? "completed" : "in_progress",
  });
}

export function createDemoSessionReset(
  session: DemoSession,
  input: { ownerUserReference: string; resetAt: string },
): DemoSessionReset | undefined {
  if (
    session.ownerUserReference !== input.ownerUserReference ||
    !validIso(input.resetAt) ||
    Date.parse(input.resetAt) < Date.parse(session.startedAt)
  ) {
    return undefined;
  }
  return Object.freeze({
    contractVersion: DEMO_RUNTIME_CONTRACT_VERSION,
    demoSessionId: session.demoSessionId,
    ownerUserReference: input.ownerUserReference,
    previousStateVersion: session.stateVersion,
    nextStateVersion: session.stateVersion + 1,
    resetAt: input.resetAt,
    result: "baseline_restored",
    clearsSessionOrders: true,
    clearsSessionContracts: true,
    clearsMissionProgress: true,
    simulation: true,
  });
}

export function createDemoOrder(
  input: Omit<DemoOrder, "contractVersion" | "simulation" | "nonBinding" | "status">,
): DemoOrder | undefined {
  if (
    !isDemoIdOfKind(input.orderId, "order") ||
    !isDemoIdOfKind(input.demoSessionId, "session") ||
    !isDemoIdOfKind(input.scenarioId, "mission") ||
    !isDemoIdOfKind(input.offerId, "offer") ||
    !isDemoIdOfKind(input.buyerOrganizationId, "org") ||
    !isDemoIdOfKind(input.sellerOrganizationId, "org") ||
    input.buyerOrganizationId === input.sellerOrganizationId ||
    !positiveDecimal(input.quantity) ||
    !positiveDecimal(input.pricePerUnit) ||
    !input.unit.trim() ||
    !input.currency.trim() ||
    !validIso(input.submittedAt)
  ) {
    return undefined;
  }
  return Object.freeze({
    contractVersion: DEMO_RUNTIME_CONTRACT_VERSION,
    ...input,
    status: "submitted",
    simulation: true,
    nonBinding: true,
  });
}

export function createDemoOrderAcceptance(
  input: Omit<DemoOrderAcceptance, "contractVersion" | "mode" | "simulation" | "nonBinding">,
): DemoOrderAcceptance | undefined {
  if (
    !isDemoIdOfKind(input.acceptanceId, "acceptance") ||
    !isDemoIdOfKind(input.demoSessionId, "session") ||
    !isDemoIdOfKind(input.scenarioId, "mission") ||
    !isDemoIdOfKind(input.orderId, "order") ||
    !validIso(input.acceptedAt)
  ) {
    return undefined;
  }
  return Object.freeze({
    contractVersion: DEMO_RUNTIME_CONTRACT_VERSION,
    ...input,
    mode: "deterministic_simulation",
    simulation: true,
    nonBinding: true,
  });
}

export function createDemoContract(
  input: Omit<DemoContract, "contractVersion" | "legalMarker" | "simulation" | "nonBinding">,
): DemoContract | undefined {
  if (
    !isDemoIdOfKind(input.contractId, "contract") ||
    !isDemoIdOfKind(input.demoSessionId, "session") ||
    !isDemoIdOfKind(input.scenarioId, "mission") ||
    !isDemoIdOfKind(input.orderId, "order") ||
    !isDemoIdOfKind(input.acceptanceId, "acceptance") ||
    !isDemoIdOfKind(input.offerId, "offer") ||
    !isDemoIdOfKind(input.buyerOrganizationId, "org") ||
    !isDemoIdOfKind(input.sellerOrganizationId, "org") ||
    !positiveDecimal(input.quantity) ||
    !positiveDecimal(input.pricePerUnit) ||
    !positiveDecimal(input.totalAmount) ||
    !validIso(input.createdAt)
  ) {
    return undefined;
  }
  return Object.freeze({
    contractVersion: DEMO_RUNTIME_CONTRACT_VERSION,
    ...input,
    legalMarker: DEMO_CONTRACT_LEGAL_MARKER,
    simulation: true,
    nonBinding: true,
  });
}
