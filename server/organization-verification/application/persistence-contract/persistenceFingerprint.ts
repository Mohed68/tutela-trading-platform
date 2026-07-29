import { createHash } from "node:crypto";

function canonical(value: unknown): string {
  if (value === null) return "null";
  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new TypeError("NON_FINITE_PERSISTENCE_CONTRACT_VALUE");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`;
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
          `${JSON.stringify(key)}:${canonical(
            Object.getOwnPropertyDescriptor(value, key)?.value,
          )}`,
      )
      .join(",")}}`;
  }
  throw new TypeError("UNSUPPORTED_PERSISTENCE_CONTRACT_VALUE");
}

export function fingerprintPersistenceContract(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonical(value)).digest("hex")}`;
}
