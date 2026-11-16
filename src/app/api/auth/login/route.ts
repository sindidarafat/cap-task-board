import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb, sanitizeUser, saveDb, syncClientUsersToDb } from "@/lib/db";
import { SESSION_COOKIE_NAME, signSessionToken } from "@/lib/auth";
import { UserAccount } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body.userId as string | undefined;
    let email = (body.email || "").trim().toLowerCase();
    const name = (body.name || "").trim();
    const password = body.password || "";
    const clientPasswordHash = typeof body.clientPasswordHash === "string" ? body.clientPasswordHash : "";
    const clientUser = body.clientUser as Partial<UserAccount> | undefined;
    const clientUsers = Array.isArray(body.clientUsers) ? body.clientUsers : undefined;

    if (!password) {
      return NextResponse.json(
        { error: "Password is required." },
        { status: 400 }
      );
    }

    if (!email && !userId && !name) {
      return NextResponse.json(
        { error: "User identity (ID, email, or name) is required." },
        { status: 400 }
      );
    }

    if (email && !email.includes("@")) {
      email = `${email}@cap.direct`;
    }

    const db = await getDb();

    // 1. Sync any client-side user records from headers or body
    const clientUsersHeader = request.headers.get("x-cap-client-users");
    if (clientUsersHeader) {
      try {
        const parsed = JSON.parse(clientUsersHeader);
        if (Array.isArray(parsed)) {
          syncClientUsersToDb(db, parsed);
        }
      } catch {}
    }
    if (clientUsers && clientUsers.length > 0) {
      syncClientUsersToDb(db, clientUsers);
    }

    // 2. Lookup user
    let user = db.users.find((u) => {
      if (userId && (u.id === userId || u.memberId === userId)) return true;
      if (email && u.email.toLowerCase() === email) return true;
      if (name && (u.name.toLowerCase() === name.toLowerCase() || u.aliases?.some(a => a.toLowerCase() === name.toLowerCase()))) return true;
      return false;
    });

    // Support Sindid Arafat's alternate emails
    if (!user && (email === "analyst@cap.direct" || email === "sindidarafat275@gmail.com")) {
      user = db.users.find((u) => u.name === "Sindid Arafat");
    }

    // If lambda cold start lost the user from /tmp, but client has cached this user
    if (!user && clientUser && (clientUser.email?.toLowerCase() === email || clientUser.id === userId)) {
      const restoredUser: UserAccount = {
        id: clientUser.id || `U-${Date.now()}`,
        memberId: clientUser.memberId || `M-${String(db.team.length + 1).padStart(3, "0")}`,
        name: clientUser.name || (email ? email.split("@")[0] : "User"),
        email: clientUser.email || email,
        phone: clientUser.phone || "",
        passwordHash: clientUser.passwordHash || (await bcrypt.hash(password, 8)),
        passwordSet: true,
        role: clientUser.role || "MEMBER",
        adminRequestStatus: clientUser.adminRequestStatus || "NONE",
        teamRole: clientUser.teamRole || "Team Member",
        approvedBy: clientUser.approvedBy || null,
        approvedAt: clientUser.approvedAt || null,
        requestedAt: clientUser.requestedAt || null,
        createdAt: clientUser.createdAt || new Date().toISOString(),
        aliases: clientUser.aliases || [],
      };
      db.users.push(restoredUser);
      // Ensure in db.team
      if (!db.team.some((m) => (restoredUser.memberId && m.id === restoredUser.memberId) || m.name.toLowerCase() === restoredUser.name.toLowerCase())) {
        db.team.push({
          id: restoredUser.memberId || restoredUser.id,
          name: restoredUser.name,
          role: restoredUser.teamRole || "Team Member",
          team: "Creative",
          dailyCapacity: 6,
          notes: "Restored from client cache",
          phone: restoredUser.phone,
          email: restoredUser.email,
        });
      }
      await saveDb(db);
      user = restoredUser;
    }

    if (!user) {
      return NextResponse.json(
        { error: "No account found. Please check your selected name or email, or click 'New User' to register." },
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
          user.passwordHash = clientPasswordHash;
          user.passwordSet = true;
          await saveDb(db);
        }
      } catch {
        // ignore comparison error
      }
    }

    // 3. Fallback agency master passwords for easy team recovery
    if (
      !valid &&
      (password === "Cap@2026!" ||
        password === "admin123" ||
        password === "member123" ||
        password === "Admin@1234")
    ) {
      valid = true;
      // Rehash so subsequent logins use direct bcrypt comparison
      user.passwordHash = await bcrypt.hash(password, 8);
      user.passwordSet = true;
      await saveDb(db);
    }

    if (!valid) {
      return NextResponse.json(
        { error: "Incorrect password. If you forgot your password, please click 'Forgot password?' or try the default agency password Cap@2026!." },
        { status: 401 }
      );
    }

    // Ensure passwordSet is true
    if (!user.passwordSet) {
      user.passwordSet = true;
      await saveDb(db);
    }

    const safeUser = sanitizeUser(user);
    const token = signSessionToken(safeUser);

    const response = NextResponse.json({
      user: safeUser,
      token,
      passwordHash: user.passwordHash,
      userRecord: user,
      message: `Signed in successfully as ${safeUser.name}.`,
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
