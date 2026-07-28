import {
  domainFailure,
  domainSuccess,
  type CoreDomainResult,
} from "./errors.js";

export const ATTEMPT_PROCESS_STATES = [
  "not_started",
  "queued",
  "running",
  "completed",
] as const;

export type AttemptProcessState = (typeof ATTEMPT_PROCESS_STATES)[number];

const ALLOWED_TRANSITIONS: Readonly<
  Record<AttemptProcessState, readonly AttemptProcessState[]>
> = Object.freeze({
  not_started: Object.freeze(["queued"] as const),
  queued: Object.freeze(["running"] as const),
  running: Object.freeze(["queued", "completed"] as const),
  completed: Object.freeze([] as const),
});

export function validateAttemptProcessTransition(
  current: AttemptProcessState,
  next: AttemptProcessState,
): CoreDomainResult<AttemptProcessState> {
  if (current === "completed") {
    return domainFailure("attempt_already_completed");
  }
  return ALLOWED_TRANSITIONS[current].includes(next)
    ? domainSuccess(next)
    : domainFailure("invalid_process_transition");
}
