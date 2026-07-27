import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const VERSION = "scrypt-v1";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return [VERSION, salt.toString("base64"), derivedKey.toString("base64")].join("$");
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [version, saltEncoded, hashEncoded] = storedHash.split("$");
  if (version !== VERSION || !saltEncoded || !hashEncoded) return false;
  try {
    const salt = Buffer.from(saltEncoded, "base64");
    const expected = Buffer.from(hashEncoded, "base64");
    const actual = (await scrypt(password, salt, expected.length)) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
