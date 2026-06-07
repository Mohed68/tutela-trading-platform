export type AccessStatus =
  | "guest"
  | "registered"
  | "pending"
  | "verified"
  | "rejected"
  | "suspended";

export function canViewMarketplace(status: AccessStatus) {
  return ["guest", "registered", "pending", "verified", "rejected", "suspended"].includes(status);
}

export function canViewPrices(status: AccessStatus) {
  return status === "verified";
}

export function canViewDocuments(status: AccessStatus) {
  return status === "verified";
}

export function canNegotiate(status: AccessStatus) {
  return status === "verified";
}
