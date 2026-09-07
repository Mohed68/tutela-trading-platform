import assert from "node:assert/strict";
import test from "node:test";
import {
  MFA_ENCRYPTION_KEY_VERSION,
  createTotpProvisioningUri,
  decryptMfaSecret,
  encodeBase32,
  encryptMfaSecret,
  generateRecoveryCodes,
  generateTotpCode,
  hashRecoveryCode,
  requireMfaEncryptionKey,
  verifyRecoveryCodeHash,
  verifyTotpCode,
} from "./index.js";

const TEST_KEY = Buffer.from("11".repeat(32), "hex");

test("TOTP matches the RFC 6238 SHA-1 vector reduced to six digits", () => {
  const secret = encodeBase32(Buffer.from("12345678901234567890", "ascii"));
  assert.equal(generateTotpCode(secret, 1), "287082");
  assert.equal(
    verifyTotpCode({
      secret,
      code: "287082",
      now: new Date(59_000),
      lastAcceptedCounter: null,
      acceptedClockSkewSteps: 0,
    }),
    1,
  );
});

test("TOTP clock skew is narrow and an accepted counter cannot replay", () => {
  const secret = encodeBase32(Buffer.from("12345678901234567890", "ascii"));
  const now = new Date(90_000);
  const previous = generateTotpCode(secret, 2);
  assert.equal(
    verifyTotpCode({ secret, code: previous, now, lastAcceptedCounter: null }),
    2,
  );
  assert.equal(
    verifyTotpCode({ secret, code: previous, now, lastAcceptedCounter: 2 }),
    null,
  );
  assert.equal(
    verifyTotpCode({
      secret,
      code: generateTotpCode(secret, 1),
      now,
      lastAcceptedCounter: null,
    }),
    null,
  );
});

test("AES-256-GCM encryption authenticates credential and user binding", () => {
  const encrypted = encryptMfaSecret(
    "JBSWY3DPEHPK3PXP",
    TEST_KEY,
    "credential-1",
    "user-1",
  );
  assert.equal(encrypted.keyVersion, MFA_ENCRYPTION_KEY_VERSION);
  assert.equal(encrypted.iv.length, 12);
  assert.equal(encrypted.authTag.length, 16);
  assert.equal(
    encrypted.ciphertext.includes(Buffer.from("JBSWY3DPEHPK3PXP")),
    false,
  );
  assert.equal(
    decryptMfaSecret(encrypted, TEST_KEY, "credential-1", "user-1"),
    "JBSWY3DPEHPK3PXP",
  );
  assert.throws(
    () => decryptMfaSecret(encrypted, TEST_KEY, "credential-1", "user-2"),
    /MFA_SECRET_DECRYPTION_FAILED/,
  );
});

test("MFA encryption key is dedicated, explicit, and exactly 32-byte hex", () => {
  assert.throws(
    () => requireMfaEncryptionKey({ SESSION_SECRET: "not-authority" }),
    /MFA_ENCRYPTION_KEY_REQUIRED/,
  );
  assert.throws(
    () => requireMfaEncryptionKey({ MFA_ENCRYPTION_KEY: "short" }),
    /MFA_ENCRYPTION_KEY_INVALID/,
  );
  assert.deepEqual(
    requireMfaEncryptionKey({ MFA_ENCRYPTION_KEY: "ab".repeat(32) }),
    Buffer.from("ab".repeat(32), "hex"),
  );
});

test("recovery codes are strong, distinct, normalized, and stored as hashes", async () => {
  const codes = generateRecoveryCodes(10);
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const code of codes) assert.match(code, /^[A-F0-9]{5}(?:-[A-F0-9]{5}){3}$/u);
  const hashed = await hashRecoveryCode(codes[0]);
  assert.equal(hashed.salt.length, 16);
  assert.equal(hashed.digest.length, 32);
  assert.equal(hashed.digest.includes(Buffer.from(codes[0])), false);
  assert.equal(
    await verifyRecoveryCodeHash(codes[0].toLowerCase(), hashed.salt, hashed.digest),
    true,
  );
  assert.equal(
    await verifyRecoveryCodeHash(codes[1], hashed.salt, hashed.digest),
    false,
  );
});

test("provisioning DTO uses the TOTP standard without exposing another authority", () => {
  const uri = createTotpProvisioningUri("JBSWY3DPEHPK3PXP", "user@example.invalid");
  assert.match(uri, /^otpauth:\/\/totp\//u);
  assert.match(uri, /issuer=TUTELA/u);
  assert.match(uri, /algorithm=SHA1&digits=6&period=30$/u);
});
