import assert from "node:assert/strict";
import test from "node:test";

import {
  createPlatformAuthorityService,
  createPlatformRoleAdministrationPolicy,
  hasPlatformPermission,
  PLATFORM_PERMISSIONS,
  PLATFORM_ROLE_PERMISSION_MATRIX,
  PLATFORM_ROLES,
  resolvePlatformAuthority,
  type PlatformAuthorityAuditRecord,
  type PlatformAuthorityMutationPort,
  type PlatformAuthorityReadPort,
  type PlatformOwnershipGovernancePolicy,
  type PlatformPrincipalRecord,
  type PlatformRole,
  type PlatformRoleAssignmentRecord,
  type SessionAssurance,
} from "./index.js";

const NOW = "2026-09-01T12:00:00.000Z";

class AuthorityStore
  implements PlatformAuthorityReadPort, PlatformAuthorityMutationPort
{
  readonly principals = new Map<string, PlatformPrincipalRecord>();
  readonly assignments = new Map<string, PlatformRoleAssignmentRecord>();
  readonly audits: PlatformAuthorityAuditRecord[] = [];
  failCommit = false;

  addPrincipal(principalId: string, userId: string) {
    this.principals.set(principalId, {
      principalId,
      userId,
      status: "active",
      createdAt: NOW,
    });
  }

  addAssignment(input: {
    assignmentId: string;
    principalId: string;
    role: string;
    status?: "active" | "revoked";
  }) {
    const revoked = input.status === "revoked";
    this.assignments.set(input.assignmentId, {
      assignmentId: input.assignmentId,
      principalId: input.principalId,
      role: input.role,
      status: input.status ?? "active",
      grantedByPrincipalId: "principal-admin",
      grantedAt: NOW,
      grantReason: "Approved operational need",
      revokedByPrincipalId: revoked ? "principal-admin" : null,
      revokedAt: revoked ? NOW : null,
      revocationReason: revoked ? "Access no longer required" : null,
    });
  }

  async findPrincipalByUserId(userId: string) {
    return [...this.principals.values()].find(
      (principal) => principal.userId === userId,
    );
  }

  async findPrincipalById(principalId: string) {
    return this.principals.get(principalId);
  }

  async listRoleAssignments(principalId: string) {
    return [...this.assignments.values()].filter(
      (assignment) => assignment.principalId === principalId,
    );
  }

  async findRoleAssignmentById(assignmentId: string) {
    return this.assignments.get(assignmentId);
  }

  async commitRoleGrant(input: {
    assignment: PlatformRoleAssignmentRecord;
    audit: PlatformAuthorityAuditRecord;
  }) {
    if (this.failCommit) throw new Error("AUDIT_OR_AUTHORITY_COMMIT_FAILED");
    this.assignments.set(input.assignment.assignmentId, input.assignment);
    this.audits.push(input.audit);
  }

  async commitRoleRevocation(input: {
    before: PlatformRoleAssignmentRecord;
    after: PlatformRoleAssignmentRecord;
    audit: PlatformAuthorityAuditRecord;
  }) {
    if (this.failCommit) throw new Error("AUDIT_OR_AUTHORITY_COMMIT_FAILED");
    assert.equal(this.assignments.get(input.before.assignmentId), input.before);
    this.assignments.set(input.after.assignmentId, input.after);
    this.audits.push(input.audit);
  }
}

function ownershipPolicy(authorized = false): PlatformOwnershipGovernancePolicy {
  return Object.freeze({
    async authorizePlatformAdminRoleMutation() {
      return authorized;
    },
  });
}

function authorityService(store: AuthorityStore, ownerAuthorized = false) {
  return createPlatformAuthorityService({
    read: store,
    mutations: store,
    roleAdministrationPolicy: createPlatformRoleAdministrationPolicy({
      platformOwnership: ownershipPolicy(ownerAuthorized),
    }),
  });
}

function commandContext(
  targetRole: PlatformRole,
  sessionAssurance: SessionAssurance = "authenticated",
) {
  return {
    requestId: `request-${targetRole}`,
    correlationId: `correlation-${targetRole}`,
    sessionAssurance,
    authorizationScope: {
      resource: "platform_role_assignment" as const,
      targetPrincipalId: "principal-target",
      targetRole,
    },
  };
}

function grantCommand(
  role = "SUPPORT",
  sessionAssurance: SessionAssurance = "authenticated",
) {
  return {
    actorUserId: "user-admin",
    targetPrincipalId: "principal-target",
    role,
    reason: "Approved support responsibility",
    assignmentId: `assignment-${role}`,
    auditEventId: `audit-${role}`,
    context: commandContext(role as PlatformRole, sessionAssurance),
    occurredAt: NOW,
  };
}

test("ordinary authenticated users have no Platform Principal or permission", async () => {
  const store = new AuthorityStore();
  const authority = await resolvePlatformAuthority("ordinary-user", store);

  assert.equal(authority.state, "no_platform_principal");
  assert.equal(authority.principalId, null);
  assert.deepEqual(authority.permissions, []);
  assert.equal(hasPlatformPermission(authority, "offers.moderate"), false);
});

test("organization and client role claims cannot create Platform authority", async () => {
  const store = new AuthorityStore();
  const clientClaims = Object.freeze({
    organizationRole: "owner",
    localStorageRole: "admin",
    requestedPermission: "platform.roles.grant",
  });
  const authority = await resolvePlatformAuthority("organization-owner", store);

  assert.equal(clientClaims.organizationRole, "owner");
  assert.equal(authority.state, "no_platform_principal");
  assert.deepEqual(authority.permissions, []);
});

test("active assignments deterministically supply only their role permissions", async () => {
  const store = new AuthorityStore();
  store.addPrincipal("principal-reviewer", "user-reviewer");
  store.addAssignment({
    assignmentId: "assignment-reviewer",
    principalId: "principal-reviewer",
    role: "VERIFICATION_REVIEWER",
  });

  const authority = await resolvePlatformAuthority("user-reviewer", store);
  assert.equal(authority.state, "resolved");
  assert.deepEqual(
    authority.permissions,
    [...PLATFORM_ROLE_PERMISSION_MATRIX.VERIFICATION_REVIEWER].sort(),
  );
  assert.equal(
    hasPlatformPermission(authority, "verification.evidence.view"),
    true,
  );
  assert.equal(hasPlatformPermission(authority, "platform.roles.grant"), false);
});

test("revoked assignments and inactive principals authorize nothing", async () => {
  const store = new AuthorityStore();
  store.addPrincipal("principal-ops", "user-ops");
  store.addAssignment({
    assignmentId: "assignment-ops",
    principalId: "principal-ops",
    role: "OPERATIONS",
    status: "revoked",
  });
  const revoked = await resolvePlatformAuthority("user-ops", store);
  assert.deepEqual(revoked.permissions, []);

  store.principals.set("principal-ops", {
    principalId: "principal-ops",
    userId: "user-ops",
    status: "inactive",
    createdAt: NOW,
  });
  const inactive = await resolvePlatformAuthority("user-ops", store);
  assert.deepEqual(inactive.permissions, []);
});

test("unsupported or malformed persisted roles fail the whole resolution closed", async () => {
  const store = new AuthorityStore();
  store.addPrincipal("principal-bad", "user-bad");
  store.addAssignment({
    assignmentId: "assignment-bad",
    principalId: "principal-bad",
    role: "SUPERUSER",
  });

  const authority = await resolvePlatformAuthority("user-bad", store);
  assert.equal(authority.state, "invalid_authority_state");
  assert.deepEqual(authority.permissions, []);
});

test("least-privilege role boundaries remain independent", async () => {
  assert.equal(
    PLATFORM_ROLE_PERMISSION_MATRIX.SUPPORT.includes("offers.moderate"),
    false,
  );
  assert.equal(
    PLATFORM_ROLE_PERMISSION_MATRIX.OPERATIONS.includes(
      "verification.evidence.view",
    ),
    false,
  );
  assert.equal(
    PLATFORM_ROLE_PERMISSION_MATRIX.VERIFICATION_REVIEWER.includes(
      "platform.roles.grant",
    ),
    false,
  );
  assert.deepEqual(PLATFORM_ROLE_PERMISSION_MATRIX.PLATFORM_ADMIN, [
    "platform.roles.view",
    "platform.roles.grant",
    "platform.roles.revoke",
    "security.audit.view",
  ]);
});

test("legacy user fields alone never enter the new resolver", async () => {
  const store = new AuthorityStore();
  const legacyUser = Object.freeze({
    id: "legacy-user",
    adminRole: "admin",
    is2FAEnabled: true,
  });

  const authority = await resolvePlatformAuthority(legacyUser.id, store);
  assert.equal(authority.state, "no_platform_principal");
  assert.deepEqual(authority.permissions, []);
});

test("role grants require an authorized actor and atomically bind audit evidence", async () => {
  const store = new AuthorityStore();
  store.addPrincipal("principal-admin", "user-admin");
  store.addAssignment({
    assignmentId: "assignment-admin",
    principalId: "principal-admin",
    role: "PLATFORM_ADMIN",
  });
  store.addPrincipal("principal-target", "user-target");
  const service = authorityService(store);

  const result = await service.grantRole(grantCommand());
  assert.equal(result.status, "completed");
  assert.equal(store.audits.length, 1);
  assert.equal(store.audits[0]?.action, "platform_role_granted");
  assert.equal(store.audits[0]?.actorPrincipalId, "principal-admin");
  assert.equal(store.audits[0]?.targetPrincipalId, "principal-target");
  assert.equal(store.audits[0]?.effectivePermission, "platform.roles.grant");
  assert.equal(store.audits[0]?.sessionAssurance, "authenticated");
  assert.equal(store.audits[0]?.securitySeverity, "high");
});

test("unauthorized actors and invalid roles are denied without mutation", async () => {
  const store = new AuthorityStore();
  store.addPrincipal("principal-support", "user-support");
  store.addAssignment({
    assignmentId: "assignment-support",
    principalId: "principal-support",
    role: "SUPPORT",
  });
  store.addPrincipal("principal-target", "user-target");
  const service = authorityService(store);

  const denied = await service.grantRole({
    ...grantCommand(),
    actorUserId: "user-support",
  });
  const invalid = await service.grantRole(grantCommand("ROOT"));
  assert.equal(denied.status, "denied");
  assert.equal(invalid.status, "invalid_request");
  assert.equal(store.audits.length, 0);
});

test("duplicate identities and malformed target authority fail closed", async () => {
  const store = new AuthorityStore();
  store.addPrincipal("principal-admin", "user-admin");
  store.addAssignment({
    assignmentId: "assignment-admin",
    principalId: "principal-admin",
    role: "PLATFORM_ADMIN",
  });
  store.addPrincipal("principal-target", "user-target");
  store.addAssignment({
    assignmentId: "assignment-SUPPORT",
    principalId: "principal-target",
    role: "UNSUPPORTED_ROLE",
  });
  const service = authorityService(store);

  const malformed = await service.grantRole(grantCommand());
  assert.equal(malformed.status, "conflict");
  assert.equal(store.audits.length, 0);
});

test("audit or persistence failure cannot leave a partial role mutation", async () => {
  const store = new AuthorityStore();
  store.addPrincipal("principal-admin", "user-admin");
  store.addAssignment({
    assignmentId: "assignment-admin",
    principalId: "principal-admin",
    role: "PLATFORM_ADMIN",
  });
  store.addPrincipal("principal-target", "user-target");
  store.failCommit = true;
  const service = authorityService(store);

  const result = await service.grantRole(grantCommand());
  assert.deepEqual(result, {
    status: "failed",
    code: "authority_commit_failed",
  });
  assert.equal(store.assignments.has("assignment-SUPPORT"), false);
  assert.equal(store.audits.length, 0);
});

test("revocation removes authority through the audited mutation boundary", async () => {
  const store = new AuthorityStore();
  store.addPrincipal("principal-admin", "user-admin");
  store.addAssignment({
    assignmentId: "assignment-admin",
    principalId: "principal-admin",
    role: "PLATFORM_ADMIN",
  });
  store.addPrincipal("principal-target", "user-target");
  store.addAssignment({
    assignmentId: "assignment-target",
    principalId: "principal-target",
    role: "OPERATIONS",
  });
  const service = authorityService(store);

  const result = await service.revokeRole({
    actorUserId: "user-admin",
    targetPrincipalId: "principal-target",
    assignmentId: "assignment-target",
    reason: "Operational access ended",
    auditEventId: "audit-revoke",
    context: commandContext("OPERATIONS"),
    occurredAt: NOW,
  });
  assert.equal(result.status, "completed");
  const authority = await service.resolvePrincipal("user-target");
  assert.deepEqual(authority.permissions, []);
  assert.equal(store.audits[0]?.action, "platform_role_revoked");
});

test("PLATFORM_ADMIN cannot grant PLATFORM_ADMIN without Platform Owner authority", async () => {
  const store = new AuthorityStore();
  store.addPrincipal("principal-admin", "user-admin");
  store.addAssignment({
    assignmentId: "assignment-admin",
    principalId: "principal-admin",
    role: "PLATFORM_ADMIN",
  });
  store.addPrincipal("principal-target", "user-target");

  const result = await authorityService(store).grantRole(
    grantCommand("PLATFORM_ADMIN", "recent_step_up"),
  );
  assert.deepEqual(result, {
    status: "denied",
    code: "platform_owner_authority_required",
  });
  assert.equal(store.assignments.has("assignment-PLATFORM_ADMIN"), false);
});

test("PLATFORM_ADMIN cannot revoke PLATFORM_ADMIN without Platform Owner authority", async () => {
  const store = new AuthorityStore();
  store.addPrincipal("principal-admin", "user-admin");
  store.addAssignment({
    assignmentId: "assignment-admin",
    principalId: "principal-admin",
    role: "PLATFORM_ADMIN",
  });
  store.addPrincipal("principal-target", "user-target");
  store.addAssignment({
    assignmentId: "assignment-target-admin",
    principalId: "principal-target",
    role: "PLATFORM_ADMIN",
  });

  const result = await authorityService(store).revokeRole({
    actorUserId: "user-admin",
    targetPrincipalId: "principal-target",
    assignmentId: "assignment-target-admin",
    reason: "Owner-governed role removal",
    auditEventId: "audit-owner-revoke",
    context: commandContext("PLATFORM_ADMIN", "recent_step_up"),
    occurredAt: NOW,
  });
  assert.deepEqual(result, {
    status: "denied",
    code: "platform_owner_authority_required",
  });
  assert.equal(store.assignments.get("assignment-target-admin")?.status, "active");
});

test("owner-sensitive policy fails closed when ownership authority is unavailable", async () => {
  const store = new AuthorityStore();
  store.addPrincipal("principal-admin", "user-admin");
  store.addAssignment({
    assignmentId: "assignment-admin",
    principalId: "principal-admin",
    role: "PLATFORM_ADMIN",
  });
  const actorAuthority = await resolvePlatformAuthority("user-admin", store);
  const policy = createPlatformRoleAdministrationPolicy({
    platformOwnership: ownershipPolicy(false),
  });

  const decision = await policy.authorizeRoleAdministration({
    actorAuthority,
    operation: "grant",
    targetPrincipalId: "principal-target",
    targetRole: "PLATFORM_ADMIN",
    context: commandContext("PLATFORM_ADMIN", "recent_step_up"),
  });
  assert.deepEqual(decision, {
    authorized: false,
    code: "platform_owner_authority_required",
  });
});

test("sensitive role mutation fails closed without recent step-up assurance", async () => {
  const store = new AuthorityStore();
  store.addPrincipal("principal-admin", "user-admin");
  store.addAssignment({
    assignmentId: "assignment-admin",
    principalId: "principal-admin",
    role: "PLATFORM_ADMIN",
  });
  store.addPrincipal("principal-target", "user-target");

  const result = await authorityService(store, true).grantRole(
    grantCommand("PLATFORM_ADMIN", "mfa"),
  );
  assert.deepEqual(result, {
    status: "denied",
    code: "recent_step_up_required",
  });
});

test("forged authority-resolution objects are rejected", () => {
  const forged = Object.freeze({
    contractVersion: "platform-authority/v1",
    state: "resolved",
    authenticatedUserId: "user-admin",
    principalId: "principal-admin",
    activeRoles: Object.freeze(["PLATFORM_ADMIN"]),
    permissions: Object.freeze(["platform.roles.grant"]),
  });
  assert.equal(hasPlatformPermission(forged, "platform.roles.grant"), false);
});

test("blank and mismatched Platform Principals fail closed", async () => {
  const store = new AuthorityStore();
  const blank = await resolvePlatformAuthority("", store);
  assert.equal(blank.state, "invalid_authority_state");
  assert.deepEqual(blank.permissions, []);

  const mismatchedRead: PlatformAuthorityReadPort = {
    async findPrincipalByUserId() {
      return {
        principalId: "principal-mismatch",
        userId: "different-user",
        status: "active",
        createdAt: NOW,
      };
    },
    async findPrincipalById() {
      return undefined;
    },
    async listRoleAssignments() {
      return [];
    },
    async findRoleAssignmentById() {
      return undefined;
    },
  };
  const mismatched = await resolvePlatformAuthority("expected-user", mismatchedRead);
  assert.equal(mismatched.state, "invalid_authority_state");
  assert.deepEqual(mismatched.permissions, []);
});

test("foreign Role Assignments fail the whole resolution closed", async () => {
  const store = new AuthorityStore();
  store.addPrincipal("principal-user", "user-with-foreign-assignment");
  const read: PlatformAuthorityReadPort = {
    findPrincipalByUserId: (userId) => store.findPrincipalByUserId(userId),
    findPrincipalById: (principalId) => store.findPrincipalById(principalId),
    async listRoleAssignments() {
      return [
        {
          assignmentId: "foreign-assignment",
          principalId: "different-principal",
          role: "SUPPORT",
          status: "active",
          grantedByPrincipalId: "principal-admin",
          grantedAt: NOW,
          grantReason: "Invalid foreign assignment",
          revokedByPrincipalId: null,
          revokedAt: null,
          revocationReason: null,
        },
      ];
    },
    findRoleAssignmentById: (assignmentId) =>
      store.findRoleAssignmentById(assignmentId),
  };
  const authority = await resolvePlatformAuthority(
    "user-with-foreign-assignment",
    read,
  );
  assert.equal(authority.state, "invalid_authority_state");
  assert.deepEqual(authority.permissions, []);
});

test("unauthorized revocation is denied without mutation", async () => {
  const store = new AuthorityStore();
  store.addPrincipal("principal-support", "user-support");
  store.addAssignment({
    assignmentId: "assignment-support",
    principalId: "principal-support",
    role: "SUPPORT",
  });
  store.addPrincipal("principal-target", "user-target");
  store.addAssignment({
    assignmentId: "assignment-target",
    principalId: "principal-target",
    role: "OPERATIONS",
  });

  const result = await authorityService(store).revokeRole({
    actorUserId: "user-support",
    targetPrincipalId: "principal-target",
    assignmentId: "assignment-target",
    reason: "Unauthorized attempt",
    auditEventId: "audit-unauthorized-revoke",
    context: commandContext("OPERATIONS"),
    occurredAt: NOW,
  });
  assert.deepEqual(result, {
    status: "denied",
    code: "platform_role_revocation_denied",
  });
  assert.equal(store.assignments.get("assignment-target")?.status, "active");
  assert.equal(store.audits.length, 0);
});

test("revocation atomic commit failure returns authority_commit_failed", async () => {
  const store = new AuthorityStore();
  store.addPrincipal("principal-admin", "user-admin");
  store.addAssignment({
    assignmentId: "assignment-admin",
    principalId: "principal-admin",
    role: "PLATFORM_ADMIN",
  });
  store.addPrincipal("principal-target", "user-target");
  store.addAssignment({
    assignmentId: "assignment-target",
    principalId: "principal-target",
    role: "OPERATIONS",
  });
  store.failCommit = true;

  const result = await authorityService(store).revokeRole({
    actorUserId: "user-admin",
    targetPrincipalId: "principal-target",
    assignmentId: "assignment-target",
    reason: "Operational access ended",
    auditEventId: "audit-failed-revoke",
    context: commandContext("OPERATIONS"),
    occurredAt: NOW,
  });
  assert.deepEqual(result, {
    status: "failed",
    code: "authority_commit_failed",
  });
  assert.equal(store.assignments.get("assignment-target")?.status, "active");
  assert.equal(store.audits.length, 0);
});

test("Platform Authority cannot manufacture canonical verification or eligibility truth", async () => {
  const canonicalTruthTerms =
    /(?:organization.*verification.*decision|trust|activity.*eligibility|participation.*eligibility|publication.*eligibility|offer.*verified)/i;
  assert.equal(PLATFORM_ROLES.some((role) => canonicalTruthTerms.test(role)), false);
  assert.equal(
    PLATFORM_PERMISSIONS.some((permission) => canonicalTruthTerms.test(permission)),
    false,
  );

  const store = new AuthorityStore();
  const service = authorityService(store);
  assert.deepEqual(Object.keys(service).sort(), [
    "grantRole",
    "listEffectivePermissions",
    "resolvePrincipal",
    "revokeRole",
  ]);
});
