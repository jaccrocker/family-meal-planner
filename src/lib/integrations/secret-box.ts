import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * AES 256 GCM for refresh tokens at rest. The key comes from
 * INTEGRATIONS_ENCRYPTION_KEY; without it, nothing is stored.
 */
function key(): Buffer {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) throw new Error("INTEGRATIONS_ENCRYPTION_KEY is not set");
  return createHash("sha256").update(raw).digest();
}

/**
 * Encrypts text with a random IV and returns "iv.tag.ciphertext", each part base64url.
 * @throws Error when INTEGRATIONS_ENCRYPTION_KEY is missing or shorter than 32 characters.
 */
export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

/**
 * Decrypts a value produced by seal.
 * @throws Error when the key is missing or the value was altered or sealed with another key.
 */
export function open(sealed: string): string {
  const [iv, tag, body] = sealed.split(".").map((s) => Buffer.from(s, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}
