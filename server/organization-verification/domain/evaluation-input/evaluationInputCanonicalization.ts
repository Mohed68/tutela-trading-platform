import { createHash } from "node:crypto";
import {
  createPolicyEvaluationInputFingerprintInternal,
  type OrganizationVerificationPolicyEvaluationInputFingerprint,
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

export function canonicalizePolicyEvaluationInputInternal(
  value: unknown,
): string {
  return JSON.stringify(canonical(value));
}

export function computePolicyEvaluationInputFingerprintInternal(
  value: unknown,
): OrganizationVerificationPolicyEvaluationInputFingerprint {
  return createPolicyEvaluationInputFingerprintInternal(
    createHash("sha256")
      .update(canonicalizePolicyEvaluationInputInternal(value), "utf8")
      .digest("hex"),
  );
}
