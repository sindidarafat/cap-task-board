import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, SESSION_COOKIE_NAME, signSessionToken } from "@/lib/auth";
import { appendActivity, getDb, sanitizeUser, saveDb } from "@/lib/db";

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const userRecord = db.users.find(
    (u) => u.id === currentUser.id || u.email.toLowerCase() === currentUser.email.toLowerCase()
  );

  if (!userRecord) {
    return NextResponse.json({ error: "User record not found" }, { status: 404 });
  }

  if (userRecord.role === "ADMIN" && userRecord.adminRequestStatus === "APPROVED") {
    return NextResponse.json({ error: "You are already an approved Admin." }, { status: 400 });
  }

  userRecord.adminRequestStatus = "PENDING";
  userRecord.requestedAt = new Date().toISOString();

  appendActivity(db, {
    actorName: userRecord.name,
    actorEmail: userRecord.email,
    action: "Requested Admin Access",
    details: `${userRecord.name} (${userRecord.teamRole}) requested Admin approval in the Admin Room.`,
    category: "ADMIN_ROOM",
  });

  await saveDb(db);

  const safeUser = sanitizeUser(userRecord);
  const token = signSessionToken(safeUser);
  const response = NextResponse.json({
    user: safeUser,
    token,
    message: "Your request for Admin access has been sent to the Admin Room for approval.",
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  return response;
}
