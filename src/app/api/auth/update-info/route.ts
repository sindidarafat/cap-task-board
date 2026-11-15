import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { appendActivity, getDb, sanitizeUser, saveDb } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME, signSessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    const body = await request.json();

    const targetUserId = body.userId || currentUser?.id;
    const targetEmail = (body.email || currentUser?.email || "").trim().toLowerCase();

    if (!currentUser && !targetUserId && !targetEmail) {
      return NextResponse.json(
        { error: "Authentication required to update profile information." },
        { status: 401 }
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

    // Security check: non-admins cannot change another user's info
    if (
      currentUser &&
      currentUser.id !== user.id &&
      currentUser.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "You are not authorized to update another user's information." },
        { status: 403 }
      );
    }

    const newName = (body.name || "").trim();
    let newEmail = (body.email || "").trim().toLowerCase();
    const newPhone = (body.phone || "").trim();
    const newDesignation = (body.designation || body.teamRole || "").trim();
    const newPassword = (body.password || body.newPassword || "").trim();

    if (newEmail && !newEmail.includes("@")) {
      newEmail = `${newEmail}@cap.direct`;
    }

    // Check email uniqueness if changing email
    if (newEmail && newEmail !== user.email.toLowerCase()) {
      const emailInUse = db.users.find(
        (u) => u.id !== user.id && u.email.toLowerCase() === newEmail
      );
      if (emailInUse) {
        return NextResponse.json(
          { error: `The email address ${newEmail} is already in use by another user.` },
          { status: 400 }
        );
      }
    }

    // Validate password if provided
    if (newPassword && newPassword.length < 4) {
      return NextResponse.json(
        { error: "Password must be at least 4 characters long." },
        { status: 400 }
      );
    }

    const oldName = user.name;
    const aliases = new Set(user.aliases || []);

    if (newName && newName !== user.name) {
      aliases.add(oldName);
      aliases.add(newName);
      user.name = newName;
    }
    user.aliases = Array.from(aliases);

    if (newEmail) {
      user.email = newEmail;
    }

    if (newPhone !== undefined) {
      user.phone = newPhone;
    }

    if (newDesignation) {
      user.teamRole = newDesignation;
    }

    if (newPassword) {
      user.passwordHash = await bcrypt.hash(newPassword, 8);
      user.passwordSet = true;
    }

    // Synchronize updates with corresponding team member in db.team
    const matchedTeamMember = db.team.find(
      (m) =>
        (user.memberId && m.id === user.memberId) ||
        m.name.toLowerCase() === oldName.toLowerCase() ||
        (user.aliases && user.aliases.some((a) => a.toLowerCase() === m.name.toLowerCase()))
    );

    if (matchedTeamMember) {
      if (newName) matchedTeamMember.name = newName;
      if (newEmail) matchedTeamMember.email = newEmail;
      if (newPhone !== undefined) matchedTeamMember.phone = newPhone;
      if (newDesignation) matchedTeamMember.role = newDesignation;
      const teamAliases = new Set(matchedTeamMember.aliases || []);
      teamAliases.add(oldName);
      if (newName) teamAliases.add(newName);
      matchedTeamMember.aliases = Array.from(teamAliases);
    }

    appendActivity(db, {
      actorName: user.name,
      actorEmail: user.email,
      action: "Updated Profile Information",
      details: `${user.name} (${user.email}) updated their profile info (Phone: ${user.phone || "N/A"}, Designation: ${user.teamRole}).${newPassword ? " Password was also updated." : ""}`,
      category: "ADMIN_ROOM",
    });

    await saveDb(db);

    const safeUser = sanitizeUser(user);
    const token = signSessionToken(safeUser);

    const response = NextResponse.json({
      success: true,
      message: "Information updated successfully!",
      user: safeUser,
      token,
      passwordHash: user.passwordHash,
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
    console.error("Update info error:", err);
    return NextResponse.json(
      { error: "Internal server error during profile update." },
      { status: 500 }
    );
  }
}
