import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticationIdentity } from "@shared/auth";
import {
  getSessionCookieSettings,
  isLocallyAuthenticatable,
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

