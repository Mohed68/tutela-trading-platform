export const LOCAL_AUTH_PROVIDER = "local" as const;
export const ACTIVE_CREDENTIAL_STATUS = "active" as const;
export const RECOVERY_PROVENANCE = "tutela-recovery-test" as const;

export interface AuthenticationIdentity {
  id: string;
  email: string | null;
  passwordHash: string | null;
  authProvider: string | null;
  lastLoginAt: Date | null;
  loginEnabled: boolean | null;
  credentialStatus: string | null;
  recoveryProvenance: string | null;
  role: string | null;
  emailVerifiedAt?: Date | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
}

export interface CurrentUserDto {
  id: string;
  displayName: string | null;
  role: "trader";
  authenticated: true;
  accountState: "active";
  organizationDisplayName: string | null;
  emailVerified: "verified" | "unknown";
  userVerified: "unknown";
  kybState: "unknown";
  organizationVerification: "unknown";
}
