export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { listLabels, upsertLabel, updateLabel, deleteLabel } from "@/lib/firestore/notesStore";

// GET /api/labels
export async function GET() {
  try {
    const labels = await listLabels();
    return NextResponse.json(labels);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/labels
export async function POST(request: Request) {
  try {
    const { name, color } = await request.json();
    if (!name) {
      return NextResponse.json({ error: "Etiket adı gerekli" }, { status: 400 });
    }

    const label = await upsertLabel(name, color || "#757575");
    return NextResponse.json(label, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/labels
export async function PUT(request: Request) {
  try {
    const { id, name, color } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "Etiket ID gerekli" }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;

    const label = await updateLabel(id, updateData);
    return NextResponse.json(label);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/labels
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Etiket ID gerekli" }, { status: 400 });
    }

    await deleteLabel(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
