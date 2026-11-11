import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isApprovedAdmin } from "@/lib/auth";
import { appendActivity, getDb, saveDb } from "@/lib/db";
import { getTodayDateStr } from "@/lib/formulas";
import { TaskRecord } from "@/lib/types";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!isApprovedAdmin(user)) {
    return NextResponse.json(
      { error: "Forbidden: Only approved Admins can add tasks." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const db = await getDb();

  // Generate next T-XXX ID
  const maxNum = db.tasks.reduce((max, t) => {
    const match = t.id.match(/^T-(\d+)$/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  const nextId = `T-${String(maxNum + 1).padStart(3, "0")}`;

  // Auto-resolve workType from client and team from owner if not provided
  const matchedClient = db.clients.find(
    (c) => c.name.trim().toLowerCase() === (body.client || "").trim().toLowerCase()
  );
  const matchedMember = db.team.find(
    (m) => m.name.trim().toLowerCase() === (body.owner || "").trim().toLowerCase()
  );

  const newTask: TaskRecord = {
    id: nextId,
    dateAdded: body.dateAdded || getTodayDateStr(),
    client: (body.client || "").trim(),
    workType: body.workType || matchedClient?.type || "Client",
    task: (body.task || "").trim(),
    brief: body.brief || "",
    owner: (body.owner || "").trim(),
    team: body.team || matchedMember?.team || "",
    reviewer: (body.reviewer || "").trim(),
    priority: body.priority || "High",
    startDate: body.startDate || getTodayDateStr(),
    internalDeadline: body.internalDeadline || "",
    clientDeadline: body.clientDeadline || "",
    estHours:
      body.estHours !== undefined && body.estHours !== null && body.estHours !== ""
        ? Number(body.estHours)
        : null,
    status: body.status || "Not started",
    blockedBy: body.blockedBy || "",
    blockedSince: body.blockedSince || "",
    deliveredOn: body.deliveredOn || "",
    completedOn: body.completedOn || "",
    actualHours:
      body.actualHours !== undefined && body.actualHours !== null && body.actualHours !== ""
        ? Number(body.actualHours)
        : null,
    revisions:
      body.revisions !== undefined && body.revisions !== null && body.revisions !== ""
        ? Number(body.revisions)
        : null,
    firstRoundApproved: body.firstRoundApproved || "",
    notes: body.notes || "",
  };

  if (!newTask.task) {
    return NextResponse.json(
      { error: "Task / Deliverable title is required." },
      { status: 400 }
    );
  }

  db.tasks.push(newTask);

  appendActivity(db, {
    actorName: user!.name,
    actorEmail: user!.email,
    action: `Added Task ${newTask.id}`,
    details: `${newTask.client ? `[${newTask.client}] ` : ""}${newTask.task} (Owner: ${newTask.owner || "Unassigned"})`,
    category: "TASK",
  });

  await saveDb(db);
  return NextResponse.json({ task: newTask, tasks: db.tasks, activityLog: db.activityLog });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!isApprovedAdmin(user)) {
    return NextResponse.json(
      { error: "Forbidden: Only approved Admins can edit tasks." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const db = await getDb();

  const index = db.tasks.findIndex((t) => t.id === body.id);
  if (index === -1) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  const existing = db.tasks[index];
  const updatedClient = body.client !== undefined ? body.client : existing.client;
  const updatedOwner = body.owner !== undefined ? body.owner : existing.owner;

  const matchedClient = db.clients.find(
    (c) => c.name.trim().toLowerCase() === updatedClient.trim().toLowerCase()
  );
  const matchedMember = db.team.find(
    (m) => m.name.trim().toLowerCase() === updatedOwner.trim().toLowerCase()
  );

  const updated: TaskRecord = {
    ...existing,
    ...body,
    workType: matchedClient ? matchedClient.type : body.workType ?? existing.workType,
    team: matchedMember ? matchedMember.team : body.team ?? existing.team,
    estHours:
      body.estHours === "" || body.estHours === null
        ? null
        : body.estHours !== undefined
        ? Number(body.estHours)
        : existing.estHours,
    actualHours:
      body.actualHours === "" || body.actualHours === null
        ? null
        : body.actualHours !== undefined
        ? Number(body.actualHours)
        : existing.actualHours,
    revisions:
      body.revisions === "" || body.revisions === null
        ? null
        : body.revisions !== undefined
        ? Number(body.revisions)
        : existing.revisions,
  };

  // Auto-populate deliveredOn or completedOn if status transitioned and dates are blank
  const today = getTodayDateStr();
  if (
    (updated.status === "Internal review" ||
      updated.status === "Client review" ||
      updated.status === "Done") &&
    !updated.deliveredOn &&
    existing.status !== updated.status
  ) {
    updated.deliveredOn = today;
  }
  if (updated.status === "Done" && !updated.completedOn && existing.status !== "Done") {
    updated.completedOn = today;
  }
  if (updated.blockedBy && !updated.blockedSince) {
    updated.blockedSince = today;
  }
  if (!updated.blockedBy) {
    updated.blockedSince = "";
  }

  db.tasks[index] = updated;

  appendActivity(db, {
    actorName: user!.name,
    actorEmail: user!.email,
    action: `Updated Task ${updated.id}`,
    details: `${updated.task} — Status: ${updated.status}${updated.owner ? `, Owner: ${updated.owner}` : ""}`,
    category: "TASK",
  });

  await saveDb(db);
  return NextResponse.json({ task: updated, tasks: db.tasks, activityLog: db.activityLog });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!isApprovedAdmin(user)) {
    return NextResponse.json(
      { error: "Forbidden: Only approved Admins can delete tasks." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Task ID is required." }, { status: 400 });
  }

  const db = await getDb();
  const target = db.tasks.find((t) => t.id === id);
  if (!target) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  db.tasks = db.tasks.filter((t) => t.id !== id);

  appendActivity(db, {
    actorName: user!.name,
    actorEmail: user!.email,
    action: `Deleted Task ${id}`,
    details: `Removed "${target.task}" (${target.client}) from Task Log.`,
    category: "TASK",
  });

  await saveDb(db);
  return NextResponse.json({ tasks: db.tasks, activityLog: db.activityLog });
}
