import React from "react";
import { Priority, TaskFlag, TaskStatus, WorkType } from "@/lib/types";

export function FlagBadge({ flag }: { flag: TaskFlag }) {
  if (!flag) return <span className="text-[#525b70] text-[13px]">—</span>;

  const chipStyles: Record<string, string> = {
    Overdue: "bg-[#ffc7ce] text-[#9c0006]",
    "Due today": "bg-[#ffd8b0] text-[#8a4500]",
    "Due soon": "bg-[#fff2a8] text-[#6b5900]",
    Blocked: "bg-[#e4dcf2] text-[#4b2c82]",
    "No deadline": "bg-[#e8ebf2] text-[#3b4254]",
    "On track": "bg-[#ddebf7] text-[#1f4e79]",
    "On hold": "bg-[#dfe3ec] text-[#3b4254]",
    Done: "bg-[#c6efce] text-[#006100]",
  };

  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-[12px] font-semibold whitespace-nowrap ${
        chipStyles[flag] || "bg-[#e8ecf6] text-[#1f2d5a]"
      }`}
    >
      {flag}
    </span>
  );
}

export function StatusBadge({ status }: { status: TaskStatus | string }) {
  if (!status) return <span className="text-[#525b70] text-[13px]">—</span>;

  const styles: Record<string, string> = {
    "Not started": "bg-[#e8ecf6] text-[#1f2d5a]",
    "In progress": "bg-[#ddebf7] text-[#1f4e79]",
    "Internal review": "bg-[#e4dcf2] text-[#4b2c82]",
    "Client review": "bg-[#ffd8b0] text-[#8a4500]",
    Revisions: "bg-[#fdf0e6] text-[#b45309] border border-[#f5d0b5]",
    Done: "bg-[#c6efce] text-[#006100]",
    "On hold": "bg-[#dfe3ec] text-[#3b4254]",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[12.5px] font-semibold whitespace-nowrap ${
        styles[status] || "bg-[#e8ecf6] text-[#1f2d5a]"
      }`}
    >
      {status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority | string }) {
  if (!priority) return <span className="text-[#525b70] text-[13px]">—</span>;

  const styles: Record<string, string> = {
    High: "text-[#c00000] font-semibold",
    Medium: "text-[#8a5a00] font-semibold",
    Low: "text-[#3b4254] font-medium",
  };

  return (
    <span className={`text-[13px] ${styles[priority] || "text-[#1e2330] font-medium"}`}>
      {priority}
    </span>
  );
}

export function WorkTypeBadge({ workType }: { workType: WorkType }) {
  if (!workType) return <span className="text-[#525b70] text-[13px]">—</span>;

  const styles: Record<string, string> = {
    Client: "bg-[#e8ecf6] text-[#1f2d5a]",
    Pitch: "bg-[#e8792b] text-white",
    Internal: "bg-[#e3e6ee] text-[#2b3142]",
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider whitespace-nowrap ${
        styles[workType] || "bg-[#e8ecf6] text-[#1f2d5a]"
      }`}
    >
      {workType}
    </span>
  );
}

export function UrgencyPill({ urgency }: { urgency: number | null }) {
  if (urgency === null || urgency === undefined) {
    return <span className="text-[#525b70] text-[13px]">—</span>;
  }

  return (
    <span
      title={`Urgency ${urgency}/7`}
      className={`font-mono-code text-[13.5px] font-bold ${
        urgency >= 6
          ? "text-[#9c0006]"
          : urgency === 5
          ? "text-[#8a4500]"
          : "text-[#1f2d5a]"
      }`}
    >
      {urgency}
    </span>
  );
}
