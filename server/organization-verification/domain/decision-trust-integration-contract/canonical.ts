import { createHash } from "node:crypto";

function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("NON_FINITE_BINDING_VALUE");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        return `${JSON.stringify(key)}:${canonicalize(descriptor?.value)}`;
      });
    return `{${entries.join(",")}}`;
  }
  throw new TypeError("UNSUPPORTED_BINDING_VALUE");
}

export function fingerprintDecisionTrustBindingInternal(
  value: unknown,
): string {
  return `sha256:${createHash("sha256").update(canonicalize(value)).digest("hex")}`;
}
