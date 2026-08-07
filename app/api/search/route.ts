import { NextResponse } from "next/server";
import { listAllPages, listAllTasks, searchBlocksByContent } from "@/lib/firestore/notesStore";

// GET /api/search?q=text&isFavorite=true&archived=true
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const isFavorite = searchParams.get("isFavorite") === "true" ? true : undefined;
    const archived = searchParams.get("archived") === "true"; // varsayılan: aktif sayfalarda ara

    if (!q.trim()) {
      return NextResponse.json({ folders: [], notebooks: [], pages: [], tasks: [] });
    }

    const needle = q.toLowerCase();
    const [allPages, allTasks, matchingBlocks] = await Promise.all([
      listAllPages(),
      listAllTasks(),
      searchBlocksByContent(q),
    ]);
    const pageMap = new Map(allPages.map((p) => [p.id, p]));

    const titleMatchedPages = allPages
      .filter(
        (p) =>
          !p.deletedAt &&
          p.isArchived === archived &&
          (isFavorite === undefined || p.isFavorite === isFavorite) &&
          p.title.toLowerCase().includes(needle)
      )
      .slice(0, 15);

    const tasks = allTasks
      .filter(
        (t) =>
          !t.deletedAt &&
          (t.title.toLowerCase().includes(needle) || (t.description || "").toLowerCase().includes(needle))
      )
      .slice(0, 15)
      .map((t) => ({ ...t, page: t.pageId ? pageMap.get(t.pageId) || null : null }));

    const blockPageIds = Array.from(new Set(matchingBlocks.slice(0, 10).map((b) => b.pageId)));
    const blockPages = blockPageIds
      .map((id) => pageMap.get(id))
      .filter((p): p is NonNullable<typeof p> => !!p && !p.deletedAt && p.isArchived === archived);

    const mergedPages = [...titleMatchedPages];
    for (const bp of blockPages) {
      if (!mergedPages.some((p) => p.id === bp.id)) {
        mergedPages.push(bp);
      }
    }

    return NextResponse.json({
      folders: [],
      notebooks: [],
      pages: mergedPages,
      tasks,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
