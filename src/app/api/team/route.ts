import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isApprovedAdmin } from "@/lib/auth";
import { appendActivity, getDb, saveDb } from "@/lib/db";
import { TeamMember } from "@/lib/types";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!isApprovedAdmin(user)) {
    return NextResponse.json(
      { error: "Forbidden: Only approved Admins can manage the Team roster." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Team member name is required." }, { status: 400 });
  }

  const db = await getDb();
  if (db.team.some((m) => m.name.trim().toLowerCase() === name.toLowerCase())) {
    return NextResponse.json(
      { error: "A team member with this name already exists." },
      { status: 409 }
    );
  }

  const newMember: TeamMember = {
    id: `M-${String(db.team.length + 1).padStart(3, "0")}-${Date.now().toString().slice(-3)}`,
    name,
    role: (body.role || "").trim(),
    team: (body.team || "Creative").trim(),
    dailyCapacity: Number(body.dailyCapacity) || 6.0,
    notes: (body.notes || "").trim(),
  };

  db.team.push(newMember);

  appendActivity(db, {
    actorName: user!.name,
    actorEmail: user!.email,
    action: `Added Team Member: ${newMember.name}`,
    details: `${newMember.role} (${newMember.team}) — Daily capacity: ${newMember.dailyCapacity} hrs`,
    category: "TEAM",
  });

  await saveDb(db);
  return NextResponse.json({ team: db.team, activityLog: db.activityLog });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!isApprovedAdmin(user)) {
    return NextResponse.json(
      { error: "Forbidden: Only approved Admins can update Team settings." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const db = await getDb();

  if (typeof body.estimateBuffer === "number") {
    db.estimateBuffer = Math.max(0, Math.min(2, body.estimateBuffer));
    appendActivity(db, {
      actorName: user!.name,
      actorEmail: user!.email,
      action: "Updated Team Estimate Buffer",
      details: `Set Estimate Buffer to ${Math.round(db.estimateBuffer * 100)}%.`,
      category: "TEAM",
    });
    await saveDb(db);
    return NextResponse.json({
      estimateBuffer: db.estimateBuffer,
      team: db.team,
      activityLog: db.activityLog,
    });
  }

  const idx = db.team.findIndex((m) => m.id === body.id);
  if (idx === -1) {
    return NextResponse.json({ error: "Team member not found." }, { status: 404 });
  }

  const oldName = db.team[idx].name;
  const updated: TeamMember = {
    ...db.team[idx],
    ...body,
    name: (body.name ?? db.team[idx].name).trim(),
    dailyCapacity:
      body.dailyCapacity !== undefined
        ? Number(body.dailyCapacity)
        : db.team[idx].dailyCapacity,
  };
  db.team[idx] = updated;

  for (const t of db.tasks) {
    if (t.owner.trim().toLowerCase() === oldName.trim().toLowerCase()) {
      t.owner = updated.name;
      t.team = updated.team;
    }
    if (t.reviewer.trim().toLowerCase() === oldName.trim().toLowerCase()) {
      t.reviewer = updated.name;
    }
  }

  appendActivity(db, {
    actorName: user!.name,
    actorEmail: user!.email,
    action: `Updated Team Member: ${updated.name}`,
    details: `${updated.role} (${updated.team}) — Capacity: ${updated.dailyCapacity} hrs/day`,
    category: "TEAM",
  });

  await saveDb(db);
  return NextResponse.json({
    team: db.team,
    tasks: db.tasks,
    activityLog: db.activityLog,
  });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!isApprovedAdmin(user)) {
    return NextResponse.json(
      { error: "Forbidden: Only approved Admins can remove Team members." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const db = await getDb();
  const target = db.team.find((m) => m.id === id);
  if (!target) {
    return NextResponse.json({ error: "Team member not found." }, { status: 404 });
  }

  db.team = db.team.filter((m) => m.id !== id);
  appendActivity(db, {
    actorName: user!.name,
    actorEmail: user!.email,
    action: `Removed Team Member: ${target.name}`,
    details: `Removed ${target.name} (${target.role}) from Team roster.`,
    category: "TEAM",
  });

  await saveDb(db);
  return NextResponse.json({ team: db.team, activityLog: db.activityLog });
}
