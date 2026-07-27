import * as Sentry from "@sentry/node";
import type { Express } from "express";

// Initialize Sentry for server-side monitoring
export function initializeServerMonitoring() {
  const sentryDsn = process.env.SENTRY_BACKEND_DSN || process.env.SENTRY_DSN;
  
  if (!sentryDsn) {
    console.warn("SENTRY_BACKEND_DSN not configured - server monitoring disabled");
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
    beforeSend(event, hint) {
      // Filter out common non-critical errors
      if (event.exception) {
        const error = hint.originalException;
        if (error instanceof Error) {
          // Skip 401 unauthorized errors (normal auth flow)
          if (error.message.includes("Unauthorized") || error.message.includes("401")) {
            return null;
          }
        }
      }
      return event;
    },
  });

  console.log(`✓ Sentry server monitoring initialized (${process.env.SENTRY_BACKEND_DSN ? 'backend DSN' : 'fallback DSN'})`);
}

// Setup Express middleware for request tracking
export function setupSentryMiddleware(app: Express) {
  const sentryDsn = process.env.SENTRY_BACKEND_DSN || process.env.SENTRY_DSN;
  if (!sentryDsn) return;

  // Sentry request handler middleware
  app.use((req, res, next) => {
    Sentry.setTag("method", req.method);
    Sentry.setTag("url", req.url);
    next();
  });
}

// Setup error handler (must be after all routes)
export function setupSentryErrorHandler(app: Express) {
  const sentryDsn = process.env.SENTRY_BACKEND_DSN || process.env.SENTRY_DSN;
  if (!sentryDsn) return;

  app.use((error: any, req: any, res: any, next: any) => {
    // Only handle 500+ errors, skip auth errors
    if (error.status === undefined || error.status >= 500) {
      Sentry.captureException(error);
    }
    next(error);
  });
}

// Business event tracking functions
export const BusinessEvents = {
  // User Events
  userRegistered: (userId: string, metadata?: Record<string, any>) => {
    Sentry.addBreadcrumb({
      category: "user",
      message: "User registered",
      level: "info",
      data: { userId, ...metadata },
    });
    
    Sentry.setTag("event_type", "user_registration");
    Sentry.captureMessage("User Registration", "info");
  },

  userLoggedIn: (userId: string, method: string = "replit_auth") => {
    Sentry.addBreadcrumb({
      category: "auth",
      message: "User logged in",
      level: "info",
      data: { userId, method },
    });
    
    Sentry.setUser({ id: userId });
    Sentry.setTag("auth_method", method);
  },

  // KYB Events
  kybDocumentUploaded: (userId: string, documentType: string, fileName: string) => {
    Sentry.addBreadcrumb({
      category: "kyb",
      message: "KYB document uploaded",
      level: "info",
      data: { userId, documentType, fileName },
    });
    
    Sentry.setTag("event_type", "kyb_upload");
    Sentry.captureMessage(`KYB Document Uploaded: ${documentType}`, "info");
  },

  kybStatusChanged: (userId: string, oldStatus: string, newStatus: string) => {
    Sentry.addBreadcrumb({
      category: "kyb",
      message: "KYB status changed",
      level: "info",
      data: { userId, oldStatus, newStatus },
    });
    
    Sentry.setTag("kyb_status", newStatus);
    Sentry.captureMessage(`KYB Status Changed: ${oldStatus} → ${newStatus}`, "info");
  },

  // Trading Events
  offerCreated: (userId: string, offerId: string, commodity: string, value: number) => {
    Sentry.addBreadcrumb({
      category: "trading",
      message: "Offer created",
      level: "info",
      data: { userId, offerId, commodity, value },
    });
    
    Sentry.setTag("event_type", "offer_created");
    Sentry.setContext("offer", { id: offerId, commodity, value });
    Sentry.captureMessage(`Offer Created: ${commodity} - $${value}`, "info");
  },

  offerVerificationSubmitted: (userId: string, offerId: string, documentCount: number) => {
    Sentry.addBreadcrumb({
      category: "trading",
      message: "Offer verification submitted",
      level: "info",
      data: { userId, offerId, documentCount },
    });

    Sentry.setTag("event_type", "offer_verification_submitted");
    Sentry.setContext("offer_verification", { offerId, documentCount });
    Sentry.captureMessage("Offer Verification Submitted", "info");
  },

  contractSigned: (contractId: string, buyerId: string, sellerId: string, value: number) => {
    Sentry.addBreadcrumb({
      category: "trading",
      message: "Contract signed",
      level: "info",
      data: { contractId, buyerId, sellerId, value },
    });
    
    Sentry.setTag("event_type", "contract_signed");
    Sentry.setContext("contract", { id: contractId, value });
    Sentry.captureMessage(`Contract Signed: $${value}`, "info");
  },

  paymentProcessed: (orderId: string, amount: number, currency: string, method: string) => {
    Sentry.addBreadcrumb({
      category: "payment",
      message: "Payment processed",
      level: "info",
      data: { orderId, amount, currency, method },
    });
    
    Sentry.setTag("event_type", "payment_processed");
    Sentry.setContext("payment", { orderId, amount, currency, method });
    Sentry.captureMessage(`Payment Processed: ${currency} ${amount}`, "info");
  },

  // Plan Events
  planUpgraded: (userId: string, oldPlan: string, newPlan: string, billingCycle: string) => {
    Sentry.addBreadcrumb({
      category: "subscription",
      message: "Plan upgraded",
      level: "info",
      data: { userId, oldPlan, newPlan, billingCycle },
    });
    
    Sentry.setTag("event_type", "plan_upgrade");
    Sentry.setTag("subscription_plan", newPlan);
    Sentry.captureMessage(`Plan Upgraded: ${oldPlan} → ${newPlan}`, "info");
  },

  // Error Events
  aiValidationFailed: (documentId: string, error: string) => {
    Sentry.addBreadcrumb({
      category: "ai",
      message: "AI validation failed",
      level: "error",
      data: { documentId, error },
    });
    
    Sentry.setTag("event_type", "ai_validation_error");
    Sentry.captureException(new Error(`AI Validation Failed: ${error}`));
  },

  blockchainError: (contractId: string, error: string) => {
    Sentry.addBreadcrumb({
      category: "blockchain",
      message: "Blockchain operation failed",
      level: "error",
      data: { contractId, error },
    });
    
    Sentry.setTag("event_type", "blockchain_error");
    Sentry.captureException(new Error(`Blockchain Error: ${error}`));
  },

  // Performance Events
  slowQuery: (query: string, duration: number, userId?: string) => {
    Sentry.addBreadcrumb({
      category: "performance",
      message: "Slow database query",
      level: "warning",
      data: { query, duration, userId },
    });
    
    if (duration > 5000) { // Log queries over 5 seconds
      Sentry.captureMessage(`Slow Query: ${query} (${duration}ms)`, "warning");
    }
  },

  // Security Events
  suspiciousActivity: (userId: string, activity: string, metadata?: Record<string, any>) => {
    Sentry.addBreadcrumb({
      category: "security",
      message: "Suspicious activity detected",
      level: "warning",
      data: { userId, activity, ...metadata },
    });
    
    Sentry.setTag("event_type", "security_alert");
    Sentry.captureMessage(`Suspicious Activity: ${activity}`, "warning");
  },
};

// Performance monitoring utilities
export const Performance = {
  startTransaction: (name: string, operation: string) => {
    return Sentry.startSpan({ name, op: operation }, (span) => span);
  },

  measureDatabaseQuery: async <T>(
    queryName: string,
    queryFn: () => Promise<T>,
    userId?: string
  ): Promise<T> => {
    const startTime = Date.now();
    const span = Sentry.startSpan({ name: queryName, op: "db.query" }, () => {
      return queryFn();
    });

    try {
      const result = await span;
      const duration = Date.now() - startTime;
      
      // Log slow queries
      if (duration > 1000) {
        BusinessEvents.slowQuery(queryName, duration, userId);
      }
      
      return result;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  },

  measureAPICall: async <T>(
    apiName: string,
    apiFn: () => Promise<T>
  ): Promise<T> => {
    return Sentry.startSpan({ name: apiName, op: "http.client" }, () => {
      return apiFn();
    });
  },
};
