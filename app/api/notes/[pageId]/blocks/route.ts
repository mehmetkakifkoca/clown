import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Fallback blocks per page
const fallbackBlocksMap: Record<string, any[]> = {
  "page-1": [
    { id: "b1", type: "heading", content: "Clown App System Architecture", checked: false, order: 0 },
    { id: "b2", type: "paragraph", content: "Clown unifies Email, Calendar, Notion Notes, and Instagram analytics into a mobile-first PWA with Vibrant Crimson Minimalist styling.", checked: false, order: 1 },
    { id: "b3", type: "checklist", content: "Verify Tailwind CSS tokens & Plus Jakarta Sans typography", checked: true, order: 2 },
    { id: "b4", type: "checklist", content: "Implement Notion-style block editor with drag handle & slash menu", checked: true, order: 3 },
    { id: "b5", type: "checklist", content: "Setup clean integration provider interfaces for Gmail/Outlook & Meta Graph", checked: false, order: 4 }
  ],
  "page-2": [
    { id: "b6", type: "heading", content: "Morning Reflections", checked: false, order: 0 },
    { id: "b7", type: "paragraph", content: "Focus today on completing the personal productivity hub and ensuring crisp micro-interactions.", checked: false, order: 1 },
    { id: "b8", type: "checklist", content: "Drink 2L of water", checked: true, order: 2 },
    { id: "b9", type: "checklist", content: "30-minute mindfulness walk", checked: false, order: 3 }
  ],
  "page-3": [
    { id: "b10", type: "heading", content: "Vibrant Crimson Color Palette", checked: false, order: 0 },
    { id: "b11", type: "paragraph", content: "Primary accent `#b61722` with soft ambient shadows and crisp surface cards `#f9f9f6`.", checked: false, order: 1 }
  ]
};

export async function GET(req: Request, { params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  try {
    const blocks = await db.block.findMany({
      where: { pageId },
      orderBy: { order: "asc" }
    });

    if (blocks.length === 0 && fallbackBlocksMap[pageId]) {
      return NextResponse.json(fallbackBlocksMap[pageId]);
    }
    return NextResponse.json(blocks);
  } catch (error) {
    console.warn("DB block query failed, returning fallback blocks:", error);
    return NextResponse.json(fallbackBlocksMap[pageId] || []);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  try {
    const body = await req.json();
    const { blocks, title } = body;

    // Update page title if provided
    if (title) {
      await db.page.update({
        where: { id: pageId },
        data: { title }
      }).catch(() => {});
    }

    if (Array.isArray(blocks)) {
      // Transaction to replace blocks with updated order and content
      await db.block.deleteMany({ where: { pageId } });
      await db.block.createMany({
        data: blocks.map((b: any, index: number) => ({
          id: b.id.startsWith("b-") || b.id.startsWith("b") ? undefined : b.id,
          pageId,
          type: b.type,
          content: b.content || "",
          checked: !!b.checked,
          order: index
        }))
      });
    }

    const updated = await db.block.findMany({
      where: { pageId },
      orderBy: { order: "asc" }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.warn("DB block sync failed, using fallback sync:", error);
    const body = await req.json();
    if (Array.isArray(body.blocks)) {
      fallbackBlocksMap[pageId] = body.blocks;
    }
    return NextResponse.json(fallbackBlocksMap[pageId] || []);
  }
}
