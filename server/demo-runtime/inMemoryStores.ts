import type { DemoId } from "./ids.js";
import type {
  DemoAccessGrantRecord,
  DemoAccessGrantStore,
  DemoAnalyticsEvent,
  DemoAnalyticsPort,
  DemoSessionRuntimeState,
  DemoSessionStore,
  PendingDemoAccessGrant,
  VerifiedDemoAccessGrantRecord,
} from "./ports.js";

export class InMemoryDemoAccessGrantStore implements DemoAccessGrantStore {
  readonly #byId = new Map<DemoId<"access-grant">, DemoAccessGrantRecord>();
  readonly #byEmail = new Map<string, DemoId<"access-grant">>();

  async findByNormalizedEmail(email: string): Promise<DemoAccessGrantRecord | undefined> {
    const id = this.#byEmail.get(email);
    return id ? this.#byId.get(id) : undefined;
  }

  async getById(grantId: DemoId<"access-grant">): Promise<DemoAccessGrantRecord | undefined> {
    return this.#byId.get(grantId);
  }

  async savePending(record: PendingDemoAccessGrant): Promise<void> {
    const previous = this.#byEmail.get(record.normalizedBusinessEmail);
    if (previous) this.#byId.delete(previous);
    this.#byId.set(record.grantId, record);
    this.#byEmail.set(record.normalizedBusinessEmail, record.grantId);
  }

  async consumeVerificationToken(input: {
    tokenDigest: string;
    consumedAt: string;
    grantExpiresAt: string;
  }): Promise<VerifiedDemoAccessGrantRecord | undefined> {
    const pending = [...this.#byId.values()].find(
      (record): record is PendingDemoAccessGrant =>
        record.status === "pending" && record.tokenDigest === input.tokenDigest,
    );
    if (!pending || Date.parse(pending.tokenExpiresAt) <= Date.parse(input.consumedAt)) {
      return undefined;
    }
    const verified: VerifiedDemoAccessGrantRecord = Object.freeze({
      status: "verified",
      tokenConsumedAt: input.consumedAt,
      grant: Object.freeze({
        contractVersion: "demo-runtime/v1",
        grantId: pending.grantId,
        userReference: `demo-qualified:${pending.grantId}`,
        firstName: pending.firstName,
        lastName: pending.lastName,
        verifiedBusinessEmail: pending.normalizedBusinessEmail,
        company: pending.company,
        country: pending.country,
        jobRole: pending.jobRole,
        participantIntent: pending.tradeRole,
        primaryInterest: pending.primaryInterest,
        grantedAt: input.consumedAt,
        expiresAt: input.grantExpiresAt,
        simulation: true,
        productionAuthority: false,
      }),
    });
    this.#byId.set(pending.grantId, verified);
    return verified;
  }

  async removePending(grantId: DemoId<"access-grant">): Promise<void> {
    const record = this.#byId.get(grantId);
    if (record?.status !== "pending") return;
    this.#byId.delete(grantId);
    if (this.#byEmail.get(record.normalizedBusinessEmail) === grantId) {
      this.#byEmail.delete(record.normalizedBusinessEmail);
    }
  }
}

export class InMemoryDemoSessionStore implements DemoSessionStore {
  readonly #byId = new Map<DemoId<"session">, DemoSessionRuntimeState>();
  readonly #byGrant = new Map<DemoId<"access-grant">, DemoId<"session">>();

  async findByGrantId(grantId: DemoId<"access-grant">): Promise<DemoSessionRuntimeState | undefined> {
    const id = this.#byGrant.get(grantId);
    return id ? this.#byId.get(id) : undefined;
  }

  async load(demoSessionId: DemoId<"session">): Promise<DemoSessionRuntimeState | undefined> {
    return this.#byId.get(demoSessionId);
  }

  async save(state: DemoSessionRuntimeState): Promise<void> {
    this.#byId.set(state.session.demoSessionId, state);
    this.#byGrant.set(state.session.grantId, state.session.demoSessionId);
  }
}

export class InMemoryDemoAnalyticsAdapter implements DemoAnalyticsPort {
  readonly events: DemoAnalyticsEvent[] = [];

  async emit(event: DemoAnalyticsEvent): Promise<void> {
    this.events.push(Object.freeze({ ...event }));
  }
}

export const noOpDemoAnalytics: DemoAnalyticsPort = Object.freeze({
  async emit() {},
});
