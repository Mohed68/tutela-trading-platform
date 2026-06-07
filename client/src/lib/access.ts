export type AccessStatus =
  | "guest"
  | "registered"
  | "pending"
  | "verified"
  | "rejected"
  | "suspended";

export type VerificationWorkflowState =
  | "registered"
  | "profile_completed"
  | "documents_completed"
  | "signatory_completed"
  | "ai_validated"
  | "pending_review"
  | "verified"
  | "rejected";

export const VERIFICATION_WORKFLOW_STORAGE_KEY = "tutelaVerificationWorkflowState";

export const VERIFICATION_WORKFLOW_STEPS = [
  { key: "profile", label: "Company Profile", completeAfter: "profile_completed" },
  { key: "documents", label: "Documents", completeAfter: "documents_completed" },
  { key: "signatory", label: "Signatory", completeAfter: "signatory_completed" },
  { key: "ai", label: "AI Validation", completeAfter: "ai_validated" },
  { key: "review", label: "Review Pending", completeAfter: "pending_review" },
] as const;

const workflowOrder: VerificationWorkflowState[] = [
  "registered",
  "profile_completed",
  "documents_completed",
  "signatory_completed",
  "ai_validated",
  "pending_review",
  "verified",
];

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

export function getStoredVerificationWorkflowState(): VerificationWorkflowState {
  if (typeof window === "undefined") {
    return "registered";
  }

  const stored = window.localStorage.getItem(VERIFICATION_WORKFLOW_STORAGE_KEY);
  return isVerificationWorkflowState(stored) ? stored : "registered";
}

export function setStoredVerificationWorkflowState(state: VerificationWorkflowState) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(VERIFICATION_WORKFLOW_STORAGE_KEY, state);
  }
}

export function isWorkflowStepComplete(
  currentState: VerificationWorkflowState,
  completeAfter: VerificationWorkflowState,
) {
  if (currentState === "rejected") {
    return false;
  }

  return workflowOrder.indexOf(currentState) >= workflowOrder.indexOf(completeAfter);
}

function isVerificationWorkflowState(value: unknown): value is VerificationWorkflowState {
  return (
    value === "registered" ||
    value === "profile_completed" ||
    value === "documents_completed" ||
    value === "signatory_completed" ||
    value === "ai_validated" ||
    value === "pending_review" ||
    value === "verified" ||
    value === "rejected"
  );
}
