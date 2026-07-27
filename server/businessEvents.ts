// Business Events Tracking for Sentry
import * as Sentry from "@sentry/node";

export interface BusinessEvent {
  event: string;
  userId?: string;
  data?: Record<string, any>;
}

/**
 * Track business events in Sentry for analytics and monitoring
 */
export function trackBusinessEvent(event: BusinessEvent) {
  // Add breadcrumb for event tracking
  Sentry.addBreadcrumb({
    category: "biz",
    message: event.event,
    level: "info",
    data: event.data
  });

  // Set context for the event
  if (event.data) {
    Sentry.setContext(event.event.toLowerCase(), event.data);
  }

  // Capture as informational message
  Sentry.captureMessage(event.event, "info");
}

/**
 * Track offer creation event
 */
export function trackOfferCreated(offerId: string, commodity: string, unit: string, qty: number, userId?: string) {
  trackBusinessEvent({
    event: "OfferCreated",
    userId,
    data: { offerId, commodity, unit, qty }
  });
}

/**
 * Track offer match event
 */
export function trackOfferMatch(offerId: string, buyerId: string, sellerId: string, matchValue: number) {
  trackBusinessEvent({
    event: "OfferMatched",
    data: { offerId, buyerId, sellerId, matchValue }
  });
}

/**
 * Track escrow initialization
 */
export function trackEscrowInit(escrowId: string, amount: number, currency: string, offerId?: string) {
  trackBusinessEvent({
    event: "EscrowInitialized",
    data: { escrowId, amount, currency, offerId }
  });
}

/**
 * Track document upload
 */
export function trackDocumentUpload(documentId: string, type: string, userId?: string, offerId?: string) {
  trackBusinessEvent({
    event: "DocumentUploaded",
    userId,
    data: { documentId, type, offerId }
  });
}

/**
 * Track settlement completion
 */
export function trackSettlement(settlementId: string, amount: number, currency: string, offerId?: string) {
  trackBusinessEvent({
    event: "SettlementCompleted",
    data: { settlementId, amount, currency, offerId }
  });
}