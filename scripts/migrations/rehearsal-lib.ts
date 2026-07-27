import crypto from "node:crypto";
import fs from "node:fs";
import type { Client } from "pg";

export const LEGACY_STRUCTURAL_FINGERPRINT =
  "0ff84f064026bb8e918a9ffc1725a8fb611eb753169bf07b9c166e81ee9f143f";

export const EXECUTION_PATH = "existing_database_upgrade" as const;
export const CONTROL_TABLES = [
  "recovery_environment_marker",
  "tutela_migration_journal",
] as const;

const LEGACY_ROW_COUNTS = new Map([
  ["neon_auth.users_sync", "1"],
  ["public.activity_logs", "0"],
  ["public.commodities", "9"],
  ["public.contracts", "0"],
  ["public.offers", "9"],
  ["public.partner_relations", "0"],
  ["public.sessions", "0"],
  ["public.users", "4"],
  ["public.verification_documents", "0"],
]);

export class RehearsalSafetyError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "RehearsalSafetyError";
  }
}

export function requireRawDatabaseUrl(value: string | undefined): string {
  if (!value) {
    throw new RehearsalSafetyError(
      "DATABASE_URL is required.",
      "DATABASE_URL_MISSING",
    );
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
      throw new Error("Unsupported protocol");
    }
  } catch {
    throw new RehearsalSafetyError(
      "DATABASE_URL must be a raw PostgreSQL URL.",
      "DATABASE_URL_INVALID",
    );
  }

  return value;
}

export function sha256Text(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function sha256File(path: string): string {
  return sha256Text(fs.readFileSync(path));
}

export function assertChecksum(
  expected: string,
  actual: string,
  identifier: string,
): void {
  if (expected !== actual) {
    throw new RehearsalSafetyError(
      `Checksum mismatch for ${identifier}.`,
      "CHECKSUM_MISMATCH",
    );
  }
}

export function redactedFailure(error: unknown): string {
  if (error instanceof RehearsalSafetyError) return error.code;
  if (error && typeof error === "object" && "code" in error) {
    return `DATABASE_ERROR_${String(error.code).replace(/[^A-Z0-9_-]/gi, "")}`;
  }
  return "REDACTED_MIGRATION_FAILURE";
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function normalizeDefault(value: string | null): string | null {
  if (value === null) return null;
  let normalized = value.replace(/::[a-zA-Z0-9_ ]+(?:\[\])?/g, "");
  if (/^'[-+]?\d+(?:\.\d+)?'$/.test(normalized)) {
    normalized = normalized.slice(1, -1);
  }
  return normalized;
}

function normalizeType(row: {
  data_type: string;
  udt_name: string;
  numeric_precision: number | null;
  numeric_scale: number | null;
}): string {
  if (row.data_type === "USER-DEFINED") return row.udt_name;
  if (row.data_type === "character varying") return "varchar";
  if (row.data_type === "timestamp without time zone") return "timestamp";
  if (row.data_type === "timestamp with time zone") return "timestamptz";
  if (row.data_type === "boolean") return "boolean";
  if (row.data_type === "integer") return "integer";
  if (row.data_type === "numeric") {
    return `numeric(${row.numeric_precision},${row.numeric_scale})`;
  }
  return row.data_type;
}

export async function applicationSchemaFingerprint(
  client: Client,
): Promise<string> {
  const excluded = CONTROL_TABLES.map((name) => `'${name}'`).join(", ");

  const schemas = (
    await client.query<{ schema_name: string }>(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('information_schema')
        AND schema_name NOT LIKE 'pg_%'
      ORDER BY schema_name
    `)
  ).rows.map((row) => row.schema_name);

  const tableRows = (
    await client.query<{ table_schema: string; table_name: string }>(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema IN ('public', 'neon_auth')
        AND NOT (
          table_schema = 'public'
          AND table_name IN (${excluded})
        )
      ORDER BY table_schema, table_name
    `)
  ).rows;

  const columns = (
    await client.query<{
      table_schema: string;
      table_name: string;
      column_name: string;
      data_type: string;
      udt_name: string;
      is_nullable: "YES" | "NO";
      column_default: string | null;
      numeric_precision: number | null;
      numeric_scale: number | null;
    }>(`
      SELECT
        table_schema,
        table_name,
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns
      WHERE table_schema IN ('public', 'neon_auth')
        AND NOT (
          table_schema = 'public'
          AND table_name IN (${excluded})
        )
      ORDER BY table_schema, table_name, ordinal_position
    `)
  ).rows.map((row) => ({
    table: `${row.table_schema}.${row.table_name}`,
    column: row.column_name,
    type: normalizeType(row),
    nullable: row.is_nullable === "YES" ? "yes" : "no",
    defaultValue: normalizeDefault(row.column_default),
  }));

  const constraints = (
    await client.query<{
      schema_name: string;
      table_name: string;
      constraint_name: string;
      definition: string;
    }>(`
      SELECT
        n.nspname AS schema_name,
        c.relname AS table_name,
        con.conname AS constraint_name,
        pg_get_constraintdef(con.oid, true) AS definition
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname IN ('public', 'neon_auth')
        AND NOT (
          n.nspname = 'public'
          AND c.relname IN (${excluded})
        )
      ORDER BY n.nspname, c.relname, con.conname
    `)
  ).rows;

  const indexes = (
    await client.query<{
      schemaname: string;
      tablename: string;
      indexname: string;
      indexdef: string;
    }>(`
      SELECT schemaname, tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname IN ('public', 'neon_auth')
        AND NOT (
          schemaname = 'public'
          AND tablename IN (${excluded})
        )
      ORDER BY schemaname, tablename, indexname
    `)
  ).rows;

  const enums = (
    await client.query<{
      name: string;
      value: string;
      sort_order: number;
    }>(`
      SELECT
        t.typname AS name,
        e.enumlabel AS value,
        e.enumsortorder AS sort_order
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      ORDER BY t.typname, e.enumsortorder
    `)
  ).rows.map((row) => ({
    name: row.name,
    value: row.value,
    order: Number(row.sort_order),
  }));

  return sha256Text(
    JSON.stringify({
      schemas,
      tables: tableRows.map(
        (row) => `${row.table_schema}.${row.table_name}`,
      ),
      columns,
      constraints,
      indexes,
      enums,
    }),
  );
}

export async function verifyRecoveryMarker(client: Client): Promise<void> {
  const result = (
    await client.query<{ count: string; valid: boolean }>(
      `
        SELECT
          count(*)::bigint AS count,
          bool_and(environment_name = $1) AS valid
        FROM public.recovery_environment_marker
      `,
      ["tutela-recovery-test"],
    )
  ).rows[0];

  if (result.count !== "1" || !result.valid) {
    throw new RehearsalSafetyError(
      "Recovery marker verification failed.",
      "RECOVERY_MARKER_INVALID",
    );
  }
}

export async function verifyLegacyRowCounts(client: Client): Promise<void> {
  for (const [name, expectedCount] of LEGACY_ROW_COUNTS) {
    const [schemaName, tableName] = name.split(".");
    const count = (
      await client.query<{ count: string }>(
        `SELECT count(*)::bigint AS count FROM ${quoteIdentifier(
          schemaName,
        )}.${quoteIdentifier(tableName)}`,
      )
    ).rows[0].count;

    if (count !== expectedCount) {
      throw new RehearsalSafetyError(
        "Legacy copied row counts changed.",
        "LEGACY_ROW_COUNTS_MISMATCH",
      );
    }
  }
}

export async function verifyLegacyBaseline(client: Client): Promise<void> {
  await verifyRecoveryMarker(client);
  await verifyLegacyRowCounts(client);

  const fingerprint = await applicationSchemaFingerprint(client);
  if (fingerprint !== LEGACY_STRUCTURAL_FINGERPRINT) {
    throw new RehearsalSafetyError(
      "Legacy structural fingerprint changed.",
      "LEGACY_FINGERPRINT_MISMATCH",
    );
  }

  const forbidden = (
    await client.query<{ name: string | null }>(`
      SELECT object_name AS name
      FROM (
        VALUES
          (to_regclass('public.offer_verifications')::text),
          (to_regclass('public.performance_insights_reports')::text),
          (to_regclass('public.tutela_migration_journal')::text),
          (to_regclass('public.partner_relations_requester_idx')::text),
          (to_regclass('public.partner_relations_partner_idx')::text),
          (to_regclass('public.partner_relations_active_pair_unique')::text)
      ) objects(object_name)
      WHERE object_name IS NOT NULL
    `)
  ).rows;

  if (forbidden.length > 0) {
    throw new RehearsalSafetyError(
      "Migration target objects already exist.",
      "MIGRATION_TARGET_PRESENT",
    );
  }
}

export async function verifyRecreatedLegacyBaseline(
  client: Client,
): Promise<void> {
  await verifyLegacyRowCounts(client);

  const fingerprint = await applicationSchemaFingerprint(client);
  if (fingerprint !== LEGACY_STRUCTURAL_FINGERPRINT) {
    throw new RehearsalSafetyError(
      "Recreated branch structural fingerprint changed.",
      "LEGACY_FINGERPRINT_MISMATCH",
    );
  }

  const forbidden = (
    await client.query<{ name: string | null }>(`
      SELECT object_name AS name
      FROM (
        VALUES
          (to_regclass('public.recovery_environment_marker')::text),
          (to_regclass('public.tutela_migration_journal')::text),
          (to_regclass('public.offer_verifications')::text),
          (to_regclass('public.performance_insights_reports')::text),
          (to_regclass('public.partner_relations_requester_idx')::text),
          (to_regclass('public.partner_relations_partner_idx')::text),
          (to_regclass('public.partner_relations_active_pair_unique')::text)
      ) objects(object_name)
      WHERE object_name IS NOT NULL
    `)
  ).rows;

  const reconciledConstraints = (
    await client.query<{ count: string }>(`
      SELECT count(*)::bigint AS count
      FROM pg_constraint
      WHERE conrelid = 'public.partner_relations'::regclass
        AND conname IN (
          'partner_relations_no_self',
          'partner_relations_status_check'
        )
    `)
  ).rows[0].count;

  if (forbidden.length > 0 || reconciledConstraints !== "0") {
    throw new RehearsalSafetyError(
      "Recreated branch still contains rehearsal objects.",
      "RECREATION_NOT_CLEAN",
    );
  }
}

async function assertUuidSupport(client: Client): Promise<void> {
  const available = (
    await client.query<{ available: boolean }>(`
      SELECT to_regprocedure('gen_random_uuid()') IS NOT NULL AS available
    `)
  ).rows[0].available;

  if (!available) {
    throw new RehearsalSafetyError(
      "gen_random_uuid() is unavailable.",
      "UUID_FUNCTION_MISSING",
    );
  }
}

async function assertJsonbSupport(client: Client): Promise<void> {
  const available = (
    await client.query<{ available: boolean }>(`
      SELECT to_regtype('jsonb') IS NOT NULL AS available
    `)
  ).rows[0].available;

  if (!available) {
    throw new RehearsalSafetyError(
      "jsonb is unavailable.",
      "JSONB_TYPE_MISSING",
    );
  }
}

async function assertVarcharPrimaryKey(
  client: Client,
  tableName: "users" | "offers",
): Promise<void> {
  const result = (
    await client.query<{ compatible: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns col
          JOIN information_schema.table_constraints tc
            ON tc.table_schema = col.table_schema
           AND tc.table_name = col.table_name
           AND tc.constraint_type = 'PRIMARY KEY'
          JOIN information_schema.key_column_usage kcu
            ON kcu.constraint_schema = tc.constraint_schema
           AND kcu.constraint_name = tc.constraint_name
           AND kcu.table_schema = tc.table_schema
           AND kcu.table_name = tc.table_name
           AND kcu.column_name = col.column_name
          WHERE col.table_schema = 'public'
            AND col.table_name = $1
            AND col.column_name = 'id'
            AND col.data_type = 'character varying'
            AND col.is_nullable = 'NO'
        ) AS compatible
      `,
      [tableName],
    )
  ).rows[0];

  if (!result.compatible) {
    throw new RehearsalSafetyError(
      `${tableName}.id is not a compatible varchar primary key.`,
      "INCOMPATIBLE_FOREIGN_KEY_TARGET",
    );
  }
}

async function assertObjectsAbsent(
  client: Client,
  tableName: string,
  indexNames: string[],
  constraintNames: string[],
): Promise<void> {
  const tableExists = (
    await client.query<{ exists: boolean }>(
      `SELECT to_regclass($1) IS NOT NULL AS exists`,
      [`public.${tableName}`],
    )
  ).rows[0].exists;

  const conflictingIndexes = (
    await client.query<{ count: string }>(
      `
        SELECT count(*)::bigint AS count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = ANY($1::text[])
      `,
      [indexNames],
    )
  ).rows[0].count;

  const conflictingConstraints = (
    await client.query<{ count: string }>(
      `
        SELECT count(*)::bigint AS count
        FROM pg_constraint con
        JOIN pg_namespace n ON n.oid = con.connamespace
        WHERE n.nspname = 'public'
          AND con.conname = ANY($1::text[])
      `,
      [constraintNames],
    )
  ).rows[0].count;

  if (
    tableExists ||
    conflictingIndexes !== "0" ||
    conflictingConstraints !== "0"
  ) {
    throw new RehearsalSafetyError(
      `Conflicting objects exist for ${tableName}.`,
      "MIGRATION_OBJECT_CONFLICT",
    );
  }
}

export async function preflight0003(client: Client): Promise<void> {
  await verifyRecoveryMarker(client);
  await assertUuidSupport(client);
  await assertVarcharPrimaryKey(client, "users");
  await assertVarcharPrimaryKey(client, "offers");
  await assertObjectsAbsent(
    client,
    "offer_verifications",
    [
      "offer_verifications_offer_idx",
      "offer_verifications_submitter_idx",
    ],
    ["offer_verifications_status_check"],
  );
}

export async function preflight0004(client: Client): Promise<void> {
  await verifyRecoveryMarker(client);
  await assertUuidSupport(client);
  await assertJsonbSupport(client);
  await assertVarcharPrimaryKey(client, "users");
  await assertObjectsAbsent(
    client,
    "performance_insights_reports",
    ["performance_insights_user_generated_idx"],
    [],
  );
}

export interface PartnerPreflightCounts {
  nullStatuses: string;
  invalidStatuses: string;
  selfRelations: string;
  duplicateActivePairs: string;
}

export async function partnerPreflight(
  client: Client,
): Promise<PartnerPreflightCounts> {
  await verifyRecoveryMarker(client);

  const counts = (
    await client.query<{
      null_statuses: string;
      invalid_statuses: string;
      self_relations: string;
      duplicate_active_pairs: string;
    }>(`
      SELECT
        count(*) FILTER (WHERE status IS NULL)::bigint AS null_statuses,
        count(*) FILTER (
          WHERE status IS NOT NULL
            AND status NOT IN ('pending', 'approved', 'rejected')
        )::bigint AS invalid_statuses,
        count(*) FILTER (
          WHERE requester_id = partner_id
        )::bigint AS self_relations,
        (
          SELECT count(*)::bigint
          FROM (
            SELECT
              LEAST(requester_id, partner_id),
              GREATEST(requester_id, partner_id)
            FROM public.partner_relations
            WHERE status IN ('pending', 'approved')
            GROUP BY 1, 2
            HAVING count(*) > 1
          ) duplicate_pairs
        ) AS duplicate_active_pairs
      FROM public.partner_relations
    `)
  ).rows[0];

  const result = {
    nullStatuses: counts.null_statuses,
    invalidStatuses: counts.invalid_statuses,
    selfRelations: counts.self_relations,
    duplicateActivePairs: counts.duplicate_active_pairs,
  };

  if (Object.values(result).some((value) => value !== "0")) {
    throw new RehearsalSafetyError(
      "Partner preflight found constraint violations.",
      "PARTNER_PREFLIGHT_FAILED",
    );
  }

  const structure = (
    await client.query<{
      columns: string;
      constraints: string;
      indexes: string;
    }>(`
      SELECT
        (
          SELECT string_agg(
            column_name || ':' || data_type || ':' || is_nullable,
            ',' ORDER BY ordinal_position
          )
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'partner_relations'
        ) AS columns,
        (
          SELECT string_agg(conname, ',' ORDER BY conname)
          FROM pg_constraint
          WHERE conrelid = 'public.partner_relations'::regclass
        ) AS constraints,
        (
          SELECT string_agg(indexname, ',' ORDER BY indexname)
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND tablename = 'partner_relations'
        ) AS indexes
    `)
  ).rows[0];

  const expectedColumns =
    "id:character varying:NO,requester_id:character varying:NO," +
    "partner_id:character varying:NO,status:character varying:YES," +
    "notes:text:YES,created_at:timestamp without time zone:YES," +
    "updated_at:timestamp without time zone:YES";
  const expectedConstraints =
    "partner_relations_partner_id_users_id_fk,partner_relations_pkey," +
    "partner_relations_requester_id_users_id_fk";
  const expectedIndexes = "partner_relations_pkey";

  if (
    structure.columns !== expectedColumns ||
    structure.constraints !== expectedConstraints ||
    structure.indexes !== expectedIndexes
  ) {
    throw new RehearsalSafetyError(
      "partner_relations differs from the approved legacy structure.",
      "PARTNER_STRUCTURE_MISMATCH",
    );
  }

  return result;
}

async function tableColumns(
  client: Client,
  tableName: string,
): Promise<
  Array<{
    name: string;
    type: string;
    nullable: boolean;
    defaultValue: string | null;
  }>
> {
  return (
    await client.query<{
      column_name: string;
      data_type: string;
      udt_name: string;
      is_nullable: "YES" | "NO";
      column_default: string | null;
      numeric_precision: number | null;
      numeric_scale: number | null;
    }>(
      `
        SELECT
          column_name,
          data_type,
          udt_name,
          is_nullable,
          column_default,
          numeric_precision,
          numeric_scale
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
        ORDER BY ordinal_position
      `,
      [tableName],
    )
  ).rows.map((row) => ({
    name: row.column_name,
    type: normalizeType(row),
    nullable: row.is_nullable === "YES",
    defaultValue: normalizeDefault(row.column_default),
  }));
}

async function namedObjects(
  client: Client,
  tableName: string,
): Promise<{ constraints: string[]; indexes: string[] }> {
  const constraints = (
    await client.query<{ name: string }>(
      `
        SELECT conname AS name
        FROM pg_constraint
        WHERE conrelid = ('public.' || $1)::regclass
        ORDER BY conname
      `,
      [tableName],
    )
  ).rows.map((row) => row.name);

  const indexes = (
    await client.query<{ name: string }>(
      `
        SELECT indexname AS name
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = $1
        ORDER BY indexname
      `,
      [tableName],
    )
  ).rows.map((row) => row.name);

  return { constraints, indexes };
}

async function foreignKeyTargets(
  client: Client,
  tableName: string,
): Promise<string[]> {
  return (
    await client.query<{
      local_column: string;
      target_schema: string;
      target_table: string;
      target_column: string;
    }>(
      `
        SELECT
          local_attribute.attname AS local_column,
          target_namespace.nspname AS target_schema,
          target_table.relname AS target_table,
          target_attribute.attname AS target_column
        FROM pg_constraint constraint_record
        JOIN pg_class local_table
          ON local_table.oid = constraint_record.conrelid
        JOIN pg_namespace local_namespace
          ON local_namespace.oid = local_table.relnamespace
        JOIN pg_class target_table
          ON target_table.oid = constraint_record.confrelid
        JOIN pg_namespace target_namespace
          ON target_namespace.oid = target_table.relnamespace
        JOIN LATERAL unnest(constraint_record.conkey) WITH ORDINALITY
          AS local_key(attnum, position) ON true
        JOIN LATERAL unnest(constraint_record.confkey) WITH ORDINALITY
          AS target_key(attnum, position)
          ON target_key.position = local_key.position
        JOIN pg_attribute local_attribute
          ON local_attribute.attrelid = local_table.oid
         AND local_attribute.attnum = local_key.attnum
        JOIN pg_attribute target_attribute
          ON target_attribute.attrelid = target_table.oid
         AND target_attribute.attnum = target_key.attnum
        WHERE constraint_record.contype = 'f'
          AND local_namespace.nspname = 'public'
          AND local_table.relname = $1
        ORDER BY local_attribute.attname
      `,
      [tableName],
    )
  ).rows.map(
    (row) =>
      `${row.local_column}->${row.target_schema}.${row.target_table}.${row.target_column}`,
  );
}

export async function verify0003(client: Client): Promise<void> {
  const actualColumns = await tableColumns(client, "offer_verifications");
  const expectedColumns = [
    { name: "id", type: "varchar", nullable: false, defaultValue: "gen_random_uuid()" },
    { name: "offer_id", type: "varchar", nullable: false, defaultValue: null },
    { name: "submitted_by", type: "varchar", nullable: false, defaultValue: null },
    { name: "documents", type: "text", nullable: false, defaultValue: null },
    { name: "notes", type: "text", nullable: true, defaultValue: null },
    { name: "status", type: "varchar", nullable: false, defaultValue: "'pending'" },
    { name: "submitted_at", type: "timestamp", nullable: false, defaultValue: null },
    { name: "created_at", type: "timestamp", nullable: true, defaultValue: "now()" },
    { name: "updated_at", type: "timestamp", nullable: true, defaultValue: "now()" },
  ];
  const objects = await namedObjects(client, "offer_verifications");
  const expectedConstraints = [
    "offer_verifications_offer_id_fkey",
    "offer_verifications_pkey",
    "offer_verifications_status_check",
    "offer_verifications_submitted_by_fkey",
  ];
  const expectedIndexes = [
    "offer_verifications_offer_idx",
    "offer_verifications_pkey",
    "offer_verifications_submitter_idx",
  ];
  const foreignKeys = await foreignKeyTargets(client, "offer_verifications");
  const expectedForeignKeys = [
    "offer_id->public.offers.id",
    "submitted_by->public.users.id",
  ];

  if (
    JSON.stringify(actualColumns) !== JSON.stringify(expectedColumns) ||
    JSON.stringify(objects.constraints) !== JSON.stringify(expectedConstraints) ||
    JSON.stringify(objects.indexes) !== JSON.stringify(expectedIndexes) ||
    JSON.stringify(foreignKeys) !== JSON.stringify(expectedForeignKeys)
  ) {
    throw new RehearsalSafetyError(
      "0003 post-verification failed.",
      "0003_POST_VERIFICATION_FAILED",
    );
  }
}

export async function verify0004(client: Client): Promise<void> {
  const actualColumns = await tableColumns(
    client,
    "performance_insights_reports",
  );
  const expectedColumns = [
    { name: "id", type: "varchar", nullable: false, defaultValue: "gen_random_uuid()" },
    { name: "user_id", type: "varchar", nullable: false, defaultValue: null },
    { name: "summary", type: "jsonb", nullable: false, defaultValue: null },
    { name: "insights", type: "jsonb", nullable: false, defaultValue: null },
    { name: "recommendations", type: "jsonb", nullable: false, defaultValue: null },
    { name: "risk_factors", type: "jsonb", nullable: false, defaultValue: null },
    { name: "opportunities", type: "jsonb", nullable: false, defaultValue: null },
    { name: "generated_at", type: "timestamp", nullable: false, defaultValue: "now()" },
  ];
  const objects = await namedObjects(
    client,
    "performance_insights_reports",
  );
  const expectedConstraints = [
    "performance_insights_reports_pkey",
    "performance_insights_reports_user_id_fkey",
  ];
  const expectedIndexes = [
    "performance_insights_reports_pkey",
    "performance_insights_user_generated_idx",
  ];
  const foreignKeys = await foreignKeyTargets(
    client,
    "performance_insights_reports",
  );

  if (
    JSON.stringify(actualColumns) !== JSON.stringify(expectedColumns) ||
    JSON.stringify(objects.constraints) !== JSON.stringify(expectedConstraints) ||
    JSON.stringify(objects.indexes) !== JSON.stringify(expectedIndexes) ||
    JSON.stringify(foreignKeys) !==
      JSON.stringify(["user_id->public.users.id"])
  ) {
    throw new RehearsalSafetyError(
      "0004 post-verification failed.",
      "0004_POST_VERIFICATION_FAILED",
    );
  }
}

export async function verify0005(client: Client): Promise<void> {
  const status = (
    await client.query<{
      nullable: "YES" | "NO";
      default_value: string | null;
    }>(`
      SELECT is_nullable AS nullable, column_default AS default_value
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'partner_relations'
        AND column_name = 'status'
    `)
  ).rows[0];

  const objects = await namedObjects(client, "partner_relations");
  const requiredConstraints = [
    "partner_relations_no_self",
    "partner_relations_partner_id_users_id_fk",
    "partner_relations_pkey",
    "partner_relations_requester_id_users_id_fk",
    "partner_relations_status_check",
  ];
  const requiredIndexes = [
    "partner_relations_active_pair_unique",
    "partner_relations_partner_idx",
    "partner_relations_pkey",
    "partner_relations_requester_idx",
  ];

  if (
    !status ||
    status.nullable !== "NO" ||
    normalizeDefault(status.default_value) !== "'pending'" ||
    JSON.stringify(objects.constraints) !== JSON.stringify(requiredConstraints) ||
    JSON.stringify(objects.indexes) !== JSON.stringify(requiredIndexes)
  ) {
    throw new RehearsalSafetyError(
      "0005 post-verification failed.",
      "0005_POST_VERIFICATION_FAILED",
    );
  }
}
