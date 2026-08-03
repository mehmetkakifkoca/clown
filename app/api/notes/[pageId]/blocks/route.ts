import { NextResponse } from "next/server";
import { listBlocks, saveBlocks } from "@/lib/firestore/notes";

// GET /api/notes/[pageId]/blocks → sayfa bloklarını listele
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params;
    const blocks = await listBlocks(pageId);
    return NextResponse.json(blocks);
  } catch (err) {
    console.error("Bloklar getirilemedi:", err);
    return NextResponse.json({ error: "Bloklar getirilemedi" }, { status: 500 });
  }
}

// PUT /api/notes/[pageId]/blocks → sayfayı + bloklarını kaydet
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params;
    const { title, blocks } = await request.json();
    await saveBlocks(pageId, title, blocks);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Bloklar kaydedilemedi:", err);
    return NextResponse.json({ error: "Bloklar kaydedilemedi" }, { status: 500 });
  }
}
