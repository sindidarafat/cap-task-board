"use client";

import React, { useState } from "react";
import { ClientRecord, Priority, TaskRecord, TaskStatus, TeamMember } from "@/lib/types";

const STATUS_OPTIONS: TaskStatus[] = [
  "Not started",
  "In progress",
  "Internal review",
  "Client review",
  "Revisions",
  "Done",
  "On hold",
];

const PRIORITY_OPTIONS: Priority[] = ["High", "Medium", "Low", ""];

interface TaskFormModalProps {
  initialTask?: TaskRecord | null;
  clients: ClientRecord[];
  team: TeamMember[];
  referenceDate: string;
  onClose: () => void;
  onSave: (taskData: Partial<TaskRecord>) => Promise<void>;
}

export default function TaskFormModal({
  initialTask,
  clients,
  team,
  referenceDate,
  onClose,
  onSave,
}: TaskFormModalProps) {
  const isEditing = Boolean(initialTask);

  const [formData, setFormData] = useState<Partial<TaskRecord>>({
    id: initialTask?.id || "",
    dateAdded: initialTask?.dateAdded || referenceDate,
    client: initialTask?.client || (clients[0]?.name ?? ""),
    workType: initialTask?.workType || (clients[0]?.type ?? "Client"),
    task: initialTask?.task || "",
    brief: initialTask?.brief || "",
    owner: initialTask?.owner || "",
    team: initialTask?.team || "",
    reviewer: initialTask?.reviewer || "",
    priority: initialTask?.priority ?? "High",
    startDate: initialTask?.startDate || referenceDate,
    internalDeadline: initialTask?.internalDeadline || "",
    clientDeadline: initialTask?.clientDeadline || "",
    estHours: initialTask?.estHours ?? null,
    status: initialTask?.status || "Not started",
    blockedBy: initialTask?.blockedBy || "",
    blockedSince: initialTask?.blockedSince || "",
    deliveredOn: initialTask?.deliveredOn || "",
    completedOn: initialTask?.completedOn || "",
    actualHours: initialTask?.actualHours ?? null,
    revisions: initialTask?.revisions ?? null,
    firstRoundApproved: initialTask?.firstRoundApproved || "",
    notes: initialTask?.notes || "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleClientChange = (clientName: string) => {
    const matched = clients.find(
      (c) => c.name.trim().toLowerCase() === clientName.trim().toLowerCase()
    );
    setFormData((prev) => ({
      ...prev,
      client: clientName,
      workType: matched ? matched.type : prev.workType,
    }));
  };

  const handleOwnerChange = (ownerName: string) => {
    const matched = team.find(
      (m) => m.name.trim().toLowerCase() === ownerName.trim().toLowerCase()
    );
    setFormData((prev) => ({
      ...prev,
      owner: ownerName,
      team: matched ? matched.team : prev.team,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.task || !formData.task.trim()) {
      setError("Task title is required.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save task.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-[#ccd1de] bg-white px-3 py-2 text-[13.5px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a] transition-colors";
  const labelClass = "block text-[12.5px] font-semibold text-[#1f2d5a] mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-[#dce1ec] border-t-4 border-t-[#e8792b] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#dce1ec] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#1f2d5a]">
              {isEditing ? `Edit ${initialTask?.id}` : "New task"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#3b4254] hover:text-[#1e2330] text-[13px] font-semibold px-2 py-1 cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-[#ffe1e5] border border-[#f5c2c7] text-[#9c0006] text-[13px] font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className={labelClass}>Task / deliverable *</label>
              <input
                type="text"
                required
                placeholder="e.g. Launching static post - 4 content"
                value={formData.task || ""}
                onChange={(e) => setFormData({ ...formData, task: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Client / prospect</label>
              <select
                value={formData.client || ""}
                onChange={(e) => handleClientChange(e.target.value)}
                className={inputClass}
              >
                <option value="">Select client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Brief / description</label>
            <textarea
              rows={2}
              placeholder="Optional brief notes or requirements"
              value={formData.brief || ""}
              onChange={(e) => setFormData({ ...formData, brief: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className={labelClass}>Owner</label>
              <select
                value={formData.owner || ""}
                onChange={(e) => handleOwnerChange(e.target.value)}
                className={inputClass}
              >
                <option value="">Unassigned</option>
                {team.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Reviewer</label>
              <select
                value={formData.reviewer || ""}
                onChange={(e) => setFormData({ ...formData, reviewer: e.target.value })}
                className={inputClass}
              >
                <option value="">None</option>
                {team.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Priority</label>
              <select
                value={formData.priority || ""}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value as Priority })
                }
                className={inputClass}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p || "none"} value={p}>
                    {p || "None"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Status</label>
              <select
                value={formData.status || "Not started"}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as TaskStatus })
                }
                className={inputClass}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-[#e3e6ee]">
            <div>
              <label className={labelClass}>Date added</label>
              <input
                type="date"
                value={formData.dateAdded || ""}
                onChange={(e) => setFormData({ ...formData, dateAdded: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Start date</label>
              <input
                type="date"
                value={formData.startDate || ""}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Internal deadline</label>
              <input
                type="date"
                value={formData.internalDeadline || ""}
                onChange={(e) =>
                  setFormData({ ...formData, internalDeadline: e.target.value })
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Client deadline</label>
              <input
                type="date"
                value={formData.clientDeadline || ""}
                onChange={(e) =>
                  setFormData({ ...formData, clientDeadline: e.target.value })
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Est. hours</label>
              <input
                type="number"
                step="0.5"
                min="0"
                placeholder="0"
                value={formData.estHours ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    estHours: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#e3e6ee]">
            <div>
              <label className={labelClass}>Blocked by</label>
              <input
                type="text"
                placeholder="Leave blank if not blocked"
                value={formData.blockedBy || ""}
                onChange={(e) => setFormData({ ...formData, blockedBy: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Blocked since</label>
              <input
                type="date"
                value={formData.blockedSince || ""}
                onChange={(e) =>
                  setFormData({ ...formData, blockedSince: e.target.value })
                }
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-[#e3e6ee]">
            <div>
              <label className={labelClass}>Delivered on</label>
              <input
                type="date"
                value={formData.deliveredOn || ""}
                onChange={(e) =>
                  setFormData({ ...formData, deliveredOn: e.target.value })
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Completed on</label>
              <input
                type="date"
                value={formData.completedOn || ""}
                onChange={(e) =>
                  setFormData({ ...formData, completedOn: e.target.value })
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Actual hours</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={formData.actualHours ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    actualHours: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Revisions</label>
              <input
                type="number"
                min="0"
                value={formData.revisions ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    revisions: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>1st-round OK?</label>
              <select
                value={formData.firstRoundApproved || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    firstRoundApproved: e.target.value as "Yes" | "No" | "",
                  })
                }
                className={inputClass}
              >
                <option value="">—</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <input
              type="text"
              placeholder="Optional note"
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#dce1ec]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#ccd1de] text-[#3b4254] text-[13px] font-semibold hover:border-[#1f2d5a] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-[#1f2d5a] text-white text-[13px] font-semibold hover:bg-[#2a3a6e] disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Saving..." : isEditing ? "Save changes" : "Add task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
