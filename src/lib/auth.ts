import crypto from "crypto";
import { NextRequest } from "next/server";
import { getDb, sanitizeUser } from "./db";
import { SafeUserAccount } from "./types";

export const SESSION_COOKIE_NAME = "cap_session_token";
const SECRET = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "cap-task-board-secret-key-2026-vercel";

export function signSessionToken(user: SafeUserAccount): string {
  const payload = Buffer.from(JSON.stringify(user), "utf-8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): SafeUserAccount | null {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expectedSig = crypto
    .createHmac("sha256", SECRET)
    .update(payload)
    .digest("base64url");

  if (sig !== expectedSig) return null;

  try {
    const json = Buffer.from(payload, "base64url").toString("utf-8");
    return JSON.parse(json) as SafeUserAccount;
  } catch {
    return null;
  }
}

export async function getCurrentUser(request: NextRequest): Promise<SafeUserAccount | null> {
  const cookieToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const headerToken = request.headers.get("x-cap-token");
  const token = cookieToken || headerToken;
  const tokenUser = verifySessionToken(token);
  if (!tokenUser) return null;

  const db = await getDb();
  const dbUser = db.users.find(
    (u) =>
      u.id === tokenUser.id ||
      u.email.toLowerCase() === tokenUser.email.toLowerCase()
  );

  if (dbUser) {
    return sanitizeUser(dbUser);
  }

  // If serverless instance cold-started after a custom user registered, preserve their session
  return tokenUser;
}

export function isApprovedAdmin(user: SafeUserAccount | null): boolean {
  return Boolean(
    user &&
      user.role === "ADMIN" &&
      user.adminRequestStatus === "APPROVED"
  );
}
