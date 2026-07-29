import { createHash } from "node:crypto";

function canonicalReplayValue(value: unknown): string {
  if (value === null) return "null";
  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new TypeError("NON_FINITE_REPLAY_VALUE");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalReplayValue).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .filter(
        (key) =>
          Object.getOwnPropertyDescriptor(value, key)?.value !== undefined,
      )
      .sort((left, right) => left.localeCompare(right))
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalReplayValue(
            Object.getOwnPropertyDescriptor(value, key)?.value,
          )}`,
      )
      .join(",")}}`;
  }
  throw new TypeError("UNSUPPORTED_REPLAY_VALUE");
}

export function fingerprintOrganizationVerificationReplay(
  value: unknown,
): string {
  return `sha256:${createHash("sha256")
    .update(canonicalReplayValue(value))
    .digest("hex")}`;
}
