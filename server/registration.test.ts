import assert from "node:assert/strict";
import test from "node:test";
import {
  activateLocalAccount,
  buildEmailVerificationUrl,
  digestEmailVerificationToken,
  registerLocalAccount,
  registrationSchema,
} from "./registration.js";
import { getVerificationEmailConfiguration } from "./verificationEmail.js";

const validInput = {
  firstName: "Ada",
  lastName: "Trader",
  email: "ADA@EXAMPLE.COM",
  password: "SafePassword123",
};

test("registration policy normalizes email and rejects weak credentials", () => {
  assert.equal(registrationSchema.parse(validInput).email, "ada@example.com");
  assert.equal(
    registrationSchema.safeParse({ ...validInput, password: "password" })
      .success,
    false,
  );
});

test("verification tokens are stored only as deterministic digests", () => {
  const digest = digestEmailVerificationToken("opaque-token-value");
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.ok(!digest.includes("opaque-token-value"));
});

test("registration creates a disabled account and sends one verification URL", async () => {
  let registration: any;
  let delivery: any;
  const result = await registerLocalAccount(validInput, {
    storage: {
      async createPendingLocalRegistration(input) {
        registration = input;
        return { id: "new-user", email: input.email, createdNew: true };
      },
      async discardPendingLocalRegistrationAttempt() {
        assert.fail("successful delivery must not remove the account");
      },
    },
    sender: {
      async send(input) {
        delivery = input;
      },
    },
    applicationBaseUrl: "https://tutela.example",
    now: new Date("2026-01-01T00:00:00.000Z"),
  });

  assert.deepEqual(result, { accepted: true });
  assert.equal(registration.email, "ada@example.com");
  assert.equal(registration.passwordHash.startsWith("scrypt-v1$"), true);
  assert.match(registration.tokenDigest, /^[a-f0-9]{64}$/);
  assert.equal(
    registration.tokenExpiresAt.toISOString(),
    "2026-01-02T00:00:00.000Z",
  );
  assert.match(delivery.verificationUrl, /^https:\/\/tutela\.example\/verify-email\?token=/);
});

test("failed email delivery removes only the new pending account", async () => {
  const removed: string[] = [];
  await assert.rejects(
    registerLocalAccount(validInput, {
      storage: {
        async createPendingLocalRegistration() {
          return {
            id: "pending-user",
            email: "ada@example.com",
            createdNew: true,
          };
        },
        async discardPendingLocalRegistrationAttempt(input) {
          removed.push(input.userId);
          assert.equal(input.removeAccount, true);
          assert.match(input.tokenDigest, /^[a-f0-9]{64}$/);
        },
      },
      sender: {
        async send() {
          throw new Error("EMAIL_VERIFICATION_DELIVERY_FAILED");
        },
      },
      applicationBaseUrl: "https://tutela.example",
    }),
    /EMAIL_VERIFICATION_DELIVERY_FAILED/,
  );
  assert.deepEqual(removed, ["pending-user"]);
});

test("failed resend preserves an existing pending account", async () => {
  let discard: { removeAccount: boolean } | undefined;
  await assert.rejects(
    registerLocalAccount(validInput, {
      storage: {
        async createPendingLocalRegistration() {
          return {
            id: "existing-pending-user",
            email: "ada@example.com",
            createdNew: false,
          };
        },
        async discardPendingLocalRegistrationAttempt(input) {
          discard = { removeAccount: input.removeAccount };
        },
      },
      sender: {
        async send() {
          throw new Error("EMAIL_VERIFICATION_DELIVERY_FAILED");
        },
      },
      applicationBaseUrl: "https://tutela.example",
    }),
    /EMAIL_VERIFICATION_DELIVERY_FAILED/,
  );
  assert.deepEqual(discard, { removeAccount: false });
});

test("activation delegates only a token digest and explicit timestamp", async () => {
  const now = new Date("2026-02-01T00:00:00.000Z");
  let received: { digest: string; at: Date } | undefined;
  const result = await activateLocalAccount("a".repeat(32), {
    storage: {
      async activateLocalRegistration(digest, at) {
        received = { digest, at };
        return undefined;
      },
    },
    now,
  });
  assert.equal(result, undefined);
  assert.match(received!.digest, /^[a-f0-9]{64}$/);
  assert.equal(received!.at, now);
});

test("production email delivery requires every confidential setting", () => {
  assert.equal(
    getVerificationEmailConfiguration({ NODE_ENV: "production" }),
    undefined,
  );
  assert.equal(
    getVerificationEmailConfiguration({
      NODE_ENV: "production",
      RESEND_API_KEY: "configured-secret",
      EMAIL_FROM: "Tutela <accounts@example.com>",
      APP_BASE_URL: "http://example.com",
    }),
    undefined,
  );
  assert.deepEqual(
    getVerificationEmailConfiguration({
      NODE_ENV: "production",
      RESEND_API_KEY: "configured-secret",
      EMAIL_FROM: "Tutela <accounts@example.com>",
      APP_BASE_URL: "https://example.com",
    }),
    {
      apiKey: "configured-secret",
      sender: "Tutela <accounts@example.com>",
      applicationBaseUrl: "https://example.com/",
    },
  );
});

test("verification URL preserves only the opaque token", () => {
  const url = new URL(
    buildEmailVerificationUrl("https://example.com/base", "opaque-token"),
  );
  assert.equal(url.pathname, "/verify-email");
  assert.equal(url.searchParams.get("token"), "opaque-token");
});
