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
  try {
    if (fs.existsSync(TMP_DB_FILE)) {
      const raw = fs.readFileSync(TMP_DB_FILE, "utf-8");
      return JSON.parse(raw) as DatabaseSchema;
    }
  } catch {
    // ignore tmp read errors
  }

  try {
    if (fs.existsSync(LOCAL_DB_FILE)) {
      const raw = fs.readFileSync(LOCAL_DB_FILE, "utf-8");
      return JSON.parse(raw) as DatabaseSchema;
    }
  } catch {
    // ignore local read errors
  }

  return null;
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
  const kvData = await readFromVercelKV();
  if (kvData) {
    globalThis.__capDbCache = kvData;
    return kvData;
  }

  if (globalThis.__capDbCache) {
    return globalThis.__capDbCache;
  }

  const diskData = readFromDisk();
  if (diskData) {
    globalThis.__capDbCache = diskData;
    return diskData;
  }

  const initial = createInitialDatabase();
  globalThis.__capDbCache = initial;
  writeToDisk(initial);
  await writeToVercelKV(initial);
  return initial;
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
