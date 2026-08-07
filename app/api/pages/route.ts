import { NextResponse } from "next/server";
import {
  listAllPages,
  getPage,
  createPage,
  updatePage,
  deletePageHard,
  setDeletedAtForChildPages,
  listBlocksByPage,
  replaceBlocksForPage,
  deleteBlocksByPage,
  deleteTasksByPage,
} from "@/lib/firestore/notesStore";

// GET /api/pages
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parentPageId = searchParams.get("parentPageId");
    const isFavorite = searchParams.get("isFavorite") === "true";
    const archived = searchParams.get("archived") === "true";
    const trash = searchParams.get("trash") === "true";
    const all = searchParams.get("all") === "true";

    const pages = await listAllPages();

    if (all) {
      // Ağaç render'ı için tüm aktif (silinmemiş), arşiv durumu eşleşen sayfalar
      const filtered = pages
        .filter((p) => !p.deletedAt && p.isArchived === archived)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      return NextResponse.json(filtered);
    }

    const filtered = pages.filter((p) => {
      if (parentPageId !== null) {
        const wantParent = parentPageId === "null" ? null : parentPageId;
        if (p.parentPageId !== wantParent) return false;
      }
      if (isFavorite && !p.isFavorite) return false;
      if (p.isArchived !== archived) return false;
      const isDeleted = !!p.deletedAt;
      if (trash !== isDeleted) return false;
      return true;
    });

    const withSubPages = filtered
      .map((p) => ({
        ...p,
        subPages: pages
          .filter((c) => c.parentPageId === p.id && c.isArchived === archived && !!c.deletedAt === trash)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return NextResponse.json(withSubPages);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/pages (Create or Duplicate)
export async function POST(request: Request) {
  try {
    const { title, parentPageId, icon, coverImage, duplicateFromId } = await request.json();

    // Sayfa Kopyalama
    if (duplicateFromId) {
      const srcPage = await getPage(duplicateFromId);
      if (!srcPage) {
        return NextResponse.json({ error: "Kaynak sayfa bulunamadı" }, { status: 404 });
      }

      const dupPage = await createPage({
        title: `${srcPage.title} (Kopya)`,
        parentPageId: srcPage.parentPageId,
        icon: srcPage.icon,
        coverImage: srcPage.coverImage,
        isFavorite: false,
      });

      const srcBlocks = await listBlocksByPage(duplicateFromId);
      if (srcBlocks.length > 0) {
        await replaceBlocksForPage(
          dupPage.id,
          srcBlocks.map((b) => ({
            id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            blockType: b.blockType,
            content: b.content,
            properties: b.properties,
          }))
        );
      } else {
        await replaceBlocksForPage(dupPage.id, [
          { id: `b-${Date.now()}`, blockType: "paragraph", content: "", properties: {} },
        ]);
      }

      return NextResponse.json(dupPage, { status: 201 });
    }

    // Standart Oluşturma
    const page = await createPage({
      title: title || "Başlıksız Not Defteri",
      parentPageId: parentPageId || null,
      isFavorite: parentPageId === null || parentPageId === undefined,
      icon: icon || "description",
      coverImage: coverImage ?? null,
    });

    await replaceBlocksForPage(page.id, [
      { id: `b-${Date.now()}`, blockType: "paragraph", content: "", properties: {} },
    ]);

    return NextResponse.json(page, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/pages (Update, Move, Archive, Favorite, Soft Delete, Restore)
export async function PUT(request: Request) {
  try {
    const {
      id,
      title,
      icon,
      coverImage,
      parentPageId,
      isArchived,
      isFavorite,
      sortOrder,
      deleted,
      restore,
    } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Sayfa ID gerekli" }, { status: 400 });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (icon !== undefined) updateData.icon = icon;
    if (coverImage !== undefined) updateData.coverImage = coverImage;
    if (parentPageId !== undefined) updateData.parentPageId = parentPageId;
    if (isArchived !== undefined) updateData.isArchived = isArchived;
    if (isFavorite !== undefined) updateData.isFavorite = isFavorite;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    if (deleted === true) {
      updateData.deletedAt = new Date().toISOString();
      await setDeletedAtForChildPages(id, updateData.deletedAt);
    } else if (restore === true) {
      updateData.deletedAt = null;
      await setDeletedAtForChildPages(id, null);
    }

    const page = await updatePage(id, updateData);
    return NextResponse.json(page);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/pages (Hard Delete)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Sayfa ID gerekli" }, { status: 400 });
    }

    await Promise.all([deleteBlocksByPage(id), deleteTasksByPage(id)]);
    await deletePageHard(id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
