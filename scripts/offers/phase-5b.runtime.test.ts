import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { request as nodeHttpRequest, type IncomingHttpHeaders } from "node:http";
import test from "node:test";
import { Client, type QueryResultRow } from "pg";
import type {
  DraftOfferDetailDto,
  DraftOfferOptionsDto,
} from "../../shared/drafts.js";
import {
  applicationSchemaFingerprint,
  requireRawDatabaseUrl,
  verifyRecoveryMarker,
} from "../migrations/rehearsal-lib.js";
import {
  readRecoveryCredentialInput,
  verifyRecoveryUserState,
} from "../auth/recovery-user-lib.js";

const EXPECTED_FINGERPRINT =
  "aeb77478a423b407e5e69705f78b7948e8020411b7defa26f605568f616fc401";
const EXPECTED_LEGACY_USER_HASH =
  "3369cf18c0fb7ffa5881cdd4a6c25c2da11ef489c46e7b9e52f5d28f41288bbc";
const EXPECTED_LEGACY_OFFER_HASH =
  "b9492303d4d3bb157941fd3ed609438761eb85396e83861af4cfb5f77664c2fc";
const PORT = "5061";
const SENSITIVE_KEYS = new Set([
  "user",
  "userId",
  "ownerId",
  "email",
  "password",
  "passwordHash",
  "verification",
  "verified",
  "sellerOrgVerified",
  "moderation",
  "financialRating",
  "creditRating",
  "riskScore",
  "session",
  "token",
]);
const serverDiagnostics = new WeakMap<
  ReturnType<typeof spawn>,
  {
    databaseVerified: boolean;
    listening: boolean;
    startupFailure: boolean;
  }
>();

function snapshotHash(rows: QueryResultRow[]): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(rows.map((row) => row.record)))
    .digest("hex");
}

async function tableSnapshot(
  client: Client,
  table: "users" | "offers",
  where = "",
): Promise<string> {
  const rows = (
    await client.query<QueryResultRow>(
      `SELECT to_jsonb(source) AS record
       FROM public.${table} AS source
       ${where}
       ORDER BY source.id`,
    )
  ).rows;
  return snapshotHash(rows);
}

function assertNoSensitiveKeys(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoSensitiveKeys);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    assert.equal(SENSITIVE_KEYS.has(key), false);
    assertNoSensitiveKeys(nested);
  }
}

function startServer(): ReturnType<typeof spawn> {
  const child = spawn(process.execPath, ["dist/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "test",
      TUTELA_RECOVERY_MODE: "true",
      DEMO_AUTH_BYPASS: "false",
      DEMO_MODE: "false",
      AUTO_VERIFY_DEMO: "false",
      RENDER: "",
      OPENAI_API_KEY: "",
      STRIPE_SECRET_KEY: "",
      SENTRY_DSN: "",
      VITE_SENTRY_DSN: "",
      GOOGLE_APPLICATION_CREDENTIALS: "",
      PORT,
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const diagnostics = {
    databaseVerified: false,
    listening: false,
    startupFailure: false,
  };
  serverDiagnostics.set(child, diagnostics);
  const inspectOutput = (chunk: Buffer | string) => {
    const output = chunk.toString();
    if (output.includes("database connectivity and required schema verified")) {
      diagnostics.databaseVerified = true;
    }
    if (output.includes("serving on port")) {
      diagnostics.listening = true;
    }
    if (output.includes("TUTELA failed to start")) {
      diagnostics.startupFailure = true;
    }
  };
  child.stdout?.on("data", inspectOutput);
  child.stderr?.on("data", inspectOutput);
  return child;
}

async function waitForServer(
  child: ReturnType<typeof spawn>,
): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("SERVER_EXITED_EARLY");
    if (serverDiagnostics.get(child)?.listening) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const diagnostics = serverDiagnostics.get(child);
  throw new Error(
    [
      "SERVER_DID_NOT_START",
      diagnostics?.databaseVerified ? "DATABASE_VERIFIED" : "DATABASE_PENDING",
      diagnostics?.listening ? "LISTENING" : "NOT_LISTENING",
      diagnostics?.startupFailure ? "STARTUP_FAILURE" : "NO_FAILURE_SIGNAL",
    ].join("_"),
  );
}

async function stopServer(
  child: ReturnType<typeof spawn> | null,
): Promise<void> {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function request(
  method: string,
  path: string,
  cookie?: string,
  body?: unknown,
): Promise<{
  status: number;
  headers: IncomingHttpHeaders;
  json: () => Promise<unknown>;
}> {
  const serialized = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const outgoing = nodeHttpRequest(
      {
        hostname: "127.0.0.1",
        port: Number(PORT),
        path,
        method,
        headers: {
          ...(cookie ? { cookie } : {}),
          ...(serialized === undefined
            ? {}
            : {
                "content-type": "application/json",
                "content-length": Buffer.byteLength(serialized),
              }),
        },
      },
      (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
        incoming.on("end", () => {
          const responseBody = Buffer.concat(chunks).toString("utf8");
          resolve({
            status: incoming.statusCode ?? 0,
            headers: incoming.headers,
            json: async () => JSON.parse(responseBody) as unknown,
          });
        });
      },
    );
    outgoing.once("error", reject);
    if (serialized !== undefined) outgoing.write(serialized);
    outgoing.end();
  });
}

function cookieFrom(response: { headers: IncomingHttpHeaders }): string {
  const value = response.headers["set-cookie"]?.[0];
  assert.ok(value);
  return value.split(";", 1)[0];
}

async function count(
  client: Client,
  table: string,
  where = "",
): Promise<number> {
  const safeTable = `"${table.replaceAll('"', '""')}"`;
  return (
    await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM public.${safeTable} ${where}`,
    )
  ).rows[0].count;
}

test(
  "Phase 5B draft is private, owner-only, side-effect-free, and exactly cleaned up",
  { timeout: 600_000 },
  async () => {
    const credential = readRecoveryCredentialInput(process.env);
    const client = new Client({
      connectionString: requireRawDatabaseUrl(process.env.DATABASE_URL),
    });
    let child: ReturnType<typeof spawn> | null = null;
    let draftId: string | null = null;
    let recoveryOwnerId: string | null = null;
    let draftStorage:
      | typeof import("../../server/drafts/storage.js")
      | undefined;
    let step = "initialize";

    try {
      step = "preflight";
      await client.connect();
      await client.query("BEGIN READ ONLY");
      await verifyRecoveryMarker(client);
      await verifyRecoveryUserState(client);
      assert.equal(
        await applicationSchemaFingerprint(client),
        EXPECTED_FINGERPRINT,
      );
      assert.equal(
        await tableSnapshot(
          client,
          "users",
          "WHERE source.recovery_provenance IS NULL",
        ),
        EXPECTED_LEGACY_USER_HASH,
      );
      assert.equal(
        await tableSnapshot(client, "offers"),
        EXPECTED_LEGACY_OFFER_HASH,
      );
      assert.equal(await count(client, "sessions"), 0);
      assert.equal(await count(client, "offers"), 9);
      assert.equal(await count(client, "offer_verifications"), 0);
      assert.equal(await count(client, "activity_logs"), 0);
      const journal = (
        await client.query<{
          execution_status: string;
          sql_executed: boolean;
        }>(`
          SELECT execution_status, sql_executed
          FROM public.tutela_migration_journal
          WHERE migration_identifier = '0007_add_draft_offer_status'
        `)
      ).rows[0];
      assert.deepEqual(journal, {
        execution_status: "succeeded",
        sql_executed: true,
      });
      const legacyOfferId = (
        await client.query<{ id: string }>(
          "SELECT id FROM public.offers ORDER BY id LIMIT 1",
        )
      ).rows[0].id;
      const legacyUserId = (
        await client.query<{ id: string }>(`
          SELECT id
          FROM public.users
          WHERE recovery_provenance IS NULL
          ORDER BY id
          LIMIT 1
        `)
      ).rows[0].id;
      recoveryOwnerId = (
        await client.query<{ id: string }>(`
          SELECT id
          FROM public.users
          WHERE recovery_provenance = 'tutela-recovery-test'
        `)
      ).rows[0].id;
      await client.query("ROLLBACK");

      step = "startup";
      child = startServer();
      await waitForServer(child);

      step = "anonymous";
      for (const [label, method, path, body] of [
        ["LIST", "GET", "/api/drafts", undefined],
        ["OPTIONS", "GET", "/api/drafts/options", undefined],
        ["CREATE", "POST", "/api/drafts", {}],
        ["DETAIL", "GET", `/api/drafts/${crypto.randomUUID()}`, undefined],
        [
          "UPDATE",
          "PATCH",
          `/api/drafts/${crypto.randomUUID()}`,
          { location: "x" },
        ],
        ["DELETE", "DELETE", `/api/drafts/${crypto.randomUUID()}`, undefined],
      ] as const) {
        const response = await request(method, path, undefined, body);
        if (response.status !== 401) {
          throw new Error(`ANONYMOUS_${label}_STATUS_${response.status}`);
        }
      }

      step = "login";
      const login = await request("POST", "/api/auth/login", undefined, {
        email: credential.email,
        password: credential.password,
      });
      assert.equal(login.status, 200);
      const cookie = cookieFrom(login);
      assert.equal(await count(client, "sessions"), 1);

      step = "options";
      const optionsResponse = await request(
        "GET",
        "/api/drafts/options",
        cookie,
      );
      if (optionsResponse.status !== 200) {
        throw new Error(`OPTIONS_STATUS_${optionsResponse.status}`);
      }
      const options = (await optionsResponse.json()) as DraftOfferOptionsDto;
      if (options.currency !== "USD") {
        throw new Error("OPTIONS_CURRENCY_INVALID");
      }
      const commodity = options.commodities.find(
        (item) => item.name === "West Texas Intermediate (WTI) Crude Oil",
      );
      if (!commodity) throw new Error("OPTIONS_COMMODITY_MISSING");
      if (JSON.stringify(commodity.units) !== JSON.stringify(["bbl", "MT"])) {
        throw new Error("OPTIONS_UNITS_INVALID");
      }

      const validCreate = {
        offerType: "sell",
        commodityId: commodity.id,
        quantity: "12.50",
        unit: "bbl",
        amountPerUnit: "81.25",
        currency: "USD",
        location: "Phase 5B synthetic recovery draft",
        validUntil: "2099-01-01T00:00:00.000Z",
      };

      step = "forbidden_create";
      for (const override of [
        { userId: legacyUserId },
        { ownerId: legacyUserId },
        { status: "active" },
        { verified: true },
        { sellerOrgVerified: true },
        { moderationStatus: "active" },
        { currency: "EUR" },
        { unit: "GAL" },
        { offerType: "trade" },
        { quantity: "0" },
        { amountPerUnit: "-1" },
        { commodityId: "99999999-9999-4999-8999-999999999999" },
      ]) {
        const response = await request("POST", "/api/drafts", cookie, {
          ...validCreate,
          ...override,
        });
        assert.equal(response.status, 400);
      }
      assert.equal(await count(client, "offers"), 9);

      step = "create";
      const createdResponse = await request(
        "POST",
        "/api/drafts",
        cookie,
        validCreate,
      );
      assert.equal(createdResponse.status, 201);
      const created = (await createdResponse.json()) as DraftOfferDetailDto;
      draftId = created.id;
      assert.equal(created.status, "draft");
      assert.deepEqual(created.visibility, { state: "private" });
      assert.equal(created.quantity.value, "12.50");
      assert.equal(created.quantity.unit, "bbl");
      assert.equal(created.pricing.amountPerUnit, "81.25");
      assert.equal(created.pricing.currency, "USD");
      assertNoSensitiveKeys(created);

      const stored = (
        await client.query<{
          user_id: string;
          status: string;
          quantity: string;
          unit: string;
          price_per_unit: string;
          currency: string;
        }>(
          `
            SELECT
              user_id,
              status::text,
              quantity::text,
              unit,
              price_per_unit::text,
              currency
            FROM public.offers
            WHERE id = $1
          `,
          [draftId],
        )
      ).rows[0];
      assert.deepEqual(stored, {
        user_id: recoveryOwnerId,
        status: "draft",
        quantity: "12.50",
        unit: "bbl",
        price_per_unit: "81.25",
        currency: "USD",
      });
      assert.equal(await count(client, "offer_verifications"), 0);
      assert.equal(await count(client, "activity_logs"), 0);

      step = "owner_reads";
      const listResponse = await request("GET", "/api/drafts", cookie);
      assert.equal(listResponse.status, 200);
      const list = (await listResponse.json()) as DraftOfferDetailDto[];
      assert.equal(list.length, 1);
      assert.equal(list[0].id, draftId);
      assertNoSensitiveKeys(list);

      const detailResponse = await request(
        "GET",
        `/api/drafts/${draftId}`,
        cookie,
      );
      assert.equal(detailResponse.status, 200);
      assert.deepEqual(await detailResponse.json(), created);

      step = "isolation";
      draftStorage = await import("../../server/drafts/storage.js");
      assert.equal(
        await draftStorage.getOwnedDraftOffer(legacyUserId, draftId),
        undefined,
      );
      assert.equal(
        await draftStorage.updateOwnedDraftOffer(legacyUserId, draftId, {
          location: "Cross-owner attempt",
        }),
        undefined,
      );
      assert.equal(
        await draftStorage.deleteOwnedDraftOffer(legacyUserId, draftId),
        undefined,
      );
      assert.equal(
        (await request("GET", `/api/drafts/${legacyOfferId}`, cookie)).status,
        404,
      );
      assert.equal(
        (
          await request("PATCH", `/api/drafts/${legacyOfferId}`, cookie, {
            location: "Legacy mutation attempt",
          })
        ).status,
        404,
      );
      assert.equal(
        (await request("DELETE", `/api/drafts/${legacyOfferId}`, cookie)).status,
        404,
      );

      step = "forbidden_update";
      for (const body of [
        {},
        { userId: legacyUserId },
        { status: "active" },
        { verified: true },
        { moderationStatus: "active" },
        { currency: "EUR" },
        { unit: "kg" },
      ]) {
        assert.equal(
          (await request("PATCH", `/api/drafts/${draftId}`, cookie, body))
            .status,
          400,
        );
      }

      step = "update";
      const beforeUpdate = (
        await client.query<{ record: Record<string, unknown> }>(
          "SELECT to_jsonb(offer) AS record FROM public.offers AS offer WHERE id = $1",
          [draftId],
        )
      ).rows[0].record;
      const updateResponse = await request(
        "PATCH",
        `/api/drafts/${draftId}`,
        cookie,
        { location: "Phase 5B updated synthetic location" },
      );
      assert.equal(updateResponse.status, 200);
      const updated = (await updateResponse.json()) as DraftOfferDetailDto;
      assert.equal(updated.location, "Phase 5B updated synthetic location");
      const afterUpdate = (
        await client.query<{ record: Record<string, unknown> }>(
          "SELECT to_jsonb(offer) AS record FROM public.offers AS offer WHERE id = $1",
          [draftId],
        )
      ).rows[0].record;
      const changedFields = Object.keys(afterUpdate).filter(
        (key) =>
          JSON.stringify(afterUpdate[key]) !== JSON.stringify(beforeUpdate[key]),
      );
      assert.deepEqual(changedFields.sort(), ["location", "updated_at"]);

      step = "publication_and_dashboard";
      const marketplace = await request("GET", "/api/offers", cookie);
      assert.equal(marketplace.status, 200);
      const marketplaceBody = (await marketplace.json()) as {
        offers: unknown[];
        totalCount: number;
      };
      assert.equal(marketplaceBody.totalCount, 0);
      assert.deepEqual(marketplaceBody.offers, []);
      assert.equal(JSON.stringify(marketplaceBody).includes(draftId), false);

      const dashboard = await request(
        "GET",
        "/api/dashboard/overview",
        cookie,
      );
      assert.equal(dashboard.status, 200);
      const dashboardBody = (await dashboard.json()) as {
        myOffers: { data: { count: number } | null };
        publicMarketplace: {
          data: { publishedOffers: number } | null;
        };
      };
      assert.equal(dashboardBody.myOffers.data?.count, 1);
      assert.equal(
        dashboardBody.publicMarketplace.data?.publishedOffers,
        0,
      );

      step = "delete";
      const deleteResponse = await request(
        "DELETE",
        `/api/drafts/${draftId}`,
        cookie,
      );
      assert.equal(deleteResponse.status, 200);
      assert.deepEqual(await deleteResponse.json(), {
        id: draftId,
        deleted: true,
      });
      assert.equal(
        (await request("GET", `/api/drafts/${draftId}`, cookie)).status,
        404,
      );
      draftId = null;

      step = "logout";
      const logout = await request("POST", "/api/auth/logout", cookie);
      assert.equal(logout.status, 200);
      assert.deepEqual(await logout.json(), { success: true });
      assert.equal(await count(client, "sessions"), 0);

      step = "final";
      await stopServer(child);
      child = null;
      await client.query("BEGIN READ ONLY");
      assert.equal(
        await applicationSchemaFingerprint(client),
        EXPECTED_FINGERPRINT,
      );
      assert.equal(
        await tableSnapshot(
          client,
          "users",
          "WHERE source.recovery_provenance IS NULL",
        ),
        EXPECTED_LEGACY_USER_HASH,
      );
      assert.equal(
        await tableSnapshot(client, "offers"),
        EXPECTED_LEGACY_OFFER_HASH,
      );
      assert.equal(await count(client, "offers"), 9);
      assert.equal(await count(client, "sessions"), 0);
      assert.equal(await count(client, "offer_verifications"), 0);
      assert.equal(await count(client, "activity_logs"), 0);
      await client.query("ROLLBACK");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      const code =
        error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
          ? error.message
          : error && typeof error === "object" && "code" in error
            ? `DATABASE_${String(error.code).replace(/[^A-Z0-9_-]/gi, "")}`
            : "ASSERTION_FAILURE";
      throw new Error(`PHASE5B_RUNTIME_${step.toUpperCase()}_${code}`);
    } finally {
      await stopServer(child);
      if (draftId && recoveryOwnerId) {
        await client
          .query(
            `
              DELETE FROM public.offers
              WHERE id = $1
                AND user_id = $2
                AND status::text = 'draft'
            `,
            [draftId, recoveryOwnerId],
          )
          .catch(() => undefined);
      }
      await client
        .query("DELETE FROM public.sessions")
        .catch(() => undefined);
      await client.end().catch(() => undefined);
      if (draftStorage) {
        const { pool } = await import("../../server/db.js");
        await pool.end().catch(() => undefined);
      }
    }
  },
);
