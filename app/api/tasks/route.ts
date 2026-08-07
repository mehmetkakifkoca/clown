import { NextResponse } from "next/server";
import { listTasks, createTask, updateTask, deleteTask } from "@/lib/firestore/tasksStore";

export async function GET() {
  try {
    const tasks = await listTasks();
    return NextResponse.json(tasks);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { title } = await request.json();
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    
    const id = crypto.randomUUID();
    await createTask(id, title);
    
    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, title, completed } = await request.json();
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });
    
    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (completed !== undefined) updates.completed = completed;
    
    await updateTask(id, updates);
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });
    
    await deleteTask(id);
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
