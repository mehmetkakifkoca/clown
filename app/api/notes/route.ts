import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Fallback in-memory store if DB is disconnected
let fallbackPages = [
  { id: "page-1", title: "Productivity Strategy & Notes", icon: "rocket_launch", createdAt: new Date() },
  { id: "page-2", title: "Daily Journal & Reflections", icon: "auto_stories", createdAt: new Date() },
  { id: "page-3", title: "Design System & Color Tokens", icon: "palette", createdAt: new Date() }
];

export async function GET() {
  try {
    const pages = await db.page.findMany({
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { blocks: true } } }
    });
    return NextResponse.json(pages);
  } catch (error) {
    console.warn("DB query failed, using fallback pages:", error);
    return NextResponse.json(fallbackPages);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = body.title || "Untitled Page";
    const icon = body.icon || "description";

    const newPage = await db.page.create({
      data: {
        title,
        icon,
        blocks: {
          create: [
            { type: "heading", content: title, order: 0 },
            { type: "paragraph", content: "Start typing your note here or type / for commands...", order: 1 },
            { type: "checklist", content: "Review design tokens", checked: true, order: 2 },
            { type: "checklist", content: "Deploy Next.js app to Vercel", checked: false, order: 3 }
          ]
        }
      },
      include: { blocks: true }
    });

    return NextResponse.json(newPage);
  } catch (error) {
    console.warn("DB create failed, creating fallback page:", error);
    const newPage = {
      id: `page-${Date.now()}`,
      title: "Untitled Page",
      icon: "description",
      createdAt: new Date()
    };
    fallbackPages.unshift(newPage);
    return NextResponse.json(newPage);
  }
}
