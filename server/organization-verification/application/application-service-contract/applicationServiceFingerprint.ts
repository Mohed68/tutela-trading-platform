import { createHash } from "node:crypto";

function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "undefined") return '"__undefined__"';
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Readonly<Record<string, unknown>>;
    return `{${Object.keys(record)
      .sort((left, right) => left.localeCompare(right))
      .map(
        (key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(String(value));
}

export function fingerprintApplicationServiceContract(
  scope: string,
  value: unknown,
): string {
  return createHash("sha256")
    .update(canonicalize(Object.freeze({ scope, value })))
    .digest("hex");
}
