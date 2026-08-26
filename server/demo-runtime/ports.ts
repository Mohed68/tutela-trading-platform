import type {
  DemoAccessGrant,
  DemoContract,
  DemoHeroMission,
  DemoOrder,
  DemoOrderAcceptance,
  DemoSession,
  DemoSessionReset,
} from "./contracts.js";
import type { DemoId } from "./ids.js";

export const DEMO_ACCESS_TOKEN_TTL_HOURS = 24;
export const DEMO_ACCESS_GRANT_TTL_DAYS = 7;
export const DEMO_DEFAULT_SESSION_TTL_MINUTES = 90;

export interface PendingDemoAccessGrant {
  readonly grantId: DemoId<"access-grant">;
  readonly normalizedBusinessEmail: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly company: string;
  readonly country: string;
  readonly jobRole: string;
  readonly tradeRole: "buyer" | "seller" | "both";
  readonly primaryInterest: string;
  readonly tokenDigest: string;
  readonly tokenExpiresAt: string;
  readonly requestedAt: string;
  readonly status: "pending";
}

export interface VerifiedDemoAccessGrantRecord {
  readonly grant: DemoAccessGrant;
  readonly status: "verified";
  readonly tokenConsumedAt: string;
}

export type DemoAccessGrantRecord =
  | PendingDemoAccessGrant
  | VerifiedDemoAccessGrantRecord;

export interface DemoAccessGrantStore {
  findByNormalizedEmail(email: string): Promise<DemoAccessGrantRecord | undefined>;
  getById(grantId: DemoId<"access-grant">): Promise<DemoAccessGrantRecord | undefined>;
  savePending(record: PendingDemoAccessGrant): Promise<void>;
  consumeVerificationToken(input: {
    tokenDigest: string;
    consumedAt: string;
    grantExpiresAt: string;
  }): Promise<VerifiedDemoAccessGrantRecord | undefined>;
  removePending(grantId: DemoId<"access-grant">): Promise<void>;
}

export interface DemoSessionRuntimeState {
  readonly session: DemoSession;
  readonly visitor: Readonly<{
    firstName: string;
    lastName: string;
    company: string;
    tradeRole: "buyer" | "seller" | "both";
  }>;
  readonly missions: readonly DemoHeroMission[];
  readonly orders: readonly DemoOrder[];
  readonly acceptances: readonly DemoOrderAcceptance[];
  readonly contracts: readonly DemoContract[];
  readonly lastReset: DemoSessionReset | null;
}

export interface DemoSessionStore {
  findByGrantId(grantId: DemoId<"access-grant">): Promise<DemoSessionRuntimeState | undefined>;
  load(demoSessionId: DemoId<"session">): Promise<DemoSessionRuntimeState | undefined>;
  save(state: DemoSessionRuntimeState): Promise<void>;
}

export const DEMO_ANALYTICS_EVENTS = [
  "demo_requested",
  "email_verified",
  "demo_started",
  "marketplace_viewed",
  "offer_viewed",
  "evidence_viewed",
  "order_started",
  "order_submitted",
  "seller_acceptance_simulated",
  "contract_reached",
  "demo_reset",
  "demo_expired",
] as const;

export type DemoAnalyticsEventName = (typeof DEMO_ANALYTICS_EVENTS)[number];

export interface DemoAnalyticsEvent {
  readonly event: DemoAnalyticsEventName;
  readonly occurredAt: string;
  readonly demoSessionId?: DemoId<"session">;
  readonly scenarioId?: DemoId<"mission">;
  readonly subjectReference?: string;
}

export interface DemoAnalyticsPort {
  emit(event: DemoAnalyticsEvent): Promise<void>;
}

export interface DemoClock {
  now(): string;
}

export interface DemoIdGenerator {
  next<Kind extends DemoGeneratedIdKind>(kind: Kind): DemoId<Kind>;
}

type DemoGeneratedIdKind =
  | "access-grant"
  | "session"
  | "order"
  | "acceptance"
  | "contract";

export interface DemoVerificationTokenPort {
  next(): string;
}

export interface DemoVerificationEmailSender {
  send(input: { recipient: string; token: string }): Promise<void>;
}
