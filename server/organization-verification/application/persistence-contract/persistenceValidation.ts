export function isExactPersistenceIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["latest", "current", "head", "default"].includes(
      value.trim().toLowerCase(),
    )
  );
}

export function isExplicitPersistenceTimestamp(
  value: unknown,
): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function normalizePersistenceReferences(
  values: readonly string[],
): readonly string[] | undefined {
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.some((value) => !isExactPersistenceIdentity(value)) ||
    new Set(values).size !== values.length
  ) {
    return undefined;
  }
  return Object.freeze(
    [...values].sort((left, right) => left.localeCompare(right)),
  );
}
