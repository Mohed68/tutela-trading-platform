import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { AuthenticationIdentity } from "@shared/auth";
import { hashPassword } from "./password.js";
import type { IStorage } from "./storage.js";

const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export const registrationSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[a-z]/, "Password must include a lowercase letter.")
    .regex(/[A-Z]/, "Password must include an uppercase letter.")
    .regex(/[0-9]/, "Password must include a number."),
});

export const emailVerificationSchema = z.object({
  token: z.string().min(32).max(512),
});

export interface VerificationEmailSender {
  send(input: {
    recipient: string;
    verificationUrl: string;
  }): Promise<void>;
}

export interface RegistrationResult {
  accepted: true;
}

export function digestEmailVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildEmailVerificationUrl(
  applicationBaseUrl: string,
  token: string,
): string {
  const url = new URL("/verify-email", applicationBaseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function registerLocalAccount(
  input: z.infer<typeof registrationSchema>,
  dependencies: {
    storage: Pick<
      IStorage,
      | "createPendingLocalRegistration"
      | "discardPendingLocalRegistrationAttempt"
    >;
    sender: VerificationEmailSender;
    applicationBaseUrl: string;
    now?: Date;
  },
): Promise<RegistrationResult> {
  const parsed = registrationSchema.parse(input);
  const rawToken = randomBytes(32).toString("base64url");
  const now = dependencies.now ?? new Date();
  const tokenDigest = digestEmailVerificationToken(rawToken);
  const created = await dependencies.storage.createPendingLocalRegistration({
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    email: parsed.email,
    passwordHash: await hashPassword(parsed.password),
    tokenDigest,
    tokenExpiresAt: new Date(now.getTime() + EMAIL_TOKEN_TTL_MS),
  });

  // Existing accounts receive the same response without revealing membership.
  if (!created) return { accepted: true };

  try {
    await dependencies.sender.send({
      recipient: created.email,
      verificationUrl: buildEmailVerificationUrl(
        dependencies.applicationBaseUrl,
        rawToken,
      ),
    });
  } catch (error) {
    await dependencies.storage.discardPendingLocalRegistrationAttempt({
      userId: created.id,
      tokenDigest,
      removeAccount: created.createdNew,
    });
    throw error;
  }

  return { accepted: true };
}

export async function registerTemporaryDirectLocalAccount(
  input: z.infer<typeof registrationSchema>,
  dependencies: {
    storage: Pick<IStorage, "createTemporaryDirectLocalRegistration">;
  },
): Promise<RegistrationResult> {
  const parsed = registrationSchema.parse(input);
  await dependencies.storage.createTemporaryDirectLocalRegistration({
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    email: parsed.email,
    passwordHash: await hashPassword(parsed.password),
  });
  // Deliberately do not reveal whether the email was already registered.
  return { accepted: true };
}

export async function activateLocalAccount(
  token: string,
  dependencies: {
    storage: Pick<IStorage, "activateLocalRegistration">;
    now?: Date;
  },
): Promise<AuthenticationIdentity | undefined> {
  const parsed = emailVerificationSchema.parse({ token });
  return dependencies.storage.activateLocalRegistration(
    digestEmailVerificationToken(parsed.token),
    dependencies.now ?? new Date(),
  );
}
