"use client";

import React, { useMemo, useState } from "react";
import { ComputedClient, ComputedTask, TeamMember } from "@/lib/types";

export type CsvExportDataset =
  | "all_tasks"
  | "filtered_tasks"
  | "today_dashboard"
  | "my_works"
  | "clients"
  | "team"
  | "master_all";

interface FieldOption {
  key: string;
  label: string;
  category?: string;
}

const TASK_FIELDS: FieldOption[] = [
  { key: "id", label: "Task ID", category: "Identification" },
  { key: "dateAdded", label: "Date Added", category: "Identification" },
  { key: "client", label: "Client / Prospect", category: "Task Info" },
  { key: "workType", label: "Work Type", category: "Task Info" },
  { key: "task", label: "Task / Deliverable", category: "Task Info" },
  { key: "brief", label: "Brief / Description", category: "Task Info" },
  { key: "owner", label: "Owner", category: "Ownership" },
  { key: "team", label: "Team", category: "Ownership" },
  { key: "reviewer", label: "Reviewer", category: "Ownership" },
  { key: "priority", label: "Priority", category: "Status & Priority" },
  { key: "status", label: "Status", category: "Status & Priority" },
  { key: "flag", label: "Flag", category: "Status & Priority" },
  { key: "urgency", label: "Urgency (1-7)", category: "Status & Priority" },
  { key: "todayRank", label: "Today Rank", category: "Status & Priority" },
  { key: "startDate", label: "Start Date", category: "Schedule" },
  { key: "internalDeadline", label: "Internal Deadline", category: "Schedule" },
  { key: "clientDeadline", label: "Client Deadline", category: "Schedule" },
  { key: "daysLeft", label: "Days Left", category: "Schedule" },
  { key: "estHours", label: "Est. Hours", category: "Hours & Tracking" },
  { key: "actualHours", label: "Actual Hours", category: "Hours & Tracking" },
  { key: "deliveredOn", label: "Delivered On", category: "Completion" },
  { key: "completedOn", label: "Completed On", category: "Completion" },
  { key: "onTime", label: "On Time Delivery?", category: "Completion" },
  { key: "daysLate", label: "Days Late", category: "Completion" },
  { key: "revisions", label: "Revisions", category: "Review" },
  { key: "firstRoundApproved", label: "First Round Approved", category: "Review" },
  { key: "blockedBy", label: "Blocked By", category: "Blockers" },
  { key: "blockedSince", label: "Blocked Since", category: "Blockers" },
  { key: "daysBlocked", label: "Days Blocked", category: "Blockers" },
  { key: "notes", label: "Notes", category: "Other" },
];

const CLIENT_FIELDS: FieldOption[] = [
  { key: "id", label: "Client ID" },
  { key: "name", label: "Client Name" },
  { key: "type", label: "Type (Client / Pitch / Internal)" },
  { key: "accountLead", label: "Account Lead" },
  { key: "accountStatus", label: "Account Status" },
  { key: "openTasks", label: "Open Tasks Count" },
  { key: "overdue", label: "Overdue Tasks Count" },
  { key: "openEstHrs", label: "Open Est. Hours" },
  { key: "notes", label: "Notes" },
];

const TEAM_FIELDS: FieldOption[] = [
  { key: "id", label: "Member ID" },
  { key: "name", label: "Full Name" },
  { key: "role", label: "Role / Title" },
  { key: "team", label: "Team Department" },
  { key: "dailyCapacity", label: "Daily Capacity (Hours)" },
  { key: "notes", label: "Notes" },
];

interface ExportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  referenceDate: string;
  allTasks: ComputedTask[];
  filteredTasks: ComputedTask[];
  todayTasks: ComputedTask[];
  myWorksTasks: ComputedTask[];
  clients: ComputedClient[];
  team: TeamMember[];
  selectedMemberName: string;
  onExportSuccess: (message: string) => void;
}

export default function ExportCsvModal({
  isOpen,
  onClose,
  referenceDate,
  allTasks,
  filteredTasks,
  todayTasks,
  myWorksTasks,
  clients,
  team,
  selectedMemberName,
  onExportSuccess,
}: ExportCsvModalProps) {
  const [selectedDataset, setSelectedDataset] =
    useState<CsvExportDataset>("all_tasks");

  // Selected fields for Tasks
  const [selectedTaskFields, setSelectedTaskFields] = useState<string[]>(() =>
    TASK_FIELDS.map((f) => f.key)
  );

  // Selected fields for Clients
  const [selectedClientFields, setSelectedClientFields] = useState<string[]>(
    () => CLIENT_FIELDS.map((f) => f.key)
  );

  // Selected fields for Team
  const [selectedTeamFields, setSelectedTeamFields] = useState<string[]>(() =>
    TEAM_FIELDS.map((f) => f.key)
  );

  const isTaskBasedDataset =
    selectedDataset === "all_tasks" ||
    selectedDataset === "filtered_tasks" ||
    selectedDataset === "today_dashboard" ||
    selectedDataset === "my_works";

  // Rows count calculation
  const targetRowCount = useMemo(() => {
    switch (selectedDataset) {
      case "all_tasks":
        return allTasks.length;
      case "filtered_tasks":
        return filteredTasks.length;
      case "today_dashboard":
        return todayTasks.length;
      case "my_works":
        return myWorksTasks.length;
      case "clients":
        return clients.length;
      case "team":
        return team.length;
      case "master_all":
        return allTasks.length + clients.length + team.length;
      default:
        return 0;
    }
  }, [
    selectedDataset,
    allTasks.length,
    filteredTasks.length,
    todayTasks.length,
    myWorksTasks.length,
    clients.length,
    team.length,
  ]);

  if (!isOpen) return null;

  const escapeCsv = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const handleSelectAll = () => {
    if (isTaskBasedDataset || selectedDataset === "master_all") {
      setSelectedTaskFields(TASK_FIELDS.map((f) => f.key));
    }
    if (selectedDataset === "clients" || selectedDataset === "master_all") {
      setSelectedClientFields(CLIENT_FIELDS.map((f) => f.key));
    }
    if (selectedDataset === "team" || selectedDataset === "master_all") {
      setSelectedTeamFields(TEAM_FIELDS.map((f) => f.key));
    }
  };

  const handleDeselectAll = () => {
    if (isTaskBasedDataset) {
      // Keep at least task and client
      setSelectedTaskFields(["id", "task", "client"]);
    } else if (selectedDataset === "clients") {
      setSelectedClientFields(["name", "type"]);
    } else if (selectedDataset === "team") {
      setSelectedTeamFields(["name", "role"]);
    } else {
      setSelectedTaskFields(["id", "task"]);
      setSelectedClientFields(["name"]);
      setSelectedTeamFields(["name"]);
    }
  };

  const toggleTaskField = (key: string) => {
    setSelectedTaskFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleClientField = (key: string) => {
    setSelectedClientFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleTeamField = (key: string) => {
    setSelectedTeamFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const generateAndDownloadCsv = () => {
    let content = "";
    let filename = `CAP_Export_${referenceDate}.csv`;

    const getTaskRow = (t: ComputedTask, fields: string[]) => {
      return fields
        .map((field) => {
          switch (field) {
            case "id":
              return t.id;
            case "dateAdded":
              return t.dateAdded;
            case "client":
              return t.client;
            case "workType":
              return t.workType;
            case "task":
              return t.task;
            case "brief":
              return t.brief;
            case "owner":
              return t.owner;
            case "team":
              return t.team;
            case "reviewer":
              return t.reviewer;
            case "priority":
              return t.priority;
            case "status":
              return t.status;
            case "flag":
              return t.flag;
            case "urgency":
              return t.urgency ?? "";
            case "todayRank":
              return t.todayRank ?? "";
            case "startDate":
              return t.startDate;
            case "internalDeadline":
              return t.internalDeadline;
            case "clientDeadline":
              return t.clientDeadline;
            case "daysLeft":
              return t.daysLeft ?? "";
            case "estHours":
              return t.estHours ?? "";
            case "actualHours":
              return t.actualHours ?? "";
            case "deliveredOn":
              return t.deliveredOn;
            case "completedOn":
              return t.completedOn;
            case "onTime":
              return t.onTime;
            case "daysLate":
              return t.daysLate ?? "";
            case "revisions":
              return t.revisions ?? "";
            case "firstRoundApproved":
              return t.firstRoundApproved;
            case "blockedBy":
              return t.blockedBy;
            case "blockedSince":
              return t.blockedSince;
            case "daysBlocked":
              return t.daysBlocked ?? "";
            case "notes":
              return t.notes;
            default:
              return "";
          }
        })
        .map(escapeCsv)
        .join(",");
    };

    if (isTaskBasedDataset) {
      let targetTasks: ComputedTask[] = allTasks;
      let datasetName = "Task_Log_All";

      if (selectedDataset === "filtered_tasks") {
        targetTasks = filteredTasks;
        datasetName = "Task_Log_Filtered";
      } else if (selectedDataset === "today_dashboard") {
        targetTasks = todayTasks;
        datasetName = "Dashboard_Today";
      } else if (selectedDataset === "my_works") {
        targetTasks = myWorksTasks;
        datasetName = `Your_Works_${selectedMemberName.replace(/\s+/g, "_")}`;
      }

      filename = `CAP_${datasetName}_${referenceDate}.csv`;

      const activeFieldObjects = TASK_FIELDS.filter((f) =>
        selectedTaskFields.includes(f.key)
      );
      const headers = activeFieldObjects.map((f) => escapeCsv(f.label)).join(",");
      const rows = targetTasks.map((t) =>
        getTaskRow(
          t,
          activeFieldObjects.map((f) => f.key)
        )
      );

      content = [headers, ...rows].join("\n");
    } else if (selectedDataset === "clients") {
      filename = `CAP_Clients_Pitches_${referenceDate}.csv`;
      const activeFieldObjects = CLIENT_FIELDS.filter((f) =>
        selectedClientFields.includes(f.key)
      );
      const headers = activeFieldObjects.map((f) => escapeCsv(f.label)).join(",");
      const rows = clients.map((c) => {
        return activeFieldObjects
          .map((f) => {
            switch (f.key) {
              case "id":
                return c.id;
              case "name":
                return c.name;
              case "type":
                return c.type;
              case "accountLead":
                return c.accountLead;
              case "accountStatus":
                return c.accountStatus;
              case "openTasks":
                return c.openTasks;
              case "overdue":
                return c.overdue;
              case "openEstHrs":
                return c.openEstHrs;
              case "notes":
                return c.notes;
              default:
                return "";
            }
          })
          .map(escapeCsv)
          .join(",");
      });

      content = [headers, ...rows].join("\n");
    } else if (selectedDataset === "team") {
      filename = `CAP_Team_Roster_${referenceDate}.csv`;
      const activeFieldObjects = TEAM_FIELDS.filter((f) =>
        selectedTeamFields.includes(f.key)
      );
      const headers = activeFieldObjects.map((f) => escapeCsv(f.label)).join(",");
      const rows = team.map((m) => {
        return activeFieldObjects
          .map((f) => {
            switch (f.key) {
              case "id":
                return m.id;
              case "name":
                return m.name;
              case "role":
                return m.role;
              case "team":
                return m.team;
              case "dailyCapacity":
                return m.dailyCapacity;
              case "notes":
                return m.notes;
              default:
                return "";
            }
          })
          .map(escapeCsv)
          .join(",");
      });

      content = [headers, ...rows].join("\n");
    } else if (selectedDataset === "master_all") {
      filename = `CAP_Master_All_Data_${referenceDate}.csv`;

      // Section 1: Tasks
      const activeTaskFields = TASK_FIELDS.filter((f) =>
        selectedTaskFields.includes(f.key)
      );
      const taskHeaders = [
        escapeCsv("SECTION: TASKS"),
        ...activeTaskFields.map((f) => escapeCsv(f.label)),
      ].join(",");
      const taskRows = allTasks.map((t) =>
        [
          escapeCsv("Task"),
          getTaskRow(
            t,
            activeTaskFields.map((f) => f.key)
          ),
        ].join(",")
      );

      // Section 2: Clients
      const activeClientFields = CLIENT_FIELDS.filter((f) =>
        selectedClientFields.includes(f.key)
      );
      const clientHeaders = [
        escapeCsv("SECTION: CLIENTS & PITCHES"),
        ...activeClientFields.map((f) => escapeCsv(f.label)),
      ].join(",");
      const clientRows = clients.map((c) =>
        [
          escapeCsv("Client"),
          ...activeClientFields.map((f) => {
            switch (f.key) {
              case "id":
                return escapeCsv(c.id);
              case "name":
                return escapeCsv(c.name);
              case "type":
                return escapeCsv(c.type);
              case "accountLead":
                return escapeCsv(c.accountLead);
              case "accountStatus":
                return escapeCsv(c.accountStatus);
              case "openTasks":
                return escapeCsv(c.openTasks);
              case "overdue":
                return escapeCsv(c.overdue);
              case "openEstHrs":
                return escapeCsv(c.openEstHrs);
              case "notes":
                return escapeCsv(c.notes);
              default:
                return '""';
            }
          }),
        ].join(",")
      );

      // Section 3: Team
      const activeTeamFields = TEAM_FIELDS.filter((f) =>
        selectedTeamFields.includes(f.key)
      );
      const teamHeaders = [
        escapeCsv("SECTION: TEAM ROSTER"),
        ...activeTeamFields.map((f) => escapeCsv(f.label)),
      ].join(",");
      const teamRows = team.map((m) =>
        [
          escapeCsv("TeamMember"),
          ...activeTeamFields.map((f) => {
            switch (f.key) {
              case "id":
                return escapeCsv(m.id);
              case "name":
                return escapeCsv(m.name);
              case "role":
                return escapeCsv(m.role);
              case "team":
                return escapeCsv(m.team);
              case "dailyCapacity":
                return escapeCsv(m.dailyCapacity);
              case "notes":
                return escapeCsv(m.notes);
              default:
                return '""';
            }
          }),
        ].join(",")
      );

      content = [
        taskHeaders,
        ...taskRows,
        "",
        clientHeaders,
        ...clientRows,
        "",
        teamHeaders,
        ...teamRows,
      ].join("\n");
    }

    // Include UTF-8 Byte Order Mark for clean opening in Microsoft Excel on Windows
    const blob = new Blob(["\uFEFF" + content], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onExportSuccess(`Downloaded ${filename} (${targetRowCount} rows)`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-[#ccd1de] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e3e6ee] bg-[#f8f9fc] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1f2d5a] text-white flex items-center justify-center text-sm font-bold">
              CSV
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-[#1f2d5a]">
                Export Data to CSV
              </h2>
              <p className="text-[12.5px] text-[#525b70]">
                Choose which page&apos;s data and columns you want to export.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-[#525b70] hover:text-[#1f2d5a] hover:bg-[#e8ecf6] flex items-center justify-center text-lg font-semibold cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6 flex-1 text-[#1e2330]">
          {/* Step 1: Select Page / Dataset */}
          <div>
            <label className="block text-[13px] font-bold text-[#1f2d5a] uppercase tracking-wider mb-2.5">
              1. Select Page / Dataset to Export
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedDataset("all_tasks")}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedDataset === "all_tasks"
                    ? "border-[#1f2d5a] bg-[#f0f4ff] ring-1 ring-[#1f2d5a]"
                    : "border-[#ccd1de] hover:border-[#1f2d5a] bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] font-bold text-[#1f2d5a]">
                    📋 All Tasks (Full Task Log)
                  </span>
                  <span className="text-[11px] font-mono-code bg-white px-2 py-0.5 rounded border border-[#ccd1de] text-[#334e68]">
                    {allTasks.length} tasks
                  </span>
                </div>
                <p className="text-[12px] text-[#525b70] mt-1">
                  Complete dataset of all tasks, deliverables, and statuses.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDataset("filtered_tasks")}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedDataset === "filtered_tasks"
                    ? "border-[#1f2d5a] bg-[#f0f4ff] ring-1 ring-[#1f2d5a]"
                    : "border-[#ccd1de] hover:border-[#1f2d5a] bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] font-bold text-[#1f2d5a]">
                    🔍 Current Filtered Tasks
                  </span>
                  <span className="text-[11px] font-mono-code bg-white px-2 py-0.5 rounded border border-[#ccd1de] text-[#334e68]">
                    {filteredTasks.length} tasks
                  </span>
                </div>
                <p className="text-[12px] text-[#525b70] mt-1">
                  Only tasks matching your current search query & active filters.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDataset("today_dashboard")}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedDataset === "today_dashboard"
                    ? "border-[#1f2d5a] bg-[#f0f4ff] ring-1 ring-[#1f2d5a]"
                    : "border-[#ccd1de] hover:border-[#1f2d5a] bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] font-bold text-[#1f2d5a]">
                    📊 Today&apos;s Dashboard Data
                  </span>
                  <span className="text-[11px] font-mono-code bg-white px-2 py-0.5 rounded border border-[#ccd1de] text-[#334e68]">
                    {todayTasks.length} tasks
                  </span>
                </div>
                <p className="text-[12px] text-[#525b70] mt-1">
                  Active, overdue, due today, and priority queue tasks for {referenceDate}.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDataset("my_works")}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedDataset === "my_works"
                    ? "border-[#1f2d5a] bg-[#f0f4ff] ring-1 ring-[#1f2d5a]"
                    : "border-[#ccd1de] hover:border-[#1f2d5a] bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] font-bold text-[#1f2d5a]">
                    👤 Your Works ({selectedMemberName || "Active Member"})
                  </span>
                  <span className="text-[11px] font-mono-code bg-white px-2 py-0.5 rounded border border-[#ccd1de] text-[#334e68]">
                    {myWorksTasks.length} tasks
                  </span>
                </div>
                <p className="text-[12px] text-[#525b70] mt-1">
                  Ongoing tasks, waiting review, and completed work for {selectedMemberName}.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDataset("clients")}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedDataset === "clients"
                    ? "border-[#1f2d5a] bg-[#f0f4ff] ring-1 ring-[#1f2d5a]"
                    : "border-[#ccd1de] hover:border-[#1f2d5a] bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] font-bold text-[#1f2d5a]">
                    🏢 Clients & Pitches Summary
                  </span>
                  <span className="text-[11px] font-mono-code bg-white px-2 py-0.5 rounded border border-[#ccd1de] text-[#334e68]">
                    {clients.length} clients
                  </span>
                </div>
                <p className="text-[12px] text-[#525b70] mt-1">
                  Client health, work type, ongoing work, and delivered volume.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDataset("team")}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedDataset === "team"
                    ? "border-[#1f2d5a] bg-[#f0f4ff] ring-1 ring-[#1f2d5a]"
                    : "border-[#ccd1de] hover:border-[#1f2d5a] bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] font-bold text-[#1f2d5a]">
                    👥 Team Capacity & Roster
                  </span>
                  <span className="text-[11px] font-mono-code bg-white px-2 py-0.5 rounded border border-[#ccd1de] text-[#334e68]">
                    {team.length} members
                  </span>
                </div>
                <p className="text-[12px] text-[#525b70] mt-1">
                  Roster, daily capacity limits, department, and active workloads.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDataset("master_all")}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer sm:col-span-2 ${
                  selectedDataset === "master_all"
                    ? "border-[#e8792b] bg-[#fff6f0] ring-1 ring-[#e8792b]"
                    : "border-[#ccd1de] hover:border-[#e8792b] bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] font-bold text-[#1f2d5a]">
                    📑 All Datasets (Complete Agency Master File)
                  </span>
                  <span className="text-[11px] font-mono-code bg-white px-2 py-0.5 rounded border border-[#ccd1de] text-[#334e68]">
                    All pages combined
                  </span>
                </div>
                <p className="text-[12px] text-[#525b70] mt-1">
                  Exports Tasks, Clients, and Team members together in one comprehensive multi-section CSV file.
                </p>
              </button>
            </div>
          </div>

          {/* Step 2: Choose Fields / Columns */}
          <div className="border-t border-[#e3e6ee] pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="block text-[13px] font-bold text-[#1f2d5a] uppercase tracking-wider">
                  2. Choose Fields to Include
                </label>
                <p className="text-[12px] text-[#525b70]">
                  Select or deselect any columns you need.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2.5 py-1 text-[11.5px] font-semibold text-[#0b69a3] hover:bg-[#e8ecf6] rounded border border-[#ccd1de] cursor-pointer"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="px-2.5 py-1 text-[11.5px] font-semibold text-[#525b70] hover:bg-[#e8ecf6] rounded border border-[#ccd1de] cursor-pointer"
                >
                  Reset to minimum
                </button>
              </div>
            </div>

            {/* Fields list based on selected dataset */}
            {isTaskBasedDataset && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-[#f8f9fc] rounded-lg border border-[#e3e6ee] max-h-56 overflow-y-auto">
                {TASK_FIELDS.map((f) => {
                  const checked = selectedTaskFields.includes(f.key);
                  return (
                    <label
                      key={f.key}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-[12.5px] cursor-pointer transition-colors ${
                        checked
                          ? "bg-white font-semibold text-[#1f2d5a] border border-[#d0dcf5]"
                          : "text-[#525b70] hover:bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTaskField(f.key)}
                        className="rounded text-[#1f2d5a] focus:ring-0 cursor-pointer"
                      />
                      <span className="truncate">{f.label}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {selectedDataset === "clients" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-[#f8f9fc] rounded-lg border border-[#e3e6ee]">
                {CLIENT_FIELDS.map((f) => {
                  const checked = selectedClientFields.includes(f.key);
                  return (
                    <label
                      key={f.key}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-[12.5px] cursor-pointer transition-colors ${
                        checked
                          ? "bg-white font-semibold text-[#1f2d5a] border border-[#d0dcf5]"
                          : "text-[#525b70] hover:bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleClientField(f.key)}
                        className="rounded text-[#1f2d5a] focus:ring-0 cursor-pointer"
                      />
                      <span>{f.label}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {selectedDataset === "team" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-[#f8f9fc] rounded-lg border border-[#e3e6ee]">
                {TEAM_FIELDS.map((f) => {
                  const checked = selectedTeamFields.includes(f.key);
                  return (
                    <label
                      key={f.key}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-[12.5px] cursor-pointer transition-colors ${
                        checked
                          ? "bg-white font-semibold text-[#1f2d5a] border border-[#d0dcf5]"
                          : "text-[#525b70] hover:bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTeamField(f.key)}
                        className="rounded text-[#1f2d5a] focus:ring-0 cursor-pointer"
                      />
                      <span>{f.label}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {selectedDataset === "master_all" && (
              <div className="p-3 bg-[#f8f9fc] rounded-lg border border-[#e3e6ee] space-y-3">
                <div className="text-[12px] font-semibold text-[#1f2d5a]">
                  Selected Task Fields: {selectedTaskFields.length} of {TASK_FIELDS.length} · Client Fields: {selectedClientFields.length} of {CLIENT_FIELDS.length} · Team Fields: {selectedTeamFields.length} of {TEAM_FIELDS.length}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {TASK_FIELDS.map((f) => {
                    const checked = selectedTaskFields.includes(f.key);
                    return (
                      <label
                        key={f.key}
                        className={`flex items-center gap-2 px-2 py-1 rounded text-[11.5px] cursor-pointer ${
                          checked ? "bg-white font-semibold text-[#1f2d5a]" : "text-[#525b70]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTaskField(f.key)}
                          className="rounded text-[#1f2d5a]"
                        />
                        <span className="truncate">{f.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#f8f9fc] border-t border-[#e3e6ee] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-[12.5px] text-[#525b70]">
            Exporting <strong>{targetRowCount}</strong> rows with{" "}
            <strong>
              {isTaskBasedDataset
                ? selectedTaskFields.length
                : selectedDataset === "clients"
                ? selectedClientFields.length
                : selectedDataset === "team"
                ? selectedTeamFields.length
                : selectedTaskFields.length + selectedClientFields.length + selectedTeamFields.length}
            </strong>{" "}
            columns selected.
          </div>
          <div className="flex items-center gap-2.5 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#ccd1de] bg-white hover:bg-[#f0f4ff] text-[#1f2d5a] text-[13px] font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={generateAndDownloadCsv}
              className="px-5 py-2 rounded-lg bg-[#1f2d5a] hover:bg-[#2a3a6e] text-white text-[13px] font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <span>Download CSV</span>
              <span>↓</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
