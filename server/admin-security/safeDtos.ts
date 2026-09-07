type UnknownRecord = Readonly<Record<string, any>>;

export function toAdminCompanySummary(user: UnknownRecord) {
  return Object.freeze({
    id: String(user.id),
    displayName: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
    email: typeof user.email === "string" ? user.email : null,
    companyName: typeof user.companyName === "string" ? user.companyName : null,
    accountRole: typeof user.role === "string" ? user.role : null,
    kybStatus: typeof user.kybStatus === "string" ? user.kybStatus : null,
    verificationLevel: typeof user.verificationLevel === "string" ? user.verificationLevel : null,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt ?? null,
  });
}

export function toAdminOfferSummary(offer: UnknownRecord) {
  return Object.freeze({
    id: String(offer.id),
    commodityId: offer.commodityId ?? null,
    sellerId: offer.sellerId ?? null,
    type: offer.type ?? null,
    quantity: offer.quantity ?? null,
    unit: offer.unit ?? null,
    price: offer.price ?? null,
    currency: offer.currency ?? null,
    status: offer.status ?? null,
    moderationStatus: offer.moderationStatus ?? null,
    createdAt: offer.createdAt instanceof Date ? offer.createdAt.toISOString() : offer.createdAt ?? null,
  });
}

export function toSecurityAuditSummary(event: UnknownRecord) {
  return Object.freeze({
    id: String(event.id),
    requestId: event.requestId ?? null,
    actorPrincipalId: event.actorPrincipalId ?? null,
    effectivePermission: event.effectivePermission ?? null,
    sessionAssurance: event.sessionAssurance ?? null,
    action: event.action ?? null,
    targetType: event.targetType ?? event.entityType ?? null,
    targetId: event.targetId ?? event.entityId ?? null,
    reason: event.reason ?? null,
    severity: event.severity ?? null,
    occurredAt: event.occurredAt ?? event.createdAt ?? null,
  });
}
