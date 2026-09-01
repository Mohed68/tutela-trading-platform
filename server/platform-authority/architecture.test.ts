import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const capabilityRoot = path.join(root, "server", "platform-authority");
const productionFiles = fs
  .readdirSync(capabilityRoot)
  .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"));
const source = productionFiles
  .map((name) => fs.readFileSync(path.join(capabilityRoot, name), "utf8"))
  .join("\n");

test("Platform Authority remains server-only, dormant, and infrastructure free", () => {
  assert.doesNotMatch(
    source,
    /(?:client|localStorage|express|routes|database|drizzle|postgres|process\.env)/,
  );
  const routes = fs.readFileSync(path.join(root, "server", "routes.ts"), "utf8");
  const adminAuth = fs.readFileSync(
    path.join(root, "server", "adminAuth.ts"),
    "utf8",
  );
  assert.doesNotMatch(routes, /platform-authority/);
  assert.doesNotMatch(adminAuth, /platform-authority/);
});

test("Platform Authority does not consume Organization role or legacy Admin authority", () => {
  assert.doesNotMatch(
    source,
    /organization-membership|organizationMembership|adminRole|is2FAEnabled|buyer|seller|partner/,
  );
});

test("permission vocabulary contains no canonical truth mutation authority", () => {
  const policy = fs.readFileSync(
    path.join(capabilityRoot, "policy.ts"),
    "utf8",
  );
  assert.doesNotMatch(
    policy,
    /(?:set|create|override|manufacture).*(?:trust|verified|eligibility|publication)/i,
  );
  assert.doesNotMatch(
    source,
    /organization-verification|participation-eligibility|publication-eligibility|trust-runtime/,
  );
});

test("public exports protect construction and authenticity internals", () => {
  const index = fs.readFileSync(path.join(capabilityRoot, "index.ts"), "utf8");
  assert.doesNotMatch(index, /authenticResolutions|validAssignment|resolution\s*[,}]/);
  assert.doesNotMatch(index, /createPlatformPrincipal|bootstrapPlatformAdmin/);
});

test("role mutations require an explicit atomic audited mutation port", () => {
  const ports = fs.readFileSync(path.join(capabilityRoot, "ports.ts"), "utf8");
  const service = fs.readFileSync(path.join(capabilityRoot, "service.ts"), "utf8");
  assert.match(ports, /persist the role mutation and its security audit record/);
  assert.match(ports, /commitRoleGrant/);
  assert.match(ports, /commitRoleRevocation/);
  assert.doesNotMatch(service, /logAdminAction|console\.|catch\s*\([^)]*\)\s*\{\s*\}/);
});
