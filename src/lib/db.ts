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
      }
    }
  } else {
    db.users = initial.users;
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
