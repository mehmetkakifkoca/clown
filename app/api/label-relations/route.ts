import { NextResponse } from "next/server";
import {
  listRelationsForEntity,
  listRelationsForLabel,
  findRelation,
  createRelation,
  deleteRelation,
  listLabels,
  listAllPages,
  listAllTasks,
} from "@/lib/firestore/notesStore";

// GET /api/label-relations
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const labelId = searchParams.get("labelId");
    const entityId = searchParams.get("entityId");
    const entityType = searchParams.get("entityType");

    if (entityId && entityType) {
      // Bu öğeye bağlı tüm etiketleri getir
      const [relations, labels] = await Promise.all([listRelationsForEntity(entityId, entityType), listLabels()]);
      const labelMap = new Map(labels.map((l) => [l.id, l]));
      const enriched = relations
        .filter((r) => labelMap.has(r.labelId))
        .map((r) => ({ id: r.id, label: labelMap.get(r.labelId) }));
      return NextResponse.json(enriched);
    }

    if (labelId) {
      // Bu etikete bağlı tüm öğeleri getir
      const relations = await listRelationsForLabel(labelId);
      const pageIds = relations.filter((r) => r.entityType === "page").map((r) => r.entityId);
      const taskIds = relations.filter((r) => r.entityType === "task").map((r) => r.entityId);

      const [allPages, allTasks] = await Promise.all([listAllPages(), listAllTasks()]);
      const pageMap = new Map(allPages.map((p) => [p.id, p]));

      const pages = allPages.filter((p) => pageIds.includes(p.id) && !p.deletedAt);
      const tasks = allTasks
        .filter((t) => taskIds.includes(t.id) && !t.deletedAt)
        .map((t) => ({ ...t, page: t.pageId ? pageMap.get(t.pageId) || null : null }));

      return NextResponse.json({ folders: [], notebooks: [], pages, tasks });
    }

    return NextResponse.json({ error: "Geçersiz sorgu parametreleri" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/label-relations
export async function POST(request: Request) {
  try {
    const { labelId, entityType, entityId } = await request.json();

    if (!labelId || !entityType || !entityId) {
      return NextResponse.json({ error: "Eksik zorunlu alanlar" }, { status: 400 });
    }

    const existing = await findRelation(labelId, entityType, entityId);
    if (existing) {
      const labels = await listLabels();
      const label = labels.find((l) => l.id === labelId);
      return NextResponse.json({ ...existing, label });
    }

    const relation = await createRelation(labelId, entityType, entityId);
    const labels = await listLabels();
    const label = labels.find((l) => l.id === labelId);

    return NextResponse.json({ ...relation, label }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/label-relations (Bağlantıyı kaldır)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const labelId = searchParams.get("labelId");
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");

    if (!labelId || !entityType || !entityId) {
      return NextResponse.json({ error: "Eksik zorunlu alanlar" }, { status: 400 });
    }

    await deleteRelation(labelId, entityType, entityId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
