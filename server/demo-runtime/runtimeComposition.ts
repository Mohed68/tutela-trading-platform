import { randomBytes, randomUUID } from "node:crypto";

import { getVerificationEmailConfiguration } from "../verificationEmail.js";
import { createDemoSimulationApplicationService } from "./applicationService.js";
import { createDemoResendEmailSender } from "./email.js";
import {
  InMemoryDemoAccessGrantStore,
  InMemoryDemoSessionStore,
  noOpDemoAnalytics,
} from "./inMemoryStores.js";
import type { DemoVerificationEmailSender } from "./ports.js";

const unavailableEmailSender: DemoVerificationEmailSender = Object.freeze({
  async send() {
    throw new Error("DEMO_EMAIL_DELIVERY_UNAVAILABLE");
  },
});

export function createInMemoryDemoRuntime(
  environment: NodeJS.ProcessEnv = process.env,
) {
  const emailConfiguration = getVerificationEmailConfiguration(environment);
  return createDemoSimulationApplicationService({
    accessGrants: new InMemoryDemoAccessGrantStore(),
    sessions: new InMemoryDemoSessionStore(),
    analytics: noOpDemoAnalytics,
    clock: Object.freeze({ now: () => new Date().toISOString() }),
    ids: Object.freeze({
      next: <Kind extends "access-grant" | "session" | "order" | "acceptance" | "contract">(
        kind: Kind,
      ) => `demo:${kind}:${randomUUID()}` as const,
    }),
    tokens: Object.freeze({ next: () => randomBytes(32).toString("base64url") }),
    emailSender: emailConfiguration
      ? createDemoResendEmailSender(emailConfiguration)
      : unavailableEmailSender,
  });
}
