import { NextResponse } from "next/server";
import { listPages, createPage } from "@/lib/firestore/notes";

// GET /api/notes → tüm sayfaları listele
export async function GET() {
  try {
    const pages = await listPages();
    return NextResponse.json(pages);
  } catch (err) {
    console.error("Sayfalar getirilemedi:", err);
    return NextResponse.json({ error: "Sayfalar getirilemedi" }, { status: 500 });
  }
}

// POST /api/notes → yeni sayfa oluştur
export async function POST(request: Request) {
  try {
    const { title, icon } = await request.json();
    const page = await createPage(title ?? "Yeni Sayfa", icon ?? "description");
    return NextResponse.json(page, { status: 201 });
  } catch (err) {
    console.error("Sayfa oluşturulamadı:", err);
    return NextResponse.json({ error: "Sayfa oluşturulamadı" }, { status: 500 });
  }
}
