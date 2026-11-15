import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb, sanitizeUser, saveDb } from "@/lib/db";
import { SESSION_COOKIE_NAME, signSessionToken } from "@/lib/auth";
import { UserAccount } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const clientPasswordHash = typeof body.clientPasswordHash === "string" ? body.clientPasswordHash : "";
    const clientUser = body.clientUser as Partial<UserAccount> | undefined;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (!email.includes("@")) {
      email = `${email}@cap.com`;
    }

    const db = await getDb();
    let user = db.users.find((u) => u.email.toLowerCase() === email);

    // If lambda cold start lost the user from /tmp, but client has cached this user
    if (!user && clientUser && clientUser.email?.toLowerCase() === email) {
      const restoredUser: UserAccount = {
        id: clientUser.id || `U-${Date.now()}`,
        memberId: clientUser.memberId || "M-000",
        name: clientUser.name || email.split("@")[0],
        email,
        passwordHash: clientUser.passwordHash || (await bcrypt.hash(password, 8)),
        role: clientUser.role || "MEMBER",
        adminRequestStatus: clientUser.adminRequestStatus || "NONE",
        teamRole: clientUser.teamRole || "Team Member",
        approvedBy: clientUser.approvedBy || null,
        approvedAt: clientUser.approvedAt || null,
        requestedAt: clientUser.requestedAt || null,
        createdAt: clientUser.createdAt || new Date().toISOString(),
      };
      db.users.push(restoredUser);
      await saveDb(db);
      user = restoredUser;
    }

    if (!user) {
      return NextResponse.json(
        { error: "No account found with this email. Please click 'Create account' to set up your password." },
        { status: 401 }
      );
    }

    let valid = false;

    // 1. Direct bcrypt comparison against user's stored hash
    try {
      valid = await bcrypt.compare(password, user.passwordHash);
    } catch {
      valid = false;
    }

    // 2. If client supplied a stored password hash (from recent reset/registration), test against it
    if (!valid && clientPasswordHash && clientPasswordHash.startsWith("$2")) {
      try {
        if (await bcrypt.compare(password, clientPasswordHash)) {
          valid = true;
          // Update user hash in db so subsequent calls on this lambda don't need client hash
          user.passwordHash = clientPasswordHash;
          await saveDb(db);
        }
      } catch {
        // ignore comparison error
      }
    }

    // 3. Fallback agency master passwords for easy team access
    if (
      !valid &&
      (password === "Cap@2026!" ||
        password === "admin123" ||
        password === "member123" ||
        password === "Admin@1234")
    ) {
      valid = true;
    }

    if (!valid) {
      return NextResponse.json(
        { error: "Incorrect password. If you forgot your password, please click 'Create account' to reset it." },
        { status: 401 }
      );
    }

    const safeUser = sanitizeUser(user);
    const token = signSessionToken(safeUser);

    const response = NextResponse.json({
      user: safeUser,
      token,
      passwordHash: user.passwordHash,
      userRecord: user,
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14, // 14 days
    });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Internal server error during sign in." },
      { status: 500 }
    );
  }
}
