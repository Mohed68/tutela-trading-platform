import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { request as nodeHttpRequest, type IncomingHttpHeaders } from "node:http";
import test from "node:test";
import { Client, type QueryResultRow } from "pg";
import type {
  DraftOfferOptionsDto,
  OwnerPrivateOfferDetailDto,
  SubmittedOfferDetailDto,
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
const PORT = "5062";
const SENSITIVE_KEYS = new Set([
  "user",
  "userId",
  "ownerId",
  "email",
  "password",
  "passwordHash",
  "verification",
  "verified",
  "published",
  "moderation",
  "session",
  "token",
]);
const serverDiagnostics = new WeakMap<
  ReturnType<typeof spawn>,
  { listening: boolean; startupFailure: boolean }
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

async function cleanupPhase6SubmissionData(
  client: Client,
  offerId: string,
): Promise<void> {
  await client.query(
    "SELECT set_config('tutela.verification_maintenance', 'on', false)",
  );
  try {
    await client.query(
      "DELETE FROM public.offer_workflow_transitions WHERE offer_id = $1",
      [offerId],
    );
    await client.query(
      `
        DELETE FROM public.offer_verification_events
        WHERE attempt_id IN (
          SELECT id FROM public.offer_verification_attempts WHERE offer_id = $1
        )
      `,
      [offerId],
    );
    await client.query(
      `
        DELETE FROM public.offer_verification_findings
        WHERE attempt_id IN (
          SELECT id FROM public.offer_verification_attempts WHERE offer_id = $1
        )
      `,
      [offerId],
    );
    await client.query(
      "DELETE FROM public.offer_verification_commands WHERE offer_id = $1",
      [offerId],
    );
    await client.query(
      "DELETE FROM public.offer_verification_attempts WHERE offer_id = $1",
      [offerId],
    );
    await client.query(
      "DELETE FROM public.offer_submission_revisions WHERE offer_id = $1",
      [offerId],
    );
  } finally {
    await client
      .query(
        "SELECT set_config('tutela.verification_maintenance', 'off', false)",
      )
      .catch(() => undefined);
  }
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
      TUTELA_VERIFICATION_WORKER_DISABLED: "true",
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
  const diagnostics = { listening: false, startupFailure: false };
  serverDiagnostics.set(child, diagnostics);
  const inspectOutput = (chunk: Buffer | string) => {
    const output = chunk.toString();
    if (output.includes("serving on port")) diagnostics.listening = true;
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
    diagnostics?.startupFailure
      ? "SERVER_STARTUP_FAILURE"
      : "SERVER_DID_NOT_START",
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

test(
  "Phase 5C freezes one owner draft as a private submitted offer and cleans it up",
  { timeout: 600_000 },
  async () => {
    const credential = readRecoveryCredentialInput(process.env);
    const client = new Client({
      connectionString: requireRawDatabaseUrl(process.env.DATABASE_URL),
    });
    let child: ReturnType<typeof spawn> | null = null;
    let offerId: string | null = null;
    let recoveryOwnerId: string | null = null;
    let privateStorage:
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
      assert.equal(await count(client, "offers"), 9);
      assert.equal(await count(client, "sessions"), 0);
      assert.equal(await count(client, "offer_verifications"), 0);
      assert.equal(await count(client, "offer_verification_attempts"), 0);
      assert.equal(await count(client, "activity_logs"), 0);
      const journal = (
        await client.query<{
          execution_status: string;
          sql_executed: boolean;
        }>(`
          SELECT execution_status, sql_executed
          FROM public.tutela_migration_journal
          WHERE migration_identifier = '0008_add_submitted_offer_status'
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

      step = "anonymous_submit";
      assert.equal(
        (
          await request(
            "POST",
            `/api/drafts/${crypto.randomUUID()}/submit`,
          )
        ).status,
        401,
      );

      step = "login";
      const login = await request("POST", "/api/auth/login", undefined, {
        email: credential.email,
        password: credential.password,
      });
      assert.equal(login.status, 200);
      const cookie = cookieFrom(login);
      assert.equal(await count(client, "sessions"), 1);

      step = "create";
      const optionsResponse = await request(
        "GET",
        "/api/drafts/options",
        cookie,
      );
      assert.equal(optionsResponse.status, 200);
      const options = (await optionsResponse.json()) as DraftOfferOptionsDto;
      const commodity = options.commodities.find(
        (item) => item.name === "West Texas Intermediate (WTI) Crude Oil",
      );
      assert.ok(commodity);
      const createResponse = await request("POST", "/api/drafts", cookie, {
        offerType: "sell",
        commodityId: commodity.id,
        quantity: "20.00",
        unit: "bbl",
        amountPerUnit: "82.00",
        currency: "USD",
        location: "Phase 5C synthetic submission",
        validUntil: "2099-01-01T00:00:00.000Z",
      });
      assert.equal(createResponse.status, 201);
      const created =
        (await createResponse.json()) as OwnerPrivateOfferDetailDto;
      assert.equal(created.status, "draft");
      offerId = created.id;

      step = "edit";
      const editResponse = await request(
        "PATCH",
        `/api/drafts/${offerId}`,
        cookie,
        { location: "Phase 5C completed synthetic draft" },
      );
      assert.equal(editResponse.status, 200);
      assert.equal(
        ((await editResponse.json()) as OwnerPrivateOfferDetailDto).location,
        "Phase 5C completed synthetic draft",
      );

      step = "authorization";
      privateStorage = await import("../../server/drafts/storage.js");
      assert.equal(
        await privateStorage.submitOwnedDraftOffer(legacyUserId, offerId),
        undefined,
      );
      assert.equal(
        (
          await request(
            "POST",
            `/api/drafts/${legacyOfferId}/submit`,
            cookie,
          )
        ).status,
        404,
      );

      step = "spoofing";
      for (const body of [
        { status: "submitted" },
        { status: "active" },
        { verified: true },
        { published: true },
        { moderationStatus: "approved" },
      ]) {
        assert.equal(
          (
            await request(
              "POST",
              `/api/drafts/${offerId}/submit`,
              cookie,
              body,
            )
          ).status,
          400,
        );
      }

      const beforeSubmit = (
        await client.query<{ record: Record<string, unknown> }>(
          "SELECT to_jsonb(offer) AS record FROM public.offers AS offer WHERE id = $1",
          [offerId],
        )
      ).rows[0].record;

      step = "submit";
      const submitResponse = await request(
        "POST",
        `/api/drafts/${offerId}/submit`,
        cookie,
      );
      assert.equal(submitResponse.status, 200);
      const submitted =
        (await submitResponse.json()) as SubmittedOfferDetailDto;
      assert.equal(submitted.status, "submitted");
      assert.deepEqual(submitted.visibility, { state: "private" });
      assertNoSensitiveKeys(submitted);

      const afterSubmit = (
        await client.query<{ record: Record<string, unknown> }>(
          "SELECT to_jsonb(offer) AS record FROM public.offers AS offer WHERE id = $1",
          [offerId],
        )
      ).rows[0].record;
      const changedFields = Object.keys(afterSubmit).filter(
        (key) =>
          JSON.stringify(afterSubmit[key]) !==
          JSON.stringify(beforeSubmit[key]),
      );
      assert.deepEqual(changedFields.sort(), ["status", "updated_at"]);

      step = "idempotence";
      const repeated = await request(
        "POST",
        `/api/drafts/${offerId}/submit`,
        cookie,
      );
      assert.equal(repeated.status, 200);
      const repeatedDto =
        (await repeated.json()) as SubmittedOfferDetailDto;
      assert.deepEqual(repeatedDto, submitted);

      step = "submitted_reads";
      const list = await request("GET", "/api/drafts", cookie);
      assert.equal(list.status, 200);
      const listed = (await list.json()) as OwnerPrivateOfferDetailDto[];
      assert.equal(listed.length, 1);
      assert.equal(listed[0].id, offerId);
      assert.equal(listed[0].status, "submitted");
      assertNoSensitiveKeys(listed);
      const detail = await request("GET", `/api/drafts/${offerId}`, cookie);
      assert.equal(detail.status, 200);
      assert.deepEqual(await detail.json(), submitted);

      step = "submitted_frozen";
      assert.equal(
        (
          await request("PATCH", `/api/drafts/${offerId}`, cookie, {
            location: "Forbidden submitted edit",
          })
        ).status,
        404,
      );
      assert.equal(
        (await request("DELETE", `/api/drafts/${offerId}`, cookie)).status,
        404,
      );
      assert.equal(
        (
          await request("PATCH", `/api/drafts/${offerId}`, cookie, {
            status: "active",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            "POST",
            `/api/drafts/${offerId}/publish`,
            cookie,
          )
        ).status,
        503,
      );

      step = "private_invariance";
      const marketplace = await request("GET", "/api/offers", cookie);
      assert.equal(marketplace.status, 200);
      const marketplaceBody = (await marketplace.json()) as {
        offers: unknown[];
        totalCount: number;
      };
      assert.deepEqual(marketplaceBody.offers, []);
      assert.equal(marketplaceBody.totalCount, 0);
      assert.equal(JSON.stringify(marketplaceBody).includes(offerId), false);
      assert.equal(await count(client, "offer_verifications"), 0);
      assert.equal(await count(client, "activity_logs"), 0);
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

      step = "cleanup";
      await cleanupPhase6SubmissionData(client, offerId);
      const cleanup = await client.query<{ id: string }>(
        `
          DELETE FROM public.offers
          WHERE id = $1
            AND user_id = $2
            AND status::text = 'submitted'
          RETURNING id
        `,
        [offerId, recoveryOwnerId],
      );
      assert.equal(cleanup.rowCount, 1);
      assert.equal(cleanup.rows[0].id, offerId);
      offerId = null;
      const emptyList = await request("GET", "/api/drafts", cookie);
      assert.equal(emptyList.status, 200);
      assert.deepEqual(await emptyList.json(), []);

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
      assert.equal(await count(client, "offer_verification_attempts"), 0);
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
      throw new Error(`PHASE5C_RUNTIME_${step.toUpperCase()}_${code}`);
    } finally {
      await stopServer(child);
      if (offerId && recoveryOwnerId) {
        await cleanupPhase6SubmissionData(client, offerId).catch(
          () => undefined,
        );
        await client
          .query(
            `
              DELETE FROM public.offers
              WHERE id = $1
                AND user_id = $2
                AND status::text IN ('draft', 'submitted')
            `,
            [offerId, recoveryOwnerId],
          )
          .catch(() => undefined);
      }
      await client.query("DELETE FROM public.sessions").catch(() => undefined);
      await client.end().catch(() => undefined);
      if (privateStorage) {
        const { pool } = await import("../../server/db.js");
        await pool.end().catch(() => undefined);
      }
    }
  },
);
