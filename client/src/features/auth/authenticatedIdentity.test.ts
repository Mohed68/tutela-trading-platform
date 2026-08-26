import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { CurrentUserDto } from "@shared/auth";
import { authenticatedIdentityPresentation } from "./authenticatedIdentity.js";

function currentUser(
  override: Partial<CurrentUserDto> = {},
): CurrentUserDto {
  return {
    id: "authenticated-user",
    displayName: "Ada Trader",
    email: "ada@acme.example",
    role: "trader",
    authenticated: true,
    accountState: "active",
    organizationDisplayName: null,
    emailVerified: "verified",
    userVerified: "unknown",
    kybState: "unknown",
    organizationVerification: "unknown",
    ...override,
  };
}

test("authenticated identity uses the server-projected name and email", () => {
  assert.deepEqual(authenticatedIdentityPresentation(currentUser()), {
    displayName: "Ada Trader",
    email: "ada@acme.example",
  });
});

test("authenticated identity falls back to email and then neutral copy", () => {
  assert.deepEqual(
    authenticatedIdentityPresentation(currentUser({ displayName: null })),
    {
      displayName: "ada@acme.example",
      email: "ada@acme.example",
    },
  );
  assert.deepEqual(
    authenticatedIdentityPresentation(
      currentUser({ displayName: null, email: null }),
    ),
    { displayName: "TUTELA User", email: "Email unavailable" },
  );
});

test("production account header contains no hard-coded demo identity", () => {
  const headerSource = readFileSync(
    new URL("../../components/navigation/AppHeader.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(headerSource, /Demo User|demo@tutela\.com/);
  assert.match(headerSource, /authenticatedIdentityPresentation\(user\)/);
});
