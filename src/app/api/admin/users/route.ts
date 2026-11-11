import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentUser, isApprovedAdmin } from "@/lib/auth";
import { appendActivity, getDb, sanitizeUser, saveDb } from "@/lib/db";
import { UserAccount } from "@/lib/types";

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser(request);
  if (!isApprovedAdmin(currentUser)) {
    return NextResponse.json(
      { error: "Forbidden: Only approved Admins in the Admin Room can manage accounts." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const action = body.action as string;
  const targetUserId = body.userId as string | undefined;

  const db = await getDb();
  const now = new Date().toISOString();

  if (action === "approve_admin" || action === "promote_to_admin") {
    const target = db.users.find((u) => u.id === targetUserId);
    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    target.role = "ADMIN";
    target.adminRequestStatus = "APPROVED";
    target.approvedBy = currentUser!.name;
    target.approvedAt = now;

    appendActivity(db, {
      actorName: currentUser!.name,
      actorEmail: currentUser!.email,
      action:
        action === "approve_admin"
          ? `Approved Admin Request: ${target.name}`
          : `Promoted Member to Admin: ${target.name}`,
      details: `${target.name} (${target.email}) was approved as an Admin by ${currentUser!.name}.`,
      category: "ADMIN_ROOM",
    });

    await saveDb(db);
    return NextResponse.json({
      users: db.users.map(sanitizeUser),
      activityLog: db.activityLog,
    });
  }

  if (action === "reject_admin") {
    const target = db.users.find((u) => u.id === targetUserId);
    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    target.role = "MEMBER";
    target.adminRequestStatus = "REJECTED";

    appendActivity(db, {
      actorName: currentUser!.name,
      actorEmail: currentUser!.email,
      action: `Declined Admin Request: ${target.name}`,
      details: `${target.name} (${target.email}) remains a view-only Member (reviewed by ${currentUser!.name}).`,
      category: "ADMIN_ROOM",
    });

    await saveDb(db);
    return NextResponse.json({
      users: db.users.map(sanitizeUser),
      activityLog: db.activityLog,
    });
  }

  if (action === "demote_to_member") {
    const target = db.users.find((u) => u.id === targetUserId);
    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const activeAdmins = db.users.filter(
      (u) => u.role === "ADMIN" && u.adminRequestStatus === "APPROVED"
    );
    if (activeAdmins.length <= 1 && target.role === "ADMIN") {
      return NextResponse.json(
        { error: "Cannot demote the last remaining Admin account." },
        { status: 400 }
      );
    }

    target.role = "MEMBER";
    target.adminRequestStatus = "NONE";
    target.approvedBy = null;
    target.approvedAt = null;

    appendActivity(db, {
      actorName: currentUser!.name,
      actorEmail: currentUser!.email,
      action: `Changed Admin to Member: ${target.name}`,
      details: `${target.name} (${target.email}) was moved to Member (view-only) role by ${currentUser!.name}.`,
      category: "ADMIN_ROOM",
    });

    await saveDb(db);
    return NextResponse.json({
      users: db.users.map(sanitizeUser),
      activityLog: db.activityLog,
    });
  }

  if (action === "create_user") {
    const name = (body.name || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "cap123";
    const role = body.role === "ADMIN" ? "ADMIN" : "MEMBER";
    const teamRole = (body.teamRole || (role === "ADMIN" ? "Admin" : "Team Member")).trim();

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required." },
        { status: 400 }
      );
    }

    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 8);
    const newUser: UserAccount = {
      id: `U-${String(db.users.length + 1).padStart(3, "0")}-${Date.now().toString().slice(-4)}`,
      name,
      email,
      passwordHash,
      role,
      adminRequestStatus: role === "ADMIN" ? "APPROVED" : "NONE",
      teamRole,
      approvedBy: role === "ADMIN" ? currentUser!.name : null,
      approvedAt: role === "ADMIN" ? now : null,
      requestedAt: role === "ADMIN" ? now : null,
      createdAt: now,
    };

    db.users.push(newUser);

    appendActivity(db, {
      actorName: currentUser!.name,
      actorEmail: currentUser!.email,
      action: `Created ${role === "ADMIN" ? "Admin" : "Member"} Account: ${name}`,
      details: `${currentUser!.name} added ${name} (${email}) as ${role === "ADMIN" ? "an approved Admin" : "a view-only Member"}.`,
      category: "ADMIN_ROOM",
    });

    await saveDb(db);
    return NextResponse.json({
      users: db.users.map(sanitizeUser),
      activityLog: db.activityLog,
    });
  }

  if (action === "delete_user") {
    const target = db.users.find((u) => u.id === targetUserId);
    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (target.id === currentUser!.id) {
      return NextResponse.json(
        { error: "You cannot delete your own active Admin account." },
        { status: 400 }
      );
    }

    db.users = db.users.filter((u) => u.id !== targetUserId);

    appendActivity(db, {
      actorName: currentUser!.name,
      actorEmail: currentUser!.email,
      action: `Removed Account: ${target.name}`,
      details: `${currentUser!.name} removed ${target.name} (${target.email}) from the system.`,
      category: "ADMIN_ROOM",
    });

    await saveDb(db);
    return NextResponse.json({
      users: db.users.map(sanitizeUser),
      activityLog: db.activityLog,
    });
  }

  return NextResponse.json({ error: "Invalid Admin Room action." }, { status: 400 });
}
