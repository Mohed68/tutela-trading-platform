import * as Sentry from "@sentry/react";
import React from "react";

// Initialize Sentry for client-side monitoring
export function initializeClientMonitoring() {
  // Check if already initialized
  if ((window as any).__SENTRY_INITIALIZED__) {
    return;
  }

  if (!import.meta.env.VITE_SENTRY_DSN) {
    console.warn("VITE_SENTRY_DSN not configured - monitoring disabled");
    return;
  }

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE || "development",
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: import.meta.env.MODE === "production" ? 0.1 : 1.0,
    beforeSend(event, hint) {
      // Filter out common non-critical errors
      if (event.exception) {
        const error = hint.originalException;
        if (error instanceof Error) {
          // Skip network errors that are expected
          if (error.message.includes("NetworkError") || 
              error.message.includes("Failed to fetch")) {
            return null;
          }
        }
      }
      return event;
    },
  });

  console.log("✓ Sentry client monitoring initialized");
}

// Business event tracking for client-side
export const ClientEvents = {
  // Page Navigation
  pageView: (pageName: string, userId?: string) => {
    Sentry.addBreadcrumb({
      category: "navigation",
      message: `Page viewed: ${pageName}`,
      level: "info",
      data: { pageName, userId },
    });
    
    Sentry.setTag("page", pageName);
  },

  // User Interactions
  buttonClick: (buttonName: string, location: string, userId?: string) => {
    Sentry.addBreadcrumb({
      category: "ui",
      message: "Button clicked",
      level: "info",
      data: { buttonName, location, userId },
    });
  },

  formSubmission: (formName: string, success: boolean, errors?: string[]) => {
    Sentry.addBreadcrumb({
      category: "ui",
      message: `Form ${success ? 'submitted' : 'failed'}`,
      level: success ? "info" : "warning",
      data: { formName, success, errors },
    });
    
    if (!success && errors?.length) {
      Sentry.captureMessage(`Form submission failed: ${formName}`, "warning");
    }
  },

  searchPerformed: (query: string, resultsCount: number, category?: string) => {
    Sentry.addBreadcrumb({
      category: "search",
      message: "Search performed",
      level: "info",
      data: { query: query.length > 50 ? query.substring(0, 50) + "..." : query, resultsCount, category },
    });
  },

  // Trading Actions
  offerViewed: (offerId: string, commodity: string, price: number) => {
    Sentry.addBreadcrumb({
      category: "trading",
      message: "Offer viewed",
      level: "info",
      data: { offerId, commodity, price },
    });
  },

  contractInitiated: (offerId: string, commodity: string) => {
    Sentry.addBreadcrumb({
      category: "trading",
      message: "Contract initiated",
      level: "info",
      data: { offerId, commodity },
    });
    
    Sentry.captureMessage(`Contract Initiated: ${commodity}`, "info");
  },

  // KYB Actions
  kybStepCompleted: (step: string, documentType?: string) => {
    Sentry.addBreadcrumb({
      category: "kyb",
      message: "KYB step completed",
      level: "info",
      data: { step, documentType },
    });
  },

  documentUploadStarted: (documentType: string, fileSize: number) => {
    Sentry.addBreadcrumb({
      category: "upload",
      message: "Document upload started",
      level: "info",
      data: { documentType, fileSize },
    });
  },

  documentUploadCompleted: (documentType: string, duration: number) => {
    Sentry.addBreadcrumb({
      category: "upload",
      message: "Document upload completed",
      level: "info",
      data: { documentType, duration },
    });
  },

  documentUploadFailed: (documentType: string, error: string) => {
    Sentry.addBreadcrumb({
      category: "upload",
      message: "Document upload failed",
      level: "error",
      data: { documentType, error },
    });
    
    Sentry.captureException(new Error(`Document upload failed: ${error}`));
  },

  // Payment Actions
  checkoutStarted: (plan: string, billingCycle: string, amount: number) => {
    Sentry.addBreadcrumb({
      category: "payment",
      message: "Checkout started",
      level: "info",
      data: { plan, billingCycle, amount },
    });
  },

  paymentSuccess: (plan: string, amount: number, sessionId: string) => {
    Sentry.addBreadcrumb({
      category: "payment",
      message: "Payment successful",
      level: "info",
      data: { plan, amount, sessionId },
    });
    
    Sentry.captureMessage(`Payment Success: ${plan} - $${amount}`, "info");
  },

  paymentFailed: (error: string, plan?: string) => {
    Sentry.addBreadcrumb({
      category: "payment",
      message: "Payment failed",
      level: "error",
      data: { error, plan },
    });
    
    Sentry.captureException(new Error(`Payment failed: ${error}`));
  },

  // Performance Issues
  slowAPICall: (endpoint: string, duration: number) => {
    if (duration > 3000) { // Log API calls over 3 seconds
      Sentry.addBreadcrumb({
        category: "performance",
        message: "Slow API call",
        level: "warning",
        data: { endpoint, duration },
      });
      
      Sentry.captureMessage(`Slow API Call: ${endpoint} (${duration}ms)`, "warning");
    }
  },

  // Error Handling
  apiError: (endpoint: string, status: number, error: string) => {
    Sentry.addBreadcrumb({
      category: "api",
      message: "API error",
      level: "error",
      data: { endpoint, status, error },
    });
    
    if (status >= 500) {
      Sentry.captureException(new Error(`API Error ${status}: ${endpoint} - ${error}`));
    }
  },

  validationError: (field: string, error: string, formName?: string) => {
    Sentry.addBreadcrumb({
      category: "validation",
      message: "Validation error",
      level: "info",
      data: { field, error, formName },
    });
  },
};

// Performance monitoring utilities for client
export const ClientPerformance = {
  measureAPICall: async <T>(
    endpoint: string,
    apiCall: () => Promise<T>
  ): Promise<T> => {
    const startTime = Date.now();
    
    try {
      const result = await apiCall();
      const duration = Date.now() - startTime;
      
      ClientEvents.slowAPICall(endpoint, duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      ClientEvents.apiError(endpoint, 0, error instanceof Error ? error.message : String(error));
      throw error;
    }
  },

  trackPageLoad: (pageName: string) => {
    Sentry.startSpan({
      name: `Page Load: ${pageName}`,
      op: "navigation",
    }, () => {});
  },
};

// User context management
export const UserContext = {
  setUser: (userId: string, email?: string, plan?: string) => {
    Sentry.setUser({
      id: userId,
      email,
    });
    
    if (plan) {
      Sentry.setTag("user_plan", plan);
    }
  },

  clearUser: () => {
    Sentry.setUser(null);
  },

  setUserProperty: (key: string, value: string) => {
    Sentry.setTag(`user_${key}`, value);
  },
};