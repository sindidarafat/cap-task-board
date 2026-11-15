"use client";

import React, { useEffect, useState } from "react";
import { SafeUserAccount } from "@/lib/types";

interface UpdateInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: SafeUserAccount;
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
  onSuccess: (message: string) => void;
  saveLocalPasswordHash: (email: string, hash: string) => void;
  saveLocalUserRecord: (userRecord: Record<string, unknown>) => void;
  setCurrentUser: (user: SafeUserAccount) => void;
  fetchBoard: () => Promise<void>;
}

export default function UpdateInfoModal({
  isOpen,
  onClose,
  currentUser,
  apiFetch,
  onSuccess,
  saveLocalPasswordHash,
  saveLocalUserRecord,
  setCurrentUser,
  fetchBoard,
}: UpdateInfoModalProps) {
  const [name, setName] = useState(currentUser.name || "");
  const [email, setEmail] = useState(currentUser.email || "");
  const [phone, setPhone] = useState(currentUser.phone || "");
  const [designation, setDesignation] = useState(currentUser.teamRole || "");
  const [password, setPassword] = useState("");
  const [retypePassword, setRetypePassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Sync state whenever modal opens or currentUser changes
  useEffect(() => {
    if (isOpen) {
      setName(currentUser.name || "");
      setEmail(currentUser.email || "");
      setPhone(currentUser.phone || "");
      setDesignation(currentUser.teamRole || "");
      setPassword("");
      setRetypePassword("");
      setError("");
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    if (!email.trim()) {
      setError("Email address is required.");
      return;
    }

    if (password) {
      if (password.length < 4) {
        setError("New password must be at least 4 characters long.");
        return;
      }
      if (password !== retypePassword) {
        setError("New passwords do not match. Please retype carefully.");
        return;
      }
    }

    setBusy(true);
    try {
      const data = await apiFetch("/api/auth/update-info", {
        method: "POST",
        body: JSON.stringify({
          userId: currentUser.id,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          designation: designation.trim(),
          password: password ? password.trim() : undefined,
        }),
      });

      if (data.user) {
        setCurrentUser(data.user);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("cap_current_user", JSON.stringify(data.user));
          window.localStorage.setItem("cap_saved_email", data.user.email);
        }
      }

      if (data.passwordHash && data.user?.email) {
        saveLocalPasswordHash(data.user.email, data.passwordHash);
      }

      if (data.userRecord) {
        saveLocalUserRecord(data.userRecord);
      }

      await fetchBoard();

      onSuccess("Your information has been saved successfully!");
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update information.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl border border-[#dce1ec] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-[#1f2d5a] px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">👤</span>
            <div>
              <h2 className="text-base font-bold">Update Profile & Info</h2>
              <p className="text-[12px] text-white/80">
                Update your personal details, contact number, and credentials
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white text-lg font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-[#ffe1e5] border border-[#f5c2c7] text-[#9c0006] text-[13px] font-medium flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                Full Name <span className="text-[#e8792b]">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[13.5px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                Designation / Title
              </label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Sr. Visualizer"
                className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[13.5px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                Email Address <span className="text-[#e8792b]">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@cap.direct"
                className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[13.5px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+8801700000000"
                className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[13.5px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-[#e8ecf6]">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[13px] font-bold text-[#1f2d5a]">
                Password
              </label>
              <span className="text-[11.5px] text-[#6b7280]">
                (Leave blank to keep your current password)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-medium text-[#4b5563] mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Min 4 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[13.5px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#4b5563] mb-1">
                  Retype New Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Confirm password"
                  value={retypePassword}
                  onChange={(e) => setRetypePassword(e.target.value)}
                  className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[13.5px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                />
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#f0f4ff] border border-[#d0dcf5] text-[12px] text-[#1f2d5a] space-y-1">
            <p className="font-semibold">Auto-Sync Note</p>
            <p className="text-[#486581]">
              Saving will immediately update your profile in the team roster, dashboard header, and database.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 rounded-lg border border-[#ccd1de] bg-white hover:bg-[#f8f9fc] text-[#3b4254] text-[13px] font-semibold cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 rounded-lg bg-[#1f2d5a] hover:bg-[#2a3a6e] text-white text-[13px] font-bold cursor-pointer disabled:opacity-50 transition-colors shadow-xs"
            >
              {busy ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
