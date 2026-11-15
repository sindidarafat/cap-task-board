import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { appendActivity, getDb, sanitizeUser, saveDb } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME, signSessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    const body = await request.json();
    const newPassword = (body.newPassword || "").trim();
    const targetUserId = body.userId || currentUser?.id;
    const targetEmail = (body.email || currentUser?.email || "").trim().toLowerCase();

    if (!currentUser && !targetUserId && !targetEmail) {
      return NextResponse.json(
        { error: "Authentication required to update password." },
        { status: 401 }
      );
    }

    if (!newPassword || newPassword.length < 4) {
      return NextResponse.json(
        { error: "New password must be at least 4 characters long." },
        { status: 400 }
      );
    }

    const db = await getDb();
    const user = db.users.find(
      (u) =>
        (targetUserId && u.id === targetUserId) ||
        (targetEmail && u.email.toLowerCase() === targetEmail) ||
        (currentUser && u.id === currentUser.id)
    );

    if (!user) {
      return NextResponse.json(
        { error: "User account not found." },
        { status: 404 }
      );
    }

    // Security check: non-admins cannot change another user's password
    if (
      currentUser &&
      currentUser.id !== user.id &&
      currentUser.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "You are not authorized to update another user's password." },
        { status: 403 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 8);
    user.passwordHash = passwordHash;
    user.passwordSet = true;

    appendActivity(db, {
      actorName: user.name,
      actorEmail: user.email,
      action: "Updated Password",
      details: `${user.name} (${user.email}) successfully updated their account password.`,
      category: "ADMIN_ROOM",
    });

    await saveDb(db);

    const safeUser = sanitizeUser(user);
    const token = signSessionToken(safeUser);

    const response = NextResponse.json({
      success: true,
      message: "Password updated successfully!",
      user: safeUser,
      token,
      passwordHash,
      userRecord: user,
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });

    return response;
  } catch (err) {
    console.error("Update password error:", err);
    return NextResponse.json(
      { error: "Internal server error during password update." },
      { status: 500 }
    );
  }
}
