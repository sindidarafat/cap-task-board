import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isApprovedAdmin } from "@/lib/auth";
import { appendActivity, getDb, saveDb } from "@/lib/db";

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
    const channels = Array.isArray(body.channels) ? body.channels : [];
    const message = (body.message || "").trim();

    if (!memberName && !memberId) {
      return NextResponse.json(
        { error: "Member name or ID is required." },
        { status: 400 }
      );
    }

    if (!channels.includes("whatsapp") && !channels.includes("email")) {
      return NextResponse.json(
        { error: "Please select at least one delivery channel (WhatsApp and/or Email)." },
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
    const resolvedPhone = (teamMember?.phone || userAccount?.phone || body.phone || "").trim();
    const resolvedEmail = (teamMember?.email || userAccount?.email || body.email || "").trim();

    if (channels.includes("whatsapp") && !resolvedPhone) {
      return NextResponse.json(
        { error: `Cannot send WhatsApp reminder: No phone number registered for ${resolvedName}. Please update their phone number first.` },
        { status: 400 }
      );
    }

    if (channels.includes("email") && !resolvedEmail) {
      return NextResponse.json(
        { error: `Cannot send Email reminder: No email registered for ${resolvedName}. Please update their email first.` },
        { status: 400 }
      );
    }

    // Format WhatsApp deep link
    let whatsappUrl = "";
    if (channels.includes("whatsapp") && resolvedPhone) {
      const cleanDigits = resolvedPhone.replace(/[^0-9]/g, "");
      whatsappUrl = `https://wa.me/${cleanDigits}?text=${encodeURIComponent(message)}`;
    }

    // Format mailto link
    let mailtoUrl = "";
    if (channels.includes("email") && resolvedEmail) {
      const subject = `CAP Task Board Reminder for ${resolvedName}`;
      mailtoUrl = `mailto:${resolvedEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    }

    // Log the reminder in the activity log
    const channelLabels: string[] = [];
    if (channels.includes("whatsapp")) channelLabels.push("WhatsApp");
    if (channels.includes("email")) channelLabels.push("Email");

    appendActivity(db, {
      actorName: currentUser!.name,
      actorEmail: currentUser!.email,
      action: `Sent Task Reminder via ${channelLabels.join(" & ")}`,
      details: `Admin ${currentUser!.name} sent a reminder to ${resolvedName} (${resolvedPhone || "No phone"} / ${resolvedEmail || "No email"}). Task Message: "${message.slice(0, 150)}${message.length > 150 ? "..." : ""}"`,
      category: "TASK",
    });

    await saveDb(db);

    return NextResponse.json({
      success: true,
      memberName: resolvedName,
      phone: resolvedPhone,
      email: resolvedEmail,
      channels,
      whatsappUrl,
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
