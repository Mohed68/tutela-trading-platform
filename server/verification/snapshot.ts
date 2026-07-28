import crypto from "node:crypto";
import type { SubmittedOfferVerificationSnapshot } from "../../shared/verification.js";

export function canonicalVerificationSnapshot(
  snapshot: SubmittedOfferVerificationSnapshot,
): string {
  return JSON.stringify({
    snapshotSchemaVersion: snapshot.snapshotSchemaVersion,
    offerId: snapshot.offerId,
    submissionRevision: snapshot.submissionRevision,
    submittedRecordVersion: snapshot.submittedRecordVersion,
    offerType: snapshot.offerType,
    commodity: {
      id: snapshot.commodity.id,
      name: snapshot.commodity.name,
      category: snapshot.commodity.category,
    },
    quantity: snapshot.quantity,
    unit: snapshot.unit,
    amountPerUnit: snapshot.amountPerUnit,
    currency: snapshot.currency,
    location: snapshot.location,
    validUntil: snapshot.validUntil,
    lifecycleStatus: snapshot.lifecycleStatus,
  });
}

export function fingerprintVerificationSnapshot(
  snapshot: SubmittedOfferVerificationSnapshot,
): string {
  return crypto
    .createHash("sha256")
    .update(canonicalVerificationSnapshot(snapshot))
    .digest("hex");
}
