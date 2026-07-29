import { createHash } from "node:crypto";

function canonicalizeWorkflowRuntimeValue(value: unknown): string {
  if (value === null) return "null";
  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new TypeError("NON_FINITE_WORKFLOW_RUNTIME_VALUE");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value
      .map((entry) => canonicalizeWorkflowRuntimeValue(entry))
      .join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalizeWorkflowRuntimeValue(
            Object.getOwnPropertyDescriptor(value, key)?.value,
          )}`,
      )
      .join(",")}}`;
  }
  throw new TypeError("UNSUPPORTED_WORKFLOW_RUNTIME_VALUE");
}

export function fingerprintOrganizationVerificationWorkflowRuntime(
  value: unknown,
): string {
  return `sha256:${createHash("sha256")
    .update(canonicalizeWorkflowRuntimeValue(value))
    .digest("hex")}`;
}
