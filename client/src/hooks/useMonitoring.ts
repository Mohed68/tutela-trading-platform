import { useEffect } from "react";
import { useLocation } from "wouter";
import { ClientEvents, UserContext, ClientPerformance } from "@/lib/monitoring";
import { useAuth } from "./useAuth";
import type { User } from "@shared/schema";

export function useMonitoring() {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth() as { user: User | null; isAuthenticated: boolean };

  // Track page views
  useEffect(() => {
    if (location) {
      const pageName = location === "/" ? "Dashboard" : location.replace("/", "").replace("-", " ").replace(/\b\w/g, l => l.toUpperCase());
      ClientEvents.pageView(pageName, user?.id);
      ClientPerformance.trackPageLoad(pageName);
    }
  }, [location, user?.id]);

  // Set user context when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      UserContext.setUser(user.id, user.email || undefined, user.currentPlan || undefined);
    } else {
      UserContext.clearUser();
    }
  }, [isAuthenticated, user]);

  const trackButtonClick = (buttonName: string, location: string) => {
    ClientEvents.buttonClick(buttonName, location, user?.id);
  };

  const trackFormSubmission = (formName: string, success: boolean, errors?: string[]) => {
    ClientEvents.formSubmission(formName, success, errors);
  };

  const trackSearch = (query: string, resultsCount: number, category?: string) => {
    ClientEvents.searchPerformed(query, resultsCount, category);
  };

  const trackOfferView = (offerId: string, commodity: string, price: number) => {
    ClientEvents.offerViewed(offerId, commodity, price);
  };

  const trackContractInitiation = (offerId: string, commodity: string) => {
    ClientEvents.contractInitiated(offerId, commodity);
  };

  const trackKybStep = (step: string, documentType?: string) => {
    ClientEvents.kybStepCompleted(step, documentType);
  };

  const trackDocumentUpload = {
    started: (documentType: string, fileSize: number) => {
      ClientEvents.documentUploadStarted(documentType, fileSize);
    },
    completed: (documentType: string, duration: number) => {
      ClientEvents.documentUploadCompleted(documentType, duration);
    },
    failed: (documentType: string, error: string) => {
      ClientEvents.documentUploadFailed(documentType, error);
    }
  };

  const trackPayment = {
    checkoutStarted: (plan: string, billingCycle: string, amount: number) => {
      ClientEvents.checkoutStarted(plan, billingCycle, amount);
    },
    success: (plan: string, amount: number, sessionId: string) => {
      ClientEvents.paymentSuccess(plan, amount, sessionId);
    },
    failed: (error: string, plan?: string) => {
      ClientEvents.paymentFailed(error, plan);
    }
  };

  const trackError = {
    api: (endpoint: string, status: number, error: string) => {
      ClientEvents.apiError(endpoint, status, error);
    },
    validation: (field: string, error: string, formName?: string) => {
      ClientEvents.validationError(field, error, formName);
    }
  };

  return {
    trackButtonClick,
    trackFormSubmission,
    trackSearch,
    trackOfferView,
    trackContractInitiation,
    trackKybStep,
    trackDocumentUpload,
    trackPayment,
    trackError
  };
}
