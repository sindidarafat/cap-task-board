import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { appendActivity, getDb, saveDb, syncClientUsersToDb } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body.userId as string | undefined;
    const email = (body.email || "").trim().toLowerCase();

    const db = await getDb();

    // Sync any client users header
    const clientUsersHeader = request.headers.get("x-cap-client-users");
    if (clientUsersHeader) {
      try {
        const parsed = JSON.parse(clientUsersHeader);
        if (Array.isArray(parsed)) {
          syncClientUsersToDb(db, parsed);
        }
      } catch {}
    }

    let user = db.users.find(
      (u) =>
        (userId && (u.id === userId || u.memberId === userId)) ||
        (email && u.email.toLowerCase() === email) ||
        (email && email.includes("@") && u.email.toLowerCase() === email)
    );

    // Support matching Sindid's alternate email
    if (!user && (email === "analyst@cap.direct" || email === "sindidarafat275@gmail.com")) {
      user = db.users.find((u) => u.name === "Sindid Arafat");
    }

    if (!user) {
      return NextResponse.json(
        { error: "User account not found. Please verify your selected name or email." },
        { status: 404 }
      );
    }

    // Generate a secure, readable temporary password
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    const tempPassword = `Cap#${randomDigits}!`;

    const passwordHash = await bcrypt.hash(tempPassword, 8);
    user.passwordHash = passwordHash;
    user.passwordSet = true;

    // Dispatch email via Resend
    const origin =
      request.nextUrl.origin || "https://captaskboardamt.vercel.app";
    const emailResult = await sendPasswordResetEmail({
      to: user.email,
      recipientName: user.name,
      tempPassword,
      siteUrl: origin,
    });

    appendActivity(db, {
      actorName: user.name,
      actorEmail: user.email,
      action: "Issued Temporary Password",
      details: `Generated temporary password for ${user.name} (${user.email}). Email delivery: ${emailResult.success ? "Sent directly via Resend (" + emailResult.messageId + ")" : "Direct email failed (" + emailResult.error + ")"}. User can sign in and update password on dashboard.`,
      category: "ADMIN_ROOM",
    });

    await saveDb(db);

    return NextResponse.json({
      success: true,
      email: user.email,
      name: user.name,
      tempPassword,
      passwordHash: user.passwordHash,
      userRecord: user,
      directEmailSent: emailResult.success,
      emailError: emailResult.error || null,
      message: emailResult.success
        ? `A temporary password has been emailed to ${user.email}.`
        : `A temporary password has been generated for ${user.email}.`,
    });
  } catch (err) {
    console.error("Reset password error:", err);
    return NextResponse.json(
      { error: "Internal server error during password reset." },
      { status: 500 }
    );
  }
}
