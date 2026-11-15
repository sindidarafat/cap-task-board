"use client";

import React, { useEffect, useState } from "react";
import { ActivityLogEntry, SafeUserAccount, TeamMember } from "@/lib/types";

interface AdminRoomViewProps {
  currentUser: SafeUserAccount;
  isAdmin: boolean;
  users: SafeUserAccount[];
  team?: TeamMember[];
  memberIdMap?: Record<string, string>;
  activityLog: ActivityLogEntry[];
  onAdminAction: (payload: Record<string, unknown>) => Promise<void>;
  onRequestAdminAccess: () => Promise<void>;
  apiFetch?: (url: string, options?: RequestInit) => Promise<any>;
}

export default function AdminRoomView({
  currentUser,
  isAdmin,
  users,
  team = [],
  memberIdMap = {},
  activityLog,
  onAdminAction,
  onRequestAdminAccess,
  apiFetch,
}: AdminRoomViewProps) {
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newTeamRole, setNewTeamRole] = useState("");
  const [newAccountRole, setNewAccountRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  // Email & Resend settings state
  const [emailConfig, setEmailConfig] = useState<{
    isConfigured: boolean;
    maskedApiKey: string;
    fromEmail: string;
    hasEnvKey: boolean;
    hasDbKey: boolean;
  } | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [fromEmailInput, setFromEmailInput] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchSettings = async () => {
      try {
        const fetcher = apiFetch || ((url: string) => fetch(url).then((r) => r.json()));
        const data = await fetcher("/api/admin/settings");
        if (data) {
          setEmailConfig(data);
          setFromEmailInput(data.fromEmail || "CAP Task Board <onboarding@resend.dev>");
        }
      } catch {
        // ignore fetch error
      }
    };
    fetchSettings();
  }, [isAdmin, apiFetch]);

  const handleSaveEmailSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setFeedback(null);
    try {
      const fetcher =
        apiFetch ||
        ((url: string, opts: any) =>
          fetch(url, opts).then(async (r) => {
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Request failed");
            return data;
          }));
      const data = await fetcher("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({
          action: "update_settings",
          resendApiKey: apiKeyInput.trim() || undefined,
          resendFromEmail: fromEmailInput.trim() || undefined,
        }),
      });
      setEmailConfig({
        isConfigured: data.isConfigured,
        maskedApiKey: data.maskedApiKey,
        fromEmail: data.fromEmail,
        hasEnvKey: emailConfig?.hasEnvKey || false,
        hasDbKey: true,
      });
      setApiKeyInput("");
      setFeedback({
        type: "success",
        text: "Email settings saved successfully! Direct background reminders are ready to send.",
      });
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save settings.",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendTestEmail = async () => {
    setTestingEmail(true);
    setFeedback(null);
    try {
      const fetcher =
        apiFetch ||
        ((url: string, opts: any) =>
          fetch(url, opts).then(async (r) => {
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Request failed");
            return data;
          }));
      const data = await fetcher("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({
          action: "test_email",
          testEmail: currentUser.email,
        }),
      });
      setFeedback({
        type: "success",
        text: data.message || `Test email dispatched to ${currentUser.email}!`,
      });
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to send test email.",
      });
    } finally {
      setTestingEmail(false);
    }
  };

  const approvedAdmins = users.filter(
    (u) => u.role === "ADMIN" && u.adminRequestStatus === "APPROVED"
  );
  const pendingRequests = users.filter((u) => u.adminRequestStatus === "PENDING");
  const memberAccounts = users.filter(
    (u) => !(u.role === "ADMIN" && u.adminRequestStatus === "APPROVED")
  );

  const filteredMembers = memberAccounts.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.teamRole.toLowerCase().includes(search.toLowerCase())
  );

  const runAction = async (key: string, payload: Record<string, unknown>, successMsg: string) => {
    setBusyId(key);
    setFeedback(null);
    try {
      await onAdminAction(payload);
      setFeedback({ type: "success", text: successMsg });
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Operation failed.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyId("create");
    setFeedback(null);
    try {
      await onAdminAction({
        action: "create_user",
        name: newName,
        email: newEmail,
        password: newPassword || "cap123",
        teamRole: newTeamRole || (newAccountRole === "ADMIN" ? "Admin" : "Member"),
        role: newAccountRole,
        memberId:
          selectedTeamMemberId && selectedTeamMemberId !== "custom"
            ? selectedTeamMemberId
            : undefined,
      });
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewTeamRole("");
      setSelectedTeamMemberId("");
      setShowCreateModal(false);
      setFeedback({
        type: "success",
        text: `Added ${newName} as ${newAccountRole === "ADMIN" ? "an Admin" : "a Member"}.`,
      });
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to create account.",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#dce1ec] pb-5">
        <div>
          <h2 className="text-lg font-bold text-[#1f2d5a]">
            Accounts & Permissions
          </h2>
          <p className="text-[13px] text-[#3b4254] mt-0.5">
            Admins have full edit access and approve new Admin accounts. Members have read-only access.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin ? (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-lg bg-[#e8792b] hover:bg-[#d76a1e] text-white font-semibold text-[13px] transition-colors cursor-pointer"
            >
              + Add account
            </button>
          ) : currentUser.adminRequestStatus === "PENDING" ? (
            <span className="px-3.5 py-1.5 rounded-lg bg-[#ffd8b0] text-[#8a4500] text-[13px] font-semibold">
              Admin request pending approval
            </span>
          ) : (
            <button
              type="button"
              onClick={onRequestAdminAccess}
              className="px-4 py-2 rounded-lg border border-[#1f2d5a] bg-white hover:bg-[#e8ecf6] text-[#1f2d5a] font-semibold text-[13px] transition-colors cursor-pointer"
            >
              Request admin access
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`px-4 py-3 rounded-lg border text-[13px] font-medium flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-[#e8ecf6] border-[#c5d0ea] text-[#1f2d5a]"
              : "bg-[#ffe1e5] border-[#f5c2c7] text-[#9c0006]"
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="font-semibold hover:underline ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Pending Admin Approval Queue */}
      {pendingRequests.length > 0 && (
        <div className="bg-white rounded-lg border border-[#dce1ec] border-t-[3px] border-t-[#e8792b] shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 bg-[#fdf3ea] border-b border-[#f5d0b5] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#e8792b]" />
              <h3 className="text-[13.5px] font-bold text-[#1f2d5a]">
                Pending Admin Requests ({pendingRequests.length})
              </h3>
            </div>
            <span className="text-[12.5px] font-medium text-[#8a4500]">
              Requires approval from an existing Admin
            </span>
          </div>

          <div className="divide-y divide-[#e3e6ee]">
            {pendingRequests.map((reqUser) => (
              <div
                key={reqUser.id}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-[#1e2330]">
                      {reqUser.name}
                    </span>
                    <span className="text-[12.5px] font-medium text-[#2d3446]">
                      · {reqUser.teamRole}
                    </span>
                  </div>
                  <div className="text-[12.5px] text-[#3b4254] mt-0.5">
                    {reqUser.email}
                    {reqUser.requestedAt && (
                      <span className="ml-2">
                        · Requested {new Date(reqUser.requestedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {isAdmin ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busyId === reqUser.id}
                      onClick={() =>
                        runAction(
                          reqUser.id,
                          { action: "approve_admin", userId: reqUser.id },
                          `Approved ${reqUser.name} as an Admin.`
                        )
                      }
                      className="px-3.5 py-1.5 rounded-lg bg-[#1f2d5a] hover:bg-[#2a3a6e] text-white text-[13px] font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === reqUser.id}
                      onClick={() =>
                        runAction(
                          reqUser.id,
                          { action: "reject_admin", userId: reqUser.id },
                          `Declined Admin request for ${reqUser.name}.`
                        )
                      }
                      className="px-3.5 py-1.5 rounded-lg border border-[#ccd1de] hover:border-[#9c0006] text-[#9c0006] text-[13px] font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <span className="text-[12.5px] font-medium text-[#8a4500]">
                    Waiting for an Admin to approve
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Admins + Members */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Admins List */}
        <div className="lg:col-span-5 bg-white rounded-lg border border-[#dce1ec] shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 bg-[#1f2d5a] text-white flex items-center justify-between">
            <h3 className="text-[13.5px] font-semibold">
              Admin Room ({approvedAdmins.length})
            </h3>
            <span className="text-[12px] text-white/80 font-medium">
              Full edit & approval rights
            </span>
          </div>

          <div className="divide-y divide-[#e3e6ee]">
            {approvedAdmins.map((admin) => (
              <div
                key={admin.id}
                className="px-5 py-3.5 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-[#1e2330]">
                      {admin.name}
                    </span>
                    {admin.id === currentUser.id && (
                      <span className="text-[11.5px] font-semibold text-[#e8792b]">
                        (you)
                      </span>
                    )}
                  </div>
                  <div className="text-[12.5px] text-[#2d3446] mt-0.5">
                    {admin.teamRole} · {admin.email}
                  </div>
                  {admin.approvedBy && (
                    <div className="text-[12px] text-[#3b4254] mt-0.5">
                      Approved by {admin.approvedBy}
                    </div>
                  )}
                </div>

                {isAdmin && approvedAdmins.length > 1 && (
                  <button
                    type="button"
                    disabled={busyId === admin.id}
                    onClick={() =>
                      runAction(
                        admin.id,
                        { action: "demote_to_member", userId: admin.id },
                        `Changed ${admin.name} to Member.`
                      )
                    }
                    className="text-[12.5px] font-semibold text-[#1f2d5a] hover:text-[#e8792b] px-3 py-1 rounded-md border border-[#ccd1de] hover:border-[#1f2d5a] transition-colors cursor-pointer"
                  >
                    Set as member
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Members List */}
        <div className="lg:col-span-7 bg-white rounded-lg border border-[#dce1ec] shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-3 bg-[#1f2d5a] text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-[13.5px] font-semibold">
                Members ({memberAccounts.length})
              </h3>
            </div>
            <input
              type="text"
              placeholder="Filter members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-md border border-white/25 bg-white/15 px-3 py-1 text-[12.5px] text-white placeholder:text-white/70 focus:outline-none focus:bg-white focus:text-[#1e2330] w-full sm:w-52"
            />
          </div>

          <div className="divide-y divide-[#e3e6ee]">
            {filteredMembers.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-[#3b4254]">
                No member accounts found.
              </div>
            ) : (
              filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-[#1e2330]">
                        {member.name}
                      </span>
                      {member.id === currentUser.id && (
                        <span className="text-[11.5px] font-semibold text-[#e8792b]">
                          (you)
                        </span>
                      )}
                      {member.adminRequestStatus === "PENDING" && (
                        <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full bg-[#ffd8b0] text-[#8a4500]">
                          Pending Admin
                        </span>
                      )}
                    </div>
                    <div className="text-[12.5px] text-[#2d3446] mt-0.5">
                      {member.teamRole} · {member.email}
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        disabled={busyId === member.id}
                        onClick={() =>
                          runAction(
                            member.id,
                            { action: "promote_to_admin", userId: member.id },
                            `Approved ${member.name} as an Admin.`
                          )
                        }
                        className="px-3 py-1 rounded-md border border-[#ccd1de] hover:border-[#1f2d5a] text-[#1f2d5a] text-[12.5px] font-semibold cursor-pointer"
                      >
                        Make admin
                      </button>
                      {member.id !== currentUser.id && (
                        <button
                          type="button"
                          disabled={busyId === member.id}
                          onClick={() =>
                            runAction(
                              member.id,
                              { action: "delete_user", userId: member.id },
                              `Removed ${member.name}.`
                            )
                          }
                          className="px-2 py-1 text-[#9c0006] hover:underline text-[12.5px] font-semibold cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Email & Resend Notification Settings */}
      {isAdmin && (
        <div className="bg-white rounded-lg border border-[#dce1ec] shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 bg-[#1f2d5a] text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-base">✉️</span>
              <div>
                <h3 className="text-[13.5px] font-bold">
                  Direct Email Dispatch & Settings (Resend Integration)
                </h3>
                <p className="text-[11.5px] text-white/80">
                  Sends official task reminders and password resets directly in the background (Free Tier: 3,000 emails/month).
                </p>
              </div>
            </div>
            <div>
              {emailConfig?.isConfigured ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-bold bg-[#dcfce7] text-[#15803d]">
                  <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse" />
                  Active & Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-bold bg-[#fef3c7] text-[#92400e]">
                  <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                  Configuration Needed
                </span>
              )}
            </div>
          </div>

          <form onSubmit={handleSaveEmailSettings} className="p-5 space-y-4 bg-[#fbfcfe]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12.5px] font-bold text-[#1f2d5a] mb-1">
                  Resend API Key {emailConfig?.maskedApiKey && `(Current: ${emailConfig.maskedApiKey})`}
                </label>
                <input
                  type="password"
                  placeholder={
                    emailConfig?.maskedApiKey || "Paste your Resend API key: re_..."
                  }
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[13px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a] bg-white font-mono-code"
                />
                <p className="text-[11px] text-[#64748b] mt-1">
                  Free key from{" "}
                  <a
                    href="https://resend.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1f2d5a] underline font-semibold"
                  >
                    resend.com
                  </a>
                  . You can also define <code className="bg-[#e2e8f0] px-1 py-0.5 rounded">RESEND_API_KEY</code> in Vercel.
                </p>
              </div>

              <div>
                <label className="block text-[12.5px] font-bold text-[#1f2d5a] mb-1">
                  From / Sender Email
                </label>
                <input
                  type="text"
                  placeholder="CAP Task Board <onboarding@resend.dev>"
                  value={fromEmailInput}
                  onChange={(e) => setFromEmailInput(e.target.value)}
                  className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[13px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a] bg-white"
                />
                <p className="text-[11px] text-[#64748b] mt-1">
                  Keep <code className="bg-[#e2e8f0] px-1 py-0.5 rounded">onboarding@resend.dev</code> for testing, or use your verified domain address (e.g. <code className="bg-[#e2e8f0] px-1 py-0.5 rounded">CAP &lt;reminders@cap.direct&gt;</code>).
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#e2e8f0]">
              <div className="text-[12px] text-[#475569]">
                {emailConfig?.hasEnvKey ? (
                  <span className="text-[#166534] font-medium">
                    ✓ Environment variable <code className="bg-[#dcfce7] px-1 py-0.5 rounded">RESEND_API_KEY</code> detected.
                  </span>
                ) : (
                  <span>
                    No server environment key detected; saved key in database will be used.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={testingEmail || !emailConfig?.isConfigured}
                  className="px-3.5 py-1.5 rounded-lg border border-[#cbd5e1] hover:bg-[#f1f5f9] text-[#1f2d5a] text-[12.5px] font-bold cursor-pointer disabled:opacity-40 transition-colors"
                >
                  {testingEmail ? "Sending test..." : `Send Test Email to ${currentUser.email.split("@")[0]}`}
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-4 py-1.5 rounded-lg bg-[#1f2d5a] hover:bg-[#2a3a6e] text-white text-[12.5px] font-bold cursor-pointer disabled:opacity-50 transition-colors shadow-2xs"
                >
                  {savingSettings ? "Saving..." : "Save Email Settings"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Activity Log */}
      <div className="bg-white rounded-lg border border-[#dce1ec] shadow-xs overflow-hidden">
        <div className="px-5 py-3 bg-[#e8ecf6] border-b border-[#dce1ec]">
          <h3 className="text-[13px] font-bold text-[#1f2d5a]">
            Activity log
          </h3>
        </div>
        <div className="divide-y divide-[#e3e6ee] max-h-60 overflow-y-auto">
          {activityLog.slice(0, 20).map((item) => (
            <div
              key={item.id}
              className="px-5 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[13px]"
            >
              <div>
                <span className="font-semibold text-[#1f2d5a]">{item.action}</span>
                <span className="text-[#2d3446] ml-1.5">— {item.details}</span>
              </div>
              <div className="text-[#3b4254] font-medium whitespace-nowrap">
                {item.actorName} · {new Date(item.timestamp).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-[#dce1ec] border-t-4 border-t-[#e8792b] w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-[#dce1ec] flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-[#1f2d5a]">
                Add account
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-[#3b4254] hover:text-[#1e2330] text-[13px] font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleCreateAccount} className="p-5 space-y-4">
              {team.length > 0 && (
                <div>
                  <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                    Select team member (from Excel roster)
                  </label>
                  <select
                    value={selectedTeamMemberId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedTeamMemberId(val);
                      if (val && val !== "custom") {
                        const found = team.find((m) => m.id === val);
                        if (found) {
                          setNewName(found.name);
                          setNewTeamRole(found.role);
                          if (!newEmail) {
                            const first = found.name.split(" ")[0].toLowerCase();
                            setNewEmail(`${first}@cap.com`);
                          }
                        }
                      }
                    }}
                    className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[13.5px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a] bg-white"
                  >
                    <option value="">— Choose from roster (or enter manually) —</option>
                    {team.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.role}
                      </option>
                    ))}
                    <option value="custom">+ New Member / Not listed</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                  Full name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajat Tanmay"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[14px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="rajat@cap.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[14px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                  Password *
                </label>
                <input
                  type="text"
                  required
                  placeholder="cap123"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[14px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                  Role / title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Servicing Lead"
                  value={newTeamRole}
                  onChange={(e) => setNewTeamRole(e.target.value)}
                  className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[14px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                  Permission level
                </label>
                <select
                  value={newAccountRole}
                  onChange={(e) =>
                    setNewAccountRole(e.target.value as "MEMBER" | "ADMIN")
                  }
                  className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[13.5px] font-medium text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                >
                  <option value="MEMBER">Member (view only)</option>
                  <option value="ADMIN">Admin (can edit & approve)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 rounded-lg border border-[#ccd1de] text-[13px] font-semibold text-[#3b4254] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyId === "create"}
                  className="px-4 py-2 rounded-lg bg-[#1f2d5a] text-white text-[13px] font-semibold hover:bg-[#2a3a6e] cursor-pointer"
                >
                  Create account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
