export type ReadonlyPostgresRow = Readonly<Record<string, unknown>>;

export interface ReadonlyPostgresQueryResult {
  readonly rowCount: number;
  readonly rows: readonly ReadonlyPostgresRow[];
}

export interface ReadonlyPostgresPort {
  query(
    statement: string,
    parameters?: readonly unknown[],
  ): Promise<ReadonlyPostgresQueryResult>;
}

export interface RawPostgresQueryResult {
  readonly rowCount: number | null;
  readonly rows: readonly Record<string, unknown>[];
}

export type RawPostgresQuery = (
  statement: string,
  parameters: readonly unknown[],
) => Promise<RawPostgresQueryResult>;

export function createReadonlyPostgresPort(
  execute: RawPostgresQuery,
): ReadonlyPostgresPort {
  return Object.freeze({
    async query(
      statement: string,
      parameters: readonly unknown[] = [],
    ): Promise<ReadonlyPostgresQueryResult> {
      const result = await execute(statement, parameters);
      return Object.freeze({
        rowCount: result.rowCount ?? result.rows.length,
        rows: Object.freeze(
          result.rows.map((row) => Object.freeze({ ...row })),
        ),
      });
    },
  });
}
