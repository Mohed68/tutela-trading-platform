export const PRIVILEGED_SESSION_ASSURANCE_VERSION =
  "privileged-session-assurance/v1" as const;

export const PRIVILEGED_SESSION_POLICY_VERSION =
  "privileged-session-policy/v1" as const;

export type PrivilegedSessionAssuranceLevel =
  | "authenticated"
  | "mfa"
  | "recent_step_up";

export interface PrivilegedSessionSecurityContext {
  readonly contractVersion: typeof PRIVILEGED_SESSION_ASSURANCE_VERSION;
  readonly authenticationAssurance: "authenticated";
  readonly authenticatedAt: string;
  readonly mfaSatisfiedAt: string | null;
  readonly stepUpSatisfiedAt: string | null;
}

export interface PrivilegedSessionPolicy {
  readonly policyVersion: typeof PRIVILEGED_SESSION_POLICY_VERSION;
  readonly recentStepUpWindowMs: number;
}

export interface SessionAssuranceClock {
  now(): Date;
}

export interface SessionAssuranceView {
  readonly contractVersion: typeof PRIVILEGED_SESSION_ASSURANCE_VERSION;
  readonly level: PrivilegedSessionAssuranceLevel;
  readonly authenticatedAt: string;
  readonly mfaSatisfiedAt: string | null;
  readonly stepUpSatisfiedAt: string | null;
}
