export type RegistrationActivationMode =
  | "email_verification"
  | "temporary_direct";

const TEMPORARY_DIRECT_VALUE = "temporary_direct";

/**
 * Email verification stays the default. The temporary direct mode must be
 * explicitly enabled by deployment configuration and can be removed later
 * without any database rewrite.
 */
export function getRegistrationActivationMode(
  environment: NodeJS.ProcessEnv = process.env,
): RegistrationActivationMode {
  return environment.TUTELA_REGISTRATION_ACTIVATION === TEMPORARY_DIRECT_VALUE
    ? "temporary_direct"
    : "email_verification";
}
