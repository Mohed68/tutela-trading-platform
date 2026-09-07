import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { DEFAULT_MFA_SECURITY_POLICY } from "./contracts.js";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function encodeBase32(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function decodeBase32(input: string): Buffer {
  const normalized = input.toUpperCase().replace(/=+$/u, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error("TOTP_SECRET_INVALID");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

export function totpCounter(
  timestamp: Date,
  periodSeconds = DEFAULT_MFA_SECURITY_POLICY.totpPeriodSeconds,
): number {
  return Math.floor(timestamp.getTime() / 1_000 / periodSeconds);
}

export function generateTotpCode(secret: string, counter: number): string {
  if (!Number.isSafeInteger(counter) || counter < 0) {
    throw new Error("TOTP_COUNTER_INVALID");
  }
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret))
    .update(counterBuffer)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value =
    (((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff)) %
    1_000_000;
  return value.toString().padStart(6, "0");
}

export function verifyTotpCode(input: {
  readonly secret: string;
  readonly code: string;
  readonly now: Date;
  readonly lastAcceptedCounter: number | null;
  readonly acceptedClockSkewSteps?: number;
}): number | null {
  if (!/^\d{6}$/u.test(input.code)) return null;
  const current = totpCounter(input.now);
  const skew =
    input.acceptedClockSkewSteps ??
    DEFAULT_MFA_SECURITY_POLICY.acceptedClockSkewSteps;
  for (let offset = -skew; offset <= skew; offset += 1) {
    const counter = current + offset;
    if (counter < 0 || counter <= (input.lastAcceptedCounter ?? -1)) continue;
    const expected = Buffer.from(generateTotpCode(input.secret, counter));
    const supplied = Buffer.from(input.code);
    if (
      expected.length === supplied.length &&
      timingSafeEqual(expected, supplied)
    ) {
      return counter;
    }
  }
  return null;
}

export function createTotpProvisioningUri(
  secret: string,
  accountLabel: string,
): string {
  const label = encodeURIComponent(`TUTELA:${accountLabel}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=TUTELA&algorithm=SHA1&digits=6&period=30`;
}
