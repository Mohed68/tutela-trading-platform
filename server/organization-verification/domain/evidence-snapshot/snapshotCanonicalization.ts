import { createHash } from "node:crypto";
import type {
  EvidenceSnapshotFingerprint,
  EvidenceSnapshotSourceDigest,
} from "./ids.js";

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nested]) => nested !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalValue(nested)]),
    );
  }
  return value;
}

export function canonicalizeEvidenceSnapshotValueInternal(
  value: unknown,
): string {
  return JSON.stringify(canonicalValue(value));
}

function sha256(value: unknown): string {
  return createHash("sha256")
    .update(canonicalizeEvidenceSnapshotValueInternal(value), "utf8")
    .digest("hex");
}

export function computeEvidenceSnapshotSourceDigestInternal(
  value: unknown,
): EvidenceSnapshotSourceDigest {
  return sha256(value) as EvidenceSnapshotSourceDigest;
}

export function computeEvidenceSnapshotFingerprintInternal(
  value: unknown,
): EvidenceSnapshotFingerprint {
  return sha256(value) as EvidenceSnapshotFingerprint;
}
