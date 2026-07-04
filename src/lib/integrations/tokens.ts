import crypto from "node:crypto";

/**
 * Symmetric encryption for OAuth tokens at rest (AES-256-GCM).
 *
 * Set INTEGRATION_TOKEN_ENC_KEY to a 32-byte secret (hex, base64, or raw).
 * If it is unset we fall back to a clearly-marked plaintext form so local dev
 * works — never rely on that in production.
 */
const ALGO = "aes-256-gcm";

function getKey(): Buffer | null {
  const raw = process.env.INTEGRATION_TOKEN_ENC_KEY;
  if (!raw) return null;
  // Accept hex (64 chars), base64, or a raw ≥32-char string.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  const b64 = Buffer.from(raw, "base64");
  if (b64.length === 32) return b64;
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptToken(plain: string | null | undefined): string | null {
  if (!plain) return null;
  const key = getKey();
  if (!key) return `plain:${plain}`;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptToken(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (stored.startsWith("plain:")) return stored.slice(6);
  if (!stored.startsWith("v1:")) return stored;
  const key = getKey();
  if (!key) return null;
  const [, ivB64, tagB64, dataB64] = stored.split(":");
  const decipher = crypto.createDecipheriv(
    ALGO,
    key,
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}
