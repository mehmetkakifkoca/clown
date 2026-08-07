export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { listRecentPageIds, listAllPages } from "@/lib/firestore/notesStore";

// GET /api/recent
export async function GET() {
  try {
    const [recentIds, allPages] = await Promise.all([listRecentPageIds(20), listAllPages()]);
    const pageMap = new Map(allPages.map((p) => [p.id, p]));

    const sortedPages = recentIds
      .map((id) => pageMap.get(id))
      .filter((p): p is NonNullable<typeof p> => !!p && !p.deletedAt);

    return NextResponse.json(sortedPages);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
