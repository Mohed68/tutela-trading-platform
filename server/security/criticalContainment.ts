import type { Express, Response } from "express";
import type { Contract, Offer, PartnerRelation, User } from "@shared/schema";

const retired = (_res: Response) =>
  _res.status(404).json({ message: "Not found." });

export function registerRetiredLegacyAuthorityRoutes(app: Express): void {
  app.get("/api/verification/pending", (_req, res) => retired(res));
  app.patch("/api/verification/:id/status", (_req, res) => retired(res));
  app.post("/api/commodities", (_req, res) => retired(res));
  app.get("/api/offers/:id", (_req, res) => retired(res));
  app.post("/api/offers/:offerId/verify", (_req, res) => retired(res));
}

export function canResolvePartnerRequest(
  relation: Pick<PartnerRelation, "partnerId" | "status">,
  actorUserId: string,
  nextStatus: unknown,
): nextStatus is "approved" | "rejected" {
  return (
    relation.partnerId === actorUserId &&
    relation.status === "pending" &&
    (nextStatus === "approved" || nextStatus === "rejected")
  );
}

export function canCloseOwnedOffer(
  offer: Pick<Offer, "userId">,
  actorUserId: string,
  nextStatus: unknown,
): nextStatus is "closed" | "cancelled" {
  return (
    offer.userId === actorUserId &&
    (nextStatus === "closed" || nextStatus === "cancelled")
  );
}

export function toSafeUserSummary(user: User) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
    companyName: user.companyName,
    financialRating: user.financialRating,
    creditRating: user.creditRating,
    verified: user.verified,
  };
}

export function toSafeOfferResponse<T extends Offer & { user?: User }>(offer: T) {
  return {
    ...offer,
    ...(offer.user ? { user: toSafeUserSummary(offer.user) } : {}),
  };
}

export function toSafeContractResponse<
  T extends Contract & { buyer: User; seller: User },
>(contract: T) {
  return {
    ...contract,
    buyer: toSafeUserSummary(contract.buyer),
    seller: toSafeUserSummary(contract.seller),
  };
}

export function toSafePartnerResponse<
  T extends PartnerRelation & { requester: User; partner: User },
>(relation: T) {
  return {
    ...relation,
    requester: toSafeUserSummary(relation.requester),
    partner: toSafeUserSummary(relation.partner),
  };
}

