import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  activateLocalAccount,
  buildEmailVerificationUrl,
  digestEmailVerificationToken,
  registerLocalAccount,
  registerTemporaryDirectLocalAccount,
  requestAuthenticatedEmailVerification,
  registrationSchema,
} from "./registration.js";
import { getRegistrationActivationMode } from "./registrationPolicy.js";
import {
  buildVerificationEmailContent,
  createResendVerificationEmailSender,
  getVerificationEmailConfiguration,
} from "./verificationEmail.js";

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

test("registration rejects normalized public email domains and accepts custom business domains", () => {
  for (const email of [
    "trader@gmail.com",
    "trader@outlook.com",
    "trader@hotmail.com",
    "trader@yahoo.com",
    "Trader@GmAiL.CoM",
  ]) {
    assert.equal(
      registrationSchema.safeParse({ ...validInput, email }).success,
      false,
      `${email} must be rejected`,
    );
  }

  const accepted = registrationSchema.parse({
    ...validInput,
    email: "Trader@Acme-Commodities.COM",
  });
  assert.equal(accepted.email, "trader@acme-commodities.com");
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

test("existing accounts preserve the same accepted registration result", async () => {
  let deliveryAttempted = false;
  const result = await registerLocalAccount(validInput, {
    storage: {
      async createPendingLocalRegistration() {
        return null;
      },
      async discardPendingLocalRegistrationAttempt() {
        assert.fail("no delivery was attempted");
      },
    },
    sender: {
      async send() {
        deliveryAttempted = true;
      },
    },
    applicationBaseUrl: "https://tutela.example",
  });

  assert.deepEqual(result, { accepted: true });
  assert.equal(deliveryAttempted, false);
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

test("authenticated legacy account receives a secret verification link for its canonical email", async () => {
  let stored: any;
  let delivered: any;
  const result = await requestAuthenticatedEmailVerification("authenticated-user", {
    storage: {
      async createAuthenticatedEmailVerificationAttempt(input) {
        stored = input;
        return { status: "created", email: "canonical@example.com" } as const;
      },
      async discardAuthenticatedEmailVerificationAttempt() { assert.fail("successful delivery must retain the digest"); },
    },
    sender: { async send(input) { delivered = input; } },
    applicationBaseUrl: "https://tutela.example",
    now: new Date("2026-09-08T12:00:00.000Z"),
  });
  assert.deepEqual(result, { status: "sent", email: "canonical@example.com" });
  assert.equal(stored.userId, "authenticated-user");
  assert.match(stored.tokenDigest, /^[a-f0-9]{64}$/);
  assert.equal(stored.tokenExpiresAt.toISOString(), "2026-09-09T12:00:00.000Z");
  assert.match(delivered.verificationUrl, /^https:\/\/tutela\.example\/verify-email\?token=/);
  assert.equal(delivered.recipient, "canonical@example.com");
  assert.doesNotMatch(JSON.stringify(result), /token/i);
});

test("verified and cooldown accounts do not receive unnecessary verification email", async () => {
  for (const attempt of [{ status: "already_verified" } as const, { status: "cooldown", retryAfterSeconds: 45 } as const]) {
    let sends = 0;
    const result = await requestAuthenticatedEmailVerification("authenticated-user", {
      storage: {
        async createAuthenticatedEmailVerificationAttempt() { return attempt; },
        async discardAuthenticatedEmailVerificationAttempt() { assert.fail("nothing was created"); },
      },
      sender: { async send() { sends += 1; } },
      applicationBaseUrl: "https://tutela.example",
    });
    assert.deepEqual(result, attempt);
    assert.equal(sends, 0);
  }
});

test("failed authenticated delivery removes only its new secret token", async () => {
  let discarded: any;
  await assert.rejects(requestAuthenticatedEmailVerification("authenticated-user", {
    storage: {
      async createAuthenticatedEmailVerificationAttempt() { return { status: "created", email: "canonical@example.com" } as const; },
      async discardAuthenticatedEmailVerificationAttempt(input) { discarded = input; },
    },
    sender: { async send() { throw new Error("EMAIL_VERIFICATION_DELIVERY_FAILED"); } },
    applicationBaseUrl: "https://tutela.example",
  }), /EMAIL_VERIFICATION_DELIVERY_FAILED/);
  assert.equal(discarded.userId, "authenticated-user");
  assert.match(discarded.tokenDigest, /^[a-f0-9]{64}$/);
});

test("authenticated verification HTTP boundary accepts no browser identity and grants no authority", () => {
  const authSource = fs.readFileSync(path.join(process.cwd(), "server/auth.ts"), "utf8");
  const route = authSource.slice(authSource.indexOf('"/api/auth/email-verification/request"'), authSource.indexOf('app.post("/api/auth/verify-email"'));
  assert.match(route, /isAuthenticated/);
  assert.match(route, /req\.user!\.claims\.sub/);
  assert.doesNotMatch(route, /req\.body|targetUserId|targetEmail|PlatformOwnership|MfaService|markMfa/);
});

test("verification activation retires only temporary registration provenance", () => {
  const storageSource = fs.readFileSync(path.join(process.cwd(), "server/storage.ts"), "utf8");
  const activation = storageSource.slice(storageSource.indexOf("async activateLocalRegistration("), storageSource.indexOf("async discardPendingLocalRegistrationAttempt("));
  assert.match(activation, /emailVerifiedAt:\s*verifiedAt/);
  assert.match(activation, /recoveryProvenance:\s*null/);
  assert.doesNotMatch(activation, /is_2fa_enabled|platform_ownership|platform_role/);
  assert.match(activation, /token\.expiresAt\.getTime\(\) <= verifiedAt\.getTime\(\)/);
  assert.match(activation, /consumedAt:\s*verifiedAt/);
});

test("correct token activates while expired and invalid tokens fail closed", async () => {
  const raw = "v".repeat(32);
  const digest = digestEmailVerificationToken(raw);
  const expiry = new Date("2026-09-09T00:00:00.000Z");
  const storage = {
    async activateLocalRegistration(candidate: string, verifiedAt: Date) {
      if (candidate !== digest || expiry.getTime() <= verifiedAt.getTime()) return undefined;
      return { id: "legacy", email: "canonical@example.com", passwordHash: "present", authProvider: "local", lastLoginAt: null, loginEnabled: true, credentialStatus: "active", recoveryProvenance: null, role: "trader", emailVerifiedAt: verifiedAt };
    },
  };
  assert.equal(await activateLocalAccount("x".repeat(32), { storage, now: new Date("2026-09-08T00:00:00.000Z") }), undefined);
  assert.equal(await activateLocalAccount(raw, { storage, now: expiry }), undefined);
  assert.equal((await activateLocalAccount(raw, { storage, now: new Date("2026-09-08T00:00:00.000Z") }))?.id, "legacy");
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

test("verification email contains branded HTML and a complete text fallback", () => {
  const verificationUrl =
    "https://tutela.example/verify-email?token=opaque-token";
  const content = buildVerificationEmailContent(
    { applicationBaseUrl: "https://tutela.example/" },
    verificationUrl,
  );

  assert.equal(content.subject, "Verify your TUTELA account");
  assert.match(content.html, /Verify my account/);
  assert.match(content.html, /https:\/\/tutela\.example\/tutela-logo\.png/);
  assert.ok(content.html.includes(verificationUrl));
  assert.match(content.html, /expires in 24 hours/);
  assert.ok(content.text.includes(verificationUrl));
  assert.match(content.text, /Verify my account/);
  assert.doesNotMatch(content.html, /configured-secret|RESEND_API_KEY|SESSION_SECRET/);
  assert.doesNotMatch(content.text, /configured-secret|RESEND_API_KEY|SESSION_SECRET/);
});

test("Resend delivery supplies both HTML and text without leaking the API key", async () => {
  const originalFetch = globalThis.fetch;
  let authorization = "";
  let payload: Record<string, unknown> | undefined;
  globalThis.fetch = async (_input, init) => {
    authorization = String((init?.headers as Record<string, string>).authorization);
    payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(null, { status: 202 });
  };

  try {
    await createResendVerificationEmailSender({
      apiKey: "configured-secret",
      sender: "no-reply@tutelaworld.com",
      applicationBaseUrl: "https://tutela.example/",
    }).send({
      recipient: "trader@acme.example",
      verificationUrl:
        "https://tutela.example/verify-email?token=opaque-token",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(authorization, "Bearer configured-secret");
  assert.equal(typeof payload?.html, "string");
  assert.equal(typeof payload?.text, "string");
  assert.equal(payload?.subject, "Verify your TUTELA account");
  assert.doesNotMatch(String(payload?.html), /configured-secret/);
  assert.doesNotMatch(String(payload?.text), /configured-secret/);
});

test("temporary direct registration stays opt-in and email verification remains default", () => {
  assert.equal(getRegistrationActivationMode({}), "email_verification");
  assert.equal(
    getRegistrationActivationMode({ TUTELA_REGISTRATION_ACTIVATION: "temporary_direct" }),
    "temporary_direct",
  );
  assert.equal(
    getRegistrationActivationMode({ TUTELA_REGISTRATION_ACTIVATION: "anything_else" }),
    "email_verification",
  );
});

test("temporary direct registration creates no token and does not send email", async () => {
  let stored: { email: string; passwordHash: string } | undefined;
  const result = await registerTemporaryDirectLocalAccount(validInput, {
    storage: {
      async createTemporaryDirectLocalRegistration(input) {
        stored = input;
      },
    },
  });

  assert.deepEqual(result, { accepted: true });
  assert.equal(stored?.email, "ada@example.com");
  assert.equal(stored?.passwordHash.startsWith("scrypt-v1$"), true);
  assert.equal("tokenDigest" in (stored ?? {}), false);
});

test("production registration inserts only the recovered authentication columns", () => {
  const storageSource = fs.readFileSync(
    path.join(process.cwd(), "server/storage.ts"),
    "utf8",
  );
  const method = storageSource.slice(
    storageSource.indexOf("async createPendingLocalRegistration("),
    storageSource.indexOf("async activateLocalRegistration("),
  );

  assert.ok(!method.includes("transaction.insert(users)"));
  for (const column of [
    "email",
    "first_name",
    "last_name",
    "password_hash",
    "auth_provider",
    "email_verified_at",
    "login_enabled",
    "credential_status",
    "recovery_provenance",
    "role",
    "verified",
  ]) {
    assert.ok(method.includes(column), `missing explicit ${column} column`);
  }
  for (const unrelatedColumn of [
    "kyb_status",
    "subscription_plan",
    "trading_preferences",
    "company_name",
  ]) {
    assert.ok(!method.includes(unrelatedColumn));
  }
});

test("temporary direct registration is explicitly marked and never marks email verified", () => {
  const storageSource = fs.readFileSync(
    path.join(process.cwd(), "server/storage.ts"),
    "utf8",
  );
  const method = storageSource.slice(
    storageSource.indexOf("async createTemporaryDirectLocalRegistration("),
    storageSource.indexOf("async createAuthenticatedEmailVerificationAttempt("),
  );

  assert.match(method, /login_enabled[\s\S]*true/);
  assert.match(method, /email_verified_at[\s\S]*NULL/);
  assert.match(method, /TEMPORARY_DIRECT_REGISTRATION_PROVENANCE/);
  assert.ok(!method.includes("emailVerificationTokens"));
});

test("temporary registration storage failures remain a safe HTTP response", () => {
  const authSource = fs.readFileSync(
    path.join(process.cwd(), "server/auth.ts"),
    "utf8",
  );
  const directBranch = authSource.slice(
    authSource.indexOf('if (activationMode === "temporary_direct")'),
    authSource.indexOf("const configuration = getVerificationEmailConfiguration()"),
  );
  assert.match(directBranch, /try\s*\{/);
  assert.match(directBranch, /catch\s*\{/);
  assert.match(directBranch, /res\.status\(503\)/);
  assert.doesNotMatch(directBranch, /console\.(?:error|log)/);
});
