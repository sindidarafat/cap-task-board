"use client";

import React, { useState } from "react";
import {
  AccountStatus,
  ClientRecord,
  ComputedClient,
  ComputedTask,
  TeamMember,
} from "@/lib/types";
import { ComingUpSummary, computeScorecard } from "@/lib/formulas";
import { PriorityBadge, StatusBadge, WorkTypeBadge } from "./BadgeHelpers";
import StickyTable from "./StickyTable";

/* =========================================================
   1. COMING UP VIEW
   ========================================================= */
export function ComingUpView({
  summary,
  estimateBuffer,
  onSelectTask,
}: {
  summary: ComingUpSummary;
  estimateBuffer: number;
  onSelectTask?: (task: ComputedTask) => void;
}) {
  return (
    <div className="space-y-8">
      {/* 6 Working Days Workload Matrix */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-[#1f2d5a]">
              6-Day Team Load
            </h2>
            <p className="text-[13px] text-[#3b4254]">
              Open tasks due over the next six working days (Sunday to Thursday), with +{Math.round(estimateBuffer * 100)}% buffer on estimated hours.
            </p>
          </div>
        </div>

        <StickyTable>
              <thead>
                <tr className="bg-[#1f2d5a] text-white">
                  <th className="py-3 px-4 font-semibold text-[12.5px]">Person</th>
                  <th className="py-3 px-3 font-semibold text-[12.5px]">Team</th>
                  <th className="py-3 px-3 font-semibold text-center text-[12.5px]">Overdue</th>
                  {summary.workingDays.map((day) => (
                    <th
                      key={day}
                      className="py-3 px-3 font-mono-code font-semibold text-center text-[12.5px]"
                    >
                      {day.slice(5)}
                    </th>
                  ))}
                  <th className="py-3 px-3 font-semibold text-right text-[12.5px]">
                    Open est. hrs
                  </th>
                  <th className="py-3 px-3 font-semibold text-right text-[12.5px]">
                    Hrs due (+{Math.round(estimateBuffer * 100)}%)
                  </th>
                  <th className="py-3 px-3 font-semibold text-right text-[12.5px]">
                    6d cap
                  </th>
                  <th className="py-3 px-4 font-semibold text-right text-[12.5px]">Load</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e3e6ee]">
                {summary.personRows.map((row) => {
                  const loadPct = Math.round(row.loadRatio * 100);
                  return (
                    <tr
                      key={row.person}
                      className="even:bg-[#f8f9fc] hover:bg-[#eef1f8] transition-colors"
                    >
                      <td className="py-3 px-4 font-semibold text-[#1e2330]">
                        {row.person}
                      </td>
                      <td className="py-3 px-3 font-medium text-[#2d3446]">{row.team}</td>
                      <td className="py-3 px-3 text-center font-mono-code">
                        {row.overdue > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-[#ffc7ce] text-[#9c0006] font-bold">
                            {row.overdue}
                          </span>
                        ) : (
                          <span className="text-[#525b70]">0</span>
                        )}
                      </td>
                      {row.dailyCounts.map((cnt, idx) => (
                        <td
                          key={idx}
                          className="py-3 px-3 text-center font-mono-code"
                        >
                          {cnt > 0 ? (
                            <span className="inline-block px-2 py-0.5 rounded bg-[#e8ecf6] text-[#1f2d5a] font-bold">
                              {cnt}
                            </span>
                          ) : (
                            <span className="text-[#525b70]">0</span>
                          )}
                        </td>
                      ))}
                      <td className="py-3 px-3 text-right font-mono-code font-medium text-[#1e2330]">
                        {row.openEstHrsAll.toFixed(1)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-code font-medium text-[#1e2330]">
                        {row.hrsDueByLastDayWithBuffer.toFixed(1)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-code font-medium text-[#3b4254]">
                        {row.capacitySixDays}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono-code font-bold ${
                          loadPct > 100
                            ? "text-[#9c0006]"
                            : loadPct >= 80
                            ? "text-[#8a4500]"
                            : "text-[#1f2d5a]"
                        }`}
                      >
                        {loadPct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </StickyTable>
      </div>

      {/* Due in the Next 14 Days */}
      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-bold text-[#1f2d5a]">
            Due in the next 14 days ({summary.dueNext14Days.length})
          </h3>
        </div>

        <StickyTable>
              <thead>
                <tr className="bg-[#1f2d5a] text-white">
                  <th className="py-3 px-4 font-semibold text-[12.5px]">#</th>
                  <th className="py-3 px-3 font-semibold text-[12.5px]">ID</th>
                  <th className="py-3 px-3 font-semibold text-[12.5px]">Deadline</th>
                  <th className="py-3 px-3 font-semibold text-[12.5px]">Client</th>
                  <th className="py-3 px-3 font-semibold text-[12.5px]">Type</th>
                  <th className="py-3 px-4 font-semibold text-[12.5px]">Task</th>
                  <th className="py-3 px-3 font-semibold text-[12.5px]">Owner</th>
                  <th className="py-3 px-3 font-semibold text-[12.5px]">Priority</th>
                  <th className="py-3 px-3 font-semibold text-[12.5px]">Status</th>
                  <th className="py-3 px-4 font-semibold text-right text-[12.5px]">Est. hrs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e3e6ee]">
                {summary.dueNext14Days.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-[#3b4254]">
                      No tasks scheduled in the next 14 days.
                    </td>
                  </tr>
                ) : (
                  summary.dueNext14Days.map((task, idx) => (
                    <tr
                      key={task.id}
                      onClick={() => onSelectTask?.(task)}
                      className={`even:bg-[#f8f9fc] hover:bg-[#eef1f8] transition-colors ${
                        onSelectTask ? "cursor-pointer" : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-mono-code font-bold text-[#1f2d5a]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 font-mono-code font-semibold text-[#1f2d5a]">
                        {task.id}
                      </td>
                      <td className="py-3 px-3 font-mono-code font-medium text-[#1e2330]">
                        {task.internalDeadline}
                      </td>
                      <td className="py-3 px-3 font-semibold text-[#1e2330]">
                        {task.client}
                      </td>
                      <td className="py-3 px-3">
                        <WorkTypeBadge workType={task.workType} />
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#1e2330]">
                        {task.task}
                      </td>
                      <td className="py-3 px-3 font-medium text-[#1e2330]">
                        {task.owner || "—"}
                      </td>
                      <td className="py-3 px-3">
                        <PriorityBadge priority={task.priority} />
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="py-3 px-4 text-right font-mono-code font-semibold text-[#1f2d5a]">
                        {task.estHours ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </StickyTable>
      </div>
    </div>
  );
}

/* =========================================================
   2. SCORECARD VIEW
   ========================================================= */
export function ScorecardView({
  tasks,
  team,
  referenceDate,
}: {
  tasks: ComputedTask[];
  team: TeamMember[];
  referenceDate: string;
}) {
  const [fromDate, setFromDate] = useState("2026-11-08");
  const [toDate, setToDate] = useState(referenceDate || "2026-11-11");

  const rows = computeScorecard(tasks, team, fromDate, toDate);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#1f2d5a]">Scorecard</h2>
          <p className="text-[13px] text-[#3b4254]">
            Delivery, on-time rate, revisions and estimate accuracy per person for the selected period.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
          <span className="text-[#3b4254]">From</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-[#ccd1de] bg-white px-2.5 py-1 text-[13px] font-mono-code font-semibold text-[#1f2d5a]"
          />
          <span className="text-[#3b4254]">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-[#ccd1de] bg-white px-2.5 py-1 text-[13px] font-mono-code font-semibold text-[#1f2d5a]"
          />
          <button
            type="button"
            onClick={() => {
              setFromDate("2026-11-01");
              setToDate("2026-11-30");
            }}
            className="px-3 py-1 rounded-lg border border-[#ccd1de] bg-white hover:border-[#1f2d5a] text-[#1f2d5a] font-semibold cursor-pointer"
          >
            Nov 2026
          </button>
          <button
            type="button"
            onClick={() => {
              setFromDate("2025-01-01");
              setToDate("2027-12-31");
            }}
            className="px-3 py-1 rounded-lg border border-[#ccd1de] bg-white hover:border-[#1f2d5a] text-[#1f2d5a] font-semibold cursor-pointer"
          >
            All time
          </button>
        </div>
      </div>

      <StickyTable>
            <thead>
              <tr className="bg-[#1f2d5a] text-white">
                <th className="py-3 px-4 font-semibold text-[12.5px]">Person</th>
                <th className="py-3 px-3 font-semibold text-[12.5px]">Team</th>
                <th className="py-3 px-3 font-semibold text-center text-[12.5px]">Open</th>
                <th className="py-3 px-3 font-semibold text-center text-[12.5px]">Overdue</th>
                <th className="py-3 px-3 font-semibold text-center text-[12.5px]">Delivered</th>
                <th className="py-3 px-3 font-semibold text-center text-[12.5px]">On time</th>
                <th className="py-3 px-3 font-semibold text-center text-[12.5px]">On-time %</th>
                <th className="py-3 px-3 font-semibold text-center text-[12.5px]">Avg rev</th>
                <th className="py-3 px-3 font-semibold text-center text-[12.5px]">1st-round %</th>
                <th className="py-3 px-3 font-semibold text-right text-[12.5px]">Est. hrs</th>
                <th className="py-3 px-3 font-semibold text-right text-[12.5px]">Actual hrs</th>
                <th className="py-3 px-3 font-semibold text-right text-[12.5px]">Accuracy</th>
                <th className="py-3 px-4 font-semibold text-center text-[12.5px]">
                  Reviews waiting
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e3e6ee]">
              {rows.map((r) => (
                <tr
                  key={r.person}
                  className="even:bg-[#f8f9fc] hover:bg-[#eef1f8] transition-colors"
                >
                  <td className="py-3 px-4 font-semibold text-[#1e2330]">
                    {r.person}
                  </td>
                  <td className="py-3 px-3 font-medium text-[#2d3446]">{r.team}</td>
                  <td className="py-3 px-3 text-center font-mono-code font-bold text-[#1f2d5a]">
                    {r.openNow}
                  </td>
                  <td className="py-3 px-3 text-center font-mono-code">
                    {r.overdueNow > 0 ? (
                      <span className="inline-block px-2 py-0.5 rounded bg-[#ffc7ce] text-[#9c0006] font-bold">
                        {r.overdueNow}
                      </span>
                    ) : (
                      <span className="text-[#525b70]">0</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center font-mono-code font-medium text-[#1e2330]">
                    {r.deliveredInPeriod}
                  </td>
                  <td className="py-3 px-3 text-center font-mono-code font-medium text-[#1e2330]">
                    {r.deliveredOnTime}
                  </td>
                  <td className="py-3 px-3 text-center font-mono-code font-semibold text-[#1f2d5a]">
                    {r.onTimePct !== null ? `${Math.round(r.onTimePct)}%` : "—"}
                  </td>
                  <td className="py-3 px-3 text-center font-mono-code font-medium text-[#1e2330]">
                    {r.avgRevisions !== null ? r.avgRevisions.toFixed(1) : "—"}
                  </td>
                  <td className="py-3 px-3 text-center font-mono-code font-semibold text-[#1f2d5a]">
                    {r.firstRoundApprovalPct !== null
                      ? `${Math.round(r.firstRoundApprovalPct)}%`
                      : "—"}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-code font-medium text-[#1e2330]">
                    {r.estHrsDelivered}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-code font-medium text-[#1e2330]">
                    {r.actualHrs}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-code font-semibold text-[#1f2d5a]">
                    {r.estimateAccuracy !== null
                      ? `${Math.round(r.estimateAccuracy)}%`
                      : "—"}
                  </td>
                  <td className="py-3 px-4 text-center font-mono-code">
                    {r.reviewsWaitingOnThem > 0 ? (
                      <span className="inline-block px-2 py-0.5 rounded bg-[#ffd8b0] text-[#8a4500] font-bold">
                        {r.reviewsWaitingOnThem}
                      </span>
                    ) : (
                      <span className="text-[#525b70]">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </StickyTable>
    </div>
  );
}

/* =========================================================
   3. CLIENTS & PITCHES VIEW
   ========================================================= */
export function ClientsPitchesView({
  clients,
  team,
  isAdmin,
  onAddClient,
  onUpdateClient,
  onDeleteClient,
}: {
  clients: ComputedClient[];
  team: TeamMember[];
  isAdmin: boolean;
  onAddClient: (c: Partial<ClientRecord>) => Promise<void>;
  onUpdateClient: (c: ClientRecord) => Promise<void>;
  onDeleteClient: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"Client" | "Pitch" | "Internal">("Client");
  const [accountLead, setAccountLead] = useState("");
  const [accountStatus, setAccountStatus] = useState<AccountStatus>("Active");
  const [notes, setNotes] = useState("");
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onAddClient({ name, type, accountLead, accountStatus, notes });
    setName("");
    setNotes("");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-[#1f2d5a]">
            Clients & Pitches ({clients.length})
          </h2>
          <p className="text-[13px] text-[#3b4254]">
            Add new clients or pitch prospects here before logging tasks for them.
          </p>
        </div>
      </div>

      {isAdmin && (
        <form
          onSubmit={handleAdd}
          className="bg-white rounded-lg border border-[#dce1ec] p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 shadow-xs"
        >
          <input
            type="text"
            required
            placeholder="Client or prospect name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-[#ccd1de] px-3 py-2 text-[13.5px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
          />
          <select
            value={type}
            onChange={(e) =>
              setType(e.target.value as "Client" | "Pitch" | "Internal")
            }
            className="rounded-lg border border-[#ccd1de] px-3 py-2 text-[13.5px] font-medium text-[#1e2330]"
          >
            <option value="Client">Client</option>
            <option value="Pitch">Pitch</option>
            <option value="Internal">Internal</option>
          </select>
          <select
            value={accountLead}
            onChange={(e) => setAccountLead(e.target.value)}
            className="rounded-lg border border-[#ccd1de] px-3 py-2 text-[13.5px] font-medium text-[#1e2330]"
          >
            <option value="">Account lead (optional)</option>
            {team.map((m) => (
              <option key={m.id} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            value={accountStatus}
            onChange={(e) => setAccountStatus(e.target.value as AccountStatus)}
            className="rounded-lg border border-[#ccd1de] px-3 py-2 text-[13.5px] font-medium text-[#1e2330]"
          >
            <option value="Active">Active</option>
            <option value="Pitching">Pitching</option>
            <option value="Won">Won</option>
            <option value="Lost">Lost</option>
            <option value="Paused">Paused</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-[#e8792b] hover:bg-[#d76a1e] text-white font-semibold text-[13.5px] px-4 py-2 cursor-pointer transition-colors"
          >
            + Add client
          </button>
        </form>
      )}

      <StickyTable>
            <thead>
              <tr className="bg-[#1f2d5a] text-white">
                <th className="py-3 px-4 font-semibold text-[12.5px]">Client / Prospect</th>
                <th className="py-3 px-3 font-semibold text-[12.5px]">Type</th>
                <th className="py-3 px-3 font-semibold text-[12.5px]">Account lead</th>
                <th className="py-3 px-3 font-semibold text-[12.5px]">Status</th>
                <th className="py-3 px-3 font-semibold text-center text-[12.5px]">Open tasks</th>
                <th className="py-3 px-3 font-semibold text-center text-[12.5px]">Overdue</th>
                <th className="py-3 px-3 font-semibold text-right text-[12.5px]">Open est. hrs</th>
                <th className="py-3 px-4 font-semibold text-[12.5px]">Notes</th>
                {isAdmin && <th className="py-3 px-4 font-semibold text-right text-[12.5px]">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e3e6ee]">
              {clients.map((c) => {
                const isEditingThis = editingClient?.id === c.id;
                const isPitch = c.type === "Pitch";
                return (
                  <tr
                    key={c.id}
                    className={`transition-colors ${
                      isPitch
                        ? "bg-[#fdf3ea] hover:bg-[#fbe8d8]"
                        : "even:bg-[#f8f9fc] hover:bg-[#eef1f8]"
                    }`}
                  >
                    <td
                      className={`py-3 px-4 font-semibold text-[#1e2330] ${
                        isPitch ? "border-l-[3px] border-l-[#e8792b]" : ""
                      }`}
                    >
                      {isEditingThis ? (
                        <input
                          type="text"
                          value={editingClient.name}
                          onChange={(e) =>
                            setEditingClient({
                              ...editingClient,
                              name: e.target.value,
                            })
                          }
                          className="border border-[#ccd1de] rounded px-2 py-1 text-[13px] w-full"
                        />
                      ) : (
                        c.name
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {isEditingThis ? (
                        <select
                          value={editingClient.type}
                          onChange={(e) =>
                            setEditingClient({
                              ...editingClient,
                              type: e.target.value as "Client" | "Pitch" | "Internal",
                            })
                          }
                          className="border border-[#ccd1de] rounded px-2 py-1 text-[13px]"
                        >
                          <option value="Client">Client</option>
                          <option value="Pitch">Pitch</option>
                          <option value="Internal">Internal</option>
                        </select>
                      ) : (
                        <WorkTypeBadge workType={c.type} />
                      )}
                    </td>
                    <td className="py-3 px-3 font-medium text-[#1e2330]">
                      {isEditingThis ? (
                        <select
                          value={editingClient.accountLead}
                          onChange={(e) =>
                            setEditingClient({
                              ...editingClient,
                              accountLead: e.target.value,
                            })
                          }
                          className="border border-[#ccd1de] rounded px-2 py-1 text-[13px]"
                        >
                          <option value="">None</option>
                          {team.map((m) => (
                            <option key={m.id} value={m.name}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        c.accountLead || "—"
                      )}
                    </td>
                    <td className="py-3 px-3 font-medium text-[#2d3446]">
                      {isEditingThis ? (
                        <select
                          value={editingClient.accountStatus}
                          onChange={(e) =>
                            setEditingClient({
                              ...editingClient,
                              accountStatus: e.target.value as AccountStatus,
                            })
                          }
                          className="border border-[#ccd1de] rounded px-2 py-1 text-[13px]"
                        >
                          <option value="Active">Active</option>
                          <option value="Pitching">Pitching</option>
                          <option value="Won">Won</option>
                          <option value="Lost">Lost</option>
                          <option value="Paused">Paused</option>
                        </select>
                      ) : (
                        c.accountStatus || "Active"
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-mono-code font-bold text-[#1f2d5a]">
                      {c.openTasks}
                    </td>
                    <td className="py-3 px-3 text-center font-mono-code">
                      {c.overdue > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded bg-[#ffc7ce] text-[#9c0006] font-bold">
                          {c.overdue}
                        </span>
                      ) : (
                        <span className="text-[#525b70]">0</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-code font-semibold text-[#1f2d5a]">
                      {c.openEstHrs}
                    </td>
                    <td className="py-3 px-4 text-[#2d3446]">
                      {isEditingThis ? (
                        <input
                          type="text"
                          value={editingClient.notes}
                          onChange={(e) =>
                            setEditingClient({
                              ...editingClient,
                              notes: e.target.value,
                            })
                          }
                          className="border border-[#ccd1de] rounded px-2 py-1 text-[13px] w-full"
                        />
                      ) : (
                        c.notes || "—"
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-right space-x-3 whitespace-nowrap">
                        {isEditingThis ? (
                          <>
                            <button
                              type="button"
                              onClick={async () => {
                                await onUpdateClient(editingClient);
                                setEditingClient(null);
                              }}
                              className="text-[#1f2d5a] font-semibold hover:underline"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingClient(null)}
                              className="text-[#525b70] hover:text-[#1e2330]"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingClient(c)}
                              className="text-[#1f2d5a] font-semibold hover:text-[#e8792b] cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteClient(c.id)}
                              className="text-[#9c0006] font-semibold hover:underline cursor-pointer"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </StickyTable>
    </div>
  );
}

/* =========================================================
   4. TEAM VIEW
   ========================================================= */
export function TeamView({
  team,
  estimateBuffer,
  isAdmin,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
  onUpdateBuffer,
}: {
  team: TeamMember[];
  estimateBuffer: number;
  isAdmin: boolean;
  onAddMember: (m: Partial<TeamMember>) => Promise<void>;
  onUpdateMember: (m: TeamMember) => Promise<void>;
  onDeleteMember: (id: string) => Promise<void>;
  onUpdateBuffer: (buf: number) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [dept, setDept] = useState("Creative");
  const [dailyCapacity, setDailyCapacity] = useState("6");
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [bufferPct, setBufferPct] = useState(String(Math.round(estimateBuffer * 100)));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onAddMember({
      name,
      role,
      team: dept,
      dailyCapacity: Number(dailyCapacity) || 6,
      notes: "",
    });
    setName("");
    setRole("");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#1f2d5a]">
            Team ({team.length})
          </h2>
          <p className="text-[13px] text-[#3b4254]">
            Feeds the Owner and Reviewer dropdowns across the task board.
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <span className="text-[#3b4254]">Estimate buffer (%):</span>
            <input
              type="number"
              min="0"
              max="100"
              value={bufferPct}
              onChange={(e) => setBufferPct(e.target.value)}
              className="w-20 rounded-lg border border-[#ccd1de] bg-white px-2.5 py-1 text-[13px] font-mono-code font-semibold text-[#1f2d5a]"
            />
            <button
              type="button"
              onClick={() => onUpdateBuffer((Number(bufferPct) || 0) / 100)}
              className="px-3 py-1 rounded-lg bg-[#1f2d5a] hover:bg-[#2a3a6e] text-white font-semibold cursor-pointer"
            >
              Save
            </button>
          </div>
        )}
      </div>

      {isAdmin && (
        <form
          onSubmit={handleAdd}
          className="bg-white rounded-lg border border-[#dce1ec] p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 shadow-xs"
        >
          <input
            type="text"
            required
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-[#ccd1de] px-3 py-2 text-[13.5px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
          />
          <input
            type="text"
            placeholder="Role (e.g. Visualizer)"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-lg border border-[#ccd1de] px-3 py-2 text-[13.5px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
          />
          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            className="rounded-lg border border-[#ccd1de] px-3 py-2 text-[13.5px] font-medium text-[#1e2330]"
          >
            <option value="Creative">Creative</option>
            <option value="Servicing">Servicing</option>
            <option value="C-Suite">C-Suite</option>
            <option value="Strategy and Data">Strategy and Data</option>
            <option value="Admin">Admin</option>
          </select>
          <input
            type="number"
            step="0.5"
            min="1"
            max="16"
            placeholder="Daily capacity (hrs)"
            value={dailyCapacity}
            onChange={(e) => setDailyCapacity(e.target.value)}
            className="rounded-lg border border-[#ccd1de] px-3 py-2 text-[13.5px] text-[#1e2330]"
          />
          <button
            type="submit"
            className="rounded-lg bg-[#e8792b] hover:bg-[#d76a1e] text-white font-semibold text-[13.5px] px-4 py-2 cursor-pointer transition-colors"
          >
            + Add member
          </button>
        </form>
      )}

      <StickyTable>
            <thead>
              <tr className="bg-[#1f2d5a] text-white">
                <th className="py-3 px-4 font-semibold text-[12.5px]">Name</th>
                <th className="py-3 px-3 font-semibold text-[12.5px]">Role</th>
                <th className="py-3 px-3 font-semibold text-[12.5px]">Department</th>
                <th className="py-3 px-3 font-semibold text-right text-[12.5px]">
                  Daily capacity
                </th>
                <th className="py-3 px-4 font-semibold text-[12.5px]">Notes</th>
                {isAdmin && <th className="py-3 px-4 font-semibold text-right text-[12.5px]">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e3e6ee]">
              {team.map((m) => {
                const isEditingThis = editingMember?.id === m.id;
                return (
                  <tr
                    key={m.id}
                    className="even:bg-[#f8f9fc] hover:bg-[#eef1f8] transition-colors"
                  >
                    <td className="py-3 px-4 font-semibold text-[#1e2330]">
                      {isEditingThis ? (
                        <input
                          type="text"
                          value={editingMember.name}
                          onChange={(e) =>
                            setEditingMember({
                              ...editingMember,
                              name: e.target.value,
                            })
                          }
                          className="border border-[#ccd1de] rounded px-2 py-1 text-[13px]"
                        />
                      ) : (
                        m.name
                      )}
                    </td>
                    <td className="py-3 px-3 font-medium text-[#2d3446]">
                      {isEditingThis ? (
                        <input
                          type="text"
                          value={editingMember.role}
                          onChange={(e) =>
                            setEditingMember({
                              ...editingMember,
                              role: e.target.value,
                            })
                          }
                          className="border border-[#ccd1de] rounded px-2 py-1 text-[13px]"
                        />
                      ) : (
                        m.role
                      )}
                    </td>
                    <td className="py-3 px-3 font-medium text-[#1f2d5a]">
                      {isEditingThis ? (
                        <select
                          value={editingMember.team}
                          onChange={(e) =>
                            setEditingMember({
                              ...editingMember,
                              team: e.target.value,
                            })
                          }
                          className="border border-[#ccd1de] rounded px-2 py-1 text-[13px]"
                        >
                          <option value="Creative">Creative</option>
                          <option value="Servicing">Servicing</option>
                          <option value="C-Suite">C-Suite</option>
                          <option value="Strategy and Data">Strategy and Data</option>
                          <option value="Admin">Admin</option>
                        </select>
                      ) : (
                        m.team
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-code font-bold text-[#1f2d5a]">
                      {isEditingThis ? (
                        <input
                          type="number"
                          step="0.5"
                          value={editingMember.dailyCapacity}
                          onChange={(e) =>
                            setEditingMember({
                              ...editingMember,
                              dailyCapacity: Number(e.target.value),
                            })
                          }
                          className="border border-[#ccd1de] rounded px-2 py-1 text-[13px] w-20 text-right"
                        />
                      ) : (
                        `${m.dailyCapacity.toFixed(1)}h`
                      )}
                    </td>
                    <td className="py-3 px-4 text-[#2d3446]">
                      {isEditingThis ? (
                        <input
                          type="text"
                          value={editingMember.notes}
                          onChange={(e) =>
                            setEditingMember({
                              ...editingMember,
                              notes: e.target.value,
                            })
                          }
                          className="border border-[#ccd1de] rounded px-2 py-1 text-[13px] w-full"
                        />
                      ) : (
                        m.notes || "—"
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-right space-x-3 whitespace-nowrap">
                        {isEditingThis ? (
                          <>
                            <button
                              type="button"
                              onClick={async () => {
                                await onUpdateMember(editingMember);
                                setEditingMember(null);
                              }}
                              className="text-[#1f2d5a] font-semibold hover:underline"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingMember(null)}
                              className="text-[#525b70] hover:text-[#1e2330]"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingMember(m)}
                              className="text-[#1f2d5a] font-semibold hover:text-[#e8792b] cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteMember(m.id)}
                              className="text-[#9c0006] font-semibold hover:underline cursor-pointer"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </StickyTable>
    </div>
  );
}

/* =========================================================
   5. HOW IT WORKS VIEW
   ========================================================= */
export function HowItWorksView() {
  return (
    <div className="max-w-5xl space-y-6 py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-[#dce1ec] border-t-[3px] border-t-[#1f2d5a] p-6 space-y-4 shadow-xs">
          <h3 className="text-base font-bold text-[#1f2d5a] border-b border-[#e3e6ee] pb-2.5">
            Who does what
          </h3>
          <div className="space-y-3.5 text-[13.5px] leading-relaxed">
            <div>
              <div className="font-bold text-[#1f2d5a]">
                Muntasir Mannan (owner of the board)
              </div>
              <p className="text-[#2d3446]">
                Logs every new task the day the brief arrives, runs the morning check, updates statuses through the day and closes the day.
              </p>
            </div>
            <div>
              <div className="font-bold text-[#1f2d5a]">
                Amit Pramanik (creative touchpoint)
              </div>
              <p className="text-[#2d3446]">
                Confirms owner, reviewer and estimated hours for every creative task, and records revision rounds after internal review.
              </p>
            </div>
            <div>
              <div className="font-bold text-[#1f2d5a]">
                Tahmina Taj (servicing touchpoint)
              </div>
              <p className="text-[#2d3446]">
                Records client approvals, client feedback, blockers and client deadline changes.
              </p>
            </div>
            <div>
              <div className="font-bold text-[#1f2d5a]">Every task owner</div>
              <p className="text-[#2d3446]">
                Tells Muntasir the moment status changes, sends work for review on time, and reports actual hours when they deliver.
              </p>
            </div>
            <div>
              <div className="font-bold text-[#1f2d5a]">
                Rajat Tanmay and Syeda Neelima Dola
              </div>
              <p className="text-[#2d3446]">
                Review the Scorecard every Thursday and settle anything blocked for more than 2 days.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#dce1ec] border-t-[3px] border-t-[#e8792b] p-6 space-y-4 shadow-xs">
          <h3 className="text-base font-bold text-[#1f2d5a] border-b border-[#e3e6ee] pb-2.5">
            Daily rhythm (Sunday to Thursday)
          </h3>
          <div className="space-y-3.5 text-[13.5px] leading-relaxed">
            <div>
              <div className="font-mono-code font-bold text-[#e8792b]">10:15</div>
              <p className="text-[#2d3446]">
                Morning check, 10 minutes, standing. Go down the Today tab top to bottom. Each owner confirms status and flags blockers.
              </p>
            </div>
            <div>
              <div className="font-mono-code font-bold text-[#e8792b]">13:30</div>
              <p className="text-[#2d3446]">
                Midday update. Muntasir updates statuses, Amit confirms anything in Internal review.
              </p>
            </div>
            <div>
              <div className="font-mono-code font-bold text-[#e8792b]">End of day</div>
              <p className="text-[#2d3446]">
                Muntasir closes the day: Delivered on, Completed on, actual hours and revisions filled in for everything that moved.
              </p>
            </div>
            <div>
              <div className="font-mono-code font-bold text-[#e8792b]">Thursday</div>
              <p className="text-[#2d3446]">
                Scorecard review and a look at next week on Coming Up.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#dce1ec] p-6 space-y-3 shadow-xs">
        <h3 className="text-base font-bold text-[#1f2d5a] border-b border-[#e3e6ee] pb-2.5">
          Board rules
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13.5px] text-[#2d3446] leading-relaxed">
          <div>
            <strong className="text-[#1f2d5a]">No task without these:</strong>{" "}
            Client, task, owner, priority, internal deadline and estimated hours.
          </div>
          <div>
            <strong className="text-[#1f2d5a]">Internal deadline:</strong>{" "}
            At least one working day before the client deadline wherever possible. On-time is judged against it.
          </div>
          <div>
            <strong className="text-[#1f2d5a]">Blocked:</strong>{" "}
            Fill Blocked by and Blocked since. Clear Blocked by once the blocker is gone. Blocked tasks are not counted as overdue.
          </div>
          <div>
            <strong className="text-[#1f2d5a]">Urgency (1 to 7):</strong>{" "}
            Priority (High 3, Medium 2, Low 1) plus deadline proximity (overdue 4, today 3, tomorrow 2, within 3 days 1).
          </div>
        </div>
      </div>
    </div>
  );
}
