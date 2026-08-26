import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const sourceFiles = readdirSync(root)
  .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
  .map((name) => ({ name, source: readFileSync(join(root, name), "utf8") }));
const contractFiles = sourceFiles.filter((file) =>
  ["contracts.ts", "fixtureCatalog.ts", "heroMissions.ts", "ids.ts", "index.ts"].includes(file.name),
);

test("demo runtime contracts import no production authority or repository", () => {
  const prohibited = [
    "../db",
    "../storage",
    "../organization-registry",
    "../organization-membership",
    "../organization-verification",
    "../organization-participation-eligibility",
    "../offer-publication-eligibility",
    "../verification/",
    "../trading-flow",
    "postgresRepository",
  ];
  for (const file of sourceFiles) {
    for (const dependency of prohibited) {
      assert.doesNotMatch(
        file.source,
        new RegExp(dependency.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        `${file.name} must not depend on ${dependency}`,
      );
    }
  }
});

test("demo runtime contains no database, HTTP route, or environment infrastructure", () => {
  for (const file of contractFiles) {
    assert.doesNotMatch(file.source, /\b(?:DATABASE_URL|process\.env|pool\.query|app\.(?:get|post|patch|delete)|fetch)\b/);
  }
});

test("application service depends on ports and not concrete in-memory adapters", () => {
  const service = sourceFiles.find((file) => file.name === "applicationService.ts")?.source ?? "";
  assert.match(service, /DemoAccessGrantStore/);
  assert.match(service, /DemoSessionStore/);
  assert.match(service, /DemoAnalyticsPort/);
  assert.doesNotMatch(service, /InMemoryDemo/);
  assert.doesNotMatch(service, /process\.env|DATABASE_URL|pool\.query/);
});

test("demo contracts cannot claim canonical authority", () => {
  const combined = sourceFiles.map((file) => file.source).join("\n");
  assert.match(combined, /canonicalAuthority:\s*false/);
  assert.match(combined, /productionAuthority:\s*false/);
  assert.doesNotMatch(combined, /canonicalAuthority:\s*true/);
  assert.doesNotMatch(combined, /productionAuthority:\s*true/);
});
