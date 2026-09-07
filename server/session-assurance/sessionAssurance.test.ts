import assert from "node:assert/strict";
import test from "node:test";
import type { SessionData } from "express-session";
import {
  DEFAULT_PRIVILEGED_SESSION_POLICY,
  PRIVILEGED_SESSION_ASSURANCE_VERSION,
  clearPrivilegedAssurance,
  getSessionAssurance,
  hasMfaAssurance,
  hasRecentStepUp,
  markAuthenticated,
  markMfaSatisfied,
  markStepUpSatisfied,
  type SessionAssuranceClock,
} from "./index.js";

const AUTHENTICATED_AT = new Date("2026-09-02T08:00:00.000Z");
const MFA_AT = new Date("2026-09-02T08:01:00.000Z");
const STEP_UP_AT = new Date("2026-09-02T08:02:00.000Z");

function clock(at: Date): SessionAssuranceClock {
  return Object.freeze({ now: () => new Date(at) });
}

function sessionData(values: Record<string, unknown> = {}): SessionData {
  return values as SessionData;
}

function authenticatedSession(now = AUTHENTICATED_AT): SessionData {
  const value = sessionData();
  markAuthenticated(value, AUTHENTICATED_AT, clock(now));
  return value;
}

test("password authentication creates authenticated assurance only", () => {
  const session = authenticatedSession();
  assert.deepEqual(getSessionAssurance(session, undefined, clock(AUTHENTICATED_AT)), {
    contractVersion: PRIVILEGED_SESSION_ASSURANCE_VERSION,
    level: "authenticated",
    authenticatedAt: AUTHENTICATED_AT.toISOString(),
    mfaSatisfiedAt: null,
    stepUpSatisfiedAt: null,
  });
  assert.equal(hasMfaAssurance(session, clock(AUTHENTICATED_AT)), false);
  assert.equal(
    hasRecentStepUp(session, DEFAULT_PRIVILEGED_SESSION_POLICY, clock(AUTHENTICATED_AT)),
    false,
  );
});

test("legacy is2FAEnabled account state cannot create session assurance", () => {
  const session = sessionData({ is2FAEnabled: true });
  assert.equal(getSessionAssurance(session, undefined, clock(AUTHENTICATED_AT)), null);
  assert.equal(hasMfaAssurance(session, clock(AUTHENTICATED_AT)), false);
});

test("trusted MFA event upgrades only an authenticated session", () => {
  const session = authenticatedSession(MFA_AT);
  markMfaSatisfied(session, MFA_AT, clock(MFA_AT));
  assert.equal(getSessionAssurance(session, undefined, clock(MFA_AT))?.level, "mfa");
  assert.equal(hasMfaAssurance(session, clock(MFA_AT)), true);
  assert.equal(hasRecentStepUp(session, undefined, clock(MFA_AT)), false);
  assert.throws(
    () => markMfaSatisfied(sessionData(), MFA_AT, clock(MFA_AT)),
    /AUTHENTICATED_SESSION_ASSURANCE_REQUIRED/,
  );
});

test("separate session for the same user inherits no assurance", () => {
  const first = authenticatedSession(STEP_UP_AT);
  markMfaSatisfied(first, MFA_AT, clock(STEP_UP_AT));
  markStepUpSatisfied(first, STEP_UP_AT, clock(STEP_UP_AT));
  const second = sessionData({ passport: { user: "same-user" } });
  assert.equal(hasRecentStepUp(first, undefined, clock(STEP_UP_AT)), true);
  assert.equal(getSessionAssurance(second, undefined, clock(STEP_UP_AT)), null);
});

test("recent step-up follows the central freshness policy deterministically", () => {
  const session = authenticatedSession(STEP_UP_AT);
  markMfaSatisfied(session, MFA_AT, clock(STEP_UP_AT));
  markStepUpSatisfied(session, STEP_UP_AT, clock(STEP_UP_AT));

  const boundary = new Date(
    STEP_UP_AT.getTime() +
      DEFAULT_PRIVILEGED_SESSION_POLICY.recentStepUpWindowMs,
  );
  assert.equal(hasRecentStepUp(session, undefined, clock(boundary)), true);
  assert.equal(
    hasRecentStepUp(session, undefined, clock(new Date(boundary.getTime() + 1))),
    false,
  );
  assert.equal(
    getSessionAssurance(session, undefined, clock(new Date(boundary.getTime() + 1)))
      ?.level,
    "mfa",
  );
});

test("missing, malformed, contradictory, and future timestamps fail closed", () => {
  const base = {
    contractVersion: PRIVILEGED_SESSION_ASSURANCE_VERSION,
    authenticationAssurance: "authenticated",
    authenticatedAt: AUTHENTICATED_AT.toISOString(),
    mfaSatisfiedAt: MFA_AT.toISOString(),
    stepUpSatisfiedAt: STEP_UP_AT.toISOString(),
  };
  const invalidContexts = [
    { ...base, authenticatedAt: undefined },
    { ...base, mfaSatisfiedAt: "not-a-time" },
    { ...base, mfaSatisfiedAt: null },
    { ...base, authenticatedAt: "2026-09-02T09:00:00.000Z" },
    { ...base, stepUpSatisfiedAt: "2026-09-02T07:59:00.000Z" },
  ];
  for (const privilegedSecurityContext of invalidContexts) {
    const session = sessionData({ privilegedSecurityContext });
    assert.equal(getSessionAssurance(session, undefined, clock(STEP_UP_AT)), null);
    assert.equal(hasMfaAssurance(session, clock(STEP_UP_AT)), false);
    assert.equal(hasRecentStepUp(session, undefined, clock(STEP_UP_AT)), false);
  }
});

test("server-side downgrade clears privileged assurance but preserves authentication", () => {
  const session = authenticatedSession(STEP_UP_AT);
  markMfaSatisfied(session, MFA_AT, clock(STEP_UP_AT));
  markStepUpSatisfied(session, STEP_UP_AT, clock(STEP_UP_AT));
  clearPrivilegedAssurance(session, clock(STEP_UP_AT));
  assert.equal(getSessionAssurance(session, undefined, clock(STEP_UP_AT))?.level, "authenticated");
  assert.equal(hasMfaAssurance(session, clock(STEP_UP_AT)), false);
  assert.equal(hasRecentStepUp(session, undefined, clock(STEP_UP_AT)), false);
});

test("client request fields, headers, cookies, and role permissions manufacture nothing", () => {
  const forged = sessionData({
    body: { mfaSatisfied: true, stepUpSatisfiedAt: STEP_UP_AT.toISOString() },
    headers: { "x-mfa-satisfied": "true" },
    cookie: { assuranceLevel: "recent_step_up" },
    localStorage: { mfaSatisfied: "true" },
    permissions: ["platform.roles.grant", "platform.roles.revoke"],
    sessionAssurance: "recent_step_up",
    is2FAEnabled: true,
  });
  assert.equal(getSessionAssurance(forged, undefined, clock(STEP_UP_AT)), null);
  assert.equal(hasRecentStepUp(forged, undefined, clock(STEP_UP_AT)), false);
});

test("new password authentication clears any earlier MFA and step-up state", () => {
  const session = authenticatedSession(STEP_UP_AT);
  markMfaSatisfied(session, MFA_AT, clock(STEP_UP_AT));
  markStepUpSatisfied(session, STEP_UP_AT, clock(STEP_UP_AT));
  const nextAuthentication = new Date("2026-09-02T08:03:00.000Z");
  markAuthenticated(session, nextAuthentication, clock(nextAuthentication));
  assert.deepEqual(
    getSessionAssurance(session, undefined, clock(nextAuthentication)),
    {
      contractVersion: PRIVILEGED_SESSION_ASSURANCE_VERSION,
      level: "authenticated",
      authenticatedAt: nextAuthentication.toISOString(),
      mfaSatisfiedAt: null,
      stepUpSatisfiedAt: null,
    },
  );
});

test("event chronology and invalid policy fail closed", () => {
  const session = authenticatedSession(MFA_AT);
  assert.throws(
    () =>
      markMfaSatisfied(
        session,
        new Date(AUTHENTICATED_AT.getTime() - 1),
        clock(MFA_AT),
      ),
    /SESSION_ASSURANCE_EVENT_ORDER_INVALID/,
  );
  assert.throws(
    () => markStepUpSatisfied(session, STEP_UP_AT, clock(STEP_UP_AT)),
    /MFA_SESSION_ASSURANCE_REQUIRED/,
  );
  assert.equal(
    hasRecentStepUp(
      session,
      { ...DEFAULT_PRIVILEGED_SESSION_POLICY, recentStepUpWindowMs: 0 },
      clock(MFA_AT),
    ),
    false,
  );
});
