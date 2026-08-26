export const DEMO_ID_KINDS = [
  "access-grant",
  "session",
  "org",
  "offer",
  "mission",
  "order",
  "acceptance",
  "contract",
] as const;

export type DemoIdKind = (typeof DEMO_ID_KINDS)[number];
export type DemoId<Kind extends DemoIdKind = DemoIdKind> =
  `demo:${Kind}:${string}`;

const DEMO_ID_PATTERN =
  /^demo:(access-grant|session|org|offer|mission|order|acceptance|contract):[a-z0-9][a-z0-9-]*$/;

export function isDemoId(value: unknown): value is DemoId {
  return typeof value === "string" && DEMO_ID_PATTERN.test(value);
}

export function hasDemoNamespacePrefix(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("demo:");
}

export function isDemoIdOfKind<Kind extends DemoIdKind>(
  value: unknown,
  kind: Kind,
): value is DemoId<Kind> {
  return isDemoId(value) && value.startsWith(`demo:${kind}:`);
}

/**
 * Defensive boundary for production adapters. D1 defines the guard but does
 * not wire it into production routes.
 */
export function isProductionIdCandidate(value: unknown): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && !isDemoId(value)
    && !hasDemoNamespacePrefix(value)
  );
}
