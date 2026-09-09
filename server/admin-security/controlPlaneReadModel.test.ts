import assert from "node:assert/strict";
import test from "node:test";
import { createAdminControlPlaneReadModel } from "./controlPlaneReadModel.js";

test("Control Plane overview is bounded and labels inactive modules honestly", async () => {
  const model = createAdminControlPlaneReadModel({ async query() { return { rows: [{ principals: 2, owners: 1, assignments: 1, audit_events: 8 }] }; } });
  const result = await model.overview();
  assert.equal(result.owners, 1);
  assert.equal(result.modules.find((item) => item.id === "risk")?.maturity, "DEFINED");
  assert.equal(result.modules.find((item) => item.id === "platform_administration")?.maturity, "ACTIVE_BASELINE");
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.modules), true);
});

test("Control Plane identity rows never select raw user or credential fields", async () => {
  const statements: string[] = [];
  const model = createAdminControlPlaneReadModel({ async query(sql) { statements.push(sql); return { rows: [] }; } });
  await model.owners(); await model.principals(); await model.roleAssignments(); await model.users();
  const sql = statements.join("\n");
  assert.doesNotMatch(sql, /SELECT\s+\*|email|password|phone|address|session|credential/i);
  assert.match(sql, /principal_id/);
  assert.match(sql, /email_verified_at/);
  assert.doesNotMatch(sql, /password_hash|encrypted_secret|recovery_code|sessions/i);
});
