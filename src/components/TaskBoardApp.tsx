"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityLogEntry,
  ClientRecord,
  ComputedTask,
  Priority,
  SafeUserAccount,
  TaskRecord,
  TaskStatus,
  TeamMember,
} from "@/lib/types";
import {
  computeClients,
  computeComingUp,
  computeTasks,
  computeTodayBoard,
} from "@/lib/formulas";
import {
  FlagBadge,
  PriorityBadge,
  StatusBadge,
  UrgencyPill,
  WorkTypeBadge,
} from "./BadgeHelpers";
import TaskFormModal from "./TaskFormModal";
import AdminRoomView from "./AdminRoomView";
import StickyTable from "./StickyTable";
import {
  ClientsPitchesView,
  ComingUpView,
  HowItWorksView,
  ScorecardView,
  TeamView,
} from "./OtherViews";

type ActiveTab =
  | "today"
  | "myworks"
  | "tasklog"
  | "comingup"
  | "scorecard"
  | "clients"
  | "team"
  | "adminroom"
  | "howitworks";

const STATUS_LIST: TaskStatus[] = [
  "Not started",
  "In progress",
  "Internal review",
  "Client review",
  "Revisions",
  "Done",
  "On hold",
];

export default function TaskBoardApp() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<SafeUserAccount | null>(null);
  const [sessionToken, setSessionToken] = useState<string>("");

  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [estimateBuffer, setEstimateBuffer] = useState<number>(0.2);
  const [users, setUsers] = useState<SafeUserAccount[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);

  const [referenceDate, setReferenceDate] = useState<string>("2026-11-11");
  const [activeTab, setActiveTab] = useState<ActiveTab>("today");

  // Auth form states
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authTeamRole, setAuthTeamRole] = useState("");
  const [authAccountType, setAuthAccountType] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  // Task Log filters & modals
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClient, setFilterClient] = useState("ALL");
  const [filterOwner, setFilterOwner] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterFlag, setFilterFlag] = useState("ALL");
  const [filterWorkType, setFilterWorkType] = useState("ALL");
  const [taskLogLayout, setTaskLogLayout] = useState<"table" | "kanban">("table");
  const [myWorksMember, setMyWorksMember] = useState<string>("");
  const [myWorksSubTab, setMyWorksSubTab] = useState<"ongoing" | "review" | "done">("ongoing");

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const apiFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers || {});
      if (!headers.has("Content-Type") && options.body) {
        headers.set("Content-Type", "application/json");
      }
      const savedToken =
        sessionToken ||
        (typeof window !== "undefined"
          ? window.localStorage.getItem("cap_session_token") || ""
          : "");
      if (savedToken) {
        headers.set("x-cap-token", savedToken);
      }

      const res = await fetch(url, {
        ...options,
        headers,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }
      return data;
    },
    [sessionToken]
  );

  const fetchBoard = useCallback(async () => {
    try {
      const data = await apiFetch("/api/board");
      if (data.user) {
        setCurrentUser(data.user);
      }
      setTasks(data.tasks || []);
      setClients(data.clients || []);
      setTeam(data.team || []);
      setEstimateBuffer(
        typeof data.estimateBuffer === "number" ? data.estimateBuffer : 0.2
      );
      setUsers(data.users || []);
      setActivityLog(data.activityLog || []);
    } catch (err) {
      console.error("Error loading board:", err);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem("cap_session_token")
        : null;
    if (saved) {
      setSessionToken(saved);
    }
    fetchBoard();
  }, [fetchBoard]);

  const isAdmin = Boolean(
    currentUser &&
      currentUser.role === "ADMIN" &&
      currentUser.adminRequestStatus === "APPROVED"
  );

  const pendingAdminCount = useMemo(
    () => users.filter((u) => u.adminRequestStatus === "PENDING").length,
    [users]
  );

  const computedTasks = useMemo(
    () => computeTasks(tasks, clients, team, referenceDate),
    [tasks, clients, team, referenceDate]
  );

  const todaySummary = useMemo(
    () => computeTodayBoard(computedTasks),
    [computedTasks]
  );

  const comingUpSummary = useMemo(
    () => computeComingUp(computedTasks, team, estimateBuffer, referenceDate),
    [computedTasks, team, estimateBuffer, referenceDate]
  );

  const computedClients = useMemo(
    () => computeClients(clients, computedTasks),
    [clients, computedTasks]
  );

  const selectedMemberName = myWorksMember || currentUser?.name || "";

  const myWorksData = useMemo(() => {
    const target = selectedMemberName.trim().toLowerCase();
    const ongoingOwned = computedTasks
      .filter(
        (t) =>
          t.status !== "Done" &&
          t.owner.trim().toLowerCase() === target
      )
      .sort((a, b) => (a.todayRank ?? 999) - (b.todayRank ?? 999));

    const waitingMyReview = computedTasks
      .filter(
        (t) =>
          t.status !== "Done" &&
          t.reviewer.trim().toLowerCase() === target
      )
      .sort((a, b) => (a.todayRank ?? 999) - (b.todayRank ?? 999));

    const completedOwned = computedTasks.filter(
      (t) =>
        t.status === "Done" &&
        t.owner.trim().toLowerCase() === target
    );

    const overdueCount = ongoingOwned.filter((t) => t.flag === "Overdue").length;
    const dueTodayCount = ongoingOwned.filter((t) => t.flag === "Due today").length;
    const inProgressCount = ongoingOwned.filter(
      (t) => t.status === "In progress" || t.status === "Revisions"
    ).length;
    const openEstHours = ongoingOwned.reduce(
      (sum, t) => sum + (t.estHours || 0),
      0
    );

    const currentUserOngoingCount = computedTasks.filter(
      (t) =>
        t.status !== "Done" &&
        t.owner.trim().toLowerCase() === (currentUser?.name || "").trim().toLowerCase()
    ).length;

    return {
      ongoingOwned,
      waitingMyReview,
      completedOwned,
      overdueCount,
      dueTodayCount,
      inProgressCount,
      openEstHours,
      currentUserOngoingCount,
    };
  }, [computedTasks, selectedMemberName, currentUser]);

  const filteredTasks = useMemo(() => {
    return computedTasks.filter((t) => {
      if (filterClient !== "ALL" && t.client !== filterClient) return false;
      if (filterOwner !== "ALL" && t.owner !== filterOwner) return false;
      if (filterStatus !== "ALL" && t.status !== filterStatus) return false;
      if (filterFlag !== "ALL" && t.flag !== filterFlag) return false;
      if (filterWorkType !== "ALL" && t.workType !== filterWorkType) return false;
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const hay = `${t.id} ${t.client} ${t.task} ${t.brief} ${t.owner} ${t.reviewer} ${t.notes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    computedTasks,
    filterClient,
    filterOwner,
    filterStatus,
    filterFlag,
    filterWorkType,
    searchQuery,
  ]);

  /* =========================================================
     AUTHENTICATION HANDLERS
     ========================================================= */
  const handleLogin = async (emailInput?: string, passwordInput?: string) => {
    const emailToUse = emailInput ?? authEmail;
    const passwordToUse = passwordInput ?? authPassword;
    setAuthError("");
    setAuthBusy(true);
    try {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: emailToUse, password: passwordToUse }),
      });
      if (data.token) {
        setSessionToken(data.token);
        window.localStorage.setItem("cap_session_token", data.token);
      }
      setCurrentUser(data.user);
      await fetchBoard();
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthBusy(true);
    try {
      const data = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: authName,
          email: authEmail,
          password: authPassword,
          teamRole: authTeamRole || (authAccountType === "ADMIN" ? "Admin" : "Member"),
          accountType: authAccountType,
        }),
      });
      if (data.token) {
        setSessionToken(data.token);
        window.localStorage.setItem("cap_session_token", data.token);
      }
      setCurrentUser(data.user);
      await fetchBoard();
      if (data.message) {
        showToast(data.message);
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.localStorage.removeItem("cap_session_token");
    setSessionToken("");
    setCurrentUser(null);
  };

  const handleRequestAdminAccess = async () => {
    try {
      const data = await apiFetch("/api/auth/request-admin", {
        method: "POST",
      });
      if (data.token) {
        setSessionToken(data.token);
        window.localStorage.setItem("cap_session_token", data.token);
      }
      setCurrentUser(data.user);
      await fetchBoard();
      showToast("Admin request sent for approval.");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Could not request admin access.");
    }
  };

  /* =========================================================
     TASK CRUD HANDLERS (ADMINS ONLY)
     ========================================================= */
  const handleSaveTask = async (taskData: Partial<TaskRecord>) => {
    if (taskData.id) {
      const data = await apiFetch("/api/tasks", {
        method: "PUT",
        body: JSON.stringify(taskData),
      });
      setTasks(data.tasks);
      setActivityLog(data.activityLog);
      showToast(`Saved ${taskData.id}`);
    } else {
      const data = await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify(taskData),
      });
      setTasks(data.tasks);
      setActivityLog(data.activityLog);
      showToast(`Added ${data.task.id}`);
    }
  };

  const handleQuickUpdateTask = async (
    taskId: string,
    patch: Partial<TaskRecord>
  ) => {
    if (!isAdmin) return;
    try {
      const data = await apiFetch("/api/tasks", {
        method: "PUT",
        body: JSON.stringify({ id: taskId, ...patch }),
      });
      setTasks(data.tasks);
      setActivityLog(data.activityLog);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Update failed");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!isAdmin) return;
    try {
      const data = await apiFetch(`/api/tasks?id=${encodeURIComponent(taskId)}`, {
        method: "DELETE",
      });
      setTasks(data.tasks);
      setActivityLog(data.activityLog);
      showToast(`Deleted ${taskId}`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleExportCSV = () => {
    const headers = [
      "ID",
      "Date added",
      "Client / Prospect",
      "Work type",
      "Task / Deliverable",
      "Brief / Description",
      "Owner",
      "Team",
      "Reviewer",
      "Priority",
      "Start date",
      "Internal deadline",
      "Client deadline",
      "Est. hours",
      "Status",
      "Blocked by",
      "Blocked since",
      "Delivered on",
      "Completed on",
      "Actual hours",
      "Revisions",
      "First-round approved?",
      "Notes",
      "Days left",
      "Flag",
      "On time?",
      "Days late",
      "Days blocked",
      "Urgency (1-7)",
      "Today rank",
    ];

    const escapeCsv = (val: unknown) => {
      if (val === null || val === undefined) return "";
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = computedTasks.map((t) =>
      [
        t.id,
        t.dateAdded,
        t.client,
        t.workType,
        t.task,
        t.brief,
        t.owner,
        t.team,
        t.reviewer,
        t.priority,
        t.startDate,
        t.internalDeadline,
        t.clientDeadline,
        t.estHours ?? "",
        t.status,
        t.blockedBy,
        t.blockedSince,
        t.deliveredOn,
        t.completedOn,
        t.actualHours ?? "",
        t.revisions ?? "",
        t.firstRoundApproved,
        t.notes,
        t.daysLeft ?? "",
        t.flag,
        t.onTime,
        t.daysLate ?? "",
        t.daysBlocked ?? "",
        t.urgency ?? "",
        t.todayRank ?? "",
      ]
        .map(escapeCsv)
        .join(",")
    );

    const csvContent = [headers.map(escapeCsv).join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CAP_Task_Log_${referenceDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* =========================================================
     LOADING OR SIGN-IN SCREEN
     ========================================================= */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f5f9] text-[#1f2d5a] flex items-center justify-center text-sm font-medium">
        Loading CAP Task Board...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#f4f5f9] text-[#1e2330] flex flex-col justify-center py-12 px-4">
        <div className="w-full max-w-md mx-auto space-y-6">
          <div className="flex items-center gap-3.5">
            <img
              src="/cap-logo-black.png"
              alt="CAP"
              className="h-9 w-auto object-contain"
            />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#1f2d5a]">
                Task Board
              </h1>
              <p className="text-[13px] text-[#3b4254]">
                Sign in with your account or create a new one.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#dce1ec] border-t-4 border-t-[#e8792b] shadow-sm p-6 space-y-5">
            <div className="flex border-b border-[#dce1ec] text-[13.5px] font-semibold">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setAuthError("");
                }}
                className={`pb-2.5 mr-6 border-b-2 transition-colors cursor-pointer ${
                  authMode === "login"
                    ? "border-[#e8792b] text-[#1f2d5a]"
                    : "border-transparent text-[#525b70] hover:text-[#1f2d5a]"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("register");
                  setAuthError("");
                }}
                className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
                  authMode === "register"
                    ? "border-[#e8792b] text-[#1f2d5a]"
                    : "border-transparent text-[#525b70] hover:text-[#1f2d5a]"
                }`}
              >
                Create account
              </button>
            </div>

            {authError && (
              <div className="p-3 rounded-lg bg-[#ffe1e5] border border-[#f5c2c7] text-[#9c0006] text-[13px] font-medium">
                {authError}
              </div>
            )}

            {authMode === "login" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleLogin();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@cap.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[14px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[14px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authBusy}
                  className="w-full py-2.5 rounded-lg bg-[#1f2d5a] hover:bg-[#2a3a6e] text-white font-semibold text-[14px] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {authBusy ? "Signing in..." : "Sign in"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                    Full name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Your name"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[14px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="you@cap.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[14px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Min 4 chars"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[14px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Visualizer"
                      value={authTeamRole}
                      onChange={(e) => setAuthTeamRole(e.target.value)}
                      className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[14px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                    Account type
                  </label>
                  <select
                    value={authAccountType}
                    onChange={(e) =>
                      setAuthAccountType(e.target.value as "MEMBER" | "ADMIN")
                    }
                    className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[13.5px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                  >
                    <option value="MEMBER">Member (view only)</option>
                    <option value="ADMIN">Admin (requires approval from an existing Admin)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={authBusy}
                  className="w-full py-2.5 rounded-lg bg-[#1f2d5a] hover:bg-[#2a3a6e] text-white font-semibold text-[14px] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {authBusy ? "Creating..." : "Create account"}
                </button>
              </form>
            )}
          </div>

          {/* Quick login links for testing */}
          <div className="border-t border-[#dce1ec] pt-4">
            <div className="text-[12px] font-semibold text-[#3b4254] mb-2">
              Quick sign-in accounts:
            </div>
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <button
                type="button"
                onClick={() => handleLogin("muntasir@cap.com", "admin123")}
                className="text-left px-3 py-2 rounded-lg border border-[#dce1ec] bg-white hover:border-[#1f2d5a] transition-colors cursor-pointer"
              >
                <div className="font-semibold text-[#1f2d5a]">Muntasir Mannan</div>
                <div className="text-[11.5px] text-[#e8792b] font-medium">Admin</div>
              </button>
              <button
                type="button"
                onClick={() => handleLogin("amit@cap.com", "admin123")}
                className="text-left px-3 py-2 rounded-lg border border-[#dce1ec] bg-white hover:border-[#1f2d5a] transition-colors cursor-pointer"
              >
                <div className="font-semibold text-[#1f2d5a]">Amit Pramanik</div>
                <div className="text-[11.5px] text-[#e8792b] font-medium">Admin</div>
              </button>
              <button
                type="button"
                onClick={() => handleLogin("rakib@cap.com", "member123")}
                className="text-left px-3 py-2 rounded-lg border border-[#dce1ec] bg-white hover:border-[#1f2d5a] transition-colors cursor-pointer"
              >
                <div className="font-semibold text-[#1e2330]">Rakib Islam</div>
                <div className="text-[11.5px] text-[#3b4254]">Member (view only)</div>
              </button>
              <button
                type="button"
                onClick={() => handleLogin("tahmina@cap.com", "member123")}
                className="text-left px-3 py-2 rounded-lg border border-[#dce1ec] bg-white hover:border-[#1f2d5a] transition-colors cursor-pointer"
              >
                <div className="font-semibold text-[#1e2330]">Tahmina Taj</div>
                <div className="text-[11.5px] text-[#8a4500] font-medium">Pending Admin</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================
     MAIN AUTHENTICATED WORKSPACE
     ========================================================= */
  return (
    <div className="min-h-screen bg-[#f4f5f9] text-[#1e2330] flex flex-col">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#1f2d5a] text-white px-4 py-2.5 rounded-lg shadow-lg text-[13px] font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#e8792b]" />
          {toast}
        </div>
      )}

      {/* Top Header: Row 1 (Logo + Date, CSV, User, Sign out) & Row 2 (Task Board + Tabs) */}
      <header className="bg-white border-b-2 border-[#dce1ec] sticky top-0 z-30 shadow-2xs">
        {/* Row 1: CAP Logo on left, Date / Export CSV / User / Sign out on right */}
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-4 border-b border-[#e8ecf6]">
          <button
            type="button"
            onClick={() => setActiveTab("today")}
            className="flex items-center gap-2.5 shrink-0 cursor-pointer focus:outline-none"
          >
            <img
              src="/cap-logo-black.png"
              alt="CAP"
              className="h-6 w-auto object-contain"
            />
          </button>

          {/* Right Utilities: Date, New Task, Export CSV, Name, Role, Sign out */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#3b4254] border border-[#ccd1de] bg-[#f8f9fc] rounded-lg px-2.5 py-1">
              <span>Date:</span>
              <input
                type="date"
                value={referenceDate}
                onChange={(e) => setReferenceDate(e.target.value)}
                className="bg-transparent text-[#1f2d5a] font-mono-code font-semibold text-[12.5px] focus:outline-none"
              />
              {referenceDate !== "2026-11-11" && (
                <button
                  type="button"
                  onClick={() => setReferenceDate("2026-11-11")}
                  className="text-[11px] font-semibold text-[#e8792b] hover:underline ml-1 cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setEditingTask(null);
                  setShowTaskModal(true);
                }}
                className="px-3 py-1 rounded-lg bg-[#e8792b] hover:bg-[#d76a1e] text-white text-[12.5px] font-semibold cursor-pointer transition-colors"
              >
                + New task
              </button>
            )}

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1 rounded-lg border border-[#ccd1de] bg-white hover:border-[#1f2d5a] text-[#1f2d5a] text-[12.5px] font-semibold cursor-pointer transition-colors"
            >
              Export CSV
            </button>

            <div className="h-4 w-px bg-[#dce1ec] mx-0.5 hidden sm:block" />

            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-[#1e2330] font-semibold">
                {currentUser.name}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11.5px] font-bold ${
                  isAdmin
                    ? "bg-[#1f2d5a] text-white"
                    : "bg-[#e8ecf6] text-[#1f2d5a]"
                }`}
              >
                {isAdmin ? "Admin" : "Member"}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-[#3b4254] hover:text-[#9c0006] font-medium ml-1 cursor-pointer"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Task Board Title & Navigation Tabs below Date/Name/CSV */}
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-12 flex items-center gap-6">
          <button
            type="button"
            onClick={() => setActiveTab("today")}
            className="font-heading font-bold text-[15px] text-[#1f2d5a] whitespace-nowrap cursor-pointer focus:outline-none"
          >
            Task Board
          </button>

          <div className="h-4 w-px bg-[#dce1ec] shrink-0" />

          <nav className="flex items-center gap-1 flex-wrap">
            {[
              { id: "today", label: "Today", count: todaySummary.rankedTasks.length },
              {
                id: "myworks",
                label: "My Works",
                count: myWorksData.currentUserOngoingCount,
              },
              { id: "tasklog", label: "Task Log", count: computedTasks.length },
              { id: "comingup", label: "Coming Up" },
              { id: "scorecard", label: "Scorecard" },
              { id: "clients", label: "Clients", count: clients.length },
              { id: "team", label: "Team", count: team.length },
              {
                id: "adminroom",
                label: "Accounts",
                count: pendingAdminCount > 0 ? pendingAdminCount : undefined,
                alert: pendingAdminCount > 0,
              },
              { id: "howitworks", label: "How It Works" },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as ActiveTab)}
                  className={`px-3.5 h-12 text-[13.5px] font-semibold border-b-[3px] whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer ${
                    active
                      ? "border-[#e8792b] text-[#1f2d5a] bg-[#f8f9fc]"
                      : "border-transparent text-[#3b4254] hover:text-[#1f2d5a] hover:bg-[#f8f9fc]"
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`text-[11.5px] font-mono-code px-1.5 py-0.5 rounded-full font-bold ${
                        tab.alert
                          ? "bg-[#e8792b] text-white"
                          : active
                          ? "bg-[#e8ecf6] text-[#1f2d5a]"
                          : "bg-[#eef0f6] text-[#3b4254]"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6 flex-1">
        {/* =====================================================
            TAB 1: TODAY BOARD
            ===================================================== */}
        {activeTab === "today" && (
          <div className="space-y-6">
            {/* Summary Tiles with CAP Brand Colors */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                {
                  label: "Open tasks",
                  value: todaySummary.openTasks,
                  border: "border-t-[#1f2d5a]",
                  text: "text-[#1f2d5a]",
                },
                {
                  label: "Overdue",
                  value: todaySummary.overdue,
                  border: "border-t-[#9c0006]",
                  text: todaySummary.overdue > 0 ? "text-[#9c0006]" : "text-[#1f2d5a]",
                },
                {
                  label: "Due today",
                  value: todaySummary.dueToday,
                  border: "border-t-[#e8792b]",
                  text: todaySummary.dueToday > 0 ? "text-[#8a4500]" : "text-[#1f2d5a]",
                },
                {
                  label: "Blocked",
                  value: todaySummary.blocked,
                  border: "border-t-[#4b2c82]",
                  text: "text-[#1f2d5a]",
                },
                {
                  label: "No deadline",
                  value: todaySummary.noDeadline,
                  border: "border-t-[#525b70]",
                  text: "text-[#1f2d5a]",
                },
                {
                  label: "Open pitches",
                  value: todaySummary.openPitchTasks,
                  border: "border-t-[#e8792b]",
                  text: "text-[#1f2d5a]",
                },
                {
                  label: "No owner",
                  value: todaySummary.noOwner,
                  border: "border-t-[#525b70]",
                  text: "text-[#1f2d5a]",
                },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className={`bg-white rounded-lg border border-[#dce1ec] border-t-[3px] ${kpi.border} px-4 py-3 shadow-xs`}
                >
                  <div className="text-[12.5px] font-semibold text-[#3b4254]">
                    {kpi.label}
                  </div>
                  <div
                    className={`text-2xl font-bold font-heading mt-0.5 ${kpi.text}`}
                  >
                    {kpi.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Today Ranked Table */}
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#1f2d5a]">
                    Today Board
                  </h2>
                  <p className="text-[13px] text-[#3b4254]">
                    Open tasks ranked automatically by urgency and deadline.
                  </p>
                </div>
                {!isAdmin && (
                  <span className="text-[12.5px] font-semibold text-[#1f2d5a] bg-[#e8ecf6] px-2.5 py-1 rounded-md">
                    Member mode (View only)
                  </span>
                )}
              </div>

              <StickyTable>
                  <thead>
                    <tr className="bg-[#1f2d5a] text-white">
                      <th className="py-3 px-3 font-semibold text-center w-11 text-[12.5px]">#</th>
                      <th className="py-3 px-3 font-semibold text-[12.5px]">ID</th>
                      <th className="py-3 px-3 font-semibold text-[12.5px]">Client</th>
                      <th className="py-3 px-3 font-semibold text-[12.5px]">Type</th>
                      <th className="py-3 px-4 font-semibold text-[12.5px]">Task</th>
                      <th className="py-3 px-3 font-semibold text-[12.5px]">Owner</th>
                      <th className="py-3 px-3 font-semibold text-[12.5px]">Reviewer</th>
                      <th className="py-3 px-3 font-semibold text-[12.5px]">Priority</th>
                      <th className="py-3 px-3 font-semibold text-[12.5px]">Deadline</th>
                      <th className="py-3 px-3 font-semibold text-[12.5px]">Status</th>
                      <th className="py-3 px-3 font-semibold text-[12.5px]">Flag</th>
                      <th className="py-3 px-3 font-semibold text-center text-[12.5px]">Urgency</th>
                      <th className="py-3 px-3 font-semibold text-right text-[12.5px]">Days left</th>
                      <th className="py-3 px-4 font-semibold text-[12.5px]">Notes</th>
                      {isAdmin && <th className="py-3 px-3 font-semibold text-right text-[12.5px]">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {todaySummary.rankedTasks.map((t, index) => {
                      const isPitch = t.workType === "Pitch";
                      return (
                        <tr
                          key={t.id}
                          className={`transition-colors ${
                            isPitch
                              ? "bg-[#fdf3ea] hover:bg-[#fbe8d8]"
                              : "even:bg-[#f8f9fc] hover:bg-[#eef1f8]"
                          }`}
                        >
                          <td
                            className={`py-3 px-3 text-center font-mono-code font-bold text-[#1f2d5a] ${
                              isPitch ? "border-l-[3px] border-l-[#e8792b]" : ""
                            }`}
                          >
                            {index + 1}
                          </td>
                          <td className="py-3 px-3 font-mono-code text-[13px] font-semibold text-[#1f2d5a] whitespace-nowrap">
                            {t.id}
                          </td>
                          <td className="py-3 px-3 font-semibold text-[#1e2330] whitespace-nowrap">
                            {t.client}
                          </td>
                          <td className="py-3 px-3">
                            <WorkTypeBadge workType={t.workType} />
                          </td>
                          <td className="py-3 px-4 max-w-md">
                            <div className="font-semibold text-[#1e2330] leading-snug">
                              {t.task}
                            </div>
                            {t.brief && (
                              <div className="text-[12.5px] text-[#3b4254] mt-0.5 leading-snug">
                                {t.brief}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 font-medium text-[#1e2330] whitespace-nowrap">
                            {t.owner || (
                              <span className="text-[#9c0006] font-semibold italic">
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-medium text-[#2d3446] whitespace-nowrap">
                            {t.reviewer || "—"}
                          </td>
                          <td className="py-3 px-3">
                            <PriorityBadge priority={t.priority} />
                          </td>
                          <td className="py-3 px-3 font-mono-code text-[13px] font-medium text-[#1e2330] whitespace-nowrap">
                            {t.internalDeadline || "—"}
                          </td>
                          <td className="py-3 px-3">
                            {isAdmin ? (
                              <select
                                value={t.status}
                                onChange={(e) =>
                                  handleQuickUpdateTask(t.id, {
                                    status: e.target.value as TaskStatus,
                                  })
                                }
                                className="rounded-md border border-[#ccd1de] bg-white hover:border-[#1f2d5a] px-2.5 py-1 text-[13px] font-medium text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                              >
                                {STATUS_LIST.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <StatusBadge status={t.status} />
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <FlagBadge flag={t.flag} />
                          </td>
                          <td className="py-3 px-3 text-center">
                            <UrgencyPill urgency={t.urgency} />
                          </td>
                          <td
                            className={`py-3 px-3 text-right font-mono-code text-[13.5px] font-bold ${
                              t.daysLeft !== null && t.daysLeft < 0
                                ? "text-[#9c0006]"
                                : t.daysLeft === 0
                                ? "text-[#8a4500]"
                                : "text-[#1f2d5a]"
                            }`}
                          >
                            {t.daysLeft ?? "—"}
                          </td>
                          <td className="py-3 px-4 text-[13px] text-[#2d3446] max-w-[220px]">
                            {t.notes || "—"}
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTask(t);
                                  setShowTaskModal(true);
                                }}
                                className="text-[13px] font-semibold text-[#1f2d5a] hover:text-[#e8792b] cursor-pointer"
                              >
                                Edit
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
              </StickyTable>
            </div>
          </div>
        )}

        {/* =====================================================
            TAB 1B: MY WORKS (ASSIGNED ONGOING WORKS)
            ===================================================== */}
        {activeTab === "myworks" && (
          <div className="space-y-6">
            {/* Member Header & Selector */}
            <div className="bg-white rounded-lg border border-[#dce1ec] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xs">
              <div>
                <h2 className="text-lg font-bold text-[#1f2d5a]">
                  My Works — {selectedMemberName}
                </h2>
                <p className="text-[13px] text-[#3b4254]">
                  Ongoing tasks assigned to {selectedMemberName === currentUser.name ? "you" : selectedMemberName}, ordered by urgency and deadline.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="font-semibold text-[#3b4254]">Member:</span>
                  <select
                    value={selectedMemberName}
                    onChange={(e) => setMyWorksMember(e.target.value)}
                    className="rounded-lg border border-[#ccd1de] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#1f2d5a] focus:outline-none focus:border-[#1f2d5a]"
                  >
                    <option value={currentUser.name}>
                      {currentUser.name} (Me)
                    </option>
                    {team
                      .filter(
                        (m) =>
                          m.name.trim().toLowerCase() !==
                          currentUser.name.trim().toLowerCase()
                      )
                      .map((m) => (
                        <option key={m.id} value={m.name}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Sub-tabs: Ongoing vs Reviewing vs Done */}
                <div className="inline-flex rounded-lg border border-[#ccd1de] bg-[#f8f9fc] p-0.5 text-[12.5px]">
                  <button
                    type="button"
                    onClick={() => setMyWorksSubTab("ongoing")}
                    className={`px-3 py-1 rounded-md font-semibold cursor-pointer ${
                      myWorksSubTab === "ongoing"
                        ? "bg-[#1f2d5a] text-white"
                        : "text-[#3b4254] hover:text-[#1f2d5a]"
                    }`}
                  >
                    Ongoing ({myWorksData.ongoingOwned.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMyWorksSubTab("review")}
                    className={`px-3 py-1 rounded-md font-semibold cursor-pointer ${
                      myWorksSubTab === "review"
                        ? "bg-[#1f2d5a] text-white"
                        : "text-[#3b4254] hover:text-[#1f2d5a]"
                    }`}
                  >
                    To Review ({myWorksData.waitingMyReview.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMyWorksSubTab("done")}
                    className={`px-3 py-1 rounded-md font-semibold cursor-pointer ${
                      myWorksSubTab === "done"
                        ? "bg-[#1f2d5a] text-white"
                        : "text-[#3b4254] hover:text-[#1f2d5a]"
                    }`}
                  >
                    Completed ({myWorksData.completedOwned.length})
                  </button>
                </div>
              </div>
            </div>

            {/* Member KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                {
                  label: "Ongoing works",
                  value: myWorksData.ongoingOwned.length,
                  border: "border-t-[#1f2d5a]",
                  text: "text-[#1f2d5a]",
                },
                {
                  label: "Overdue",
                  value: myWorksData.overdueCount,
                  border: "border-t-[#9c0006]",
                  text: myWorksData.overdueCount > 0 ? "text-[#9c0006]" : "text-[#1f2d5a]",
                },
                {
                  label: "Due today",
                  value: myWorksData.dueTodayCount,
                  border: "border-t-[#e8792b]",
                  text: myWorksData.dueTodayCount > 0 ? "text-[#8a4500]" : "text-[#1f2d5a]",
                },
                {
                  label: "In progress",
                  value: myWorksData.inProgressCount,
                  border: "border-t-[#1f4e79]",
                  text: "text-[#1f2d5a]",
                },
                {
                  label: "Waiting my review",
                  value: myWorksData.waitingMyReview.length,
                  border: "border-t-[#4b2c82]",
                  text: "text-[#1f2d5a]",
                },
                {
                  label: "Open est. hours",
                  value: `${myWorksData.openEstHours}h`,
                  border: "border-t-[#525b70]",
                  text: "text-[#1f2d5a]",
                },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className={`bg-white rounded-lg border border-[#dce1ec] border-t-[3px] ${kpi.border} px-4 py-3 shadow-xs`}
                >
                  <div className="text-[12.5px] font-semibold text-[#3b4254]">
                    {kpi.label}
                  </div>
                  <div
                    className={`text-2xl font-bold font-heading mt-0.5 ${kpi.text}`}
                  >
                    {kpi.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Member Works Table */}
            {(() => {
              const list =
                myWorksSubTab === "ongoing"
                  ? myWorksData.ongoingOwned
                  : myWorksSubTab === "review"
                  ? myWorksData.waitingMyReview
                  : myWorksData.completedOwned;

              return (
                <StickyTable>
                  <thead>
                    <tr className="bg-[#1f2d5a] text-white">
                      <th className="py-3 px-3 font-semibold text-center w-11 text-[12.5px]">#</th>
                      <th className="py-3 px-3 font-semibold text-[12.5px]">ID</th>
                      <th className="py-3 px-3 font-semibold text-[12.5px]">Client</th>
                      <th className="py-3 px-3 font-semibold text-[12.5px]">Type</th>
                      <th className="py-3 px-4 font-semibold text-[12.5px]">Task</th>
                      <th className="py-3 px-3 font-semibold text-[12.5px]">Owner</th>
                      <th className="py-3 px-3 font-semibold text-[12.5px]">Reviewer</th>
                      <th className="py-3 px-3 font-semibold text-[12.5px]">Priority</th>
                      <th className="py-3 px-3 font-semibold text-[12.5px]">Deadline</th>
                      <th className="py-3 px-3 font-semibold text-right text-[12.5px]">Est. hrs</th>
                      <th className="py-3 px-3 font-semibold text-[12.5px]">Status</th>
                      <th className="py-3 px-3 font-semibold text-[12.5px]">Flag</th>
                      <th className="py-3 px-3 font-semibold text-center text-[12.5px]">Urgency</th>
                      <th className="py-3 px-3 font-semibold text-right text-[12.5px]">Days left</th>
                      <th className="py-3 px-4 font-semibold text-[12.5px]">Notes</th>
                      {isAdmin && <th className="py-3 px-3 font-semibold text-right text-[12.5px]">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {list.length === 0 ? (
                      <tr>
                        <td
                          colSpan={isAdmin ? 16 : 15}
                          className="py-10 text-center text-[13.5px] font-medium text-[#3b4254]"
                        >
                          No tasks found in this section for {selectedMemberName}.
                        </td>
                      </tr>
                    ) : (
                      list.map((t, index) => {
                        const isPitch = t.workType === "Pitch";
                        return (
                          <tr
                            key={t.id}
                            className={`transition-colors ${
                              isPitch
                                ? "bg-[#fdf3ea] hover:bg-[#fbe8d8]"
                                : "even:bg-[#f8f9fc] hover:bg-[#eef1f8]"
                            }`}
                          >
                            <td
                              className={`py-3 px-3 text-center font-mono-code font-bold text-[#1f2d5a] ${
                                isPitch ? "border-l-[3px] border-l-[#e8792b]" : ""
                              }`}
                            >
                              {index + 1}
                            </td>
                            <td className="py-3 px-3 font-mono-code text-[13px] font-semibold text-[#1f2d5a] whitespace-nowrap">
                              {t.id}
                            </td>
                            <td className="py-3 px-3 font-semibold text-[#1e2330] whitespace-nowrap">
                              {t.client}
                            </td>
                            <td className="py-3 px-3">
                              <WorkTypeBadge workType={t.workType} />
                            </td>
                            <td className="py-3 px-4 max-w-md">
                              <div className="font-semibold text-[#1e2330] leading-snug">
                                {t.task}
                              </div>
                              {t.brief && (
                                <div className="text-[12.5px] text-[#3b4254] mt-0.5 leading-snug">
                                  {t.brief}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 font-medium text-[#1e2330] whitespace-nowrap">
                              {t.owner || "—"}
                            </td>
                            <td className="py-3 px-3 font-medium text-[#2d3446] whitespace-nowrap">
                              {t.reviewer || "—"}
                            </td>
                            <td className="py-3 px-3">
                              <PriorityBadge priority={t.priority} />
                            </td>
                            <td className="py-3 px-3 font-mono-code text-[13px] font-medium text-[#1e2330] whitespace-nowrap">
                              {t.internalDeadline || "—"}
                            </td>
                            <td className="py-3 px-3 text-right font-mono-code text-[13px] font-semibold text-[#1f2d5a]">
                              {t.estHours ?? "—"}
                            </td>
                            <td className="py-3 px-3">
                              {isAdmin ? (
                                <select
                                  value={t.status}
                                  onChange={(e) =>
                                    handleQuickUpdateTask(t.id, {
                                      status: e.target.value as TaskStatus,
                                    })
                                  }
                                  className="rounded-md border border-[#ccd1de] bg-white hover:border-[#1f2d5a] px-2.5 py-1 text-[13px] font-medium text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                                >
                                  {STATUS_LIST.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <StatusBadge status={t.status} />
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <FlagBadge flag={t.flag} />
                            </td>
                            <td className="py-3 px-3 text-center">
                              <UrgencyPill urgency={t.urgency} />
                            </td>
                            <td
                              className={`py-3 px-3 text-right font-mono-code text-[13.5px] font-bold ${
                                t.daysLeft !== null && t.daysLeft < 0
                                  ? "text-[#9c0006]"
                                  : t.daysLeft === 0
                                  ? "text-[#8a4500]"
                                  : "text-[#1f2d5a]"
                              }`}
                            >
                              {t.daysLeft ?? "—"}
                            </td>
                            <td className="py-3 px-4 text-[13px] text-[#2d3446] max-w-[220px]">
                              {t.notes || "—"}
                            </td>
                            {isAdmin && (
                              <td className="py-3 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingTask(t);
                                    setShowTaskModal(true);
                                  }}
                                  className="text-[13px] font-semibold text-[#1f2d5a] hover:text-[#e8792b] cursor-pointer"
                                >
                                  Edit
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </StickyTable>
              );
            })()}
          </div>
        )}

        {/* =====================================================
            TAB 2: TASK LOG (MASTER SHEET)
            ===================================================== */}
        {activeTab === "tasklog" && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white rounded-lg border border-[#dce1ec] p-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 shadow-xs">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                <input
                  type="text"
                  placeholder="Search tasks, clients, owners..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-lg border border-[#ccd1de] bg-white px-3 py-1.5 text-[13.5px] text-[#1e2330] placeholder:text-[#525b70] w-full sm:w-64 focus:outline-none focus:border-[#1f2d5a]"
                />

                <select
                  value={filterClient}
                  onChange={(e) => setFilterClient(e.target.value)}
                  className="rounded-lg border border-[#ccd1de] bg-white px-2.5 py-1.5 text-[13px] font-medium text-[#1e2330]"
                >
                  <option value="ALL">All clients</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filterOwner}
                  onChange={(e) => setFilterOwner(e.target.value)}
                  className="rounded-lg border border-[#ccd1de] bg-white px-2.5 py-1.5 text-[13px] font-medium text-[#1e2330]"
                >
                  <option value="ALL">All owners</option>
                  {team.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="rounded-lg border border-[#ccd1de] bg-white px-2.5 py-1.5 text-[13px] font-medium text-[#1e2330]"
                >
                  <option value="ALL">All statuses</option>
                  {STATUS_LIST.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <select
                  value={filterFlag}
                  onChange={(e) => setFilterFlag(e.target.value)}
                  className="rounded-lg border border-[#ccd1de] bg-white px-2.5 py-1.5 text-[13px] font-medium text-[#1e2330]"
                >
                  <option value="ALL">All flags</option>
                  {[
                    "Overdue",
                    "Due today",
                    "Due soon",
                    "Blocked",
                    "No deadline",
                    "On track",
                    "Done",
                    "On hold",
                  ].map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>

                <select
                  value={filterWorkType}
                  onChange={(e) => setFilterWorkType(e.target.value)}
                  className="rounded-lg border border-[#ccd1de] bg-white px-2.5 py-1.5 text-[13px] font-medium text-[#1e2330]"
                >
                  <option value="ALL">All types</option>
                  <option value="Client">Client</option>
                  <option value="Pitch">Pitch</option>
                  <option value="Internal">Internal</option>
                </select>

                {(searchQuery ||
                  filterClient !== "ALL" ||
                  filterOwner !== "ALL" ||
                  filterStatus !== "ALL" ||
                  filterFlag !== "ALL" ||
                  filterWorkType !== "ALL") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setFilterClient("ALL");
                      setFilterOwner("ALL");
                      setFilterStatus("ALL");
                      setFilterFlag("ALL");
                      setFilterWorkType("ALL");
                    }}
                    className="text-[13px] font-semibold text-[#e8792b] hover:underline px-2 py-1 cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-[#ccd1de] bg-[#f8f9fc] p-0.5 text-[13px]">
                  <button
                    type="button"
                    onClick={() => setTaskLogLayout("table")}
                    className={`px-3 py-1 rounded-md font-semibold cursor-pointer ${
                      taskLogLayout === "table"
                        ? "bg-[#1f2d5a] text-white"
                        : "text-[#3b4254] hover:text-[#1f2d5a]"
                    }`}
                  >
                    Table
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskLogLayout("kanban")}
                    className={`px-3 py-1 rounded-md font-semibold cursor-pointer ${
                      taskLogLayout === "kanban"
                        ? "bg-[#1f2d5a] text-white"
                        : "text-[#3b4254] hover:text-[#1f2d5a]"
                    }`}
                  >
                    Board
                  </button>
                </div>
              </div>
            </div>

            {taskLogLayout === "table" ? (
              <StickyTable>
                  <thead>
                    <tr className="bg-[#1f2d5a] text-white">
                      <th className="py-3 px-2.5 font-semibold text-[12.5px]">ID</th>
                      <th className="py-3 px-2 font-semibold text-[12.5px]">Added</th>
                      <th className="py-3 px-2.5 font-semibold text-[12.5px]">Client</th>
                      <th className="py-3 px-2 font-semibold text-[12.5px]">Type</th>
                      <th className="py-3 px-3 font-semibold text-[12.5px]">
                        Task / Deliverable
                      </th>
                      <th className="py-3 px-2.5 font-semibold text-[12.5px]">
                        Brief
                      </th>
                      <th className="py-3 px-2.5 font-semibold text-[12.5px]">Owner</th>
                      <th className="py-3 px-2 font-semibold text-[12.5px]">Team</th>
                      <th className="py-3 px-2.5 font-semibold text-[12.5px]">Reviewer</th>
                      <th className="py-3 px-2 font-semibold text-[12.5px]">Priority</th>
                      <th className="py-3 px-2 font-semibold text-[12.5px]">Internal DL</th>
                      <th className="py-3 px-2 font-semibold text-[12.5px]">Client DL</th>
                      <th className="py-3 px-2 font-semibold text-right text-[12.5px]">Est.</th>
                      <th className="py-3 px-2.5 font-semibold text-[12.5px]">Status</th>
                      <th className="py-3 px-2 font-semibold text-[12.5px]">Flag</th>
                      <th className="py-3 px-2 font-semibold text-right text-[12.5px]">Days</th>
                      <th className="py-3 px-2 font-semibold text-center text-[12.5px]">Urg</th>
                      <th className="py-3 px-2.5 font-semibold text-[12.5px]">Notes</th>
                      {isAdmin && (
                        <th className="py-3 px-2.5 font-semibold text-right text-[12.5px]">Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((t) => {
                      const isPitch = t.workType === "Pitch";
                      return (
                        <tr
                          key={t.id}
                          className={`transition-colors ${
                            isPitch
                              ? "bg-[#fdf3ea] hover:bg-[#fbe8d8]"
                              : "even:bg-[#f8f9fc] hover:bg-[#eef1f8]"
                          }`}
                        >
                          <td
                            className={`py-3 px-2.5 font-mono-code text-[13px] font-semibold text-[#1f2d5a] whitespace-nowrap ${
                              isPitch ? "border-l-[3px] border-l-[#e8792b]" : ""
                            }`}
                          >
                            {t.id}
                          </td>
                          <td className="py-3 px-2 font-mono-code text-[12.5px] font-medium text-[#3b4254] whitespace-nowrap">
                            {t.dateAdded.slice(5)}
                          </td>
                          <td className="py-3 px-2.5 font-semibold text-[#1e2330] whitespace-nowrap">
                            {t.client}
                          </td>
                          <td className="py-3 px-2">
                            <WorkTypeBadge workType={t.workType} />
                          </td>
                          <td className="py-3 px-3 font-semibold text-[#1e2330]">
                            {t.task}
                          </td>
                          <td className="py-3 px-2.5 text-[13px] text-[#2d3446] max-w-[200px]">
                            <div className="line-clamp-2">
                              {t.brief || "—"}
                            </div>
                          </td>
                          <td className="py-3 px-2.5 font-medium text-[#1e2330] whitespace-nowrap">
                            {isAdmin ? (
                              <select
                                value={t.owner}
                                onChange={(e) =>
                                  handleQuickUpdateTask(t.id, {
                                    owner: e.target.value,
                                  })
                                }
                                className="rounded-md border border-[#ccd1de] bg-white px-2 py-1 text-[13px] font-medium text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                              >
                                <option value="">Unassigned</option>
                                {team.map((m) => (
                                  <option key={m.id} value={m.name}>
                                    {m.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              t.owner || "—"
                            )}
                          </td>
                          <td className="py-3 px-2 text-[13px] font-medium text-[#2d3446] whitespace-nowrap">
                            {t.team || "—"}
                          </td>
                          <td className="py-3 px-2.5 text-[13px] font-medium text-[#2d3446] whitespace-nowrap">
                            {t.reviewer || "—"}
                          </td>
                          <td className="py-3 px-2">
                            {isAdmin ? (
                              <select
                                value={t.priority}
                                onChange={(e) =>
                                  handleQuickUpdateTask(t.id, {
                                    priority: e.target.value as Priority,
                                  })
                                }
                                className="rounded-md border border-[#ccd1de] bg-white px-2 py-1 text-[13px] font-medium text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                              >
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                                <option value="">—</option>
                              </select>
                            ) : (
                              <PriorityBadge priority={t.priority} />
                            )}
                          </td>
                          <td className="py-3 px-2 font-mono-code text-[13px] font-medium text-[#1e2330] whitespace-nowrap">
                            {t.internalDeadline ? t.internalDeadline.slice(5) : "—"}
                          </td>
                          <td className="py-3 px-2 font-mono-code text-[13px] font-medium text-[#3b4254] whitespace-nowrap">
                            {t.clientDeadline ? t.clientDeadline.slice(5) : "—"}
                          </td>
                          <td className="py-3 px-2 text-right font-mono-code text-[13px] font-semibold text-[#1f2d5a]">
                            {t.estHours ?? "—"}
                          </td>
                          <td className="py-3 px-2.5">
                            {isAdmin ? (
                              <select
                                value={t.status}
                                onChange={(e) =>
                                  handleQuickUpdateTask(t.id, {
                                    status: e.target.value as TaskStatus,
                                  })
                                }
                                className="rounded-md border border-[#ccd1de] bg-white px-2 py-1 text-[13px] font-medium text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                              >
                                {STATUS_LIST.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <StatusBadge status={t.status} />
                            )}
                          </td>
                          <td className="py-3 px-2">
                            <FlagBadge flag={t.flag} />
                          </td>
                          <td
                            className={`py-3 px-2 text-right font-mono-code text-[13px] font-bold ${
                              t.daysLeft !== null && t.daysLeft < 0
                                ? "text-[#9c0006]"
                                : "text-[#1f2d5a]"
                            }`}
                          >
                            {t.daysLeft ?? "—"}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <UrgencyPill urgency={t.urgency} />
                          </td>
                          <td className="py-3 px-2.5 text-[13px] text-[#2d3446] max-w-[150px] truncate">
                            {t.notes || "—"}
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-2.5 text-right whitespace-nowrap space-x-2.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTask(t);
                                  setShowTaskModal(true);
                                }}
                                className="text-[13px] font-semibold text-[#1f2d5a] hover:text-[#e8792b] cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTask(t.id)}
                                className="text-[13px] font-semibold text-[#9c0006] hover:underline cursor-pointer"
                              >
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
              </StickyTable>
            ) : (
              /* Clean Kanban Layout */
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {(
                  [
                    "Not started",
                    "In progress",
                    "Internal review",
                    "Client review",
                    "Revisions",
                    "Done",
                  ] as TaskStatus[]
                ).map((colStatus) => {
                  const colTasks = filteredTasks.filter(
                    (t) => t.status === colStatus
                  );
                  return (
                    <div
                      key={colStatus}
                      className="flex flex-col gap-2.5"
                    >
                      <div className="flex items-center justify-between px-2.5 py-2 rounded-md bg-[#1f2d5a] text-white">
                        <span className="text-[13px] font-semibold">
                          {colStatus}
                        </span>
                        <span className="text-[12px] font-mono-code font-bold bg-white/20 px-1.5 py-0.5 rounded">
                          {colTasks.length}
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {colTasks.map((t) => (
                          <div
                            key={t.id}
                            onClick={() => {
                              if (isAdmin) {
                                setEditingTask(t);
                                setShowTaskModal(true);
                              }
                            }}
                            className={`bg-white rounded-lg p-3.5 border border-[#dce1ec] shadow-xs space-y-2 ${
                              isAdmin
                                ? "cursor-pointer hover:border-[#1f2d5a] transition-colors"
                                : ""
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono-code text-[12px] font-semibold text-[#1f2d5a]">
                                {t.id}
                              </span>
                              <FlagBadge flag={t.flag} />
                            </div>
                            <div className="text-[13.5px] font-semibold text-[#1e2330]">
                              {t.task}
                            </div>
                            <div className="flex items-center justify-between text-[12.5px] text-[#2d3446] font-medium">
                              <span className="truncate">{t.client}</span>
                              <PriorityBadge priority={t.priority} />
                            </div>
                            <div className="pt-2 border-t border-[#e3e6ee] flex items-center justify-between text-[12px] text-[#3b4254] font-medium">
                              <span>{t.owner || "Unassigned"}</span>
                              <span className="font-mono-code font-semibold text-[#1f2d5a]">
                                {t.internalDeadline
                                  ? t.internalDeadline.slice(5)
                                  : ""}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =====================================================
            TAB 3: COMING UP
            ===================================================== */}
        {activeTab === "comingup" && (
          <ComingUpView
            summary={comingUpSummary}
            estimateBuffer={estimateBuffer}
            onSelectTask={
              isAdmin
                ? (t: ComputedTask) => {
                    setEditingTask(t);
                    setShowTaskModal(true);
                  }
                : undefined
            }
          />
        )}

        {/* =====================================================
            TAB 4: SCORECARD
            ===================================================== */}
        {activeTab === "scorecard" && (
          <ScorecardView
            tasks={computedTasks}
            team={team}
            referenceDate={referenceDate}
          />
        )}

        {/* =====================================================
            TAB 5: CLIENTS & PITCHES
            ===================================================== */}
        {activeTab === "clients" && (
          <ClientsPitchesView
            clients={computedClients}
            team={team}
            isAdmin={isAdmin}
            onAddClient={async (c) => {
              const data = await apiFetch("/api/clients", {
                method: "POST",
                body: JSON.stringify(c),
              });
              setClients(data.clients);
              setActivityLog(data.activityLog);
              showToast(`Added ${c.name}`);
            }}
            onUpdateClient={async (c) => {
              const data = await apiFetch("/api/clients", {
                method: "PUT",
                body: JSON.stringify(c),
              });
              setClients(data.clients);
              if (data.tasks) setTasks(data.tasks);
              setActivityLog(data.activityLog);
              showToast(`Saved ${c.name}`);
            }}
            onDeleteClient={async (id) => {
              const data = await apiFetch(`/api/clients?id=${encodeURIComponent(id)}`, {
                method: "DELETE",
              });
              setClients(data.clients);
              setActivityLog(data.activityLog);
              showToast("Deleted client");
            }}
          />
        )}

        {/* =====================================================
            TAB 6: TEAM
            ===================================================== */}
        {activeTab === "team" && (
          <TeamView
            team={team}
            estimateBuffer={estimateBuffer}
            isAdmin={isAdmin}
            onAddMember={async (m) => {
              const data = await apiFetch("/api/team", {
                method: "POST",
                body: JSON.stringify(m),
              });
              setTeam(data.team);
              setActivityLog(data.activityLog);
              showToast(`Added ${m.name}`);
            }}
            onUpdateMember={async (m) => {
              const data = await apiFetch("/api/team", {
                method: "PUT",
                body: JSON.stringify(m),
              });
              setTeam(data.team);
              if (data.tasks) setTasks(data.tasks);
              setActivityLog(data.activityLog);
              showToast(`Saved ${m.name}`);
            }}
            onDeleteMember={async (id) => {
              const data = await apiFetch(`/api/team?id=${encodeURIComponent(id)}`, {
                method: "DELETE",
              });
              setTeam(data.team);
              setActivityLog(data.activityLog);
              showToast("Removed member");
            }}
            onUpdateBuffer={async (buf) => {
              const data = await apiFetch("/api/team", {
                method: "PUT",
                body: JSON.stringify({ estimateBuffer: buf }),
              });
              setEstimateBuffer(data.estimateBuffer);
              setActivityLog(data.activityLog);
              showToast(`Updated buffer to ${Math.round(buf * 100)}%`);
            }}
          />
        )}

        {/* =====================================================
            TAB 7: ACCOUNTS / ADMIN ROOM
            ===================================================== */}
        {activeTab === "adminroom" && (
          <AdminRoomView
            currentUser={currentUser}
            isAdmin={isAdmin}
            users={users}
            activityLog={activityLog}
            onRequestAdminAccess={handleRequestAdminAccess}
            onAdminAction={async (payload) => {
              const data = await apiFetch("/api/admin/users", {
                method: "POST",
                body: JSON.stringify(payload),
              });
              setUsers(data.users);
              setActivityLog(data.activityLog);
              await fetchBoard();
            }}
          />
        )}

        {/* =====================================================
            TAB 8: HOW IT WORKS
            ===================================================== */}
        {activeTab === "howitworks" && <HowItWorksView />}
      </main>

      {/* Add / Edit Task Modal */}
      {showTaskModal && isAdmin && (
        <TaskFormModal
          initialTask={editingTask}
          clients={clients}
          team={team}
          referenceDate={referenceDate}
          onClose={() => {
            setShowTaskModal(false);
            setEditingTask(null);
          }}
          onSave={handleSaveTask}
        />
      )}
    </div>
  );
}
