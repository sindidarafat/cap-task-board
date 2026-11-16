"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { SafeUserAccount, TeamMember } from "@/lib/types";

interface SendReminderDropdownProps {
  member?: TeamMember;
  memberName: string;
  memberRole?: string;
  memberPhone?: string;
  memberEmail?: string;
  team?: TeamMember[];
  users?: SafeUserAccount[];
  isAdmin: boolean;
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
  onSuccess: (message: string) => void;
  defaultTaskDetails?: string;
}

export default function SendReminderDropdown({
  member,
  memberName,
  memberRole,
  memberPhone,
  memberEmail,
  team = [],
  users = [],
  isAdmin,
  apiFetch,
  onSuccess,
  defaultTaskDetails = "",
}: SendReminderDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [taskDetails, setTaskDetails] = useState(defaultTaskDetails);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Resolve recipient contact details from props, team list, or users list
  const resolvedInfo = useMemo(() => {
    const nameToMatch = member?.name || memberName || "";
    const tMember =
      member ||
      team.find(
        (m) =>
          m.name.toLowerCase() === nameToMatch.toLowerCase() ||
          m.aliases?.some((a) => a.toLowerCase() === nameToMatch.toLowerCase())
      );

    const uAccount = users.find(
      (u) =>
        (tMember && u.memberId === tMember.id) ||
        u.name.toLowerCase() === nameToMatch.toLowerCase() ||
        u.aliases?.some((a) => a.toLowerCase() === nameToMatch.toLowerCase())
    );

    const name = tMember?.name || uAccount?.name || nameToMatch;
    const role = memberRole || tMember?.role || uAccount?.teamRole || "Team Member";
    const phone = (memberPhone || tMember?.phone || uAccount?.phone || "").trim();
    const email = (memberEmail || tMember?.email || uAccount?.email || "").trim();

    return { name, role, phone, email, id: tMember?.id || uAccount?.id };
  }, [member, memberName, memberRole, memberPhone, memberEmail, team, users]);

  // Count words in taskDetails
  const wordCount = useMemo(() => {
    return taskDetails.trim() ? taskDetails.trim().split(/\s+/).filter(Boolean).length : 0;
  }, [taskDetails]);

  const isOverWordLimit = wordCount > 500;

  // Reset fields when opened
  useEffect(() => {
    if (isOpen) {
      setError("");
      if (defaultTaskDetails) {
        setTaskDetails(defaultTaskDetails);
      }
    }
  }, [isOpen, defaultTaskDetails]);

  // Only render button if the user is an admin
  if (!isAdmin) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!resolvedInfo.email) {
      setError(`No email address registered for ${resolvedInfo.name}. Please add their email in the roster or profile.`);
      return;
    }

    if (!taskDetails.trim()) {
      setError("Please enter the task details message.");
      return;
    }

    if (isOverWordLimit) {
      setError(`Your message is ${wordCount} words. The maximum allowed is 500 words.`);
      return;
    }

    setBusy(true);
    try {
      const data = await apiFetch("/api/reminders/send", {
        method: "POST",
        body: JSON.stringify({
          memberName: resolvedInfo.name,
          memberId: resolvedInfo.id,
          phone: resolvedInfo.phone,
          email: resolvedInfo.email,
          channels: ["email"],
          message: taskDetails.trim(),
        }),
      });

      if (data.directEmailSent) {
        onSuccess(`Direct reminder email successfully sent to ${resolvedInfo.name} (${resolvedInfo.email})!`);
      } else {
        if (data.mailtoUrl) {
          window.location.href = data.mailtoUrl;
          onSuccess(`Email draft opened (${data.emailError || "Direct sending unavailable"}).`);
        } else {
          onSuccess(`Reminder logged for ${resolvedInfo.name}.`);
        }
      }

      setIsOpen(false);
      setTaskDetails("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send reminder.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#cbd5e1] bg-white hover:bg-[#f0f4ff] hover:border-[#1f2d5a] text-[#1f2d5a] text-[11.5px] font-bold cursor-pointer transition-colors shadow-2xs shrink-0"
        title={`Send Email reminder to ${resolvedInfo.name}`}
      >
        <span>🔔</span>
        <span>Send Reminder</span>
        <span className="text-[9px] text-[#64748b]">▾</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl border border-[#dce1ec] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-[#1f2d5a] px-5 py-3.5 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔔</span>
                <div>
                  <h3 className="text-sm font-bold">Send Reminder: {resolvedInfo.name}</h3>
                  <p className="text-[11.5px] text-white/80">{resolvedInfo.role}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-white/70 hover:text-white text-base font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSend} className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {error && (
                <div className="p-2.5 rounded-lg bg-[#ffe1e5] border border-[#f5c2c7] text-[#9c0006] text-[12.5px] font-medium flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Recipient Information Card */}
              <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-lg p-3 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-[#1e40af] uppercase tracking-wide">
                    Delivery: Direct Email
                  </span>
                  <div className="text-[13px] font-semibold text-[#1e2330] mt-0.5">
                    {resolvedInfo.email ? (
                      <span className="font-mono-code">{resolvedInfo.email}</span>
                    ) : (
                      <span className="text-[#dc2626]">No email registered for {resolvedInfo.name}</span>
                    )}
                  </div>
                </div>
                <span className="text-[10.5px] font-bold bg-[#dbeafe] text-[#1d4ed8] px-2 py-0.5 rounded">
                  Resend
                </span>
              </div>

              {/* Task Details Section: Up to 500 words */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[12.5px] font-bold text-[#1f2d5a]">
                    Task Details & Instructions:
                  </label>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                      isOverWordLimit
                        ? "bg-[#ffe1e5] text-[#9c0006]"
                        : "bg-[#f1f5f9] text-[#475569]"
                    }`}
                  >
                    {wordCount} / 500 words
                  </span>
                </div>

                <textarea
                  rows={5}
                  required
                  value={taskDetails}
                  onChange={(e) => setTaskDetails(e.target.value)}
                  placeholder={`Hi ${resolvedInfo.name.split(" ")[0]}, please check the status of your assigned task, review the deliverables, and update the board...`}
                  className="w-full rounded-lg border border-[#ccd1de] p-2.5 text-[13px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a] resize-none"
                />

                <p className="text-[11px] text-[#64748b]">
                  The employee will receive this message directly in their registered email inbox via Resend.
                </p>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={busy}
                  className="px-3.5 py-1.5 rounded-lg border border-[#ccd1de] bg-white hover:bg-[#f8f9fc] text-[#475569] text-[12.5px] font-semibold cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !resolvedInfo.email || isOverWordLimit}
                  className="px-4 py-1.5 rounded-lg bg-[#e8792b] hover:bg-[#d76a1e] text-white text-[12.5px] font-bold cursor-pointer disabled:opacity-50 transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <span>{busy ? "Sending..." : "Send Reminder"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
