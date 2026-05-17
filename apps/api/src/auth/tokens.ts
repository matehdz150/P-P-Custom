import crypto from "crypto";

export const ACCESS_TTL_MS = 15 * 60 * 1000; // 15 min
export const REFRESH_TTL_DAYS = 7;

const SECRET =
  process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me";

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

// Access token sin estado (HMAC firmado): `${payload}.${sig}`
export function signAccessToken(userId: string): string {
  const exp = Date.now() + ACCESS_TTL_MS;
  const payload = b64url(Buffer.from(`${userId}.${exp}`));
  const sig = b64url(
    crypto.createHmac("sha256", SECRET).update(payload).digest(),
  );
  return `${payload}.${sig}`;
}

export function verifyAccessToken(token?: string): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = b64url(
    crypto.createHmac("sha256", SECRET).update(payload).digest(),
  );
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const decoded = Buffer.from(
    payload.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  ).toString();
  const [userId, expStr] = decoded.split(".");
  const exp = Number(expStr);
  if (!userId || !Number.isFinite(exp) || Date.now() > exp) return null;

  return userId;
}

export function newRefreshToken(): { token: string; hash: string } {
  const token = crypto.randomUUID() + crypto.randomBytes(16).toString("hex");
  return { token, hash: sha256(token) };
}
