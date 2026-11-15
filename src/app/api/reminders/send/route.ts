import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isApprovedAdmin } from "@/lib/auth";
import { appendActivity, getDb, saveDb } from "@/lib/db";
import { sendReminderEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!isApprovedAdmin(currentUser)) {
      return NextResponse.json(
        { error: "Only approved Administrators can send team reminders." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const memberName = (body.memberName || "").trim();
    const memberId = (body.memberId || "").trim();
    const message = (body.message || "").trim();

    if (!memberName && !memberId) {
      return NextResponse.json(
        { error: "Member name or ID is required." },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: "Task details message is required." },
        { status: 400 }
      );
    }

    const wordCount = message.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > 500) {
      return NextResponse.json(
        { error: `Message exceeds the 500-word limit (${wordCount} words provided). Please shorten your message.` },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Find member in db.team or db.users
    const teamMember = db.team.find(
      (m) =>
        (memberId && m.id === memberId) ||
        m.name.toLowerCase() === memberName.toLowerCase() ||
        (m.aliases && m.aliases.some((a) => a.toLowerCase() === memberName.toLowerCase()))
    );

    const userAccount = db.users.find(
      (u) =>
        (memberId && u.memberId === memberId) ||
        u.name.toLowerCase() === memberName.toLowerCase() ||
        (u.aliases && u.aliases.some((a) => a.toLowerCase() === memberName.toLowerCase()))
    );

    const resolvedName = teamMember?.name || userAccount?.name || memberName;
    const resolvedEmail = (teamMember?.email || userAccount?.email || body.email || "").trim();
    const resolvedPhone = (teamMember?.phone || userAccount?.phone || body.phone || "").trim();

    if (!resolvedEmail) {
      return NextResponse.json(
        { error: `Cannot send Email reminder: No email registered for ${resolvedName}. Please update their email first.` },
        { status: 400 }
      );
    }

    // Format mailto link (used as fallback or manual review)
    const subject = `CAP Task Board Reminder for ${resolvedName}`;
    const mailtoUrl = `mailto:${resolvedEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;

    // Direct background email dispatch via Resend
    let directEmailSent = false;
    let directEmailMessageId: string | null = null;
    let emailError: string | null = null;

    const origin =
      request.nextUrl.origin || "https://captaskboardamt.vercel.app";
    const emailResult = await sendReminderEmail({
      to: resolvedEmail,
      recipientName: resolvedName,
      senderName: currentUser!.name,
      message,
      siteUrl: origin,
    });

    if (emailResult.success) {
      directEmailSent = true;
      directEmailMessageId = emailResult.messageId || null;
    } else {
      emailError = emailResult.error || "Failed to deliver email through Resend.";
    }

    // Log the reminder in the activity log
    appendActivity(db, {
      actorName: currentUser!.name,
      actorEmail: currentUser!.email,
      action: `Sent Task Reminder via Email`,
      details: `Admin ${currentUser!.name} sent an email reminder to ${resolvedName} (${resolvedEmail}). Direct Delivery: ${directEmailSent ? "Success (" + directEmailMessageId + ")" : emailError ? "Failed (" + emailError + ")" : "N/A"}. Message: "${message.slice(0, 150)}${message.length > 150 ? "..." : ""}"`,
      category: "TASK",
    });

    await saveDb(db);

    return NextResponse.json({
      success: true,
      memberName: resolvedName,
      phone: resolvedPhone,
      email: resolvedEmail,
      channels: ["email"],
      directEmailSent,
      directEmailMessageId,
      emailError,
      mailtoUrl,
      message,
    });
  } catch (err) {
    console.error("Send reminder error:", err);
    return NextResponse.json(
      { error: "Internal server error while sending reminder." },
      { status: 500 }
    );
  }
}
