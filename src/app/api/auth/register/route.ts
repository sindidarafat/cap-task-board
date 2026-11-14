import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { appendActivity, getDb, sanitizeUser, saveDb } from "@/lib/db";
import { SESSION_COOKIE_NAME, signSessionToken } from "@/lib/auth";
import { UserAccount } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = (body.name || "").trim();
    let email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const teamRole = (body.teamRole || "Team Member").trim();
    const requestedAccountType = body.accountType === "ADMIN" ? "ADMIN" : "MEMBER";

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required." },
        { status: 400 }
      );
    }

    if (!email.includes("@")) {
      email = `${email}@cap.com`;
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: "Password must be at least 4 characters." },
        { status: 400 }
      );
    }

    const db = await getDb();
    const existingUserIndex = db.users.findIndex((u) => u.email.toLowerCase() === email);

    // If account already exists in pre-seeded roster, allow user to set their password and sign in directly
    if (existingUserIndex >= 0) {
      const existingUser = db.users[existingUserIndex];
      const passwordHash = await bcrypt.hash(password, 8);
      existingUser.passwordHash = passwordHash;
      if (name) existingUser.name = name;
      if (teamRole && teamRole !== "Team Member") existingUser.teamRole = teamRole;

      if (requestedAccountType === "ADMIN" && existingUser.role !== "ADMIN") {
        existingUser.adminRequestStatus = "PENDING";
        existingUser.requestedAt = new Date().toISOString();
        appendActivity(db, {
          actorName: existingUser.name,
          actorEmail: existingUser.email,
          action: "Requested Admin Account Approval",
          details: `${existingUser.name} requested Admin access. Waiting for approval in the Admin Room.`,
          category: "ADMIN_ROOM",
        });
      }

      await saveDb(db);
      const safeUser = sanitizeUser(existingUser);
      const token = signSessionToken(safeUser);

      const response = NextResponse.json({
        user: safeUser,
        token,
        message:
          requestedAccountType === "ADMIN" && existingUser.role !== "ADMIN"
            ? "Password set! Your request for Admin access is pending approval in the Admin Room."
            : "Signed in successfully!",
      });

      response.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 14,
      });

      return response;
    }

    const passwordHash = await bcrypt.hash(password, 8);
    const now = new Date().toISOString();
    const hasExistingAdmins = db.users.some(
      (u) => u.role === "ADMIN" && u.adminRequestStatus === "APPROVED"
    );

    const isAutoApprovedFirstAdmin = requestedAccountType === "ADMIN" && !hasExistingAdmins;

    // Match with existing team members from Excel data (M-001 to M-014) or create a new Member ID
    const matchedTeamMember = db.team.find(
      (m) =>
        m.name.trim().toLowerCase() === name.toLowerCase() ||
        (body.memberId && m.id.toLowerCase() === String(body.memberId).toLowerCase())
    );

    let finalName = name;
    let finalTeamRole = teamRole;
    let memberId: string;

    if (matchedTeamMember) {
      finalName = matchedTeamMember.name;
      memberId = matchedTeamMember.id;
      if (!teamRole || teamRole === "Team Member") {
        finalTeamRole = matchedTeamMember.role || "Team Member";
      }
    } else {
      const existingNumericIds = db.team
        .map((m) => {
          const match = m.id.match(/\d+/);
          return match ? parseInt(match[0], 10) : 0;
        })
        .filter((n) => !isNaN(n));
      const nextNum =
        existingNumericIds.length > 0
          ? Math.max(...existingNumericIds) + 1
          : db.team.length + 1;
      memberId = `M-${String(nextNum).padStart(3, "0")}`;

      db.team.push({
        id: memberId,
        name: finalName,
        role: finalTeamRole,
        team: "Creative",
        dailyCapacity: 6,
        notes: "Registered via web account creation",
      });
    }

    const newUser: UserAccount = {
      id: `U-${String(db.users.length + 1).padStart(3, "0")}-${Date.now().toString().slice(-4)}`,
      memberId,
      name: finalName,
      email,
      passwordHash,
      role: isAutoApprovedFirstAdmin ? "ADMIN" : "MEMBER",
      adminRequestStatus:
        requestedAccountType === "ADMIN"
          ? isAutoApprovedFirstAdmin
            ? "APPROVED"
            : "PENDING"
          : "NONE",
      teamRole: finalTeamRole,
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
          ? "Account created! You currently have Member (view-only) access until an existing Admin approves your Admin request in the Admin Room."
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
