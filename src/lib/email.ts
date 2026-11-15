import { Resend } from "resend";
import { getDb } from "./db";

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Resolve the Resend API Key and From Email from environment or database settings.
 */
export async function getEmailConfig(): Promise<{
  apiKey: string;
  fromEmail: string;
  isConfigured: boolean;
}> {
  const envKey = (process.env.RESEND_API_KEY || "").trim();
  const envFrom = (process.env.RESEND_FROM_EMAIL || "").trim();

  let dbKey = "";
  let dbFrom = "";
  try {
    const db = await getDb();
    dbKey = (db.settings?.resendApiKey || "").trim();
    dbFrom = (db.settings?.resendFromEmail || "").trim();
  } catch {
    // ignore db read failure
  }

  const apiKey = envKey || dbKey;
  const fromEmail =
    envFrom || dbFrom || "CAP Task Board <onboarding@resend.dev>";

  return {
    apiKey,
    fromEmail,
    isConfigured: Boolean(apiKey),
  };
}

/**
 * Send an email directly in the background using Resend.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<EmailResult> {
  try {
    const config = await getEmailConfig();
    if (!config.apiKey) {
      return {
        success: false,
        error:
          "Resend API Key is not configured. Please add RESEND_API_KEY to your environment variables or in Admin Room > Email Settings.",
      };
    }

    const resend = new Resend(config.apiKey);
    const toList = Array.isArray(to) ? to : [to];

    const { data, error } = await resend.emails.send({
      from: config.fromEmail,
      to: toList,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    });

    if (error) {
      console.error("Resend send error:", error);
      return {
        success: false,
        error: error.message || "Failed to deliver email through Resend.",
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Unexpected error sending email.";
    console.error("sendEmail exception:", err);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Send a formatted Task Reminder email to an employee.
 */
export async function sendReminderEmail({
  to,
  recipientName,
  senderName,
  message,
  siteUrl = "https://captaskboardamt.vercel.app",
}: {
  to: string;
  recipientName: string;
  senderName: string;
  message: string;
  siteUrl?: string;
}): Promise<EmailResult> {
  const subject = `[CAP Task Board] Task Reminder for ${recipientName} from ${senderName}`;

  // Format message lines into paragraphs or line breaks
  const escapedMessage = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
    .header { background-color: #1f2d5a; padding: 24px 30px; text-align: left; }
    .header h1 { margin: 0; font-size: 20px; color: #ffffff; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 4px 0 0; font-size: 13px; color: #cbd5e1; }
    .badge { display: inline-block; background: #e8792b; color: #ffffff; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; margin-bottom: 8px; }
    .body { padding: 30px; }
    .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 16px; }
    .meta-box { background-color: #f8fafc; border-left: 4px solid #1f2d5a; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 20px; font-size: 13px; color: #475569; }
    .meta-box strong { color: #1e293b; }
    .message-card { background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px; font-size: 14.5px; line-height: 1.6; color: #1e293b; white-space: normal; }
    .btn-container { text-align: center; margin: 28px 0 10px; }
    .btn { display: inline-block; background-color: #1f2d5a; color: #ffffff !important; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 6px; box-shadow: 0 2px 6px rgba(31,45,90,0.25); }
    .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 30px; text-align: center; font-size: 12px; color: #64748b; }
    .footer a { color: #1f2d5a; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">Official Notification</div>
      <h1>CAP Task Board</h1>
      <p>Direct Task Reminder from Management</p>
    </div>
    <div class="body">
      <div class="greeting">Hi ${recipientName},</div>
      <div class="meta-box">
        <div><strong>Sender:</strong> ${senderName} (Administrator)</div>
        <div><strong>Channel:</strong> Direct Email Notification</div>
        <div><strong>Recipient:</strong> ${recipientName} (${to})</div>
      </div>
      <div style="font-size: 13px; font-weight: 700; color: #1f2d5a; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
        Task Details & Instructions:
      </div>
      <div class="message-card">
        ${escapedMessage}
      </div>
      <div class="btn-container">
        <a href="${siteUrl}" class="btn" target="_blank" rel="noopener noreferrer">
          Open CAP Task Board &rarr;
        </a>
      </div>
    </div>
    <div class="footer">
      This is an official task reminder sent from the <strong>CAP Task Board</strong> platform.<br/>
      If you have questions, please reach out directly to ${senderName}.
    </div>
  </div>
</body>
</html>
`;

  return sendEmail({
    to,
    subject,
    html,
    text: `Hi ${recipientName},\n\nYou have received a task reminder from ${senderName} on CAP Task Board:\n\n${message}\n\nOpen Task Board: ${siteUrl}`,
  });
}

/**
 * Send a Password Reset email with the issued temporary password.
 */
export async function sendPasswordResetEmail({
  to,
  recipientName,
  tempPassword,
  siteUrl = "https://captaskboardamt.vercel.app",
}: {
  to: string;
  recipientName: string;
  tempPassword: string;
  siteUrl?: string;
}): Promise<EmailResult> {
  const subject = `[CAP Task Board] Your Temporary Password Reset`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
    .header { background-color: #1f2d5a; padding: 22px 28px; text-align: left; }
    .header h1 { margin: 0; font-size: 19px; color: #ffffff; font-weight: 700; }
    .body { padding: 28px; }
    .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
    .desc { font-size: 14px; line-height: 1.5; color: #475569; margin-bottom: 20px; }
    .pwd-box { background: #f0fdf4; border: 2px dashed #86efac; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 20px; }
    .pwd-label { font-size: 11.5px; font-weight: 700; color: #166534; text-transform: uppercase; margin-bottom: 6px; }
    .pwd-code { font-family: monospace; font-size: 22px; font-weight: 700; color: #15803d; letter-spacing: 2px; }
    .instructions { background: #f8fafc; border-radius: 8px; padding: 14px; font-size: 12.5px; line-height: 1.5; color: #475569; margin-bottom: 24px; border: 1px solid #e2e8f0; }
    .btn-container { text-align: center; margin-bottom: 10px; }
    .btn { display: inline-block; background-color: #e8792b; color: #ffffff !important; font-size: 14px; font-weight: 700; text-decoration: none; padding: 11px 26px; border-radius: 6px; }
    .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center; font-size: 11.5px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CAP Task Board</h1>
    </div>
    <div class="body">
      <div class="greeting">Hi ${recipientName},</div>
      <div class="desc">
        A temporary password has been generated for your CAP Task Board account (${to}).
      </div>
      <div class="pwd-box">
        <div class="pwd-label">Your Temporary Password</div>
        <div class="pwd-code">${tempPassword}</div>
      </div>
      <div class="instructions">
        <strong>Next steps:</strong>
        <ol style="margin: 6px 0 0 18px; padding: 0;">
          <li>Sign in using your email and this temporary password.</li>
          <li>Click the <strong>Update Info</strong> button in the top navigation bar.</li>
          <li>Set a new permanent password of your choice and save.</li>
        </ol>
      </div>
      <div class="btn-container">
        <a href="${siteUrl}" class="btn" target="_blank" rel="noopener noreferrer">
          Sign In Now &rarr;
        </a>
      </div>
    </div>
    <div class="footer">
      If you did not request this temporary password, please inform an administrator immediately.
    </div>
  </div>
</body>
</html>
`;

  return sendEmail({
    to,
    subject,
    html,
    text: `Hi ${recipientName},\n\nYour temporary password for CAP Task Board is: ${tempPassword}\n\nSign in at: ${siteUrl}\nAfter signing in, click 'Update Info' to set your permanent password.`,
  });
}
