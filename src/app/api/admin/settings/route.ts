import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isApprovedAdmin } from "@/lib/auth";
import { appendActivity, getDb, saveDb } from "@/lib/db";
import { getEmailConfig, sendEmail } from "@/lib/email";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!isApprovedAdmin(currentUser)) {
      return NextResponse.json(
        { error: "Forbidden: Only approved Administrators can view settings." },
        { status: 403 }
      );
    }

    const config = await getEmailConfig();
    const envKey = (process.env.RESEND_API_KEY || "").trim();
    const db = await getDb();
    const dbKey = (db.settings?.resendApiKey || "").trim();

    // Mask key for safety (e.g., re_123***89)
    let maskedKey = "";
    if (config.apiKey) {
      if (config.apiKey.length > 8) {
        maskedKey = `${config.apiKey.slice(0, 5)}••••••••${config.apiKey.slice(-4)}`;
      } else {
        maskedKey = "••••••••";
      }
    }

    return NextResponse.json({
      isConfigured: config.isConfigured,
      hasEnvKey: Boolean(envKey),
      hasDbKey: Boolean(dbKey),
      maskedApiKey: maskedKey,
      fromEmail: config.fromEmail,
    });
  } catch (err) {
    console.error("GET admin settings error:", err);
    return NextResponse.json(
      { error: "Internal server error fetching settings." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!isApprovedAdmin(currentUser)) {
      return NextResponse.json(
        { error: "Forbidden: Only approved Administrators can change settings." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = (body.action || "update_settings").trim();

    const db = await getDb();
    if (!db.settings) {
      db.settings = {
        resendApiKey: "",
        resendFromEmail: "CAP Task Board <onboarding@resend.dev>",
      };
    }

    if (action === "update_settings") {
      const resendApiKey = typeof body.resendApiKey === "string" ? body.resendApiKey.trim() : undefined;
      const resendFromEmail = typeof body.resendFromEmail === "string" ? body.resendFromEmail.trim() : undefined;

      if (resendApiKey !== undefined) {
        db.settings.resendApiKey = resendApiKey;
      }
      if (resendFromEmail !== undefined && resendFromEmail.length > 0) {
        db.settings.resendFromEmail = resendFromEmail;
      }

      appendActivity(db, {
        actorName: currentUser!.name,
        actorEmail: currentUser!.email,
        action: "Updated Resend Email Configuration",
        details: `${currentUser!.name} updated email settings. Sender: "${db.settings.resendFromEmail}", API key updated: ${resendApiKey !== undefined ? "Yes" : "No"}.`,
        category: "ADMIN_ROOM",
      });

      await saveDb(db);

      const config = await getEmailConfig();
      let maskedKey = "";
      if (config.apiKey) {
        maskedKey =
          config.apiKey.length > 8
            ? `${config.apiKey.slice(0, 5)}••••••••${config.apiKey.slice(-4)}`
            : "••••••••";
      }

      return NextResponse.json({
        success: true,
        message: "Email settings saved successfully.",
        isConfigured: config.isConfigured,
        maskedApiKey: maskedKey,
        fromEmail: config.fromEmail,
      });
    }

    if (action === "test_email") {
      const targetEmail = (body.testEmail || currentUser!.email || "").trim();
      if (!targetEmail) {
        return NextResponse.json(
          { error: "Target email address is required for test email." },
          { status: 400 }
        );
      }

      const config = await getEmailConfig();
      if (!config.apiKey) {
        return NextResponse.json(
          {
            error:
              "Resend API Key is missing. Please save your API key first or add RESEND_API_KEY to Vercel.",
          },
          { status: 400 }
        );
      }

      const testResult = await sendEmail({
        to: targetEmail,
        subject: `[CAP Task Board] Resend Test Email Connection Verified`,
        html: `
<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
  <h2 style="color: #1f2d5a; margin-top: 0;">🎉 Resend Email Connection Verified!</h2>
  <p>Hello <strong>${currentUser!.name}</strong>,</p>
  <p>This is a confirmation that your <strong>CAP Task Board</strong> email sending service is properly configured with Resend and ready to deliver task reminders.</p>
  <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 12px; margin: 16px 0; color: #166534; font-size: 13px;">
    <strong>Sender Address:</strong> ${config.fromEmail}<br/>
    <strong>Recipient:</strong> ${targetEmail}<br/>
    <strong>Status:</strong> Active & Ready
  </div>
  <p style="font-size: 12px; color: #64748b;">CAP Task Board &bull; Automated System Verification</p>
</div>
`,
        text: `Hello ${currentUser!.name},\n\nYour CAP Task Board email service is properly configured with Resend! Sender: ${config.fromEmail}.`,
      });

      if (!testResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: testResult.error || "Failed to send test email.",
          },
          { status: 400 }
        );
      }

      appendActivity(db, {
        actorName: currentUser!.name,
        actorEmail: currentUser!.email,
        action: "Sent Test Email",
        details: `${currentUser!.name} sent a verification test email to ${targetEmail} (ID: ${testResult.messageId}).`,
        category: "ADMIN_ROOM",
      });
      await saveDb(db);

      return NextResponse.json({
        success: true,
        messageId: testResult.messageId,
        message: `Test email sent successfully to ${targetEmail}! Check your inbox.`,
      });
    }

    return NextResponse.json(
      { error: "Unknown action." },
      { status: 400 }
    );
  } catch (err) {
    console.error("POST admin settings error:", err);
    return NextResponse.json(
      { error: "Internal server error while saving settings." },
      { status: 500 }
    );
  }
}
