import { NextResponse } from "next/server";
import {
  updatePage,
  logRecentItem,
  listBlocksByPage,
  replaceBlocksForPage,
  replaceTasksForPage,
  getLatestVersion,
  createVersion,
} from "@/lib/firestore/notesStore";

// GET /api/pages/[pageId]/blocks
export async function GET(
  request: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params;

    await updatePage(pageId, { lastOpenedAt: new Date().toISOString() }).catch(() => {});
    await logRecentItem(pageId).catch(() => {});

    const blocks = await listBlocksByPage(pageId);

    const formatted = blocks.map((b) => ({
      id: b.id,
      type: b.blockType,
      content: b.content,
      checked: b.properties?.checked ?? false,
      toggleBody: b.properties?.toggleBody ?? "",
      properties: b.properties || {},
    }));

    return NextResponse.json(formatted);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/pages/[pageId]/blocks
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params;
    const { title, blocks } = await request.json();

    if (!Array.isArray(blocks)) {
      return NextResponse.json({ error: "Blocks array gerekli" }, { status: 400 });
    }

    // 1. Sayfa başlığını güncelle
    if (title !== undefined) {
      await updatePage(pageId, { title });

      // Versiyon geçmişi anlık görüntüsü (değişiklik varsa)
      const snapshotContent = JSON.stringify({ title, blocks });
      const lastVersion = await getLatestVersion(pageId);
      if (!lastVersion || lastVersion.contentSnapshot !== snapshotContent) {
        await createVersion(pageId, snapshotContent);
      }
    }

    // 2. Blokları kaydet
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

    await replaceBlocksForPage(pageId, blocksData);

    // 3. Merkezi Görevler Tablosu Senkronizasyonu
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

    await replaceTasksForPage(pageId, tasksData);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Auto save blocks error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
