import { NextResponse } from "next/server";
import { listProjects, createProject, updateProject, deleteProject, listAllTasks } from "@/lib/firestore/notesStore";

// GET /api/projects
export async function GET() {
  try {
    const [projects, tasks] = await Promise.all([listProjects(), listAllTasks()]);

    const openCounts = new Map<string, number>();
    for (const t of tasks) {
      if (t.projectId && t.status !== "DONE") {
        openCounts.set(t.projectId, (openCounts.get(t.projectId) || 0) + 1);
      }
    }

    const result = projects
      .map((p) => ({ ...p, taskCount: openCounts.get(p.id) || 0 }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/projects
export async function POST(request: Request) {
  try {
    const { name, color, icon } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Proje adı gerekli" }, { status: 400 });
    }

    const project = await createProject({ name: name.trim(), color, icon });
    return NextResponse.json(project, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/projects
export async function PUT(request: Request) {
  try {
    const { id, name, color, icon, isArchived, sortOrder } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "Proje ID gerekli" }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;
    if (icon !== undefined) updateData.icon = icon;
    if (isArchived !== undefined) updateData.isArchived = isArchived;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    const project = await updateProject(id, updateData);
    return NextResponse.json(project);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/projects?id=xxx (Bağlı görevlerin projectId'sini temizler)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Proje ID gerekli" }, { status: 400 });
    }

    await deleteProject(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
