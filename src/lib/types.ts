export type WorkType = "Client" | "Pitch" | "Internal" | string;
export type Priority = "High" | "Medium" | "Low" | "";
export type TaskStatus =
  | "Not started"
  | "In progress"
  | "Internal review"
  | "Client review"
  | "Revisions"
  | "Done"
  | "On hold";

export type TaskFlag =
  | "Overdue"
  | "Due today"
  | "Due soon"
  | "Blocked"
  | "No deadline"
  | "On track"
  | "On hold"
  | "Done"
  | "";

export interface TaskRecord {
  id: string;
  dateAdded: string; // YYYY-MM-DD
  client: string;
  workType: WorkType;
  task: string;
  brief: string;
  owner: string;
  team: string;
  reviewer: string;
  priority: Priority;
  startDate: string; // YYYY-MM-DD or ""
  internalDeadline: string; // YYYY-MM-DD or ""
  clientDeadline: string; // YYYY-MM-DD or ""
  estHours: number | null;
  status: TaskStatus;
  blockedBy: string;
  blockedSince: string; // YYYY-MM-DD or ""
  deliveredOn: string; // YYYY-MM-DD or ""
  completedOn: string; // YYYY-MM-DD or ""
  actualHours: number | null;
  revisions: number | null;
  firstRoundApproved: "Yes" | "No" | "";
  notes: string;
}

export interface ComputedTask extends TaskRecord {
  logRow: number; // 5-based row index matching Excel Task Log
  daysLeft: number | null;
  flag: TaskFlag;
  onTime: "Yes" | "No" | "";
  daysLate: number | null;
  daysBlocked: number | null;
  urgency: number | null; // 1 to 7
  todaySortKey: number | null;
  todayRank: number | null;
  upcomingSortKey: number | null;
  upcomingRank: number | null;
}

export type AccountStatus = "Active" | "Pitching" | "Won" | "Lost" | "Paused" | "";

export interface ClientRecord {
  id: string;
  name: string;
  type: "Client" | "Pitch" | "Internal";
  accountLead: string;
  accountStatus: AccountStatus;
  notes: string;
}

export interface ComputedClient extends ClientRecord {
  openTasks: number;
  overdue: number;
  openEstHrs: number;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  team: "Creative" | "Servicing" | "C-Suite" | "Strategy and Data" | "Admin" | string;
  dailyCapacity: number;
  notes: string;
}

export type UserRole = "ADMIN" | "MEMBER";
export type AdminRequestStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED";

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  adminRequestStatus: AdminRequestStatus;
  teamRole: string;
  approvedBy: string | null;
  approvedAt: string | null;
  requestedAt: string | null;
  createdAt: string;
}

export type SafeUserAccount = Omit<UserAccount, "passwordHash">;

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorEmail: string;
  action: string;
  details: string;
  category: "TASK" | "ADMIN_ROOM" | "CLIENT" | "TEAM";
}

export interface DatabaseSchema {
  tasks: TaskRecord[];
  clients: ClientRecord[];
  team: TeamMember[];
  estimateBuffer: number; // e.g. 0.2 for 20%
  users: UserAccount[];
  activityLog: ActivityLogEntry[];
}
