import { createHash } from "node:crypto";
import {
  createEvaluationProjectionFingerprintInternal,
  type EvaluationProjectionFingerprint,
} from "./ids.js";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nested]) => nested !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonical(nested)]),
    );
  }
  return value;
}

export function computeEvaluationProjectionFingerprintInternal(
  value: unknown,
): EvaluationProjectionFingerprint {
  return createEvaluationProjectionFingerprintInternal(
    createHash("sha256")
      .update(JSON.stringify(canonical(value)), "utf8")
      .digest("hex"),
  );
}
