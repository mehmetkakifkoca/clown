import { NextResponse } from "next/server";
import {
  listVersionsByPage,
  getVersion,
  updatePage,
  replaceBlocksForPage,
  replaceTasksForPage,
} from "@/lib/firestore/notesStore";

// GET /api/versions?pageId=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get("pageId");

    if (!pageId) {
      return NextResponse.json({ error: "Sayfa ID gerekli" }, { status: 400 });
    }

    const versions = await listVersionsByPage(pageId);
    return NextResponse.json(versions);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/versions (Bir versiyon anlık görüntüsünü geri yükler)
export async function POST(request: Request) {
  try {
    const { versionId } = await request.json();

    if (!versionId) {
      return NextResponse.json({ error: "Versiyon ID gerekli" }, { status: 400 });
    }

    const version = await getVersion(versionId);
    if (!version) {
      return NextResponse.json({ error: "Versiyon anlık görüntüsü bulunamadı" }, { status: 404 });
    }

    const { title, blocks } = JSON.parse(version.contentSnapshot);

    await updatePage(version.pageId, { title });

    const blocksData = blocks.map((b: any) => {
      const propertiesObj = { ...(b.properties || {}) };
      propertiesObj.checked = b.checked ?? false;
      if (b.toggleBody) propertiesObj.toggleBody = b.toggleBody;

      return {
        id: b.id,
        blockType: b.type,
        content: b.content || "",
        properties: propertiesObj,
      };
    });

    await replaceBlocksForPage(version.pageId, blocksData);

    const taskBlocks = blocks.filter((b: any) => b.type === "checklist");
    const tasksData = taskBlocks.map((b: any) => {
      const props = b.properties || {};
      const isDone = b.checked === true;
      return {
        id: b.id,
        blockId: b.id,
        title: b.content || "Başlıksız Görev",
        description: props.description || null,
        status: isDone ? "DONE" : props.status || "TODO",
        priority: props.priority || "NORMAL",
        dueDate: props.dueDate || null,
        reminderDate: props.reminderDate || null,
        completedAt: isDone ? new Date().toISOString() : null,
        projectId: props.projectId || null,
      };
    });

    await replaceTasksForPage(version.pageId, tasksData);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
