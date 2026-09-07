export const MFA_CREDENTIAL_CONTRACT_VERSION = "mfa-credential/v1" as const;
export const MFA_ENCRYPTION_KEY_VERSION = "mfa-encryption/v1" as const;

export type MfaCredentialStatus =
  | "pending_enrollment"
  | "active"
  | "revoked";

export interface MfaSecurityPolicy {
  readonly totpPeriodSeconds: 30;
  readonly totpDigits: 6;
  readonly acceptedClockSkewSteps: 1;
  readonly maximumFailedAttempts: 5;
  readonly temporaryLockMs: number;
  readonly recoveryCodeCount: 10;
}

export const DEFAULT_MFA_SECURITY_POLICY: Readonly<MfaSecurityPolicy> =
  Object.freeze({
    totpPeriodSeconds: 30,
    totpDigits: 6,
    acceptedClockSkewSteps: 1,
    maximumFailedAttempts: 5,
    temporaryLockMs: 5 * 60 * 1_000,
    recoveryCodeCount: 10,
  });

export interface MfaEnrollmentDto {
  readonly credentialId: string;
  readonly status: "pending_enrollment";
  readonly factorType: "totp";
  readonly secret: string;
  readonly otpauthUri: string;
}

export interface MfaEnrollmentConfirmationDto {
  readonly credentialId: string;
  readonly status: "active";
  readonly recoveryCodes: readonly string[];
}

export interface MfaStatusDto {
  readonly enrolled: boolean;
  readonly status: MfaCredentialStatus | "not_enrolled";
  readonly factorType: "totp" | null;
}

export type MfaChallengeResult =
  | Readonly<{ status: "satisfied"; method: "totp" | "recovery_code" }>
  | Readonly<{ status: "invalid" }>
  | Readonly<{ status: "locked"; retryAfterSeconds: number }>;

export interface EncryptedMfaSecret {
  readonly ciphertext: Buffer;
  readonly iv: Buffer;
  readonly authTag: Buffer;
  readonly keyVersion: typeof MFA_ENCRYPTION_KEY_VERSION;
}

export interface RecoveryCodeDigest {
  readonly plaintext: string;
  readonly salt: Buffer;
  readonly digest: Buffer;
}
