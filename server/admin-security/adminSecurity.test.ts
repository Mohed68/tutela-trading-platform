import assert from "node:assert/strict";
import test from "node:test";
import type { SessionData } from "express-session";
import { ADMIN_ACTION_ASSURANCE, satisfiesAdminActionAssurance } from "./index.js";
import { configurePrivilegedAdminAuthorization, requireAdminAuth, requirePermission } from "../adminAuth.js";
import { markAuthenticated, markMfaSatisfied, markStepUpSatisfied } from "../session-assurance/index.js";
import type { PlatformAuthorityReadPort } from "../platform-authority/index.js";

const now = new Date();
const read: PlatformAuthorityReadPort = {
  async findPrincipalByUserId(userId) { return { principalId: "principal-1", userId, status: "active", createdAt: now.toISOString() }; },
  async findPrincipalById() { return undefined; },
  async listRoleAssignments() { return [{ assignmentId: "assignment-1", principalId: "principal-1", role: "SUPPORT", status: "active", grantedByPrincipalId: "owner-1", grantedAt: now.toISOString(), grantReason: "Approved support duty", revokedByPrincipalId: null, revokedAt: null, revocationReason: null }]; },
  async findRoleAssignmentById() { return undefined; },
};

function session(level: "authenticated" | "mfa" | "recent_step_up") {
  const value = {} as SessionData;
  markAuthenticated(value, now, { now: () => now });
  if (level !== "authenticated") markMfaSatisfied(value, now, { now: () => now });
  if (level === "recent_step_up") markStepUpSatisfied(value, now, { now: () => now });
  return value;
}

function response() {
  return { statusCode: 200, body: undefined as unknown, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } };
}

test("central action assurance policy distinguishes read, MFA, and step-up", () => {
  assert.equal(ADMIN_ACTION_ASSURANCE["users.support.view"], "authenticated");
  assert.equal(ADMIN_ACTION_ASSURANCE["verification.evidence.view"], "mfa");
  assert.equal(ADMIN_ACTION_ASSURANCE["platform.roles.grant"], "recent_step_up");
  assert.equal(satisfiesAdminActionAssurance("users.support.remediate", "mfa"), false);
  assert.equal(satisfiesAdminActionAssurance("users.support.remediate", "recent_step_up"), true);
});

test("real Platform Authority plus server session assurance authorizes a matching read", async () => {
  configurePrivilegedAdminAuthorization(read);
  const req: any = { user: { claims: { sub: "user-1" } }, session: session("authenticated") };
  const res: any = response();
  let entered = false;
  await requireAdminAuth(req, res, () => { entered = true; });
  assert.equal(entered, true);
  let permitted = false;
  requirePermission("users.support.view")(req, res, () => { permitted = true; });
  assert.equal(permitted, true);
});

test("legacy role and is2FAEnabled cannot forge authority or assurance", async () => {
  configurePrivilegedAdminAuthorization({ ...read, async findPrincipalByUserId() { return undefined; } });
  const req: any = { user: { claims: { sub: "user-legacy" }, adminRole: "admin", is2FAEnabled: true }, session: {} };
  const res: any = response();
  let entered = false;
  await requireAdminAuth(req, res, () => { entered = true; });
  assert.equal(entered, false);
  assert.equal(res.statusCode, 403);
});

test("MFA and recent step-up requirements fail closed", () => {
  assert.equal(satisfiesAdminActionAssurance("security.audit.view", "authenticated"), false);
  assert.equal(satisfiesAdminActionAssurance("verification.review.submit", "mfa"), false);
});
