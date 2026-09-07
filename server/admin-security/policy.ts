import type { PlatformPermission, SessionAssurance } from "../platform-authority/index.js";

export const ADMIN_ACTION_ASSURANCE: Readonly<Record<PlatformPermission, SessionAssurance>> = Object.freeze({
  "platform.roles.view": "authenticated",
  "platform.roles.grant": "recent_step_up",
  "platform.roles.revoke": "recent_step_up",
  "verification.queue.view": "authenticated",
  "verification.evidence.view": "mfa",
  "verification.review.submit": "recent_step_up",
  "offers.moderate": "mfa",
  "commodity.catalog.manage": "recent_step_up",
  "users.support.view": "authenticated",
  "users.support.remediate": "recent_step_up",
  "security.audit.view": "mfa",
});

const assuranceRank: Readonly<Record<SessionAssurance, number>> = Object.freeze({
  authenticated: 1,
  mfa: 2,
  recent_step_up: 3,
});

export function satisfiesAdminActionAssurance(permission: PlatformPermission, actual: SessionAssurance): boolean {
  return assuranceRank[actual] >= assuranceRank[ADMIN_ACTION_ASSURANCE[permission]];
}
