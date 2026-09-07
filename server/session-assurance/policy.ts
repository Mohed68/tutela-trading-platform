import {
  PRIVILEGED_SESSION_POLICY_VERSION,
  type PrivilegedSessionPolicy,
} from "./contracts.js";

export const DEFAULT_RECENT_STEP_UP_WINDOW_MS = 5 * 60 * 1_000;

export const DEFAULT_PRIVILEGED_SESSION_POLICY: PrivilegedSessionPolicy =
  Object.freeze({
    policyVersion: PRIVILEGED_SESSION_POLICY_VERSION,
    recentStepUpWindowMs: DEFAULT_RECENT_STEP_UP_WINDOW_MS,
  });

export function isValidPrivilegedSessionPolicy(
  policy: PrivilegedSessionPolicy,
): boolean {
  return (
    policy.policyVersion === PRIVILEGED_SESSION_POLICY_VERSION &&
    Number.isSafeInteger(policy.recentStepUpWindowMs) &&
    policy.recentStepUpWindowMs > 0
  );
}
