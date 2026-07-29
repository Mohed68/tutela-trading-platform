export function canonicalizeWorkflowValue(value: unknown): string {
  if (value === null) return "null";
  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new TypeError("NON_FINITE_WORKFLOW_VALUE");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeWorkflowValue).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalizeWorkflowValue(
            Object.getOwnPropertyDescriptor(value, key)?.value,
          )}`,
      )
      .join(",")}}`;
  }
  throw new TypeError("UNSUPPORTED_WORKFLOW_VALUE");
}
