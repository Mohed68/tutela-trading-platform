import type { SessionData } from "express-session";
import {
  PRIVILEGED_SESSION_ASSURANCE_VERSION,
  type PrivilegedSessionPolicy,
  type PrivilegedSessionSecurityContext,
  type SessionAssuranceClock,
  type SessionAssuranceView,
} from "./contracts.js";
import {
  DEFAULT_PRIVILEGED_SESSION_POLICY,
  isValidPrivilegedSessionPolicy,
} from "./policy.js";

export const systemSessionAssuranceClock: SessionAssuranceClock = Object.freeze({
  now: () => new Date(),
});

function exactTimestamp(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    return null;
  }
  return parsed;
}

function eventTimestamp(
  occurredAt: Date,
  clock: SessionAssuranceClock,
): string {
  const timestamp = occurredAt.getTime();
  const now = clock.now().getTime();
  if (!Number.isFinite(timestamp) || !Number.isFinite(now) || timestamp > now) {
    throw new Error("SESSION_ASSURANCE_EVENT_TIME_INVALID");
  }
  return occurredAt.toISOString();
}

function validatedContext(
  session: SessionData,
  clock: SessionAssuranceClock,
): PrivilegedSessionSecurityContext | null {
  const context = session.privilegedSecurityContext;
  if (
    !context ||
    context.contractVersion !== PRIVILEGED_SESSION_ASSURANCE_VERSION ||
    context.authenticationAssurance !== "authenticated"
  ) {
    return null;
  }

  const now = clock.now().getTime();
  const authenticatedAt = exactTimestamp(context.authenticatedAt);
  const mfaSatisfiedAt =
    context.mfaSatisfiedAt === null
      ? null
      : exactTimestamp(context.mfaSatisfiedAt);
  const stepUpSatisfiedAt =
    context.stepUpSatisfiedAt === null
      ? null
      : exactTimestamp(context.stepUpSatisfiedAt);

  if (
    !Number.isFinite(now) ||
    !authenticatedAt ||
    authenticatedAt.getTime() > now ||
    (context.mfaSatisfiedAt !== null && !mfaSatisfiedAt) ||
    (context.stepUpSatisfiedAt !== null && !stepUpSatisfiedAt) ||
    (mfaSatisfiedAt && mfaSatisfiedAt.getTime() < authenticatedAt.getTime()) ||
    (mfaSatisfiedAt && mfaSatisfiedAt.getTime() > now) ||
    (stepUpSatisfiedAt && !mfaSatisfiedAt) ||
    (stepUpSatisfiedAt &&
      mfaSatisfiedAt &&
      stepUpSatisfiedAt.getTime() < mfaSatisfiedAt.getTime()) ||
    (stepUpSatisfiedAt && stepUpSatisfiedAt.getTime() > now)
  ) {
    return null;
  }

  return context;
}

function replaceContext(
  session: SessionData,
  context: PrivilegedSessionSecurityContext,
): void {
  session.privilegedSecurityContext = context;
}

export function markAuthenticated(
  session: SessionData,
  occurredAt: Date = systemSessionAssuranceClock.now(),
  clock: SessionAssuranceClock = systemSessionAssuranceClock,
): void {
  replaceContext(session, {
    contractVersion: PRIVILEGED_SESSION_ASSURANCE_VERSION,
    authenticationAssurance: "authenticated",
    authenticatedAt: eventTimestamp(occurredAt, clock),
    mfaSatisfiedAt: null,
    stepUpSatisfiedAt: null,
  });
}

export function markMfaSatisfied(
  session: SessionData,
  occurredAt: Date,
  clock: SessionAssuranceClock = systemSessionAssuranceClock,
): void {
  const context = validatedContext(session, clock);
  if (!context) throw new Error("AUTHENTICATED_SESSION_ASSURANCE_REQUIRED");
  const timestamp = eventTimestamp(occurredAt, clock);
  if (timestamp < context.authenticatedAt) {
    throw new Error("SESSION_ASSURANCE_EVENT_ORDER_INVALID");
  }
  replaceContext(session, {
    ...context,
    mfaSatisfiedAt: timestamp,
    stepUpSatisfiedAt: null,
  });
}

export function markStepUpSatisfied(
  session: SessionData,
  occurredAt: Date,
  clock: SessionAssuranceClock = systemSessionAssuranceClock,
): void {
  const context = validatedContext(session, clock);
  if (!context?.mfaSatisfiedAt) {
    throw new Error("MFA_SESSION_ASSURANCE_REQUIRED");
  }
  const timestamp = eventTimestamp(occurredAt, clock);
  if (timestamp < context.mfaSatisfiedAt) {
    throw new Error("SESSION_ASSURANCE_EVENT_ORDER_INVALID");
  }
  replaceContext(session, { ...context, stepUpSatisfiedAt: timestamp });
}

export function clearPrivilegedAssurance(
  session: SessionData,
  clock: SessionAssuranceClock = systemSessionAssuranceClock,
): void {
  const context = validatedContext(session, clock);
  if (!context) {
    delete session.privilegedSecurityContext;
    return;
  }
  replaceContext(session, {
    ...context,
    mfaSatisfiedAt: null,
    stepUpSatisfiedAt: null,
  });
}

export function hasMfaAssurance(
  session: SessionData,
  clock: SessionAssuranceClock = systemSessionAssuranceClock,
): boolean {
  return Boolean(validatedContext(session, clock)?.mfaSatisfiedAt);
}

export function hasRecentStepUp(
  session: SessionData,
  policy: PrivilegedSessionPolicy = DEFAULT_PRIVILEGED_SESSION_POLICY,
  clock: SessionAssuranceClock = systemSessionAssuranceClock,
): boolean {
  if (!isValidPrivilegedSessionPolicy(policy)) return false;
  const context = validatedContext(session, clock);
  if (!context?.mfaSatisfiedAt || !context.stepUpSatisfiedAt) return false;
  const age = clock.now().getTime() - new Date(context.stepUpSatisfiedAt).getTime();
  return age >= 0 && age <= policy.recentStepUpWindowMs;
}

export function getSessionAssurance(
  session: SessionData,
  policy: PrivilegedSessionPolicy = DEFAULT_PRIVILEGED_SESSION_POLICY,
  clock: SessionAssuranceClock = systemSessionAssuranceClock,
): Readonly<SessionAssuranceView> | null {
  const context = validatedContext(session, clock);
  if (!context || !isValidPrivilegedSessionPolicy(policy)) return null;
  const level = hasRecentStepUp(session, policy, clock)
    ? "recent_step_up"
    : context.mfaSatisfiedAt
      ? "mfa"
      : "authenticated";
  return Object.freeze({
    contractVersion: context.contractVersion,
    level,
    authenticatedAt: context.authenticatedAt,
    mfaSatisfiedAt: context.mfaSatisfiedAt,
    stepUpSatisfiedAt: context.stepUpSatisfiedAt,
  });
}
