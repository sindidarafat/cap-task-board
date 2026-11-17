import crypto from "crypto";
import { NextRequest } from "next/server";
import { getDb, sanitizeUser, saveDb, syncClientUsersToDb } from "./db";
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
  let cookieToken: string | undefined = undefined;
  try {
    cookieToken = request.cookies?.get(SESSION_COOKIE_NAME)?.value;
  } catch {
    // ignore cookie parse error
  }

  if (!cookieToken) {
    const rawCookie = request.headers.get("cookie");
    if (rawCookie) {
      const match = rawCookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]*)`));
      if (match) cookieToken = decodeURIComponent(match[1]);
    }
  }

  const headerToken = request.headers.get("x-cap-token");
  const token = cookieToken || headerToken;
  const tokenUser = verifySessionToken(token);
  if (!tokenUser) return null;

  const db = await getDb();

  // Ensure any client-cached users in request headers are synced
  const clientUsersHeader = request.headers.get("x-cap-client-users");
  if (clientUsersHeader) {
    try {
      const clientUsers = JSON.parse(clientUsersHeader);
      if (Array.isArray(clientUsers)) {
        if (syncClientUsersToDb(db, clientUsers)) {
          await saveDb(db);
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  const dbUser = db.users.find(
    (u) =>
      u.id === tokenUser.id ||
      u.email.toLowerCase() === tokenUser.email.toLowerCase()
  );

  if (dbUser) {
    // If the cryptographically verified session token has approved admin status,
    // ensure dbUser reflects it so serverless cold starts never demote approved admins
    if (tokenUser.role === "ADMIN" && tokenUser.adminRequestStatus === "APPROVED") {
      if (dbUser.role !== "ADMIN" || dbUser.adminRequestStatus !== "APPROVED") {
        dbUser.role = "ADMIN";
        dbUser.adminRequestStatus = "APPROVED";
        await saveDb(db);
      }
    }
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
