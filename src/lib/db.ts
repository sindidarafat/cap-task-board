import fs from "fs";
import path from "path";
import os from "os";
import { ActivityLogEntry, DatabaseSchema, SafeUserAccount, UserAccount } from "./types";
import { createInitialDatabase } from "./seed-data";

declare global {
  // eslint-disable-next-line no-var
  var __capDbCache: DatabaseSchema | undefined;
}

const LOCAL_DATA_DIR = path.join(process.cwd(), "data");
const LOCAL_DB_FILE = path.join(LOCAL_DATA_DIR, "db.json");
const TMP_DB_FILE = path.join(os.tmpdir(), "cap-taskboard-db.json");

function readFromDisk(): DatabaseSchema | null {
  let localData: DatabaseSchema | null = null;
  let localMtime = 0;
  let tmpData: DatabaseSchema | null = null;
  let tmpMtime = 0;

  try {
    if (fs.existsSync(LOCAL_DB_FILE)) {
      localMtime = fs.statSync(LOCAL_DB_FILE).mtimeMs;
      const raw = fs.readFileSync(LOCAL_DB_FILE, "utf-8");
      localData = JSON.parse(raw) as DatabaseSchema;
    }
  } catch {
    // ignore local read errors
  }

  try {
    if (fs.existsSync(TMP_DB_FILE)) {
      tmpMtime = fs.statSync(TMP_DB_FILE).mtimeMs;
      const raw = fs.readFileSync(TMP_DB_FILE, "utf-8");
      tmpData = JSON.parse(raw) as DatabaseSchema;
    }
  } catch {
    // ignore tmp read errors
  }

  if (localData && tmpData) {
    return tmpMtime > localMtime ? tmpData : localData;
  }
  return localData || tmpData || null;
}

function writeToDisk(data: DatabaseSchema): void {
  const json = JSON.stringify(data, null, 2);
  try {
    if (!fs.existsSync(LOCAL_DATA_DIR)) {
      fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_DB_FILE, json, "utf-8");
  } catch {
    // On Vercel serverless, process.cwd() is read-only; write to /tmp instead
  }

  try {
    fs.writeFileSync(TMP_DB_FILE, json, "utf-8");
  } catch {
    // ignore tmp write errors
  }
}

async function readFromVercelKV(): Promise<DatabaseSchema | null> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const res = await fetch(`${url}/get/cap_taskboard_db`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: string | null };
    if (!body.result) return null;
    return JSON.parse(body.result) as DatabaseSchema;
  } catch {
    return null;
  }
}

async function writeToVercelKV(data: DatabaseSchema): Promise<void> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;

  try {
    await fetch(`${url}/set/cap_taskboard_db`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(JSON.stringify(data)),
    });
  } catch {
    // ignore KV write errors
  }
}

export async function getDb(): Promise<DatabaseSchema> {
  const initial = createInitialDatabase();
  let db: DatabaseSchema | null = null;

  const kvData = await readFromVercelKV();
  if (kvData) {
    db = kvData;
  } else if (globalThis.__capDbCache) {
    db = globalThis.__capDbCache;
  } else {
    const diskData = readFromDisk();
    if (diskData) {
      db = diskData;
    } else {
      db = initial;
    }
  }

  // Guarantee that every seed team account is present in db.users
  if (Array.isArray(db.users)) {
    for (const initUser of initial.users) {
      const idx = db.users.findIndex(
        (u) =>
          u.email.toLowerCase() === initUser.email.toLowerCase() ||
          u.id === initUser.id
      );
      if (idx === -1) {
        db.users.push(initUser);
      } else {
        // If the existing user was pre-seeded as admin, make sure their role stays ADMIN
        if (initUser.role === "ADMIN" && db.users[idx].role !== "ADMIN") {
          db.users[idx].role = "ADMIN";
          db.users[idx].adminRequestStatus = "APPROVED";
        }
        if (initUser.phone && !db.users[idx].phone) {
          db.users[idx].phone = initUser.phone;
        }
        if (initUser.aliases) {
          db.users[idx].aliases = initUser.aliases;
        }
      }
    }
    // Ensure all users with password hashes have passwordSet marked true
    for (const u of db.users) {
      if (u.passwordHash && u.passwordSet === undefined) {
        u.passwordSet = true;
      }
    }
  } else {
    db.users = initial.users;
  }

  // Guarantee team roster has emails, phones, and aliases
  if (Array.isArray(db.team)) {
    for (const initMember of initial.team) {
      const tIdx = db.team.findIndex((m) => m.id === initMember.id);
      if (tIdx === -1) {
        db.team.push(initMember);
      } else {
        if (initMember.phone && !db.team[tIdx].phone) {
          db.team[tIdx].phone = initMember.phone;
        }
        if (initMember.email && !db.team[tIdx].email) {
          db.team[tIdx].email = initMember.email;
        }
        if (initMember.aliases) {
          db.team[tIdx].aliases = initMember.aliases;
        }
      }
    }
  } else {
    db.team = initial.team;
  }

  if (!db.settings) {
    db.settings = {
      resendApiKey: "",
      resendFromEmail: "CAP Task Board <onboarding@resend.dev>",
    };
  }

  globalThis.__capDbCache = db;
  return db;
}

export async function saveDb(data: DatabaseSchema): Promise<DatabaseSchema> {
  globalThis.__capDbCache = data;
  writeToDisk(data);
  await writeToVercelKV(data);
  return data;
}

export function sanitizeUser(u: UserAccount): SafeUserAccount {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safe } = u;
  return safe;
}

export function appendActivity(
  db: DatabaseSchema,
  entry: Omit<ActivityLogEntry, "id" | "timestamp">
): void {
  const nextId = `ACT-${String(db.activityLog.length + 1).padStart(3, "0")}`;
  db.activityLog.unshift({
    id: nextId,
    timestamp: new Date().toISOString(),
    ...entry,
  });
  if (db.activityLog.length > 200) {
    db.activityLog = db.activityLog.slice(0, 200);
  }
}

/**
 * Synchronize client-cached users and credentials into server DB memory & disk.
 * This ensures that on Vercel serverless cold starts or multi-lambda environments,
 * user registrations, password updates, and profile edits are never lost.
 */
export function syncClientUsersToDb(
  db: DatabaseSchema,
  clientUsers: unknown[]
): boolean {
  if (!Array.isArray(clientUsers) || clientUsers.length === 0) return false;
  let changed = false;

  for (const raw of clientUsers) {
    if (!raw || typeof raw !== "object") continue;
    const cu = raw as Partial<UserAccount>;
    if (!cu.email) continue;
    const email = String(cu.email).trim().toLowerCase();

    const idx = db.users.findIndex(
      (u) =>
        u.email.toLowerCase() === email ||
        (cu.id && u.id === cu.id) ||
        (cu.name && u.name.toLowerCase() === String(cu.name).trim().toLowerCase())
    );

    if (idx >= 0) {
      const u = db.users[idx];
      if (
        cu.passwordHash &&
        typeof cu.passwordHash === "string" &&
        cu.passwordHash.startsWith("$2") &&
        u.passwordHash !== cu.passwordHash
      ) {
        u.passwordHash = cu.passwordHash;
        changed = true;
      }
      if (cu.passwordSet !== undefined && u.passwordSet !== cu.passwordSet) {
        u.passwordSet = cu.passwordSet;
        changed = true;
      }
      if (cu.phone && !u.phone) {
        u.phone = cu.phone;
        changed = true;
      }
      if (
        cu.teamRole &&
        (!u.teamRole || u.teamRole === "Team Member") &&
        cu.teamRole !== "Team Member"
      ) {
        u.teamRole = cu.teamRole;
        changed = true;
      }
      if (cu.role && cu.role === "ADMIN" && u.role !== "ADMIN") {
        u.role = "ADMIN";
        u.adminRequestStatus = cu.adminRequestStatus || "APPROVED";
        changed = true;
      }
      if (cu.name && u.name !== cu.name && cu.name.trim().length > 2) {
        const aliases = new Set(u.aliases || []);
        aliases.add(u.name);
        aliases.add(cu.name.trim());
        u.aliases = Array.from(aliases);
      }
      // Keep matching team member in sync
      const tm = db.team.find(
        (m) =>
          (u.memberId && m.id === u.memberId) ||
          m.name.toLowerCase() === u.name.toLowerCase()
      );
      if (tm) {
        if (u.phone && !tm.phone) tm.phone = u.phone;
        if (u.email && !tm.email) tm.email = u.email;
        if (u.teamRole && !tm.role) tm.role = u.teamRole;
      }
    } else {
      // User registered on client or another instance, restore into this instance
      const memberId =
        cu.memberId ||
        `M-${String(db.team.length + 1).padStart(3, "0")}-${Date.now().toString().slice(-3)}`;
      const newUser: UserAccount = {
        id: cu.id || `U-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        memberId,
        name: cu.name || email.split("@")[0],
        email: email,
        phone: cu.phone || "",
        passwordHash:
          cu.passwordHash ||
          "$2b$08$6Ho0U1H4A7r9waJkq2KkEus5VGKLZufqQUzPqMps1teMw2dlIO8pC",
        passwordSet: cu.passwordSet ?? true,
        role: cu.role || "MEMBER",
        adminRequestStatus: cu.adminRequestStatus || "NONE",
        teamRole: cu.teamRole || "Team Member",
        approvedBy: cu.approvedBy || null,
        approvedAt: cu.approvedAt || null,
        requestedAt: cu.requestedAt || null,
        createdAt: cu.createdAt || new Date().toISOString(),
        aliases: cu.aliases || [cu.name || email],
      };
      db.users.push(newUser);
      changed = true;

      // Also ensure present in db.team so they appear on team roster!
      const tmIdx = db.team.findIndex(
        (m) =>
          (newUser.memberId && m.id === newUser.memberId) ||
          m.name.toLowerCase() === newUser.name.toLowerCase()
      );
      if (tmIdx === -1) {
        db.team.push({
          id: newUser.memberId || newUser.id,
          name: newUser.name,
          role: newUser.teamRole || "Team Member",
          team: "Creative",
          dailyCapacity: 6,
          notes: "Synchronized account",
          phone: newUser.phone,
          email: newUser.email,
        });
      }
    }
  }

  return changed;
}
