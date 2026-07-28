import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { hashPassword, verifyPassword } from "../../server/password.js";
import {
  ACTIVE_CREDENTIAL_STATUS,
  LOCAL_AUTH_PROVIDER,
  RECOVERY_PROVENANCE,
} from "../../shared/auth.js";
import {
  applicationSchemaFingerprint,
  requireRawDatabaseUrl,
  verifyRecoveryMarker,
} from "../migrations/rehearsal-lib.js";
import {
  assertRecoveryUserEnvironment,
  readRecoveryCredentialInput,
  verifyRecoveryUserState,
} from "./recovery-user-lib.js";

const EXPECTED_FINGERPRINT =
  "d309afaee7935df8b4e91e42f9f6f6c6e9c646b810640e1683e0512e6777bdbe";
const MIGRATION_IDENTIFIER = "0006_additive_auth_recovery";
type Command = "create" | "verify" | "cleanup-rehearse" | "cleanup";

async function assertDatabaseAuthority(client: Client): Promise<void> {
  await verifyRecoveryMarker(client);
  if ((await applicationSchemaFingerprint(client)) !== EXPECTED_FINGERPRINT) {
    throw new Error("AUTH_SCHEMA_FINGERPRINT_MISMATCH");
  }
  const journal = (
    await client.query<{ count: string }>(
      `
        SELECT count(*)::text AS count
        FROM public.tutela_migration_journal
        WHERE migration_identifier = $1
          AND execution_status = 'succeeded'
          AND sql_executed IS TRUE
      `,
      [MIGRATION_IDENTIFIER],
    )
  ).rows[0].count;
  if (journal !== "1") {
    throw new Error("AUTH_MIGRATION_JOURNAL_INVALID");
  }
}

async function createRecoveryUser(client: Client): Promise<void> {
  const { email, password } = readRecoveryCredentialInput(process.env);
  await client.query("BEGIN");
  try {
    await assertDatabaseAuthority(client);
    const existingByEmail = (
      await client.query<{
        password_hash: string | null;
        recovery_provenance: string | null;
      }>(
        `
          SELECT password_hash, recovery_provenance
          FROM public.users
          WHERE lower(email) = $1
          FOR UPDATE
        `,
        [email],
      )
    ).rows[0];

    if (existingByEmail) {
      if (
        existingByEmail.recovery_provenance !== RECOVERY_PROVENANCE ||
        !existingByEmail.password_hash ||
        !(await verifyPassword(password, existingByEmail.password_hash))
      ) {
        throw new Error("RECOVERY_IDENTIFIER_COLLISION");
      }
      await verifyRecoveryUserState(client);
      await client.query("ROLLBACK");
      console.log(
        JSON.stringify({
          command: "create",
          created: false,
          alreadyExists: true,
          role: "trader",
          legacyUsersUnchanged: true,
        }),
      );
      return;
    }

    const existingRecoveryCount = (
      await client.query<{ count: string }>(
        `
          SELECT count(*)::text AS count
          FROM public.users
          WHERE recovery_provenance = $1
        `,
        [RECOVERY_PROVENANCE],
      )
    ).rows[0].count;
    if (existingRecoveryCount !== "0") {
      throw new Error("RECOVERY_USER_ALREADY_EXISTS");
    }

    const passwordHash = await hashPassword(password);
    await client.query(
      `
        INSERT INTO public.users (
          id,
          email,
          first_name,
          last_name,
          profile_image_url,
          company_name,
          role,
          financial_rating,
          credit_rating,
          verified,
          created_at,
          updated_at,
          password_hash,
          auth_provider,
          last_login_at,
          login_enabled,
          credential_status,
          recovery_provenance
        )
        VALUES (
          $1, $2, NULL, NULL, NULL, NULL, 'trader', NULL, NULL, false,
          now(), now(), $3, $4, NULL, true, $5, $6
        )
      `,
      [
        randomUUID(),
        email,
        passwordHash,
        LOCAL_AUTH_PROVIDER,
        ACTIVE_CREDENTIAL_STATUS,
        RECOVERY_PROVENANCE,
      ],
    );
    await verifyRecoveryUserState(client);
    await client.query("COMMIT");
    console.log(
      JSON.stringify({
        command: "create",
        created: true,
        alreadyExists: false,
        role: "trader",
        legacyUsersUnchanged: true,
      }),
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function verifyRecoveryUser(client: Client): Promise<void> {
  await client.query("BEGIN READ ONLY");
  try {
    await assertDatabaseAuthority(client);
    await verifyRecoveryUserState(client);
    await client.query("ROLLBACK");
    console.log(
      JSON.stringify({
        command: "verify",
        recoveryUsers: 1,
        role: "trader",
        adminGranted: false,
        verificationGranted: false,
        organizationGranted: false,
        legacyUsersUnchanged: true,
      }),
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function cleanupRecoveryUser(
  client: Client,
  rehearseOnly: boolean,
): Promise<void> {
  const { email } = readRecoveryCredentialInput(process.env);
  await client.query("BEGIN");
  try {
    await assertDatabaseAuthority(client);
    const recovery = (
      await client.query<{ id: string }>(
        `
          SELECT id
          FROM public.users
          WHERE lower(email) = $1
            AND recovery_provenance = $2
          FOR UPDATE
        `,
        [email, RECOVERY_PROVENANCE],
      )
    ).rows[0];
    if (!recovery) {
      throw new Error("RECOVERY_USER_NOT_FOUND");
    }

    await client.query(
      `DELETE FROM public.sessions
       WHERE sess #>> '{passport,user}' = $1`,
      [recovery.id],
    );
    const removed = await client.query(
      `
        DELETE FROM public.users
        WHERE id = $1
          AND recovery_provenance = $2
      `,
      [recovery.id, RECOVERY_PROVENANCE],
    );
    if (removed.rowCount !== 1) {
      throw new Error("RECOVERY_USER_CLEANUP_SCOPE_INVALID");
    }

    const legacyCount = (
      await client.query<{ count: string }>(
        `
          SELECT count(*)::text AS count
          FROM public.users
          WHERE recovery_provenance IS NULL
        `,
      )
    ).rows[0].count;
    if (legacyCount !== "4") {
      throw new Error("LEGACY_USER_COUNT_CHANGED");
    }

    if (rehearseOnly) {
      await client.query("ROLLBACK");
    } else {
      await client.query("COMMIT");
    }
    console.log(
      JSON.stringify({
        command: rehearseOnly ? "cleanup-rehearse" : "cleanup",
        removed: !rehearseOnly,
        transactionRolledBack: rehearseOnly,
        legacyUsersUnchanged: true,
      }),
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

const command = process.argv[2] as Command | undefined;
if (
  !command ||
  !["create", "verify", "cleanup-rehearse", "cleanup"].includes(command)
) {
  console.error("RECOVERY_USER_COMMAND_REQUIRED");
  process.exit(1);
}

assertRecoveryUserEnvironment(process.env);
if (command !== "verify") {
  readRecoveryCredentialInput(process.env);
}

const client = new Client({
  connectionString: requireRawDatabaseUrl(process.env.DATABASE_URL),
});

try {
  await client.connect();
  if (command === "create") await createRecoveryUser(client);
  if (command === "verify") await verifyRecoveryUser(client);
  if (command === "cleanup-rehearse") {
    await cleanupRecoveryUser(client, true);
  }
  if (command === "cleanup") await cleanupRecoveryUser(client, false);
} catch (error) {
  const code =
    error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : error && typeof error === "object" && "code" in error
        ? `DATABASE_ERROR_${String(error.code).replace(/[^A-Z0-9_-]/gi, "")}`
        : "RECOVERY_USER_COMMAND_FAILED";
  console.error(code);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
