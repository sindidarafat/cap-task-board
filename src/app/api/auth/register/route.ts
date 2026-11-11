import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { appendActivity, getDb, sanitizeUser, saveDb } from "@/lib/db";
import { SESSION_COOKIE_NAME, signSessionToken } from "@/lib/auth";
import { UserAccount } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = (body.name || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const teamRole = (body.teamRole || "Team Member").trim();
    const requestedAccountType = body.accountType === "ADMIN" ? "ADMIN" : "MEMBER";

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: "Password must be at least 4 characters." },
        { status: 400 }
      );
    }

    const db = await getDb();
    const exists = db.users.some((u) => u.email.toLowerCase() === email);
    if (exists) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 8);
    const now = new Date().toISOString();
    const hasExistingAdmins = db.users.some(
      (u) => u.role === "ADMIN" && u.adminRequestStatus === "APPROVED"
    );

    // If user requests an Admin account, it must be approved by other admins (unless 0 admins exist)
    const isAutoApprovedFirstAdmin = requestedAccountType === "ADMIN" && !hasExistingAdmins;

    const newUser: UserAccount = {
      id: `U-${String(db.users.length + 1).padStart(3, "0")}-${Date.now().toString().slice(-4)}`,
      name,
      email,
      passwordHash,
      role: isAutoApprovedFirstAdmin ? "ADMIN" : "MEMBER",
      adminRequestStatus:
        requestedAccountType === "ADMIN"
          ? isAutoApprovedFirstAdmin
            ? "APPROVED"
            : "PENDING"
          : "NONE",
      teamRole,
      approvedBy: isAutoApprovedFirstAdmin ? "System Auto-Bootstrap" : null,
      approvedAt: isAutoApprovedFirstAdmin ? now : null,
      requestedAt: requestedAccountType === "ADMIN" ? now : null,
      createdAt: now,
    };

    db.users.push(newUser);

    if (requestedAccountType === "ADMIN") {
      appendActivity(db, {
        actorName: name,
        actorEmail: email,
        action: isAutoApprovedFirstAdmin
          ? "Created First Admin Account"
          : "Registered & Requested Admin Approval",
        details: isAutoApprovedFirstAdmin
          ? `${name} (${teamRole}) registered as the initial Admin.`
          : `${name} (${teamRole}) registered and requested Admin access. Waiting for approval from an existing Admin in the Admin Room.`,
        category: "ADMIN_ROOM",
      });
    } else {
      appendActivity(db, {
        actorName: name,
        actorEmail: email,
        action: "Registered Member Account",
        details: `${name} (${teamRole}) joined as a view-only Member.`,
        category: "ADMIN_ROOM",
      });
    }

    await saveDb(db);

    const safeUser = sanitizeUser(newUser);
    const token = signSessionToken(safeUser);

    const response = NextResponse.json({
      user: safeUser,
      token,
      message:
        requestedAccountType === "ADMIN" && !isAutoApprovedFirstAdmin
          ? "Account created! You currently have Member (view-only) access until another Admin approves your Admin request in the Admin Room."
          : "Account created successfully!",
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });

    return response;
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json(
      { error: "Internal server error during registration." },
      { status: 500 }
    );
  }
}
