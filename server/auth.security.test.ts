import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import type { AuthenticationIdentity } from "@shared/auth";
import { TEMPORARY_DIRECT_REGISTRATION_PROVENANCE } from "@shared/auth";
import {
  getSessionCookieSettings,
  isLocallyAuthenticatable,
  isPendingEmailVerification,
  setupAuth,
  toCurrentUserDto,
} from "./auth.js";

function recoveryIdentity(
  override: Partial<AuthenticationIdentity> = {},
): AuthenticationIdentity {
  return {
    id: "opaque-recovery-id",
    email: null,
    passwordHash: "scrypt-v1$salt$hash",
    authProvider: "local",
    lastLoginAt: null,
    loginEnabled: true,
    credentialStatus: "active",
    recoveryProvenance: "tutela-recovery-test",
    role: "trader",
    ...override,
  };
}

test("local authentication requires every approved authority predicate", () => {
  assert.equal(isLocallyAuthenticatable(recoveryIdentity()), true);

  for (const override of [
    { passwordHash: null },
    { authProvider: null },
    { authProvider: "legacy" },
    { loginEnabled: null },
    { loginEnabled: false },
    { credentialStatus: null },
    { credentialStatus: "revoked" },
    { recoveryProvenance: null },
    { role: null },
    { role: "admin" },
  ] satisfies Array<Partial<AuthenticationIdentity>>) {
    assert.equal(
      isLocallyAuthenticatable(recoveryIdentity(override)),
      false,
    );
  }
});

test("verified self-registered traders authenticate without recovery authority", () => {
  assert.equal(
    isLocallyAuthenticatable(
      recoveryIdentity({
        recoveryProvenance: null,
        emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ),
    true,
  );
  assert.equal(
    isLocallyAuthenticatable(
      recoveryIdentity({
        recoveryProvenance: null,
        emailVerifiedAt: null,
      }),
    ),
    false,
  );
});

test("only an exact pending local registration is eligible for unverified-account UX", () => {
  const pending = recoveryIdentity({
    email: "trader@acme.example",
    loginEnabled: false,
    recoveryProvenance: null,
    emailVerifiedAt: null,
  });
  assert.equal(isPendingEmailVerification(pending), true);
  assert.equal(isLocallyAuthenticatable(pending), false);

  for (const override of [
    { passwordHash: null },
    { authProvider: "legacy" },
    { loginEnabled: true },
    { credentialStatus: "revoked" },
    { recoveryProvenance: TEMPORARY_DIRECT_REGISTRATION_PROVENANCE },
    { emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z") },
  ] satisfies Array<Partial<AuthenticationIdentity>>) {
    assert.equal(isPendingEmailVerification({ ...pending, ...override }), false);
  }
});

test("temporary direct registration is authenticatable but remains email-unknown", () => {
  const directIdentity = recoveryIdentity({
    recoveryProvenance: TEMPORARY_DIRECT_REGISTRATION_PROVENANCE,
    emailVerifiedAt: null,
  });

  assert.equal(isLocallyAuthenticatable(directIdentity), true);
  assert.equal(
    toCurrentUserDto(
      directIdentity as AuthenticationIdentity & { passwordHash: string },
    ).emailVerified,
    "unknown",
  );
});

test("current-user DTO is an explicit minimal allow-list", () => {
  const dto = toCurrentUserDto(
    recoveryIdentity() as AuthenticationIdentity & { passwordHash: string },
  );

  assert.deepEqual(dto, {
    id: "opaque-recovery-id",
    displayName: "Recovery trader",
    role: "trader",
    authenticated: true,
    accountState: "active",
    organizationDisplayName: null,
    emailVerified: "unknown",
    userVerified: "unknown",
    kybState: "unknown",
    organizationVerification: "unknown",
  });

  for (const prohibited of [
    "email",
    "password",
    "passwordHash",
    "authProvider",
    "lastLoginAt",
    "recoveryProvenance",
    "verified",
    "adminRole",
    "kybStatus",
    "financialRating",
    "subscriptionId",
  ]) {
    assert.equal(prohibited in dto, false);
  }
});

test("session cookie defaults stay secure by environment", () => {
  assert.deepEqual(getSessionCookieSettings({ NODE_ENV: "development" }), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  assert.deepEqual(getSessionCookieSettings({ NODE_ENV: "production" }), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
});

test("public registration rejects invalid account input before persistence", async () => {
  const app = express();
  app.use(express.json());
  await setupAuth(app);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address() as AddressInfo;
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/auth/register`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "disabled@recovery.tutela.invalid",
          password: "not-a-real-password",
        }),
      },
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      message:
        "Enter a valid name, email, and a 12-character password containing uppercase, lowercase, and numeric characters.",
    });

    const publicEmailResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/auth/register`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: "Public",
          lastName: "Trader",
          email: "Trader@GMAIL.com",
          password: "SafePassword123",
        }),
      },
    );
    assert.equal(publicEmailResponse.status, 400);
    assert.deepEqual(await publicEmailResponse.json(), {
      code: "BUSINESS_EMAIL_REQUIRED",
      title: "Please use your company email address",
      message:
        "TUTELA is a B2B trading platform. Registration requires an official business email associated with your organization. Public email services such as Gmail, Outlook, Yahoo, and similar providers are not accepted.",
      supportText:
        "If your organization does not yet have a business email domain, contact TUTELA support.",
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
