import {
  ClientRecord,
  ComputedClient,
  ComputedTask,
  TaskFlag,
  TaskRecord,
  TeamMember,
} from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseDateUTC(dateStr: string | null | undefined): number | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return Date.UTC(y, m - 1, d);
}

export function formatDateUTC(ms: number): string {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getTodayDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function diffDays(targetDateStr: string, baseDateStr: string): number | null {
  const t = parseDateUTC(targetDateStr);
  const b = parseDateUTC(baseDateStr);
  if (t === null || b === null) return null;
  return Math.round((t - b) / MS_PER_DAY);
}

/**
 * Computes all derived columns for Task Log, matching the exact Excel formulas in CAP_Task_Board.xlsx
 */
export function computeTasks(
  tasks: TaskRecord[],
  clients: ClientRecord[],
  team: TeamMember[],
  todayStr: string = getTodayDateStr()
): ComputedTask[] {
  const clientTypeMap = new Map<string, string>();
  for (const c of clients) {
    clientTypeMap.set(c.name.trim().toLowerCase(), c.type);
  }

  const memberTeamMap = new Map<string, string>();
  for (const m of team) {
    memberTeamMap.set(m.name.trim().toLowerCase(), m.team);
  }

  const base2025Ms = Date.UTC(2025, 0, 1);

  const intermediate = tasks.map((t, idx) => {
    const logRow = idx + 5; // Row 5 is the first task in Excel
    const hasTitle = Boolean(t.task && t.task.trim() !== "");

    // Lookup workType from Clients & Pitches if client matches
    const lookedUpWorkType = t.client
      ? clientTypeMap.get(t.client.trim().toLowerCase()) || t.workType || "Not listed"
      : "";
    const workType = t.workType || lookedUpWorkType;

    // Lookup team from Team sheet if owner matches
    const lookedUpTeam = t.owner
      ? memberTeamMap.get(t.owner.trim().toLowerCase()) || t.team || ""
      : "";
    const resolvedTeam = lookedUpTeam || t.team || "";

    const isDone = t.status === "Done";
    const isOnHold = t.status === "On hold";
    const hasBlockedBy = Boolean(t.blockedBy && t.blockedBy.trim() !== "");
    const hasInternalDeadline = Boolean(
      t.internalDeadline && t.internalDeadline.trim() !== ""
    );

    // Days left: =IF(OR(E5="",L5="",O5="Done"),"",L5-TODAY())
    const daysLeft =
      !hasTitle || !hasInternalDeadline || isDone
        ? null
        : diffDays(t.internalDeadline, todayStr);

    // Flag:
    // =IF(E5="","",IF(O5="Done","Done",IF(O5="On hold","On hold",IF(P5<>"","Blocked",IF(L5="","No deadline",IF(L5<TODAY(),"Overdue",IF(L5=TODAY(),"Due today",IF(L5-TODAY()<=2,"Due soon","On track"))))))))
    let flag: TaskFlag = "";
    if (hasTitle) {
      if (isDone) {
        flag = "Done";
      } else if (isOnHold) {
        flag = "On hold";
      } else if (hasBlockedBy) {
        flag = "Blocked";
      } else if (!hasInternalDeadline || daysLeft === null) {
        flag = "No deadline";
      } else if (daysLeft < 0) {
        flag = "Overdue";
      } else if (daysLeft === 0) {
        flag = "Due today";
      } else if (daysLeft <= 2) {
        flag = "Due soon";
      } else {
        flag = "On track";
      }
    }

    // On time?: =IF(OR(R5="",L5=""),"",IF(R5<=L5,"Yes","No"))
    let onTime: "Yes" | "No" | "" = "";
    let daysLate: number | null = null;
    if (t.deliveredOn && t.internalDeadline) {
      const delDiff = diffDays(t.deliveredOn, t.internalDeadline);
      if (delDiff !== null) {
        if (delDiff <= 0) {
          onTime = "Yes";
        } else {
          onTime = "No";
          daysLate = delDiff;
        }
      }
    }

    // Days blocked: =IF(OR(P5="",Q5=""),"",TODAY()-Q5)
    let daysBlocked: number | null = null;
    if (hasBlockedBy && t.blockedSince) {
      daysBlocked = diffDays(todayStr, t.blockedSince);
    }

    // Urgency (1-7):
    // =IF(OR(E5="",O5="Done",O5="On hold"),"",IF(J5="High",3,IF(J5="Medium",2,1))+IF(L5="",0,IF(L5<TODAY(),4,IF(L5=TODAY(),3,IF(L5-TODAY()<=1,2,IF(L5-TODAY()<=3,1,0))))))
    let urgency: number | null = null;
    if (hasTitle && !isDone && !isOnHold) {
      const prioScore =
        t.priority === "High" ? 3 : t.priority === "Medium" ? 2 : 1;
      let deadlineScore = 0;
      if (hasInternalDeadline && daysLeft !== null) {
        if (daysLeft < 0) deadlineScore = 4;
        else if (daysLeft === 0) deadlineScore = 3;
        else if (daysLeft <= 1) deadlineScore = 2;
        else if (daysLeft <= 3) deadlineScore = 1;
        else deadlineScore = 0;
      }
      urgency = prioScore + deadlineScore;
    }

    // Today sort key:
    // =IF(AC5="","",IF(OR(L5="",L5<=TODAY()+2,O5="In progress",O5="Internal review",O5="Client review",O5="Revisions"),AC5*100000000+IF(L5="",0,(90000-(L5-DATE(2025,1,1)))*1000)+(1000-ROW()),""))
    let todaySortKey: number | null = null;
    const activeStatusForToday =
      t.status === "In progress" ||
      t.status === "Internal review" ||
      t.status === "Client review" ||
      t.status === "Revisions";

    if (
      urgency !== null &&
      (!hasInternalDeadline ||
        (daysLeft !== null && daysLeft <= 2) ||
        activeStatusForToday)
    ) {
      const lMs = parseDateUTC(t.internalDeadline);
      const dateOffset =
        lMs === null
          ? 0
          : (90000 - Math.round((lMs - base2025Ms) / MS_PER_DAY)) * 1000;
      todaySortKey = urgency * 100000000 + dateOffset + (1000 - logRow);
    }

    // Upcoming sort key:
    // =IF(OR(AC5="",L5=""),"",IF(AND(L5>TODAY(),L5<=TODAY()+14),(90000-(L5-DATE(2025,1,1)))*1000+(1000-ROW()),""))
    let upcomingSortKey: number | null = null;
    if (
      urgency !== null &&
      hasInternalDeadline &&
      daysLeft !== null &&
      daysLeft > 0 &&
      daysLeft <= 14
    ) {
      const lMs = parseDateUTC(t.internalDeadline)!;
      const dateOffset =
        (90000 - Math.round((lMs - base2025Ms) / MS_PER_DAY)) * 1000;
      upcomingSortKey = dateOffset + (1000 - logRow);
    }

    return {
      ...t,
      workType,
      team: resolvedTeam,
      logRow,
      daysLeft,
      flag,
      onTime,
      daysLate,
      daysBlocked,
      urgency,
      todaySortKey,
      todayRank: null as number | null,
      upcomingSortKey,
      upcomingRank: null as number | null,
    };
  });

  // Compute todayRank and upcomingRank (1 = highest sort key)
  const validTodayKeys = intermediate
    .map((x) => x.todaySortKey)
    .filter((k): k is number => k !== null);
  const validUpcomingKeys = intermediate
    .map((x) => x.upcomingSortKey)
    .filter((k): k is number => k !== null);

  return intermediate.map((item) => {
    const todayRank =
      item.todaySortKey === null
        ? null
        : validTodayKeys.filter((k) => k > item.todaySortKey!).length + 1;
    const upcomingRank =
      item.upcomingSortKey === null
        ? null
        : validUpcomingKeys.filter((k) => k > item.upcomingSortKey!).length + 1;

    return {
      ...item,
      todayRank,
      upcomingRank,
    };
  });
}

export interface TodayBoardSummary {
  openTasks: number;
  overdue: number;
  dueToday: number;
  blocked: number;
  noDeadline: number;
  openPitchTasks: number;
  noOwner: number;
  rankedTasks: ComputedTask[];
}

export function computeTodayBoard(tasks: ComputedTask[]): TodayBoardSummary {
  const validTasks = tasks.filter((t) => Boolean(t.task && t.task.trim() !== ""));
  const openList = validTasks.filter((t) => t.status !== "Done");

  const openTasks = openList.length;
  const overdue = validTasks.filter((t) => t.flag === "Overdue").length;
  const dueToday = validTasks.filter((t) => t.flag === "Due today").length;
  const blocked = validTasks.filter((t) => t.flag === "Blocked").length;
  const noDeadline = validTasks.filter((t) => t.flag === "No deadline").length;
  const openPitchTasks = openList.filter((t) => t.workType === "Pitch").length;
  const noOwner = openList.filter((t) => !t.owner || t.owner.trim() === "").length;

  const rankedTasks = [...validTasks]
    .filter((t) => t.todayRank !== null)
    .sort((a, b) => (a.todayRank ?? 9999) - (b.todayRank ?? 9999));

  return {
    openTasks,
    overdue,
    dueToday,
    blocked,
    noDeadline,
    openPitchTasks,
    noOwner,
    rankedTasks,
  };
}

/**
 * Generates the next 6 working days starting from todayStr (Sunday-Thursday workweek, skipping Friday=5 and Saturday=6 in JS getUTCDay()).
 */
export function getNextSixWorkingDays(todayStr: string): string[] {
  const startMs = parseDateUTC(todayStr) ?? Date.now();
  const days: string[] = [];
  let currentMs = startMs;

  // First day in Excel is =TODAY()
  days.push(formatDateUTC(currentMs));

  while (days.length < 6) {
    currentMs += MS_PER_DAY;
    const dow = new Date(currentMs).getUTCDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
    if (dow === 5) {
      // Friday -> skip 2 days to Sunday
      currentMs += 2 * MS_PER_DAY;
    } else if (dow === 6) {
      // Saturday -> skip 1 day to Sunday
      currentMs += 1 * MS_PER_DAY;
    }
    days.push(formatDateUTC(currentMs));
  }
  return days;
}

export interface PersonLoadRow {
  person: string;
  role: string;
  team: string;
  overdue: number;
  dailyCounts: number[]; // length 6 matching workingDays
  openEstHrsAll: number;
  hrsDueByLastDayWithBuffer: number;
  capacitySixDays: number;
  loadRatio: number; // e.g. 0.0667 for 6.7%
}

export interface ComingUpSummary {
  workingDays: string[];
  personRows: PersonLoadRow[];
  dueNext14Days: ComputedTask[];
}

export function computeComingUp(
  tasks: ComputedTask[],
  team: TeamMember[],
  estimateBuffer: number,
  todayStr: string = getTodayDateStr()
): ComingUpSummary {
  const workingDays = getNextSixWorkingDays(todayStr);
  const lastWorkingDay = workingDays[workingDays.length - 1];
  const lastWorkingDayMs = parseDateUTC(lastWorkingDay)!;

  const personRows: PersonLoadRow[] = team.map((member) => {
    const nameKey = member.name.trim().toLowerCase();
    const memberOpenTasks = tasks.filter(
      (t) =>
        t.task.trim() !== "" &&
        t.owner.trim().toLowerCase() === nameKey &&
        t.status !== "Done"
    );

    const overdue = tasks.filter(
      (t) =>
        t.task.trim() !== "" &&
        t.owner.trim().toLowerCase() === nameKey &&
        t.flag === "Overdue"
    ).length;

    const dailyCounts = workingDays.map((dayStr) => {
      return memberOpenTasks.filter((t) => t.internalDeadline === dayStr).length;
    });

    const openEstHrsAll = memberOpenTasks.reduce(
      (sum, t) => sum + (t.estHours ?? 0),
      0
    );

    const hrsDueByLastDayRaw = memberOpenTasks
      .filter((t) => {
        const dlMs = parseDateUTC(t.internalDeadline);
        return dlMs !== null && dlMs <= lastWorkingDayMs;
      })
      .reduce((sum, t) => sum + (t.estHours ?? 0), 0);

    const hrsDueByLastDayWithBuffer = hrsDueByLastDayRaw * (1 + estimateBuffer);
    const capacitySixDays = (member.dailyCapacity || 6) * 6;
    const loadRatio =
      capacitySixDays > 0 ? hrsDueByLastDayWithBuffer / capacitySixDays : 0;

    return {
      person: member.name,
      role: member.role,
      team: member.team,
      overdue,
      dailyCounts,
      openEstHrsAll,
      hrsDueByLastDayWithBuffer,
      capacitySixDays,
      loadRatio,
    };
  });

  const dueNext14Days = [...tasks]
    .filter((t) => t.upcomingRank !== null)
    .sort((a, b) => (a.upcomingRank ?? 9999) - (b.upcomingRank ?? 9999));

  return {
    workingDays,
    personRows,
    dueNext14Days,
  };
}

export interface ScorecardRow {
  person: string;
  role: string;
  team: string;
  openNow: number;
  overdueNow: number;
  deliveredInPeriod: number;
  deliveredOnTime: number;
  onTimePct: number | null;
  avgRevisions: number | null;
  firstRoundApprovalPct: number | null;
  estHrsDelivered: number;
  actualHrs: number;
  estimateAccuracy: number | null;
  reviewsWaitingOnThem: number;
}

export function computeScorecard(
  tasks: ComputedTask[],
  team: TeamMember[],
  fromDateStr: string,
  toDateStr: string
): ScorecardRow[] {
  const fromMs = parseDateUTC(fromDateStr);
  const toMs = parseDateUTC(toDateStr);

  return team.map((member) => {
    const nameKey = member.name.trim().toLowerCase();
    const ownerTasks = tasks.filter(
      (t) => t.task.trim() !== "" && t.owner.trim().toLowerCase() === nameKey
    );

    const openNow = ownerTasks.filter((t) => t.status !== "Done").length;
    const overdueNow = ownerTasks.filter((t) => t.flag === "Overdue").length;

    const deliveredTasks = ownerTasks.filter((t) => {
      if (!t.deliveredOn) return false;
      const dMs = parseDateUTC(t.deliveredOn);
      if (dMs === null) return false;
      if (fromMs !== null && dMs < fromMs) return false;
      if (toMs !== null && dMs > toMs) return false;
      return true;
    });

    const deliveredInPeriod = deliveredTasks.length;
    const deliveredOnTime = deliveredTasks.filter(
      (t) => t.onTime === "Yes"
    ).length;

    const onTimePct =
      deliveredInPeriod > 0 ? (deliveredOnTime / deliveredInPeriod) * 100 : null;

    const totalRevisions = deliveredTasks.reduce(
      (sum, t) => sum + (t.revisions ?? 0),
      0
    );
    const avgRevisions =
      deliveredInPeriod > 0 ? totalRevisions / deliveredInPeriod : null;

    const firstRoundApprovedCount = deliveredTasks.filter(
      (t) => t.firstRoundApproved === "Yes"
    ).length;
    const firstRoundApprovalPct =
      deliveredInPeriod > 0
        ? (firstRoundApprovedCount / deliveredInPeriod) * 100
        : null;

    const estHrsDelivered = deliveredTasks.reduce(
      (sum, t) => sum + (t.estHours ?? 0),
      0
    );
    const actualHrs = deliveredTasks.reduce(
      (sum, t) => sum + (t.actualHours ?? 0),
      0
    );
    const estimateAccuracy =
      actualHrs > 0 ? (estHrsDelivered / actualHrs) * 100 : null;

    const reviewsWaitingOnThem = tasks.filter(
      (t) =>
        t.task.trim() !== "" &&
        t.reviewer.trim().toLowerCase() === nameKey &&
        t.status === "Internal review"
    ).length;

    return {
      person: member.name,
      role: member.role,
      team: member.team,
      openNow,
      overdueNow,
      deliveredInPeriod,
      deliveredOnTime,
      onTimePct,
      avgRevisions,
      firstRoundApprovalPct,
      estHrsDelivered,
      actualHrs,
      estimateAccuracy,
      reviewsWaitingOnThem,
    };
  });
}

export function computeClients(
  clients: ClientRecord[],
  tasks: ComputedTask[]
): ComputedClient[] {
  return clients.map((c) => {
    const cKey = c.name.trim().toLowerCase();
    const clientTasks = tasks.filter(
      (t) => t.task.trim() !== "" && t.client.trim().toLowerCase() === cKey
    );
    const openTasks = clientTasks.filter((t) => t.status !== "Done").length;
    const overdue = clientTasks.filter((t) => t.flag === "Overdue").length;
    const openEstHrs = clientTasks
      .filter((t) => t.status !== "Done")
      .reduce((sum, t) => sum + (t.estHours ?? 0), 0);

    return {
      ...c,
      openTasks,
      overdue,
      openEstHrs,
    };
  });
}
