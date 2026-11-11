import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isApprovedAdmin } from "@/lib/auth";
import { appendActivity, getDb, sanitizeUser, saveDb } from "@/lib/db";
import { createInitialDatabase } from "@/lib/seed-data";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  const db = await getDb();

  return NextResponse.json({
    user,
    tasks: db.tasks,
    clients: db.clients,
    team: db.team,
    estimateBuffer: db.estimateBuffer,
    users: db.users.map(sanitizeUser),
    activityLog: db.activityLog,
  });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!isApprovedAdmin(user)) {
    return NextResponse.json(
      { error: "Only approved Admins can modify board settings." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const db = await getDb();

  if (body.action === "reset_seed") {
    const fresh = createInitialDatabase();
    // Keep registered users so nobody loses their account on reset
    fresh.users = db.users;
    appendActivity(fresh, {
      actorName: user!.name,
      actorEmail: user!.email,
      action: "Reset Board to Original Excel Seed",
      details: "Restored all 26 tasks, 10 clients, and 14 team members from CAP_Task_Board.xlsx.",
      category: "TASK",
    });
    await saveDb(fresh);
    return NextResponse.json({
      tasks: fresh.tasks,
      clients: fresh.clients,
      team: fresh.team,
      estimateBuffer: fresh.estimateBuffer,
      users: fresh.users.map(sanitizeUser),
      activityLog: fresh.activityLog,
    });
  }

  if (body.action === "import_data") {
    if (Array.isArray(body.tasks)) db.tasks = body.tasks;
    if (Array.isArray(body.clients)) db.clients = body.clients;
    if (Array.isArray(body.team)) db.team = body.team;
    if (typeof body.estimateBuffer === "number") db.estimateBuffer = body.estimateBuffer;

    appendActivity(db, {
      actorName: user!.name,
      actorEmail: user!.email,
      action: "Imported Board Data",
      details: `Imported ${db.tasks.length} tasks, ${db.clients.length} clients, and ${db.team.length} team members.`,
      category: "TASK",
    });

    await saveDb(db);
    return NextResponse.json({
      tasks: db.tasks,
      clients: db.clients,
      team: db.team,
      estimateBuffer: db.estimateBuffer,
      users: db.users.map(sanitizeUser),
      activityLog: db.activityLog,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
