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
  getTodayDateStr,
} from "@/lib/formulas";
import {
  FlagBadge,
  MemberTag,
  PriorityBadge,
  StatusBadge,
  UrgencyPill,
  WorkTypeBadge,
} from "./BadgeHelpers";
import TaskFormModal from "./TaskFormModal";
import ExportCsvModal from "./ExportCsvModal";
import UpdateInfoModal from "./UpdateInfoModal";
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

export interface OfficialMemberItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "ADMIN" | "MEMBER";
  title: string;
  aliases: string[];
}

export const OFFICIAL_TEAM_ROSTER: OfficialMemberItem[] = [
  { id: "M-009", name: "Tanmay paul", email: "md@cap.direct", phone: "+8801681436919", role: "ADMIN", title: "MD and Servicing Lead", aliases: ["Rajat Tanmay", "Tanmay paul"] },
  { id: "M-010", name: "Syeda Nilima Dola", email: "ceo@cap.direct", phone: "+8801757629895", role: "ADMIN", title: "CEO", aliases: ["Syeda Neelima Dola", "Syeda Nilima Dola", "Neelima Dola"] },
  { id: "M-012", name: "Meem Arafat Manab", email: "data@cap.direct", phone: "+353851522813", role: "ADMIN", title: "Chief of Finance", aliases: ["Meem Arafat Manab", "Meem Arafat"] },
  { id: "M-011", name: "Manjurul Mahmud", email: "strategy@cap.direct", phone: "+4915755531545", role: "ADMIN", title: "Chief of Strategy", aliases: ["Manjurul Mahmud"] },
  { id: "M-001", name: "Amit Pramanik", email: "creative@cap.direct", phone: "+8801840783226", role: "ADMIN", title: "Creative Director", aliases: ["Amit Pramanik"] },
  { id: "M-015", name: "Hasib Mohammad Ashiq", email: "office@cap.direct", phone: "+8801672824324", role: "ADMIN", title: "Admin / Office Lead", aliases: ["Hasib Mohammad Ashiq", "Hasib Ashiq"] },
  { id: "M-008", name: "Tahmina Taj", email: "client.service@cap.direct", phone: "+8801643116621", role: "MEMBER", title: "Client Servicing Executive", aliases: ["Tahmina Taj"] },
  { id: "M-014", name: "Rashedul Islam", email: "accounts@cap.direct", phone: "+8801805033153", role: "ADMIN", title: "Admin", aliases: ["Rashed", "Rashedul Islam"] },
  { id: "M-002", name: "Ragib Shahriar", email: "writer@cap.direct", phone: "+8801787623050", role: "MEMBER", title: "Copy Supervisor", aliases: ["Ragib Shahriar"] },
  { id: "M-006", name: "Hasin Ishraq Bijoy", email: "visualizer@cap.direct", phone: "+8801786039319", role: "MEMBER", title: "Video Editor", aliases: ["Hasin Bijoy", "Hasin Ishraq Bijoy"] },
  { id: "M-003", name: "Md. Rakib-ul-Islam", email: "design@cap.direct", phone: "+8801955688057", role: "MEMBER", title: "Sr. Visualizer", aliases: ["Rakib Islam", "Md. Rakib-ul-Islam"] },
  { id: "M-007", name: "Md. Montasir Mannan", email: "operations@cap.direct", phone: "+8801712888824", role: "ADMIN", title: "Key Account Manager (Board Owner)", aliases: ["Muntasir Mannan", "Md. Montasir Mannan"] },
  { id: "M-005", name: "Nusrat Laxme", email: "nusratlaxme123@gmail.com", phone: "+8801628586049", role: "MEMBER", title: "Jr. Visualizer", aliases: ["Laxmi", "Nusrat Laxme"] },
  { id: "M-013", name: "Sindid Arafat", email: "sindidarafat275@gmail.com", phone: "+8801735807816", role: "ADMIN", title: "Data Analyst & Admin", aliases: ["Sindid Arafat"] },
  { id: "M-004", name: "Rajib Hossen", email: "rajibakash@gmail.com", phone: "+8801681795542", role: "MEMBER", title: "Sr. Visualizer", aliases: ["Rajib Akash", "Rajib Hossen"] },
  { id: "M-000", name: "CAP Admin", email: "admin@cap.direct", phone: "+8801700000000", role: "ADMIN", title: "System Administrator", aliases: ["CAP Admin", "Admin"] },
];

const TEAM_ROSTER_DEFAULTS: Record<
  string,
  { email: string; role: "ADMIN" | "MEMBER"; title: string; phone: string }
> = Object.fromEntries(
  OFFICIAL_TEAM_ROSTER.map((m) => [
    m.id,
    { email: m.email, role: m.role, title: m.title, phone: m.phone },
  ])
);

function matchPersonWithAliases(
  taskPerson: string,
  targetName: string,
  teamRoster: TeamMember[]
): boolean {
  if (!taskPerson || !targetName) return false;
  const p = taskPerson.trim().toLowerCase();
  const t = targetName.trim().toLowerCase();
  if (p === t) return true;

  const targetMember = teamRoster.find(
    (m) =>
      m.name.toLowerCase() === t ||
      m.aliases?.some((a) => a.toLowerCase() === t)
  );
  if (targetMember) {
    if (targetMember.name.toLowerCase() === p) return true;
    if (targetMember.aliases?.some((a) => a.toLowerCase() === p)) return true;
  }

  const taskMember = teamRoster.find(
    (m) =>
      m.name.toLowerCase() === p ||
      m.aliases?.some((a) => a.toLowerCase() === p)
  );
  if (taskMember) {
    if (taskMember.name.toLowerCase() === t) return true;
    if (taskMember.aliases?.some((a) => a.toLowerCase() === t)) return true;
  }

  return false;
}

function getLocalPasswordHash(email: string): string | undefined {
  if (typeof window === "undefined" || !email) return undefined;
  try {
    const raw = window.localStorage.getItem("cap_user_hashes");
    if (!raw) return undefined;
    const map = JSON.parse(raw);
    return map[email.toLowerCase()];
  } catch {
    return undefined;
  }
}

function saveLocalPasswordHash(email: string, hash: string): void {
  if (typeof window === "undefined" || !email || !hash) return;
  const cleanEmail = email.trim().toLowerCase();
  try {
    const raw = window.localStorage.getItem("cap_user_hashes");
    const map = raw ? JSON.parse(raw) : {};
    map[cleanEmail] = hash;
    window.localStorage.setItem("cap_user_hashes", JSON.stringify(map));

    // Also update any matching record in cap_local_users
    const rawUsers = window.localStorage.getItem("cap_local_users");
    if (rawUsers) {
      const list: Record<string, unknown>[] = JSON.parse(rawUsers);
      const idx = list.findIndex(
        (u) => String(u.email || "").toLowerCase() === cleanEmail
      );
      if (idx >= 0) {
        list[idx] = { ...list[idx], passwordHash: hash, passwordSet: true };
        window.localStorage.setItem("cap_local_users", JSON.stringify(list));
      }
    }
  } catch {}
}

function getLocalUserRecords(): Record<string, unknown>[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("cap_local_users");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalUserRecord(userRecord: Record<string, unknown>): void {
  if (typeof window === "undefined" || !userRecord || !userRecord.email) return;
  const cleanEmail = String(userRecord.email).trim().toLowerCase();
  try {
    const raw = window.localStorage.getItem("cap_local_users");
    const list: Record<string, unknown>[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(
      (u) =>
        String(u.email || "").toLowerCase() === cleanEmail ||
        (userRecord.id && String(u.id || "") === String(userRecord.id))
    );
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...userRecord, email: cleanEmail };
    } else {
      list.push({ ...userRecord, email: cleanEmail });
    }
    window.localStorage.setItem("cap_local_users", JSON.stringify(list));

    // If a password hash is present in the record, keep cap_user_hashes synchronized
    if (userRecord.passwordHash && typeof userRecord.passwordHash === "string") {
      const rawHashes = window.localStorage.getItem("cap_user_hashes");
      const map = rawHashes ? JSON.parse(rawHashes) : {};
      map[cleanEmail] = userRecord.passwordHash;
      window.localStorage.setItem("cap_user_hashes", JSON.stringify(map));
    }
  } catch {}
}

export default function TaskBoardApp() {
  const [currentUser, setCurrentUser] = useState<SafeUserAccount | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem("cap_current_user");
        if (saved) return JSON.parse(saved) as SafeUserAccount;
      } catch {}
    }
    return null;
  });
  const [sessionToken, setSessionToken] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("cap_session_token") || "";
    }
    return "";
  });

  const [loading, setLoading] = useState(true);

  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [estimateBuffer, setEstimateBuffer] = useState<number>(0.2);
  const [users, setUsers] = useState<SafeUserAccount[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);

  const [referenceDate, setReferenceDate] = useState<string>("2026-11-15");
  const [activeTab, setActiveTab] = useState<ActiveTab>("today");

  // Auth redesign states: 2 options (1- existing user, 2- new user)
  const [authOption, setAuthOption] = useState<"existing" | "new">("existing");
  const [authSubMode, setAuthSubMode] = useState<"login" | "set_password">("login");
  const [authLoginMethod, setAuthLoginMethod] = useState<"roster" | "email">("roster");
  const [selectedExistingMemberId, setSelectedExistingMemberId] = useState<string>("M-013"); // Sindid Arafat by default
  const [authEmail, setAuthEmail] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("cap_saved_email") || "";
    }
    return "";
  });
  const [authPassword, setAuthPassword] = useState("");
  const [authRetypePassword, setAuthRetypePassword] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authName, setAuthName] = useState("");
  const [authTeamRole, setAuthTeamRole] = useState("");
  const [authAccountType, setAuthAccountType] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [resetSuccessInfo, setResetSuccessInfo] = useState<{
    tempPassword: string;
    email: string;
    name: string;
  } | null>(null);

  // Update info modal on dashboard
  const [showUpdateInfoModal, setShowUpdateInfoModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  const [showExportModal, setShowExportModal] = useState(false);
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

      const localUsers = getLocalUserRecords();
      if (localUsers.length > 0) {
        headers.set("x-cap-client-users", JSON.stringify(localUsers));
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
        if (typeof window !== "undefined") {
          window.localStorage.setItem("cap_current_user", JSON.stringify(data.user));
        }
      }
      setTasks(data.tasks || []);
      setClients(data.clients || []);
      setTeam(data.team || []);
      setEstimateBuffer(
        typeof data.estimateBuffer === "number" ? data.estimateBuffer : 0.2
      );
      setUsers(data.users || []);
      setActivityLog(data.activityLog || []);

      // Cache all users & team in localStorage so offline or serverless cold starts never lose records
      if (typeof window !== "undefined") {
        if (Array.isArray(data.users)) {
          for (const u of data.users) {
            saveLocalUserRecord(u);
          }
        }
        if (Array.isArray(data.team)) {
          try {
            window.localStorage.setItem("cap_cached_team", JSON.stringify(data.team));
          } catch {}
        }
      }
    } catch (err) {
      console.error("Error loading board:", err);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    // Set to today's present date on client load
    setReferenceDate(getTodayDateStr());
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

  const allRosterMembers = useMemo<OfficialMemberItem[]>(() => {
    const map = new Map<string, OfficialMemberItem>();
    // 1. Official seed roster
    for (const m of OFFICIAL_TEAM_ROSTER) {
      map.set(m.id, { ...m });
    }
    // 2. Any additional team members in team
    for (const tm of team) {
      if (!map.has(tm.id)) {
        map.set(tm.id, {
          id: tm.id,
          name: tm.name,
          email: tm.email || `${tm.name.toLowerCase().replace(/[^a-z0-9]/g, ".")}@cap.direct`,
          phone: tm.phone || "",
          role: "MEMBER",
          title: tm.role || "Team Member",
          aliases: tm.aliases || [tm.name],
        });
      }
    }
    // 3. Any additional registered users in users
    for (const u of users) {
      const key = u.memberId || u.id;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: u.name,
          email: u.email,
          phone: u.phone || "",
          role: u.role,
          title: u.teamRole || "Team Member",
          aliases: u.aliases || [u.name],
        });
      }
    }
    // 4. Any locally cached users from getLocalUserRecords()
    const local = getLocalUserRecords();
    for (const lu of local) {
      const email = String(lu.email || "").trim().toLowerCase();
      if (email) {
        const exists = Array.from(map.values()).some(
          (m) => m.email.toLowerCase() === email
        );
        if (!exists) {
          const id = String(lu.memberId || lu.id || `M-LOCAL-${email}`);
          map.set(id, {
            id,
            name: String(lu.name || email.split("@")[0]),
            email: email,
            phone: String(lu.phone || ""),
            role: lu.role === "ADMIN" ? "ADMIN" : "MEMBER",
            title: String(lu.teamRole || "Team Member"),
            aliases: Array.isArray(lu.aliases)
              ? (lu.aliases as string[])
              : [String(lu.name || email)],
          });
        }
      }
    }
    return Array.from(map.values());
  }, [team, users]);

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

  const memberIdMap = useMemo(() => {
    const map: Record<string, string> = {};
    team.forEach((m) => {
      map[m.name.trim().toLowerCase()] = m.id;
    });
    users.forEach((u) => {
      if (u.memberId) {
        map[u.name.trim().toLowerCase()] = u.memberId;
      }
    });
    return map;
  }, [team, users]);

  const selectedMemberName = myWorksMember || currentUser?.name || "";

  const myWorksData = useMemo(() => {
    const target = selectedMemberName.trim();
    const ongoingOwned = computedTasks
      .filter(
        (t) =>
          t.status !== "Done" &&
          matchPersonWithAliases(t.owner, target, team)
      )
      .sort((a, b) => (a.todayRank ?? 999) - (b.todayRank ?? 999));

    const waitingMyReview = computedTasks
      .filter(
        (t) =>
          t.status !== "Done" &&
          matchPersonWithAliases(t.reviewer, target, team)
      )
      .sort((a, b) => (a.todayRank ?? 999) - (b.todayRank ?? 999));

    const completedOwned = computedTasks.filter(
      (t) =>
        t.status === "Done" &&
        matchPersonWithAliases(t.owner, target, team)
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
        matchPersonWithAliases(t.owner, currentUser?.name || "", team)
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
  }, [computedTasks, selectedMemberName, currentUser, team]);

  const filteredTasks = useMemo(() => {
    return computedTasks.filter((t) => {
      if (filterClient !== "ALL" && t.client !== filterClient) return false;
      if (filterOwner !== "ALL" && !matchPersonWithAliases(t.owner, filterOwner, team)) return false;
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
    team,
  ]);

  /* =========================================================
     AUTHENTICATION HANDLERS
     ========================================================= */
  const handleLogin = async (emailInput?: string, passwordInput?: string) => {
    const targetOfficial =
      allRosterMembers.find((m) => m.id === selectedExistingMemberId) ||
      allRosterMembers[0];
    const emailToUse = (
      emailInput ??
      (authLoginMethod === "email" ? authEmail : targetOfficial?.email || authEmail)
    )
      .trim()
      .toLowerCase();
    const passwordToUse = passwordInput ?? authPassword;

    if (!passwordToUse) {
      setAuthError("Please enter your password.");
      return;
    }

    setAuthError("");
    setAuthBusy(true);
    try {
      const clientPasswordHash = getLocalPasswordHash(emailToUse);
      const localUsers = getLocalUserRecords();
      const clientUser = localUsers.find(
        (u) => String(u.email || "").toLowerCase() === emailToUse
      );

      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          userId: targetOfficial?.id,
          email: emailToUse,
          password: passwordToUse,
          clientPasswordHash,
          clientUser,
          clientUsers: localUsers,
        }),
      });

      if (data.token) {
        setSessionToken(data.token);
        window.localStorage.setItem("cap_session_token", data.token);
      }
      if (data.user) {
        setCurrentUser(data.user);
        window.localStorage.setItem("cap_current_user", JSON.stringify(data.user));
      }
      window.localStorage.setItem("cap_saved_email", emailToUse);
      if (data.passwordHash) {
        saveLocalPasswordHash(emailToUse, data.passwordHash);
      }
      if (data.userRecord) {
        saveLocalUserRecord(data.userRecord);
      }
      await fetchBoard();
      showToast(data.message || `Signed in successfully! Welcome, ${data.user?.name || "Team Member"}.`);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleExistingMemberSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const targetMember =
      allRosterMembers.find((m) => m.id === selectedExistingMemberId) ||
      allRosterMembers.find((m) => m.email.toLowerCase() === authEmail.trim().toLowerCase()) ||
      allRosterMembers[0];

    if (!authPassword || authPassword.length < 4) {
      setAuthError("Password must be at least 4 characters.");
      return;
    }
    if (authPassword !== authRetypePassword) {
      setAuthError("Passwords do not match. Please retype carefully.");
      return;
    }

    setAuthBusy(true);
    try {
      const localUsers = getLocalUserRecords();
      const data = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          action: "set_password",
          memberId: targetMember.id,
          name: targetMember.name,
          email: targetMember.email,
          phone: targetMember.phone,
          password: authPassword,
          clientUsers: localUsers,
        }),
      });

      if (data.token) {
        setSessionToken(data.token);
        window.localStorage.setItem("cap_session_token", data.token);
      }
      if (data.user) {
        setCurrentUser(data.user);
        window.localStorage.setItem("cap_current_user", JSON.stringify(data.user));
      }
      window.localStorage.setItem("cap_saved_email", targetMember.email);
      if (data.passwordHash) {
        saveLocalPasswordHash(targetMember.email, data.passwordHash);
      }
      if (data.userRecord) {
        saveLocalUserRecord(data.userRecord);
      }
      await fetchBoard();
      showToast(data.message || `Password set successfully! Welcome, ${targetMember.name}.`);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Failed to set password.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    setAuthError("");
    const targetMember =
      allRosterMembers.find((m) => m.id === selectedExistingMemberId) ||
      allRosterMembers.find((m) => m.email.toLowerCase() === authEmail.trim().toLowerCase()) ||
      allRosterMembers[0];

    setAuthBusy(true);
    try {
      const data = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          userId: targetMember.id,
          email: targetMember.email,
        }),
      });

      setResetSuccessInfo({
        tempPassword: data.tempPassword,
        email: data.email,
        name: data.name,
      });

      if (data.tempPassword) {
        setAuthPassword(data.tempPassword);
        setAuthSubMode("login");
      }

      if (data.passwordHash && data.email) {
        saveLocalPasswordHash(data.email, data.passwordHash);
      }
      if (data.userRecord) {
        saveLocalUserRecord(data.userRecord);
      }

      showToast(`Temporary password generated for ${data.name}!`);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleNewUserRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    if (!authName.trim()) {
      setAuthError("Full Name is required.");
      return;
    }
    if (!authEmail.trim()) {
      setAuthError("Email is required.");
      return;
    }
    if (!authPhone.trim()) {
      setAuthError("Phone Number is required.");
      return;
    }
    if (!authPassword || authPassword.length < 4) {
      setAuthError("Password must be at least 4 characters.");
      return;
    }
    if (authPassword !== authRetypePassword) {
      setAuthError("Passwords do not match. Please retype carefully.");
      return;
    }

    setAuthBusy(true);
    try {
      const localUsers = getLocalUserRecords();
      const data = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          action: "new_user",
          name: authName.trim(),
          email: authEmail.trim(),
          phone: authPhone.trim(),
          teamRole: authTeamRole.trim() || (authAccountType === "ADMIN" ? "Admin" : "Team Member"),
          accountType: authAccountType,
          password: authPassword,
          clientUsers: localUsers,
        }),
      });

      if (data.token) {
        setSessionToken(data.token);
        window.localStorage.setItem("cap_session_token", data.token);
      }
      if (data.user) {
        setCurrentUser(data.user);
        window.localStorage.setItem("cap_current_user", JSON.stringify(data.user));
      }
      window.localStorage.setItem("cap_saved_email", authEmail.trim());
      if (data.passwordHash) {
        saveLocalPasswordHash(authEmail.trim(), data.passwordHash);
      }
      if (data.userRecord) {
        saveLocalUserRecord(data.userRecord);
      }
      await fetchBoard();
      showToast(data.message || `Account created! Signed in as ${authName}.`);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.localStorage.removeItem("cap_session_token");
    window.localStorage.removeItem("cap_current_user");
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
    const selectedOfficial =
      (authLoginMethod === "email" && authEmail.trim())
        ? (allRosterMembers.find(
            (m) => m.email.toLowerCase() === authEmail.trim().toLowerCase()
          ) || {
            id: "custom-user",
            name: authEmail.split("@")[0] || "Team Member",
            email: authEmail.trim(),
            phone: "",
            role: "MEMBER" as const,
            title: "Team Member",
            aliases: [],
          })
        : (allRosterMembers.find((m) => m.id === selectedExistingMemberId) ||
           allRosterMembers[0]);

    return (
      <div className="min-h-screen bg-[#f4f5f9] text-[#1e2330] flex flex-col justify-center py-10 px-4">
        <div className="w-full max-w-lg mx-auto space-y-6">
          <div className="flex items-center gap-3.5">
            <img
              src="/cap-logo-black.png"
              alt="CAP"
              className="h-10 w-auto object-contain"
            />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#1f2d5a]">
                Task Board
              </h1>
              <p className="text-[13px] text-[#3b4254]">
                Choose an option below to enter the workspace.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#dce1ec] border-t-4 border-t-[#e8792b] shadow-sm p-6 space-y-5">
            {/* 2 Clear Options: 1- Existing user, 2- New user */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#f4f5f9] rounded-lg border border-[#e2e6f0]">
              <button
                type="button"
                onClick={() => {
                  setAuthOption("existing");
                  setAuthError("");
                  setResetSuccessInfo(null);
                }}
                className={`py-2 px-3 rounded-md text-[13.5px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  authOption === "existing"
                    ? "bg-white text-[#1f2d5a] shadow-xs border border-[#ccd1de]"
                    : "text-[#525b70] hover:text-[#1f2d5a]"
                }`}
              >
                <span>1.</span>
                <span>Existing User</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthOption("new");
                  setAuthError("");
                  setResetSuccessInfo(null);
                }}
                className={`py-2 px-3 rounded-md text-[13.5px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  authOption === "new"
                    ? "bg-white text-[#1f2d5a] shadow-xs border border-[#ccd1de]"
                    : "text-[#525b70] hover:text-[#1f2d5a]"
                }`}
              >
                <span>2.</span>
                <span>New User</span>
              </button>
            </div>

            {authError && (
              <div className="p-3 rounded-lg bg-[#ffe1e5] border border-[#f5c2c7] text-[#9c0006] text-[13px] font-medium flex items-center gap-2">
                <span>⚠️</span>
                <span>{authError}</span>
              </div>
            )}

            {resetSuccessInfo && (
              <div className="p-4 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] text-[#065f46] space-y-2">
                <div className="flex items-center gap-2 font-bold text-[13.5px]">
                  <span>📬</span>
                  <span>Temporary Password Issued & Sent!</span>
                </div>
                <p className="text-[12.5px] text-[#047857]">
                  A temporary password was generated for <strong>{resetSuccessInfo.name}</strong> and sent to <strong>{resetSuccessInfo.email}</strong>.
                </p>
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-[#6ee7b7]">
                  <span className="text-[12px] text-[#065f46] font-medium">Temporary Password:</span>
                  <code className="font-mono-code font-bold text-[14px] text-[#1f2d5a] bg-[#f0f4ff] px-2 py-0.5 rounded">
                    {resetSuccessInfo.tempPassword}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(resetSuccessInfo.tempPassword);
                      showToast("Password copied to clipboard!");
                    }}
                    className="ml-auto text-[11.5px] font-bold text-[#0b69a3] hover:underline cursor-pointer"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-[11.5px] text-[#065f46]">
                  You can sign in now with this password. Once signed in, you can update it anytime using the <strong>UPDATE INFO</strong> button beside &apos;Sign out&apos; on the dashboard.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    handleLogin(resetSuccessInfo.email, resetSuccessInfo.tempPassword);
                  }}
                  disabled={authBusy}
                  className="w-full mt-1 py-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-[13px] font-bold cursor-pointer transition-colors shadow-xs"
                >
                  {authBusy ? "Signing in..." : "Auto-Fill & Sign In Now"}
                </button>
              </div>
            )}

            {authOption === "existing" ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[13px] font-semibold text-[#1f2d5a]">
                      Select your identity
                    </label>
                    <div className="flex items-center gap-1.5 text-[11.5px]">
                      <button
                        type="button"
                        onClick={() => setAuthLoginMethod("roster")}
                        className={`font-semibold cursor-pointer ${
                          authLoginMethod === "roster"
                            ? "text-[#1f2d5a] underline"
                            : "text-[#525b70] hover:text-[#1f2d5a]"
                        }`}
                      >
                        Choose from roster
                      </button>
                      <span className="text-[#ccd1de]">|</span>
                      <button
                        type="button"
                        onClick={() => setAuthLoginMethod("email")}
                        className={`font-semibold cursor-pointer ${
                          authLoginMethod === "email"
                            ? "text-[#1f2d5a] underline"
                            : "text-[#525b70] hover:text-[#1f2d5a]"
                        }`}
                      >
                        Type email
                      </button>
                    </div>
                  </div>

                  {authLoginMethod === "roster" ? (
                    <select
                      value={selectedExistingMemberId}
                      onChange={(e) => {
                        setSelectedExistingMemberId(e.target.value);
                        setAuthError("");
                        setResetSuccessInfo(null);
                        setAuthPassword("");
                        setAuthRetypePassword("");
                      }}
                      className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[13.5px] font-medium text-[#1e2330] focus:outline-none focus:border-[#1f2d5a] bg-white cursor-pointer"
                    >
                      {allRosterMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} — {m.title} ({m.role === "ADMIN" ? "Admin" : "Member"})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="email"
                      required
                      placeholder="e.g. sindidarafat275@gmail.com or md@cap.direct"
                      value={authEmail}
                      onChange={(e) => {
                        setAuthEmail(e.target.value);
                        setAuthError("");
                        setResetSuccessInfo(null);
                      }}
                      className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[13.5px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                    />
                  )}
                </div>

                {/* Member Info Card */}
                <div className="p-3.5 rounded-lg bg-[#f8f9fc] border border-[#dce1ec] space-y-1.5 text-[12.5px]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1f2d5a] text-[13.5px]">
                      {selectedOfficial.name}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        selectedOfficial.role === "ADMIN"
                          ? "bg-[#1f2d5a] text-white"
                          : "bg-[#e8ecf6] text-[#1f2d5a]"
                      }`}
                    >
                      {selectedOfficial.role === "ADMIN" ? "Admin" : "Member"}
                    </span>
                  </div>
                  <div className="text-[#525b70] flex items-center gap-1.5">
                    <span className="font-medium text-[#1f2d5a]">Title:</span> {selectedOfficial.title}
                  </div>
                  <div className="text-[#525b70] flex items-center gap-1.5">
                    <span className="font-medium text-[#1f2d5a]">Official Email:</span>{" "}
                    <code className="text-[#0b69a3] font-mono-code">{selectedOfficial.email}</code>
                  </div>
                  {selectedOfficial.phone && (
                    <div className="text-[#525b70] flex items-center gap-1.5">
                      <span className="font-medium text-[#1f2d5a]">Phone Number:</span>{" "}
                      <span className="font-mono-code font-semibold text-[#1e2330]">{selectedOfficial.phone}</span>
                    </div>
                  )}
                </div>

                {authSubMode === "login" ? (
                  /* Standard Sign In with Password */
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleLogin();
                    }}
                    className="space-y-3.5 pt-1"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[13px] font-semibold text-[#1f2d5a]">
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={handleForgotPassword}
                          disabled={authBusy}
                          className="text-[12px] text-[#0b69a3] hover:underline cursor-pointer font-semibold"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <input
                        type="password"
                        required
                        autoComplete="current-password"
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

                    <div className="flex flex-col items-center gap-1.5 pt-1 text-center">
                      <p className="text-[11.5px] text-[#6b7280]">
                        Default agency password: <code className="bg-[#f0f4ff] text-[#1f2d5a] font-mono-code px-1.5 py-0.5 rounded font-bold">Cap@2026!</code>
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthSubMode("set_password");
                          setAuthError("");
                        }}
                        className="text-[12px] font-bold text-[#e8792b] hover:underline cursor-pointer"
                      >
                        🔑 Set or change personal password
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Set or Change Password */
                  <form onSubmit={handleExistingMemberSetPassword} className="space-y-3.5 pt-1">
                    <div className="p-3 rounded-lg bg-[#eff6ff] border border-[#bfdbfe] text-[12px] text-[#1e3a8a] space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-[12.5px]">
                        <span>🔑</span>
                        <span>Set or Change Personal Password</span>
                      </div>
                      <p>
                        Set a new password for <strong>{selectedOfficial.name}</strong> ({selectedOfficial.email}).
                      </p>
                    </div>

                    <div>
                      <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        required
                        autoComplete="new-password"
                        placeholder="Minimum 4 characters"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[14px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                      />
                    </div>

                    <div>
                      <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                        Retype Password
                      </label>
                      <input
                        type="password"
                        required
                        autoComplete="new-password"
                        placeholder="Confirm password"
                        value={authRetypePassword}
                        onChange={(e) => setAuthRetypePassword(e.target.value)}
                        className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[14px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={authBusy}
                      className="w-full py-2.5 rounded-lg bg-[#1f2d5a] hover:bg-[#2a3a6e] text-white font-semibold text-[14px] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {authBusy ? "Saving password..." : "Set Password & Sign In"}
                    </button>

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthSubMode("login");
                          setAuthError("");
                        }}
                        className="text-[12px] font-bold text-[#0b69a3] hover:underline cursor-pointer"
                      >
                        ← Back to standard Sign In
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              /* Option 2: New User Registration */
              <form onSubmit={handleNewUserRegister} className="space-y-3.5">
                <div className="p-3 rounded-lg bg-[#f0fdf4] border border-[#bbf7d0] text-[12px] text-[#166534] space-y-0.5">
                  <div className="font-bold flex items-center gap-1.5 text-[12.5px]">
                    <span>✨</span>
                    <span>New User Registration</span>
                  </div>
                  <p>Register a new member with full credentials to access the CAP Task Board.</p>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                    Full Name <span className="text-[#e8792b]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jane Doe"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[14px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                    Email Address <span className="text-[#e8792b]">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. jane@cap.direct"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[14px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                    Phone Number <span className="text-[#e8792b]">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +8801700000000"
                    value={authPhone}
                    onChange={(e) => setAuthPhone(e.target.value)}
                    className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[14px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                      Title / Designation
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Visualizer"
                      value={authTeamRole}
                      onChange={(e) => setAuthTeamRole(e.target.value)}
                      className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[14px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                      Account Type
                    </label>
                    <select
                      value={authAccountType}
                      onChange={(e) =>
                        setAuthAccountType(e.target.value as "MEMBER" | "ADMIN")
                      }
                      className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[13px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a] bg-white"
                    >
                      <option value="MEMBER">Member (view only)</option>
                      <option value="ADMIN">Admin (requires approval)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1f2d5a] mb-1">
                      Password <span className="text-[#e8792b]">*</span>
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
                      Retype Password <span className="text-[#e8792b]">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Confirm password"
                      value={authRetypePassword}
                      onChange={(e) => setAuthRetypePassword(e.target.value)}
                      className="w-full rounded-lg border border-[#ccd1de] px-3 py-2 text-[14px] text-[#1e2330] focus:outline-none focus:border-[#1f2d5a]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authBusy}
                  className="w-full py-2.5 rounded-lg bg-[#1f2d5a] hover:bg-[#2a3a6e] text-white font-semibold text-[14px] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {authBusy ? "Creating account..." : "Create Account & Sign In"}
                </button>
              </form>
            )}
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
        {/* Row 1: Logo + Actions */}
        <div className="max-w-[1600px] mx-auto px-3 sm:px-6 h-13 sm:h-12 flex items-center justify-between gap-2 border-b border-[#e8ecf6]">
          <button
            type="button"
            onClick={() => setActiveTab("today")}
            className="flex items-center gap-2 shrink-0 cursor-pointer focus:outline-none"
          >
            <img
              src="/cap-logo-black.png"
              alt="CAP"
              className="h-5 sm:h-6 w-auto object-contain"
            />
            <span className="font-heading font-bold text-[13.5px] text-[#1f2d5a] md:hidden">
              Task Board
            </span>
          </button>

          {/* Desktop Right Utilities */}
          <div className="hidden md:flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#3b4254] border border-[#ccd1de] bg-[#f8f9fc] rounded-lg px-2.5 py-1">
              <span>Date:</span>
              <input
                type="date"
                value={referenceDate}
                onChange={(e) => setReferenceDate(e.target.value)}
                className="bg-transparent text-[#1f2d5a] font-mono-code font-semibold text-[12.5px] focus:outline-none cursor-pointer"
                title="Select a date to view that day's works"
              />
              {referenceDate !== getTodayDateStr() && (
                <button
                  type="button"
                  onClick={() => setReferenceDate(getTodayDateStr())}
                  className="text-[11.5px] font-semibold text-[#e8792b] hover:underline ml-1 cursor-pointer"
                  title="Return to today's present date"
                >
                  Today
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
                className="px-3 py-1 rounded-lg bg-[#e8792b] hover:bg-[#d76a1e] text-white text-[12.5px] font-semibold cursor-pointer transition-colors shadow-2xs"
              >
                + New task
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="px-3 py-1 rounded-lg border border-[#ccd1de] bg-white hover:border-[#1f2d5a] text-[#1f2d5a] text-[12.5px] font-semibold cursor-pointer transition-colors"
            >
              Export CSV
            </button>

            <div className="h-4 w-px bg-[#dce1ec] mx-0.5" />

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
                onClick={() => setShowUpdateInfoModal(true)}
                className="px-2.5 py-1 rounded-md border border-[#ccd1de] bg-white hover:border-[#1f2d5a] hover:bg-[#f0f4ff] text-[#1f2d5a] text-[12px] font-bold cursor-pointer transition-colors shadow-2xs"
                title="Update your personal information, contact number, or password"
              >
                Update info
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="text-[#3b4254] hover:text-[#9c0006] font-medium ml-1 cursor-pointer"
              >
                Sign out
              </button>
            </div>
          </div>

          {/* Mobile Right Utilities */}
          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setEditingTask(null);
                  setShowTaskModal(true);
                }}
                className="px-2.5 py-1 rounded-md bg-[#e8792b] text-white text-[11.5px] font-bold cursor-pointer shadow-2xs"
              >
                + Task
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="px-2 py-1 rounded-md border border-[#ccd1de] bg-white text-[#1f2d5a] text-[11.5px] font-bold cursor-pointer"
            >
              CSV
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="px-2 py-1 rounded-md border border-[#ccd1de] bg-[#f8f9fc] text-[#1f2d5a] text-[11.5px] font-bold cursor-pointer flex items-center gap-1"
            >
              <span className="max-w-[70px] truncate">{currentUser.name.split(" ")[0]}</span>
              <span className="text-[9px] text-[#64748b]">{mobileMenuOpen ? "▲" : "▼"}</span>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-[#dce1ec] p-3 space-y-3 shadow-lg animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-[#e8ecf6]">
              <div>
                <div className="font-bold text-[13.5px] text-[#1e2330]">
                  {currentUser.name}
                </div>
                <div className="text-[11.5px] text-[#64748b]">{currentUser.email}</div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  isAdmin ? "bg-[#1f2d5a] text-white" : "bg-[#e8ecf6] text-[#1f2d5a]"
                }`}
              >
                {isAdmin ? "Admin" : "Member"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#f8f9fc] border border-[#e2e8f0]">
              <span className="text-[12px] font-bold text-[#1f2d5a] shrink-0">Date:</span>
              <div className="flex items-center gap-1.5 flex-1 justify-end">
                <input
                  type="date"
                  value={referenceDate}
                  onChange={(e) => setReferenceDate(e.target.value)}
                  className="bg-white border border-[#ccd1de] rounded px-2 py-0.5 text-[#1f2d5a] font-mono-code font-semibold text-[11.5px] focus:outline-none"
                />
                {referenceDate !== getTodayDateStr() && (
                  <button
                    type="button"
                    onClick={() => setReferenceDate(getTodayDateStr())}
                    className="text-[11px] font-bold text-[#e8792b] bg-[#fdf0e6] px-2 py-0.5 rounded border border-[#e8792b]"
                  >
                    Today
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowUpdateInfoModal(true);
                  setMobileMenuOpen(false);
                }}
                className="py-1.5 px-3 rounded-lg border border-[#ccd1de] bg-white hover:bg-[#f0f4ff] text-[#1f2d5a] text-[12px] font-bold text-center"
              >
                ✏️ Update info
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="py-1.5 px-3 rounded-lg border border-[#ffc7ce] bg-[#ffe1e5] text-[#9c0006] text-[12px] font-bold text-center"
              >
                Sign out
              </button>
            </div>
          </div>
        )}

        {/* Row 2: Horizontal Scrolling Navigation Tabs */}
        <div className="max-w-[1600px] mx-auto px-2 sm:px-6 h-11 sm:h-12 flex items-center gap-2 sm:gap-6 overflow-hidden">
          <button
            type="button"
            onClick={() => setActiveTab("today")}
            className="hidden sm:block font-heading font-bold text-[15px] text-[#1f2d5a] whitespace-nowrap cursor-pointer focus:outline-none"
          >
            Task Board
          </button>

          <div className="h-4 w-px bg-[#dce1ec] shrink-0 hidden sm:block" />

          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap py-1 flex-1 -mx-1 px-1">
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
                  onClick={() => {
                    setActiveTab(tab.id as ActiveTab);
                    setMobileMenuOpen(false);
                  }}
                  className={`px-3 sm:px-3.5 h-9 sm:h-12 text-[12.5px] sm:text-[13.5px] font-semibold border-b-[3px] shrink-0 whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer ${
                    active
                      ? "border-[#e8792b] text-[#1f2d5a] bg-[#f8f9fc]"
                      : "border-transparent text-[#3b4254] hover:text-[#1f2d5a] hover:bg-[#f8f9fc]"
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`text-[10.5px] sm:text-[11.5px] font-mono-code px-1.5 py-0.2 sm:py-0.5 rounded-full font-bold ${
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
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
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
              ].map((kpi, idx) => (
                <div
                  key={kpi.label}
                  className={`bg-white rounded-lg border border-[#dce1ec] border-t-[3px] ${kpi.border} p-2.5 sm:px-4 sm:py-3 shadow-xs ${
                    idx === 6 ? "col-span-2 sm:col-span-1" : ""
                  }`}
                >
                  <div className="text-[11.5px] sm:text-[12.5px] font-semibold text-[#3b4254] truncate">
                    {kpi.label}
                  </div>
                  <div
                    className={`text-xl sm:text-2xl font-bold font-heading mt-0.5 ${kpi.text}`}
                  >
                    {kpi.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Today Ranked Table */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-2">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#1f2d5a]">
                    Today Board
                  </h2>
                  <p className="text-[12px] sm:text-[13px] text-[#3b4254]">
                    Open tasks ranked automatically by urgency and deadline.
                  </p>
                </div>
                {!isAdmin && (
                  <span className="self-start sm:self-auto text-[11.5px] sm:text-[12.5px] font-semibold text-[#1f2d5a] bg-[#e8ecf6] px-2.5 py-1 rounded-md">
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
                      <th className="py-3 px-4 font-semibold text-[12.5px] min-w-[180px]">Task</th>
                      <th className="py-3 px-4 font-semibold text-[12.5px] min-w-[220px]">Description</th>
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
                          <td className="py-3 px-4 max-w-xs font-semibold text-[#1e2330] leading-snug">
                            {t.task}
                          </td>
                          <td className="py-3 px-4 max-w-sm text-[13px] text-[#3b4254] leading-snug">
                            {t.brief || <span className="text-neutral-400 font-normal">—</span>}
                          </td>
                          <td className="py-3 px-3 font-medium text-[#1e2330] whitespace-nowrap">
                            {t.owner ? (
                              <MemberTag name={t.owner} idMap={memberIdMap} />
                            ) : (
                              <span className="text-[#9c0006] font-semibold italic">
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-medium text-[#2d3446] whitespace-nowrap">
                            {t.reviewer ? (
                              <MemberTag name={t.reviewer} idMap={memberIdMap} />
                            ) : (
                              "—"
                            )}
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
            <div className="bg-white rounded-lg border border-[#dce1ec] p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3.5 shadow-xs">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#1f2d5a]">
                  My Works — {selectedMemberName}
                </h2>
                <p className="text-[12px] sm:text-[13px] text-[#3b4254]">
                  Ongoing tasks assigned to {selectedMemberName === currentUser.name ? "you" : selectedMemberName}, ordered by urgency and deadline.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
                <div className="flex items-center gap-2 text-[12.5px] sm:text-[13px]">
                  <span className="font-semibold text-[#3b4254] shrink-0">Member:</span>
                  <select
                    value={selectedMemberName}
                    onChange={(e) => setMyWorksMember(e.target.value)}
                    className="w-full sm:w-auto rounded-lg border border-[#ccd1de] bg-white px-2.5 py-1.5 text-[12.5px] sm:text-[13px] font-semibold text-[#1f2d5a] focus:outline-none focus:border-[#1f2d5a]"
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
                          {m.name} — {m.role}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Sub-tabs: Ongoing vs Reviewing vs Done */}
                <div className="inline-flex rounded-lg border border-[#ccd1de] bg-[#f8f9fc] p-0.5 text-[11.5px] sm:text-[12.5px] overflow-x-auto no-scrollbar whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setMyWorksSubTab("ongoing")}
                    className={`px-2.5 sm:px-3 py-1 rounded-md font-semibold cursor-pointer shrink-0 ${
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
                    className={`px-2.5 sm:px-3 py-1 rounded-md font-semibold cursor-pointer shrink-0 ${
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
                    className={`px-2.5 sm:px-3 py-1 rounded-md font-semibold cursor-pointer shrink-0 ${
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
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
                  className={`bg-white rounded-lg border border-[#dce1ec] border-t-[3px] ${kpi.border} p-2.5 sm:px-4 sm:py-3 shadow-xs`}
                >
                  <div className="text-[11.5px] sm:text-[12.5px] font-semibold text-[#3b4254] truncate">
                    {kpi.label}
                  </div>
                  <div
                    className={`text-xl sm:text-2xl font-bold font-heading mt-0.5 ${kpi.text}`}
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
                      <th className="py-3 px-4 font-semibold text-[12.5px] min-w-[180px]">Task</th>
                      <th className="py-3 px-4 font-semibold text-[12.5px] min-w-[220px]">Description</th>
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
                          colSpan={isAdmin ? 17 : 16}
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
                            <td className="py-3 px-4 max-w-xs font-semibold text-[#1e2330] leading-snug">
                              {t.task}
                            </td>
                            <td className="py-3 px-4 max-w-sm text-[13px] text-[#3b4254] leading-snug">
                              {t.brief || <span className="text-neutral-400 font-normal">—</span>}
                            </td>
                            <td className="py-3 px-3 font-medium text-[#1e2330] whitespace-nowrap">
                              <MemberTag name={t.owner} idMap={memberIdMap} />
                            </td>
                            <td className="py-3 px-3 font-medium text-[#2d3446] whitespace-nowrap">
                              {t.reviewer ? (
                                <MemberTag name={t.reviewer} idMap={memberIdMap} />
                              ) : (
                                "—"
                              )}
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
            <div className="bg-white rounded-lg border border-[#dce1ec] p-3 sm:p-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 flex-1">
                <input
                  type="text"
                  placeholder="Search tasks, clients, owners..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-lg border border-[#ccd1de] bg-white px-3 py-1.5 text-[13px] text-[#1e2330] placeholder:text-[#525b70] w-full sm:w-64 focus:outline-none focus:border-[#1f2d5a]"
                />

                <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
                  <select
                    value={filterClient}
                    onChange={(e) => setFilterClient(e.target.value)}
                    className="rounded-lg border border-[#ccd1de] bg-white px-2 py-1.5 text-[12px] sm:text-[13px] font-medium text-[#1e2330] w-full sm:w-auto"
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
                    className="rounded-lg border border-[#ccd1de] bg-white px-2 py-1.5 text-[12px] sm:text-[13px] font-medium text-[#1e2330] w-full sm:w-auto"
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
                    className="rounded-lg border border-[#ccd1de] bg-white px-2 py-1.5 text-[12px] sm:text-[13px] font-medium text-[#1e2330] w-full sm:w-auto"
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
                    className="rounded-lg border border-[#ccd1de] bg-white px-2 py-1.5 text-[12px] sm:text-[13px] font-medium text-[#1e2330] w-full sm:w-auto"
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
                    className="col-span-2 sm:col-auto rounded-lg border border-[#ccd1de] bg-white px-2 py-1.5 text-[12px] sm:text-[13px] font-medium text-[#1e2330] w-full sm:w-auto"
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
                      className="col-span-2 sm:col-auto text-[12px] sm:text-[13px] font-semibold text-[#e8792b] hover:underline px-2 py-1 cursor-pointer text-center"
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#e8ecf6]">
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
                        Task
                      </th>
                      <th className="py-3 px-2.5 font-semibold text-[12.5px]">
                        Description
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
                            ) : t.owner ? (
                              <MemberTag name={t.owner} idMap={memberIdMap} />
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-3 px-2 text-[13px] font-medium text-[#2d3446] whitespace-nowrap">
                            {t.team || "—"}
                          </td>
                          <td className="py-3 px-2.5 text-[13px] font-medium text-[#2d3446] whitespace-nowrap">
                            {t.reviewer ? (
                              <MemberTag name={t.reviewer} idMap={memberIdMap} />
                            ) : (
                              "—"
                            )}
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
                            {t.brief && (
                              <p className="text-[12px] text-[#525b70] line-clamp-2 leading-snug">
                                {t.brief}
                              </p>
                            )}
                            <div className="flex items-center justify-between text-[12.5px] text-[#2d3446] font-medium">
                              <span className="truncate">{t.client}</span>
                              <PriorityBadge priority={t.priority} />
                            </div>
                            <div className="pt-2 border-t border-[#e3e6ee] flex items-center justify-between text-[12px] text-[#3b4254] font-medium">
                              <span>
                                {t.owner ? (
                                  <MemberTag name={t.owner} idMap={memberIdMap} />
                                ) : (
                                  "Unassigned"
                                )}
                              </span>
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
            team={team}
            users={users}
            memberIdMap={memberIdMap}
            isAdmin={isAdmin}
            apiFetch={apiFetch}
            onSuccess={(msg) => showToast(msg)}
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
            users={users}
            referenceDate={referenceDate}
            memberIdMap={memberIdMap}
            isAdmin={isAdmin}
            apiFetch={apiFetch}
            onSuccess={(msg) => showToast(msg)}
          />
        )}

        {/* =====================================================
            TAB 5: CLIENTS & PITCHES
            ===================================================== */}
        {activeTab === "clients" && (
          <ClientsPitchesView
            clients={computedClients}
            team={team}
            memberIdMap={memberIdMap}
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
            users={users}
            estimateBuffer={estimateBuffer}
            isAdmin={isAdmin}
            apiFetch={apiFetch}
            onSuccess={(msg) => showToast(msg)}
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
            team={team}
            memberIdMap={memberIdMap}
            activityLog={activityLog}
            apiFetch={apiFetch}
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

      {/* Export CSV Modal */}
      <ExportCsvModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        referenceDate={referenceDate}
        allTasks={computedTasks}
        filteredTasks={filteredTasks}
        todayTasks={todaySummary.rankedTasks}
        myWorksTasks={[
          ...myWorksData.ongoingOwned,
          ...myWorksData.waitingMyReview,
          ...myWorksData.completedOwned,
        ]}
        clients={computedClients}
        team={team}
        selectedMemberName={selectedMemberName}
        onExportSuccess={(msg) => showToast(msg)}
      />

      {/* Update Info Modal (accessible on dashboard beside Sign out) */}
      {currentUser && (
        <UpdateInfoModal
          isOpen={showUpdateInfoModal}
          onClose={() => setShowUpdateInfoModal(false)}
          currentUser={currentUser}
          apiFetch={apiFetch}
          onSuccess={(msg) => showToast(msg)}
          saveLocalPasswordHash={saveLocalPasswordHash}
          saveLocalUserRecord={saveLocalUserRecord}
          setCurrentUser={setCurrentUser}
          fetchBoard={fetchBoard}
        />
      )}
    </div>
  );
}
