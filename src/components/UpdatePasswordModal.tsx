"use client";

import React, { useState } from "react";
import { SafeUserAccount } from "@/lib/types";

interface UpdatePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: SafeUserAccount;
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
  onSuccess: (message: string) => void;
  saveLocalPasswordHash: (email: string, hash: string) => void;
}

export default function UpdatePasswordModal({
  isOpen,
  onClose,
  currentUser,
  apiFetch,
  onSuccess,
  saveLocalPasswordHash,
}: UpdatePasswordModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [retypePassword, setRetypePassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!newPassword || newPassword.length < 4) {
      setError("New password must be at least 4 characters long.");
      return;
    }

    if (newPassword !== retypePassword) {
      setError("Passwords do not match. Please retype carefully.");
      return;
    }

    setBusy(true);
    try {
      const data = await apiFetch("/api/auth/update-password", {
        method: "POST",
        body: JSON.stringify({
          newPassword,
          userId: currentUser.id,
          email: currentUser.email,
        }),
      });

      if (data.passwordHash && currentUser.email) {
        saveLocalPasswordHash(currentUser.email, data.passwordHash);
      }

      onSuccess("Password updated successfully! Your new password has been saved.");
      setNewPassword("");
      setRetypePassword("");
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl border border-[#dce1ec] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-[#1f2d5a] px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🔒</span>
            <div>
              <h2 className="text-base font-bold">Update Password</h2>
              <p className="text-[12px] text-white/80">
                {currentUser.name} ({currentUser.email})
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-[#ffe1e5] border border-[#f5c2c7] text-[#9c0006] text-[13px] font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Minimum 4 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[14px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
              Retype New Password
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Confirm new password"
              value={retypePassword}
              onChange={(e) => setRetypePassword(e.target.value)}
              className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[14px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
            />
          </div>

          <div className="p-3 rounded-lg bg-[#f0f4ff] border border-[#d0dcf5] text-[12px] text-[#1f2d5a] space-y-1">
            <p className="font-semibold">Security Note</p>
            <p className="text-[#486581]">
              Your updated password is encrypted with bcrypt and saved persistently. You can sign in immediately using your new password.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
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
              className="px-4 py-2 rounded-lg bg-[#1f2d5a] hover:bg-[#2a3a6e] text-white text-[13px] font-semibold cursor-pointer disabled:opacity-50 transition-colors"
            >
              {busy ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
