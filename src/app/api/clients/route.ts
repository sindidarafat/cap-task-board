import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isApprovedAdmin } from "@/lib/auth";
import { appendActivity, getDb, saveDb } from "@/lib/db";
import { ClientRecord } from "@/lib/types";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!isApprovedAdmin(user)) {
    return NextResponse.json(
      { error: "Forbidden: Only approved Admins can add clients or pitches." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Client / Prospect name is required." }, { status: 400 });
  }

  const db = await getDb();
  if (db.clients.some((c) => c.name.trim().toLowerCase() === name.toLowerCase())) {
    return NextResponse.json(
      { error: "A client or pitch with this name already exists." },
      { status: 409 }
    );
  }

  const newClient: ClientRecord = {
    id: `C-${String(db.clients.length + 1).padStart(3, "0")}-${Date.now().toString().slice(-3)}`,
    name,
    type: body.type || "Client",
    accountLead: (body.accountLead || "").trim(),
    accountStatus: body.accountStatus || "Active",
    notes: (body.notes || "").trim(),
  };

  db.clients.push(newClient);

  appendActivity(db, {
    actorName: user!.name,
    actorEmail: user!.email,
    action: `Added ${newClient.type}: ${newClient.name}`,
    details: `Account lead: ${newClient.accountLead || "Unassigned"}, Status: ${newClient.accountStatus}`,
    category: "CLIENT",
  });

  await saveDb(db);
  return NextResponse.json({ clients: db.clients, activityLog: db.activityLog });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!isApprovedAdmin(user)) {
    return NextResponse.json(
      { error: "Forbidden: Only approved Admins can edit clients or pitches." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const db = await getDb();
  const idx = db.clients.findIndex((c) => c.id === body.id);
  if (idx === -1) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const oldName = db.clients[idx].name;
  const updated: ClientRecord = {
    ...db.clients[idx],
    ...body,
    name: (body.name ?? db.clients[idx].name).trim(),
  };
  db.clients[idx] = updated;

  // Cascade client name or type changes to Task Log
  for (const t of db.tasks) {
    if (t.client.trim().toLowerCase() === oldName.trim().toLowerCase()) {
      t.client = updated.name;
      t.workType = updated.type;
    }
  }

  appendActivity(db, {
    actorName: user!.name,
    actorEmail: user!.email,
    action: `Updated Client/Pitch: ${updated.name}`,
    details: `Type: ${updated.type}, Status: ${updated.accountStatus}, Lead: ${updated.accountLead || "None"}`,
    category: "CLIENT",
  });

  await saveDb(db);
  return NextResponse.json({
    clients: db.clients,
    tasks: db.tasks,
    activityLog: db.activityLog,
  });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!isApprovedAdmin(user)) {
    return NextResponse.json(
      { error: "Forbidden: Only approved Admins can delete clients." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const db = await getDb();
  const target = db.clients.find((c) => c.id === id);
  if (!target) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  db.clients = db.clients.filter((c) => c.id !== id);
  appendActivity(db, {
    actorName: user!.name,
    actorEmail: user!.email,
    action: `Removed Client/Pitch: ${target.name}`,
    details: `Deleted ${target.name} from Clients & Pitches directory.`,
    category: "CLIENT",
  });

  await saveDb(db);
  return NextResponse.json({ clients: db.clients, activityLog: db.activityLog });
}
