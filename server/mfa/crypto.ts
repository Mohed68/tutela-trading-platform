import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import {
  MFA_ENCRYPTION_KEY_VERSION,
  type EncryptedMfaSecret,
  type RecoveryCodeDigest,
} from "./contracts.js";

const scrypt = promisify(scryptCallback);

export function requireMfaEncryptionKey(
  environment: NodeJS.ProcessEnv = process.env,
): Buffer {
  const encoded = environment.MFA_ENCRYPTION_KEY?.trim();
  if (!encoded) throw new Error("MFA_ENCRYPTION_KEY_REQUIRED");
  if (!/^[0-9a-f]{64}$/iu.test(encoded)) {
    throw new Error("MFA_ENCRYPTION_KEY_INVALID");
  }
  return Buffer.from(encoded, "hex");
}

function associatedData(credentialId: string, userId: string): Buffer {
  return Buffer.from(
    `${MFA_ENCRYPTION_KEY_VERSION}:${credentialId}:${userId}`,
    "utf8",
  );
}

export function encryptMfaSecret(
  plaintext: string,
  key: Buffer,
  credentialId: string,
  userId: string,
): EncryptedMfaSecret {
  if (key.length !== 32) throw new Error("MFA_ENCRYPTION_KEY_INVALID");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(associatedData(credentialId, userId));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return Object.freeze({
    ciphertext,
    iv,
    authTag: cipher.getAuthTag(),
    keyVersion: MFA_ENCRYPTION_KEY_VERSION,
  });
}

export function decryptMfaSecret(
  encrypted: EncryptedMfaSecret,
  key: Buffer,
  credentialId: string,
  userId: string,
): string {
  if (
    key.length !== 32 ||
    encrypted.keyVersion !== MFA_ENCRYPTION_KEY_VERSION
  ) {
    throw new Error("MFA_ENCRYPTION_CONFIGURATION_INVALID");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, encrypted.iv);
    decipher.setAAD(associatedData(credentialId, userId));
    decipher.setAuthTag(encrypted.authTag);
    return Buffer.concat([
      decipher.update(encrypted.ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("MFA_SECRET_DECRYPTION_FAILED");
  }
}

function normalizeRecoveryCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/gu, "");
}

export function generateRecoveryCodes(count: number): readonly string[] {
  return Object.freeze(
    Array.from({ length: count }, () => {
      const value = randomBytes(10).toString("hex").toUpperCase();
      return `${value.slice(0, 5)}-${value.slice(5, 10)}-${value.slice(10, 15)}-${value.slice(15, 20)}`;
    }),
  );
}

export async function hashRecoveryCode(
  plaintext: string,
): Promise<RecoveryCodeDigest> {
  const normalized = normalizeRecoveryCode(plaintext);
  const salt = randomBytes(16);
  const digest = (await scrypt(normalized, salt, 32)) as Buffer;
  return Object.freeze({ plaintext, salt, digest });
}

export async function verifyRecoveryCodeHash(
  plaintext: string,
  salt: Buffer,
  expected: Buffer,
): Promise<boolean> {
  if (salt.length !== 16 || expected.length !== 32) return false;
  const actual = (await scrypt(normalizeRecoveryCode(plaintext), salt, 32)) as Buffer;
  return timingSafeEqual(actual, expected);
}
