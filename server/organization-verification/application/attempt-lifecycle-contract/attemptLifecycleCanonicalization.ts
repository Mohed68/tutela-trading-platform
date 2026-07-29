import { createHash } from "node:crypto";

export function canonicalizeAttemptLifecycleValue(value: unknown): string {
  if (value === null) return "null";
  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new TypeError("NON_FINITE_ATTEMPT_LIFECYCLE_VALUE");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value
      .map((entry) => canonicalizeAttemptLifecycleValue(entry))
      .join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => {
        const entry = Object.getOwnPropertyDescriptor(value, key)?.value;
        return `${JSON.stringify(key)}:${canonicalizeAttemptLifecycleValue(entry)}`;
      })
      .join(",")}}`;
  }
  throw new TypeError("UNSUPPORTED_ATTEMPT_LIFECYCLE_VALUE");
}

export function fingerprintAttemptLifecycleValue(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(canonicalizeAttemptLifecycleValue(value))
    .digest("hex")}`;
}
