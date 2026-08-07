import { NextResponse } from "next/server";
import {
  listAllTasks,
  updateTask,
  createStandaloneTask,
  softDeleteTask,
  listAllPages,
  listProjects,
} from "@/lib/firestore/notesStore";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// GET /api/tasks?view=all&projectId=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "all"; // today | upcoming | overdue | completed | all
    const projectId = searchParams.get("projectId"); // proje id, veya "none" (projesiz)

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [tasks, pages, projects] = await Promise.all([listAllTasks(), listAllPages(), listProjects()]);
    const pageMap = new Map(pages.map((p) => [p.id, { id: p.id, title: p.title }]));
    const projectMap = new Map(projects.map((p) => [p.id, { id: p.id, name: p.name, color: p.color, icon: p.icon }]));

    let filtered = tasks;

    if (view === "today") {
      filtered = filtered.filter((t) => {
        if (!t.dueDate || t.status === "DONE") return false;
        const d = new Date(t.dueDate);
        return d >= todayStart && d <= todayEnd;
      });
    } else if (view === "upcoming") {
      filtered = filtered.filter((t) => {
        if (!t.dueDate || t.status === "DONE") return false;
        return new Date(t.dueDate) > todayEnd;
      });
    } else if (view === "overdue") {
      filtered = filtered.filter((t) => {
        if (!t.dueDate || t.status === "DONE") return false;
        return new Date(t.dueDate) < todayStart;
      });
    } else if (view === "completed") {
      filtered = filtered.filter((t) => t.status === "DONE");
    }

    if (projectId === "none") {
      filtered = filtered.filter((t) => !t.projectId);
    } else if (projectId) {
      filtered = filtered.filter((t) => t.projectId === projectId);
    }

    filtered = filtered.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    const result = filtered.map((t) => ({
      ...t,
      page: t.pageId ? pageMap.get(t.pageId) || null : null,
      project: t.projectId ? projectMap.get(t.projectId) || null : null,
    }));

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/tasks (Bağımsız hızlı görev oluştur — bir not sayfasına bağlı değil)
export async function POST(request: Request) {
  try {
    const { title, description, priority, dueDate, reminderDate, projectId } = await request.json();

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Görev başlığı gerekli" }, { status: 400 });
    }

    const task = await createStandaloneTask({
      title: title.trim(),
      description,
      priority,
      dueDate,
      reminderDate,
      projectId,
    });

    return NextResponse.json(task, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/tasks (Merkezi görev panosundan güncelleme, kaynak bloğa geri senkronize eder)
export async function PUT(request: Request) {
  try {
    const { id, title, description, status, priority, dueDate, reminderDate, projectId } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Görev ID gerekli" }, { status: 400 });
    }

    const taskUpdate: any = {};
    if (title !== undefined) taskUpdate.title = title;
    if (description !== undefined) taskUpdate.description = description;
    if (status !== undefined) {
      taskUpdate.status = status;
      taskUpdate.completedAt = status === "DONE" ? new Date().toISOString() : null;
    }
    if (priority !== undefined) taskUpdate.priority = priority;
    if (dueDate !== undefined) taskUpdate.dueDate = dueDate || null;
    if (reminderDate !== undefined) taskUpdate.reminderDate = reminderDate || null;
    if (projectId !== undefined) taskUpdate.projectId = projectId || null;

    // 1. Task tablosunda güncelle
    const task = await updateTask(id, taskUpdate);

    // 2. Kaynak bloğa geri senkronize et (sayfaya bağlı görevler için)
    if (task.blockId) {
      const blockRef = doc(db, "noteBlocks", task.blockId);
      const blockSnap = await getDoc(blockRef);

      if (blockSnap.exists()) {
        const props = { ...(blockSnap.data().properties || {}) };
        props.checked = task.status === "DONE";
        if (task.status) props.status = task.status;
        if (task.priority) props.priority = task.priority;
        props.dueDate = task.dueDate || null;
        if (task.description) props.description = task.description;
        props.projectId = task.projectId || null;

        await updateDoc(blockRef, {
          content: task.title,
          properties: props,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json(task);
  } catch (err: any) {
    console.error("Central task sync error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/tasks?id=xxx (Sadece bağımsız hızlı görevler için önerilir)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Görev ID gerekli" }, { status: 400 });
    }

    await softDeleteTask(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
