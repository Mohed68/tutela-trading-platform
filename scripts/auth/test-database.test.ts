import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { requireTestDatabase } from "./test-database.js";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

function productionTypeScriptFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const metadata = statSync(path);
    if (metadata.isDirectory()) {
      files.push(...productionTypeScriptFiles(path));
    } else if (path.endsWith(".ts") && !path.endsWith(".test.ts")) {
      files.push(path);
    }
  }
  return files;
}

test("missing TEST_DATABASE_URL fails closed without DATABASE_URL fallback", () => {
  assert.throws(
    () =>
      requireTestDatabase({
        DATABASE_URL: "postgresql://runtime.invalid/tutela",
      }),
    /TEST_DATABASE_URL_REQUIRED/,
  );
});

test("matching runtime and test database identities are rejected as ambiguous", () => {
  const same = "postgresql://isolated.invalid/tutela_test";
  assert.throws(
    () => requireTestDatabase({ TEST_DATABASE_URL: same, DATABASE_URL: same }),
    /TEST_DATABASE_URL_AMBIGUOUS/,
  );
});

test("explicit distinct PostgreSQL test identity is accepted", () => {
  const identity = requireTestDatabase({
    TEST_DATABASE_URL: "postgresql://test.invalid/tutela_test",
    DATABASE_URL: "postgresql://runtime.invalid/tutela",
  });
  assert.equal(
    identity.connectionString,
    "postgresql://test.invalid/tutela_test",
  );
  assert.equal(Object.isFrozen(identity), true);
});

test("invalid and ambiguous test database configuration fails closed", () => {
  for (const value of ["", "https://test.invalid/db", "postgresql:///db"]) {
    assert.throws(
      () => requireTestDatabase({ TEST_DATABASE_URL: value }),
      /TEST_DATABASE_URL_(?:REQUIRED|INVALID)/,
    );
  }
});

test("production runtime cannot import the test-only database helper", () => {
  const forbidden = /scripts[\\/]auth[\\/]test-database(?:\.js|\.ts)?/;
  for (const area of ["server", "shared", join("client", "src")]) {
    for (const path of productionTypeScriptFiles(join(repositoryRoot, area))) {
      assert.doesNotMatch(
        readFileSync(path, "utf8"),
        forbidden,
        relative(repositoryRoot, path),
      );
    }
  }
});

test("ordinary Auth characterization remains database independent", () => {
  const packageJson = JSON.parse(
    readFileSync(join(repositoryRoot, "package.json"), "utf8"),
  ) as { scripts: Record<string, string> };
  const command = packageJson.scripts["test:auth-characterization"];
  assert.doesNotMatch(command, /DATABASE_URL|env-file|legacy-auth|runtime/);
  assert.match(command, /unit-test-environment\.ts/);
  assert.match(command, /password\.test\.ts/);
  assert.match(command, /auth\.security\.test\.ts/);
});

test("DB-backed Auth tests cannot select the runtime DATABASE_URL", () => {
  for (const file of [
    "legacy-auth.characterization.test.ts",
    "phase-4a.runtime.characterization.test.ts",
    "phase-4b.runtime.test.ts",
    "auth-session.integration.test.ts",
  ]) {
    const source = readFileSync(join(repositoryRoot, "scripts", "auth", file), "utf8");
    assert.doesNotMatch(source, /process\.env\.DATABASE_URL/, file);
    assert.match(source, /requireTestDatabase/, file);
  }
});
