import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { appendActivity, getDb, sanitizeUser, saveDb } from "@/lib/db";
import { SESSION_COOKIE_NAME, signSessionToken } from "@/lib/auth";
import { UserAccount } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action as string | undefined; // "set_password" | "new_user"
    const userId = body.userId as string | undefined;
    const name = (body.name || "").trim();
    let email = (body.email || "").trim().toLowerCase();
    const phone = (body.phone || "").trim();
    const password = body.password || "";
    const teamRole = (body.teamRole || body.title || "Team Member").trim();
    const requestedAccountType = body.accountType === "ADMIN" ? "ADMIN" : "MEMBER";

    if (!password) {
      return NextResponse.json(
        { error: "Password is required." },
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

    // Case 1: Existing member setting their password (first time activation)
    if (action === "set_password" || (userId && !email)) {
      let existingUser = db.users.find(
        (u) =>
          (userId && u.id === userId) ||
          (email && u.email.toLowerCase() === email) ||
          (name && (u.name.toLowerCase() === name.toLowerCase() || u.aliases?.some(a => a.toLowerCase() === name.toLowerCase())))
      );

      // Support Sindid Arafat alternate email
      if (!existingUser && (email === "analyst@cap.direct" || email === "sindidarafat275@gmail.com")) {
        existingUser = db.users.find((u) => u.name === "Sindid Arafat");
      }

      if (existingUser) {
        const passwordHash = await bcrypt.hash(password, 8);
        existingUser.passwordHash = passwordHash;
        existingUser.passwordSet = true;
        if (phone && !existingUser.phone) existingUser.phone = phone;

        // Also update phone on corresponding team member if present
        const matchedMember = db.team.find((m) => m.id === existingUser?.memberId || m.name === existingUser?.name);
        if (matchedMember && phone) {
          matchedMember.phone = phone;
        }

        appendActivity(db, {
          actorName: existingUser.name,
          actorEmail: existingUser.email,
          action: "Activated Account Password",
          details: `${existingUser.name} (${existingUser.email}) set their password and activated account.`,
          category: "ADMIN_ROOM",
        });

        await saveDb(db);

        const safeUser = sanitizeUser(existingUser);
        const token = signSessionToken(safeUser);

        const response = NextResponse.json({
          user: safeUser,
          token,
          passwordHash,
          userRecord: existingUser,
          message: `Password set successfully! Welcome to CAP Task Board, ${safeUser.name}.`,
        });

        response.cookies.set(SESSION_COOKIE_NAME, token, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 14,
        });

        return response;
      }
    }

    // Case 2: Standard or New User Registration
    if (!name || !email) {
      return NextResponse.json(
        { error: "Full Name and Email are required." },
        { status: 400 }
      );
    }

    if (!email.includes("@")) {
      email = `${email}@cap.direct`;
    }

    const existingUserIndex = db.users.findIndex((u) => u.email.toLowerCase() === email);

    // If an account already exists with this email, update its password
    if (existingUserIndex >= 0) {
      const existingUser = db.users[existingUserIndex];
      const passwordHash = await bcrypt.hash(password, 8);
      existingUser.passwordHash = passwordHash;
      existingUser.passwordSet = true;
      if (name) existingUser.name = name;
      if (phone) existingUser.phone = phone;
      if (teamRole && teamRole !== "Team Member") existingUser.teamRole = teamRole;

      if (requestedAccountType === "ADMIN" && existingUser.role !== "ADMIN") {
        existingUser.adminRequestStatus = "PENDING";
        existingUser.requestedAt = new Date().toISOString();
      }

      await saveDb(db);
      const safeUser = sanitizeUser(existingUser);
      const token = signSessionToken(safeUser);

      const response = NextResponse.json({
        user: safeUser,
        token,
        passwordHash,
        userRecord: existingUser,
        message: `Account updated successfully! Signed in as ${safeUser.name}.`,
      });

      response.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 14,
      });

      return response;
    }

    // Creating a brand-new user
    const passwordHash = await bcrypt.hash(password, 8);
    const now = new Date().toISOString();
    const hasExistingAdmins = db.users.some(
      (u) => u.role === "ADMIN" && u.adminRequestStatus === "APPROVED"
    );

    const isAutoApprovedFirstAdmin = requestedAccountType === "ADMIN" && !hasExistingAdmins;

    // Check if name matches any existing team member in db.team
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
      if (phone && !matchedTeamMember.phone) {
        matchedTeamMember.phone = phone;
      }
      if (email && !matchedTeamMember.email) {
        matchedTeamMember.email = email;
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
        phone,
        email,
      });
    }

    const newUser: UserAccount = {
      id: `U-${String(db.users.length + 1).padStart(3, "0")}-${Date.now().toString().slice(-4)}`,
      memberId,
      name: finalName,
      email,
      phone,
      passwordHash,
      passwordSet: true,
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
      aliases: [finalName],
    };

    db.users.push(newUser);

    appendActivity(db, {
      actorName: name,
      actorEmail: email,
      action: requestedAccountType === "ADMIN" ? "Registered Admin Account" : "Registered Member Account",
      details: `${name} (${finalTeamRole}) registered with phone ${phone || "N/A"}.`,
      category: "ADMIN_ROOM",
    });

    await saveDb(db);

    const safeUser = sanitizeUser(newUser);
    const token = signSessionToken(safeUser);

    const response = NextResponse.json({
      user: safeUser,
      token,
      passwordHash,
      userRecord: newUser,
      message:
        requestedAccountType === "ADMIN" && !isAutoApprovedFirstAdmin
          ? "Account created! You have Member access while your Admin elevation is reviewed."
          : `Account created successfully! Signed in as ${safeUser.name}.`,
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
