"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SearchModal } from "@/components/Notes/SearchModal";
import { DetailsPanel } from "@/components/Notes/DetailsPanel";

interface PageItem {
  id: string;
  title: string;
  icon: string;
  coverImage: string | null;
  parentPageId: string | null;
  isArchived: boolean;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  deletedAt: string | null;
}

interface BlockItem {
  id: string;
  type: "paragraph" | "heading" | "checklist" | "bullet" | "toggle" | "quote" | "callout" | "divider" | "code" | "table" | "subpage";
  content: string;
  checked: boolean;
  toggleBody?: string;
  properties?: any; // table rows, task details, subpageId { pageId: "xxx" }
}

interface ProjectOption {
  id: string;
  name: string;
  color: string;
}

function NotesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activePageId = searchParams.get("id") || "";
  const currentView = searchParams.get("view") || ""; // favorites | recent | trash | archive | ""
  const highlightTaskId = searchParams.get("highlightTask") || "";

  const [pages, setPages] = useState<PageItem[]>([]);
  const [recentPages, setRecentPages] = useState<PageItem[]>([]);
  const [activePage, setActivePage] = useState<PageItem | null>(null);
  const [blocks, setBlocks] = useState<BlockItem[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [activeBlockIndex, setActiveBlockIndex] = useState<number | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Modals for Create/Move
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTarget, setMoveTarget] = useState({ id: "", targetParentPageId: "null" });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTarget, setCreateTarget] = useState({ name: "" });

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadAllPages();
    loadRecentPages();
    loadProjects();
  }, [searchParams]);

  useEffect(() => {
    if (activePageId) {
      loadPageData(activePageId);
    } else {
      setActivePage(null);
      setBlocks([]);
    }
  }, [activePageId]);

  const loadAllPages = async () => {
    try {
      const res = await fetch("/api/pages?all=true");
      const data = await res.json();
      if (Array.isArray(data)) setPages(data);
    } catch {}
  };

  const loadRecentPages = async () => {
    try {
      const res = await fetch("/api/recent");
      const data = await res.json();
      if (Array.isArray(data)) setRecentPages(data.slice(0, 3));
    } catch {}
  };

  const loadProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (Array.isArray(data)) setProjects(data);
    } catch {}
  };

  const loadPageData = async (pageId: string) => {
    setLoading(true);
    try {
      const resPage = await fetch(`/api/pages?all=true`);
      const allPages = await resPage.json();
      if (Array.isArray(allPages)) {
        setPages(allPages);
        const p = allPages.find((x) => x.id === pageId);
        if (p) setActivePage(p);
      }

      const resBlocks = await fetch(`/api/pages/${pageId}/blocks`);
      const blocksData = await resBlocks.json();
      if (Array.isArray(blocksData)) {
        setBlocks(blocksData);
      }
    } catch {
      setSaveStatus("error");
    }
    setLoading(false);
  };

  const triggerAutoSave = (updatedBlocks: BlockItem[], updatedTitle?: string) => {
    if (!activePageId) return;
    setSaveStatus("saving");

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pages/${activePageId}/blocks`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: updatedTitle !== undefined ? updatedTitle : (activePage?.title || "Başlıksız Sayfa"),
            blocks: updatedBlocks,
          }),
        });
        if (res.ok) {
          setSaveStatus("saved");
          window.dispatchEvent(new Event("refresh-sidebar"));
        } else {
          setSaveStatus("error");
        }
      } catch {
        setSaveStatus("error");
      }
    }, 800);
  };

  const handleTitleChange = (newTitle: string) => {
    if (!activePage) return;
    const updatedPage = { ...activePage, title: newTitle };
    setActivePage(updatedPage);
    setPages(pages.map((p) => (p.id === activePageId ? updatedPage : p)));
    triggerAutoSave(blocks, newTitle);
  };

  const updateBlock = (index: number, content: string, extraProperties?: any) => {
    const updated = [...blocks];
    updated[index].content = content;
    if (extraProperties) {
      updated[index].properties = { ...updated[index].properties, ...extraProperties };
    }
    setBlocks(updated);

    if (content.endsWith("/")) {
      setActiveBlockIndex(index);
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
    }
    triggerAutoSave(updated);
  };

  const addBlock = (type: BlockItem["type"], index?: number) => {
    const newBlock: BlockItem = {
      id: `b-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type,
      content: "",
      checked: false,
      toggleBody: "",
      properties: type === "table" ? { rows: [["", ""], ["", ""]] } : type === "code" ? { language: "javascript" } : type === "callout" ? { type: "info" } : {},
    };

    const updated =
      typeof index === "number"
        ? [...blocks.slice(0, index + 1), newBlock, ...blocks.slice(index + 1)]
        : [...blocks, newBlock];

    setBlocks(updated);
    setShowSlashMenu(false);
    triggerAutoSave(updated);
  };

  const removeBlock = (index: number) => {
    if (blocks.length <= 1) return;
    const updated = blocks.filter((_, i) => i !== index);
    setBlocks(updated);
    triggerAutoSave(updated);
  };

  // Convert selected block text/content to a subpage recursively
  const handleConvertToSubpage = async (index: number, block: BlockItem) => {
    try {
      const titleText = block.content.trim() || "Yeni Alt Sayfa";
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleText,
          parentPageId: activePageId,
        }),
      });
      const newPage = await res.json();

      const updated = [...blocks];
      updated[index].type = "subpage";
      updated[index].content = newPage.title;
      updated[index].properties = { pageId: newPage.id };

      setBlocks(updated);
      triggerAutoSave(updated);
      window.dispatchEvent(new Event("refresh-sidebar"));
    } catch {}
  };

  const handleMovePage = async () => {
    try {
      const targetParentId = moveTarget.targetParentPageId === "null" ? null : moveTarget.targetParentPageId;
      await fetch("/api/pages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: moveTarget.id, parentPageId: targetParentId }),
      });
      setShowMoveModal(false);
      loadAllPages();
      window.dispatchEvent(new Event("refresh-sidebar"));
    } catch {}
  };

  const handleCreatePage = async (parentPageId: string | null = null, customTitle?: string) => {
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: customTitle || (parentPageId ? "Yeni Alt Sayfa" : "Yeni Defter"),
          parentPageId,
        }),
      });
      const newPage = await res.json();
      loadAllPages();
      window.dispatchEvent(new Event("refresh-sidebar"));
      router.push(`/notes?id=${newPage.id}`);
    } catch {}
  };

  const handleDuplicatePage = async (pageId: string) => {
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duplicateFromId: pageId }),
      });
      const duplicated = await res.json();
      loadAllPages();
      window.dispatchEvent(new Event("refresh-sidebar"));
      router.push(`/notes?id=${duplicated.id}`);
    } catch {}
  };

  const handleSoftDeletePage = async (pageId: string) => {
    if (!confirm("Bu sayfayı çöp kutusuna taşımak istediğinizden emin misiniz?")) return;
    try {
      await fetch("/api/pages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pageId, deleted: true }),
      });
      loadAllPages();
      window.dispatchEvent(new Event("refresh-sidebar"));
      router.push("/notes");
    } catch {}
  };

  const handleRestorePage = async (pageId: string) => {
    try {
      await fetch("/api/pages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pageId, restore: true }),
      });
      loadAllPages();
      window.dispatchEvent(new Event("refresh-sidebar"));
    } catch {}
  };

  const handleHardDeletePage = async (pageId: string) => {
    if (!confirm("Bu sayfayı kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!")) return;
    try {
      await fetch(`/api/pages?id=${pageId}`, { method: "DELETE" });
      loadAllPages();
      window.dispatchEvent(new Event("refresh-sidebar"));
    } catch {}
  };

  // Keyboard custom backspace handler
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    index: number,
    block: BlockItem
  ) => {
    if (e.key === "Backspace" && block.content === "") {
      if (block.type !== "paragraph") {
        e.preventDefault();
        const updated = [...blocks];
        updated[index].type = "paragraph";
        setBlocks(updated);
        triggerAutoSave(updated);
      } else if (blocks.length > 1) {
        e.preventDefault();
        removeBlock(index);
      }
    }
  };

  const getBreadcrumbs = (pageId: string) => {
    const path: PageItem[] = [];
    let current = pages.find((p) => p.id === pageId);
    while (current) {
      path.unshift(current);
      const parentId = current.parentPageId;
      current = parentId ? pages.find((p) => p.id === parentId) : undefined;
    }
    return path;
  };

  // Views renderers (Favorites, trash, recents, archive)
  const renderFilteredPagesView = (title: string, icon: string, filterFn: (p: PageItem) => boolean, isTrash = false) => {
    const filtered = pages.filter(filterFn);

    return (
      <div className="max-w-3xl mx-auto py-8">
        <div className="flex items-center space-x-3 mb-6 pb-2 border-b border-outline-variant/15 select-none">
          <span className="material-symbols-outlined text-3xl text-primary">{icon}</span>
          <h2 className="text-2xl font-bold font-headline-lg">{title}</h2>
          <span className="text-xs bg-surface-container px-2 py-0.5 rounded font-bold text-secondary">{filtered.length} Öğe</span>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-surface-container-low rounded-3xl border border-outline-variant/15 p-6 select-none">
            <span className="material-symbols-outlined text-4xl text-outline mb-2">info</span>
            <p className="text-sm text-secondary font-medium">Herhangi bir öğe bulunmuyor</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3.5 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl hover:border-primary/30 transition-all shadow-xs"
              >
                <Link href={`/notes?id=${p.id}`} className="flex items-center space-x-2.5 min-w-0 flex-1">
                  <span className="material-symbols-outlined text-secondary text-[18px]">{p.icon || "description"}</span>
                  <span className="text-xs md:text-sm font-semibold truncate hover:text-primary transition-colors">{p.title}</span>
                </Link>
                <div className="flex items-center space-x-2 ml-4">
                  {isTrash ? (
                    <>
                      <button
                        onClick={() => handleRestorePage(p.id)}
                        className="px-2.5 py-1 bg-primary text-on-primary text-[10px] font-bold rounded-lg shadow-sm"
                      >
                        Geri Yükle
                      </button>
                      <button
                        onClick={() => handleHardDeletePage(p.id)}
                        className="px-2.5 py-1 bg-surface-container hover:bg-surface-container-high text-[10px] font-bold rounded-lg text-error"
                      >
                        Kalıcı Sil
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleSoftDeletePage(p.id)}
                      className="px-2.5 py-1 bg-surface-container hover:bg-surface-container-high text-[10px] font-bold rounded-lg text-error"
                    >
                      Çöpe At
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`min-h-screen bg-background text-on-surface px-6 md:px-12 lg:px-20 pt-6 pb-28 md:pb-8 relative transition-all duration-350 ${isDetailsOpen ? "pr-80" : ""}`}>
      {/* 1. View Toggles */}
      {currentView === "favorites" && renderFilteredPagesView("Favori Defterler", "star", (p) => p.isFavorite && !p.deletedAt)}
      {currentView === "recent" && renderFilteredPagesView("Son Kullanılanlar", "history", (p) => p.lastOpenedAt !== null && !p.deletedAt)}
      {currentView === "trash" && renderFilteredPagesView("Çöp Kutusu", "delete", (p) => p.deletedAt !== null, true)}
      {currentView === "archive" && renderFilteredPagesView("Arşivlenmiş Sayfalar", "archive", (p) => p.isArchived && !p.deletedAt)}

      {/* 2. Active Page Block Canvas Editor */}
      {!currentView && activePageId && (
        <div className="w-full max-w-3xl mx-auto min-h-[600px] flex flex-col justify-between py-2 animate-in fade-in duration-300">
          <div>
            {/* Breadcrumbs bar */}
            <div className="flex items-center justify-between text-xs text-secondary font-semibold mb-6 flex-wrap select-none gap-y-2">
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => router.push("/notes")}
                  className="hover:text-primary transition-colors flex items-center space-x-1"
                >
                  <span className="material-symbols-outlined text-[15px]">folder</span>
                  <span>Not Defterleri</span>
                </button>
                {getBreadcrumbs(activePageId).map((p, idx, arr) => (
                  <span key={p.id} className="flex items-center space-x-1.5">
                    <span className="text-outline-variant/60 font-normal">/</span>
                    <button
                      onClick={() => router.push(`/notes?id=${p.id}`)}
                      className={`hover:text-primary transition-colors flex items-center space-x-1 ${
                        idx === arr.length - 1 ? "text-on-surface font-bold" : ""
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">{p.icon || "description"}</span>
                      <span>{p.title}</span>
                    </button>
                  </span>
                ))}
              </div>

              {/* Actions panel */}
              <div className="flex items-center space-x-2">
                <span className="text-[10px] text-outline select-none mr-2">
                  {saveStatus === "saving" && "☁️ Kaydediliyor..."}
                  {saveStatus === "saved" && "✓ Kaydedildi"}
                  {saveStatus === "error" && "⚠️ Kaydedilemedi"}
                </span>

                {/* Move page button */}
                <button
                  onClick={() => {
                    setMoveTarget({ id: activePageId, targetParentPageId: activePage?.parentPageId || "null" });
                    setShowMoveModal(true);
                  }}
                  className="w-7 h-7 rounded-lg hover:bg-surface-container flex items-center justify-center border border-outline-variant/20"
                  title="Not Defterini Taşı"
                >
                  <span className="material-symbols-outlined text-[17px]">drive_file_move</span>
                </button>

                <button
                  onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                  className="w-7 h-7 rounded-lg hover:bg-surface-container flex items-center justify-center border border-outline-variant/20"
                  title="Detaylar"
                >
                  <span className="material-symbols-outlined text-[17px]">info</span>
                </button>
              </div>
            </div>

            {/* Page Cover & Icon Header */}
            <div className="group relative mb-5 flex items-center space-x-3.5 pb-5 border-b border-outline-variant/15">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center select-none text-primary">
                <span className="material-symbols-outlined text-2xl">{activePage?.icon || "description"}</span>
              </div>
              <input
                type="text"
                value={activePage?.title || ""}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="text-2xl md:text-3xl font-bold font-headline-lg bg-transparent text-on-surface focus:outline-none w-full tracking-tight"
                placeholder="Başlıksız Sayfa"
              />
            </div>

            {/* Subpages grid in-canvas */}
            <div className="mb-6 mt-2">
              <div className="flex items-center justify-between mb-3 pb-1 border-b border-outline-variant/15 select-none">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-secondary font-label-caps flex items-center">
                  <span className="material-symbols-outlined text-[14px] mr-1 text-primary">folder_open</span>
                  İç İçe Sayfalar
                </h3>
                <button
                  onClick={() => handleCreatePage(activePageId)}
                  className="text-[10px] font-bold text-primary hover:underline flex items-center space-x-0.5"
                >
                  <span className="material-symbols-outlined text-[13px]">add</span>
                  <span>Alt Defter Ekle</span>
                </button>
              </div>
              {pages.filter((p) => p.parentPageId === activePageId && !p.deletedAt).length === 0 ? (
                <p className="text-[10px] text-outline italic select-none">Bu not defterinin altında başka sayfa bulunmuyor.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {pages
                    .filter((p) => p.parentPageId === activePageId && !p.deletedAt)
                    .map((subP) => (
                      <div
                        key={subP.id}
                        className="flex items-center justify-between px-3 py-2 bg-surface-container-low/40 hover:bg-surface-container-low rounded-xl border border-outline-variant/15 text-left text-xs font-semibold text-on-surface transition-all group"
                      >
                        <Link href={`/notes?id=${subP.id}`} className="flex items-center space-x-2 truncate flex-1 min-w-0">
                          <span className="material-symbols-outlined text-[16px] text-secondary group-hover:text-primary transition-colors">
                            {subP.icon || "article"}
                          </span>
                          <span className="truncate flex-1">{subP.title}</span>
                        </Link>
                        <button
                          onClick={() => handleDuplicatePage(subP.id)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-outline hover:text-primary transition-all"
                          title="Kopyala"
                        >
                          <span className="material-symbols-outlined text-[14px]">content_copy</span>
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Block list */}
            {loading ? (
              <div className="space-y-4 py-8">
                <div className="h-8 bg-surface-container-low animate-pulse rounded-lg w-3/4" />
                <div className="h-5 bg-surface-container-low animate-pulse rounded-lg w-full" />
                <div className="h-5 bg-surface-container-low animate-pulse rounded-lg w-5/6" />
              </div>
            ) : (
              <div className="space-y-3 relative">
                {blocks.map((block, index) => {
                  const isHighlighted = block.id === highlightTaskId;

                  return (
                    <div
                      key={block.id}
                      className={`group flex items-start space-x-2.5 p-1.5 rounded-xl transition-all relative ${
                        isHighlighted ? "bg-primary/5 ring-1 ring-primary/30" : "hover:bg-surface-container-low/30"
                      }`}
                    >
                      {/* Drag Handle, Convert & Delete */}
                      <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 pt-1.5 transition-opacity text-outline select-none">
                        <span className="material-symbols-outlined text-[16px] cursor-grab">drag_indicator</span>
                        
                        {/* Convert block text to subpage */}
                        {block.type !== "subpage" && block.type !== "divider" && (
                          <button
                            onClick={() => handleConvertToSubpage(index, block)}
                            className="text-primary hover:scale-115 transition-transform"
                            title="Metni Alt Deftere Dönüştür"
                          >
                            <span className="material-symbols-outlined text-[15px]">swap_horizontal_circle</span>
                          </button>
                        )}

                        <button
                          onClick={() => removeBlock(index)}
                          className="text-error hover:scale-110 transition-transform"
                          title="Sil"
                        >
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                        </button>
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Heading */}
                        {block.type === "heading" && (
                          <input
                            type="text"
                            value={block.content}
                            onChange={(e) => updateBlock(index, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addBlock("paragraph", index);
                              }
                              handleKeyDown(e, index, block);
                            }}
                            placeholder="Başlık..."
                            className="w-full text-lg md:text-xl font-bold font-headline-lg bg-transparent text-on-surface focus:outline-none border-b border-transparent focus:border-primary/30 py-1"
                          />
                        )}

                        {/* Paragraph */}
                        {block.type === "paragraph" && (
                          <textarea
                            ref={(el) => {
                              if (el) {
                                el.style.height = "auto";
                                el.style.height = `${el.scrollHeight}px`;
                              }
                            }}
                            rows={1}
                            value={block.content}
                            onChange={(e) => {
                              updateBlock(index, e.target.value);
                              e.target.style.height = "auto";
                              e.target.style.height = `${e.target.scrollHeight}px`;
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Backspace" && block.content === "" && blocks.length > 1) {
                                e.preventDefault();
                                removeBlock(index);
                              }
                            }}
                            placeholder="Metin yazın veya / ile komut girin..."
                            className="w-full text-xs md:text-sm leading-relaxed bg-transparent text-on-surface focus:outline-none resize-none py-1"
                          />
                        )}

                        {/* Checklist Task Block */}
                        {block.type === "checklist" && (
                          <div className="w-full">
                            <div className="flex items-center space-x-3 py-1">
                              <input
                                type="checkbox"
                                checked={block.checked}
                                onChange={(e) => {
                                  updateBlock(index, block.content, { checked: e.target.checked });
                                }}
                                className="w-4 h-4 accent-primary rounded cursor-pointer"
                              />
                              <input
                                type="text"
                                value={block.content}
                                onChange={(e) => updateBlock(index, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addBlock("checklist", index);
                                  }
                                  handleKeyDown(e, index, block);
                                }}
                                placeholder="Yapılacak iş..."
                                className={`w-full text-xs md:text-sm bg-transparent focus:outline-none py-0.5 ${
                                  block.checked ? "line-through text-outline font-normal" : "text-on-surface"
                                }`}
                              />
                            </div>
                            
                            {/* Task properties box inside editor block */}
                            <div className="pl-7 flex items-center space-x-2 flex-wrap gap-y-1 select-none">
                              <select
                                value={block.properties?.priority || "NORMAL"}
                                onChange={(e) => updateBlock(index, block.content, { priority: e.target.value })}
                                className="text-[9px] font-bold bg-surface-container-low px-1.5 py-0.5 rounded border border-outline-variant/20 focus:outline-none text-secondary"
                              >
                                <option value="LOW">LOW</option>
                                <option value="NORMAL">NORMAL</option>
                                <option value="HIGH">HIGH</option>
                                <option value="URGENT">URGENT</option>
                              </select>
                              <input
                                type="date"
                                value={block.properties?.dueDate || ""}
                                onChange={(e) => updateBlock(index, block.content, { dueDate: e.target.value })}
                                className="text-[9px] font-bold bg-surface-container-low px-1.5 py-0.5 rounded border border-outline-variant/20 focus:outline-none text-secondary"
                              />
                              <select
                                value={block.properties?.projectId || ""}
                                onChange={(e) => updateBlock(index, block.content, { projectId: e.target.value || null })}
                                className="text-[9px] font-bold bg-surface-container-low px-1.5 py-0.5 rounded border border-outline-variant/20 focus:outline-none text-secondary"
                              >
                                <option value="">Projesiz</option>
                                {projects.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}

                        {/* Bullet list */}
                        {block.type === "bullet" && (
                          <div className="flex items-start space-x-2 py-1">
                            <span className="text-primary font-bold select-none pt-0.5">•</span>
                            <input
                              type="text"
                              value={block.content}
                              onChange={(e) => updateBlock(index, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addBlock("bullet", index);
                                }
                                handleKeyDown(e, index, block);
                              }}
                              placeholder="Liste öğesi..."
                              className="w-full text-xs md:text-sm bg-transparent text-on-surface focus:outline-none py-0.5"
                            />
                          </div>
                        )}

                        {/* Toggle list */}
                        {block.type === "toggle" && (
                          <div className="w-full py-1">
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => {
                                  updateBlock(index, block.content, { checked: !block.checked });
                                }}
                                className="w-5 h-5 flex items-center justify-center text-outline hover:text-on-surface transition-colors"
                              >
                                <span className={`material-symbols-outlined text-[18px] transition-transform duration-100 ${block.checked ? "rotate-90" : "rotate-0"}`}>
                                  chevron_right
                                </span>
                              </button>
                              <input
                                type="text"
                                value={block.content}
                                onChange={(e) => updateBlock(index, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addBlock("paragraph", index);
                                  }
                                  handleKeyDown(e, index, block);
                                }}
                                placeholder="Açılır liste..."
                                className="w-full font-semibold text-xs md:text-sm bg-transparent text-on-surface focus:outline-none py-0.5"
                              />
                            </div>
                            {block.checked && (
                              <div className="pl-7 mt-1.5 border-l border-outline-variant/30 ml-2.5">
                                <textarea
                                  rows={3}
                                  value={block.toggleBody || ""}
                                  onChange={(e) => {
                                    const updated = [...blocks];
                                    updated[index].toggleBody = e.target.value;
                                    setBlocks(updated);
                                    triggerAutoSave(updated);
                                  }}
                                  placeholder="Detaylı notlarınızı buraya yazın..."
                                  className="w-full text-xs md:text-sm leading-relaxed bg-transparent text-secondary focus:outline-none resize-none"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Code block */}
                        {block.type === "code" && (
                          <div className="w-full py-2 space-y-1.5">
                            <div className="flex items-center justify-between px-2.5 py-1 bg-surface-container rounded-t-xl select-none">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-outline font-label-caps flex items-center">
                                <span className="material-symbols-outlined text-[15px] mr-1">code</span>Kod Bloğu
                              </span>
                              <select
                                value={block.properties?.language || "javascript"}
                                onChange={(e) => updateBlock(index, block.content, { language: e.target.value })}
                                className="text-[9px] font-bold bg-surface-container-low px-1.5 py-0.5 rounded border border-outline-variant/20 focus:outline-none text-secondary"
                              >
                                <option value="javascript">JavaScript</option>
                                <option value="typescript">TypeScript</option>
                                <option value="python">Python</option>
                                <option value="css">CSS</option>
                                <option value="html">HTML</option>
                              </select>
                            </div>
                            <textarea
                              rows={5}
                              value={block.content}
                              onChange={(e) => updateBlock(index, e.target.value)}
                              placeholder="Kodlarınızı buraya yazın..."
                              className="w-full font-mono text-xs p-3 bg-surface-container-lowest border border-outline-variant/25 rounded-b-xl focus:outline-none resize-none"
                            />
                          </div>
                        )}

                        {/* Table Block */}
                        {block.type === "table" && (
                          <div className="w-full py-2 space-y-2 overflow-x-auto">
                            <div className="flex items-center space-x-2 select-none mb-1">
                              <button
                                onClick={() => {
                                  const rows = block.properties?.rows || [["", ""], ["", ""]];
                                  const updatedRows = [...rows, Array(rows[0].length).fill("")];
                                  updateBlock(index, block.content, { rows: updatedRows });
                                }}
                                className="px-2 py-1 bg-surface-container hover:bg-surface-container-high text-[10px] font-bold rounded-lg text-secondary"
                              >
                                + Satır Ekle
                              </button>
                              <button
                                onClick={() => {
                                  const rows = block.properties?.rows || [["", ""], ["", ""]];
                                  const updatedRows = rows.map((r: any) => [...r, ""]);
                                  updateBlock(index, block.content, { rows: updatedRows });
                                }}
                                className="px-2 py-1 bg-surface-container hover:bg-surface-container-high text-[10px] font-bold rounded-lg text-secondary"
                              >
                                + Sütun Ekle
                              </button>
                            </div>
                            <table className="border-collapse border border-outline-variant/30 text-xs md:text-sm w-full bg-surface-container-lowest rounded-xl overflow-hidden">
                              <tbody>
                                {(block.properties?.rows || [["", ""], ["", ""]]).map((row: string[], rIdx: number) => (
                                  <tr key={rIdx}>
                                    {row.map((cell: string, cIdx: number) => (
                                      <td key={cIdx} className="border border-outline-variant/20 p-2">
                                        <input
                                          type="text"
                                          value={cell}
                                          onChange={(e) => {
                                            const updatedRows = [...(block.properties?.rows || [])];
                                            updatedRows[rIdx] = [...updatedRows[rIdx]];
                                            updatedRows[rIdx][cIdx] = e.target.value;
                                            updateBlock(index, block.content, { rows: updatedRows });
                                          }}
                                          className="w-full bg-transparent focus:outline-none"
                                          placeholder="Hücre..."
                                        />
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Quote Block */}
                        {block.type === "quote" && (
                          <div className="pl-4 border-l-4 border-primary/50 py-1 my-1">
                            <input
                              type="text"
                              value={block.content}
                              onChange={(e) => updateBlock(index, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index, block)}
                              placeholder="Alıntı..."
                              className="w-full italic text-xs md:text-sm bg-transparent text-secondary focus:outline-none"
                            />
                          </div>
                        )}

                        {/* Callout Box */}
                        {block.type === "callout" && (
                          <div className={`p-3.5 rounded-2xl border flex items-start space-x-3 my-1 bg-surface-container-low/50 border-outline-variant/20`}>
                            <span className="material-symbols-outlined text-[20px] text-primary select-none pt-0.5">info</span>
                            <input
                              type="text"
                              value={block.content}
                              onChange={(e) => updateBlock(index, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index, block)}
                              placeholder="Önemli bilgi..."
                              className="w-full text-xs bg-transparent focus:outline-none text-on-surface"
                            />
                          </div>
                        )}

                        {/* Divider */}
                        {block.type === "divider" && (
                          <div className="py-2.5 select-none">
                            <hr className="border-t border-outline-variant/35" />
                          </div>
                        )}

                        {/* Inline subpage card block link (Notion style) */}
                        {block.type === "subpage" && (
                          <div className="flex items-center justify-between py-1.5 px-3 bg-surface-container-low hover:bg-surface-container border border-outline-variant/20 rounded-xl select-none w-fit cursor-pointer group/sublink transition-colors">
                            <Link
                              href={`/notes?id=${block.properties?.pageId}`}
                              className="flex items-center space-x-2 text-xs font-bold text-on-surface hover:text-primary transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px] text-secondary">article</span>
                              <span>{block.content || "Başlıksız Alt Defter"}</span>
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Slash Commands Dropdown */}
                {showSlashMenu && (
                  <div className="absolute left-8 z-30 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-2xl p-2.5 w-64 animate-in fade-in zoom-in-95 duration-150 select-none">
                    <div className="text-[10px] font-bold font-label-caps uppercase text-outline px-2.5 py-1 border-b border-surface-container">
                      Blok Türü Ekle
                    </div>
                    {[
                      { label: "Başlık Bloğu", type: "heading" as const, icon: "title", color: "text-primary" },
                      { label: "Paragraf Metni", type: "paragraph" as const, icon: "segment", color: "text-secondary" },
                      { label: "Yapılacaklar Listesi", type: "checklist" as const, icon: "check_box", color: "text-emerald-600" },
                      { label: "Noktalı Liste", type: "bullet" as const, icon: "format_list_bulleted", color: "text-blue-500" },
                      { label: "Açılır Liste (Toggle)", type: "toggle" as const, icon: "arrow_drop_down_circle", color: "text-amber-600" },
                      { label: "Alıntı (Quote)", type: "quote" as const, icon: "format_quote", color: "text-purple-600" },
                      { label: "Bilgi Kutusu (Callout)", type: "callout" as const, icon: "info", color: "text-sky-600" },
                      { label: "Kod Bloğu", type: "code" as const, icon: "code", color: "text-rose-600" },
                      { label: "Tablo", type: "table" as const, icon: "table", color: "text-indigo-600" },
                      { label: "Yatay Çizgi (Divider)", type: "divider" as const, icon: "horizontal_rule", color: "text-outline" },
                    ].map((item) => (
                      <button
                        key={item.type}
                        onClick={() => {
                          if (activeBlockIndex !== null) {
                            const updated = [...blocks];
                            updated[activeBlockIndex].content = updated[activeBlockIndex].content.replace(/\/$/, "");
                            updated[activeBlockIndex].type = item.type;
                            if (item.type === "toggle") {
                              updated[activeBlockIndex].toggleBody = "";
                              updated[activeBlockIndex].checked = false;
                            } else if (item.type === "table") {
                              updated[activeBlockIndex].properties = { rows: [["", ""], ["", ""]] };
                            } else if (item.type === "code") {
                              updated[activeBlockIndex].properties = { language: "javascript" };
                            } else if (item.type === "callout") {
                              updated[activeBlockIndex].properties = { type: "info" };
                            }
                            setBlocks(updated);
                            setShowSlashMenu(false);
                            triggerAutoSave(updated);
                          }
                        }}
                        className="w-full text-left flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-surface-container transition-colors"
                      >
                        <span className={`material-symbols-outlined text-[18px] ${item.color}`}>{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Toolbar Selector */}
          <div className="pt-4 mt-8 border-t border-outline-variant/15 flex items-center justify-between select-none">
            <div className="flex items-center space-x-1.5 flex-wrap gap-y-1.5">
              {[
                { label: "Başlık", type: "heading" as const, icon: "title" },
                { label: "Metin", type: "paragraph" as const, icon: "short_text" },
                { label: "Görev", type: "checklist" as const, icon: "check_box" },
                { label: "Liste", type: "bullet" as const, icon: "format_list_bulleted" },
                { label: "Açılır", type: "toggle" as const, icon: "arrow_drop_down" },
                { label: "Alıntı", type: "quote" as const, icon: "format_quote" },
                { label: "Bilgi", type: "callout" as const, icon: "info" },
                { label: "Kod", type: "code" as const, icon: "code" },
                { label: "Tablo", type: "table" as const, icon: "table" },
              ].map((btn) => (
                <button
                  key={btn.type}
                  onClick={() => addBlock(btn.type)}
                  className="px-2.5 py-1.5 bg-surface-container-low hover:bg-surface-container rounded-xl text-[11px] font-semibold text-on-surface flex items-center space-x-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-[15px]">{btn.icon}</span>
                  <span>{btn.label}</span>
                </button>
              ))}
            </div>
            <span className="text-[11px] text-outline font-label-sm font-medium">
              &apos;/&apos; ile komutlara ulaşın
            </span>
          </div>
        </div>
      )}

      {/* Empty default landing workspace */}
      {!currentView && !activePageId && (
        <div className="max-w-3xl mx-auto py-12 px-4 animate-in fade-in slide-in-from-bottom-4 duration-350 select-none">
          {/* Top Welcome / Header */}
          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center p-2 mb-4 ring-2 ring-primary/10 shadow-sm relative group">
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/20 via-transparent to-primary/10 opacity-60 group-hover:scale-110 transition-transform duration-300" />
              <img src="/logo-mascot.png" alt="Clown" className="w-14 h-14 object-contain relative z-10 filter drop-shadow-md group-hover:rotate-12 transition-transform duration-300" />
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              <h2 className="text-xl md:text-2xl font-black font-headline-lg text-on-surface tracking-tight">
                Hoş Geldiniz, Akif 👋
              </h2>
            </div>
            <p className="text-xs text-secondary mt-1.5 max-w-sm leading-relaxed">
              Kişisel Not Çalışma Alanınızda düzenli, sade ve hızlı çalışın. Sol ağaçtan notlarınızı yönetin veya hemen başlayın.
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { label: "Defterler", value: pages.length, icon: "book", color: "text-[#b61722] bg-[#b61722]/5" },
              { label: "Favoriler", value: pages.filter(p => p.isFavorite).length, icon: "star", color: "text-amber-600 bg-amber-50" },
              { label: "Son İnceleme", value: recentPages.length, icon: "history", color: "text-emerald-600 bg-emerald-50" },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center justify-center p-4 bg-surface-container-low/40 border border-outline-variant/15 rounded-2xl shadow-xs">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${stat.color}`}>
                  <span className="material-symbols-outlined text-[18px]">{stat.icon}</span>
                </div>
                <span className="text-base font-extrabold text-on-surface leading-tight">{stat.value}</span>
                <span className="text-[9px] font-bold text-outline uppercase tracking-wider font-label-caps mt-0.5">{stat.label}</span>
              </div>
            ))}
          </div>

          {/* Recent Pages Section */}
          {recentPages.length > 0 && (
            <div className="mb-8 bg-surface-container-low/30 border border-outline-variant/15 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center space-x-1.5 mb-3 pb-1 border-b border-outline-variant/10">
                <span className="material-symbols-outlined text-[15px] text-primary">history</span>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-secondary font-label-caps">Son Düzenlenenler</h3>
              </div>
              <div className="space-y-1.5">
                {recentPages.map((rp) => (
                  <Link
                    key={rp.id}
                    href={`/notes?id=${rp.id}`}
                    className="flex items-center justify-between p-2.5 bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/20 rounded-xl hover:border-primary/20 transition-all group"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                      <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors text-[16px]">
                        {rp.icon || "description"}
                      </span>
                      <span className="text-xs font-semibold truncate text-on-surface">{rp.title}</span>
                    </div>
                    <span className="text-[9px] text-outline opacity-75 mr-1 font-bold group-hover:text-primary transition-colors">Aç</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Quick Modern Action Card */}
          <div className="flex flex-col items-center justify-center p-5 bg-gradient-to-tr from-surface-container-low/20 to-surface-container-low/50 border border-outline-variant/15 rounded-2xl text-center shadow-xs">
            <span className="text-[9px] font-bold text-secondary uppercase font-label-caps tracking-wider block mb-3">HIZLI BAŞLANGIÇ</span>
            <button
              onClick={() => {
                setShowCreateModal(true);
                setCreateTarget({ name: "" });
              }}
              className="flex items-center space-x-2 px-6 py-2.5 bg-primary text-on-primary hover:bg-primary-container text-xs font-extrabold rounded-2xl shadow-md hover:-translate-y-0.5 hover:shadow-lg transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">note_add</span>
              <span>Yeni Not Defteri Oluştur</span>
            </button>
          </div>
        </div>
      )}

      {/* Details Side Panel overlay */}
      {activePage && (
        <DetailsPanel
          page={{
            id: activePage.id,
            title: activePage.title,
            icon: activePage.icon,
            coverImage: activePage.coverImage,
            isArchived: activePage.isArchived,
            isFavorite: activePage.isFavorite,
            createdAt: activePage.createdAt,
            updatedAt: activePage.updatedAt,
            lastOpenedAt: activePage.lastOpenedAt,
          }}
          blocks={blocks}
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          onRefreshPage={() => {
            loadAllPages();
            if (activePageId) loadPageData(activePageId);
          }}
        />
      )}

      {/* Global Command+K Quick Search dialog */}
      <SearchModal />

      {/* Create Modal dialog */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4 select-none">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-6 shadow-2xl border border-outline-variant/30 animate-in slide-in-from-bottom duration-200">
            <h2 className="text-base font-bold font-headline-lg mb-4">
              Yeni Not Defteri Oluştur
            </h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleCreatePage(null, createTarget.name.trim());
              setShowCreateModal(false);
            }} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-secondary block mb-1">İsim:</label>
                <input
                  type="text"
                  required
                  placeholder="örn. Günlük Notlar veya Çalışma Planı"
                  value={createTarget.name}
                  onChange={(e) => setCreateTarget({ name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-outline hover:bg-surface-container rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-semibold bg-primary text-on-primary rounded-xl shadow-md hover:bg-primary-container transition-colors"
                >
                  Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move Page / Parent Selector Modal dialog */}
      {showMoveModal && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4 select-none">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-6 shadow-2xl border border-outline-variant/30 animate-in slide-in-from-bottom duration-200">
            <h2 className="text-base font-bold font-headline-lg mb-4">
              Not Defterini Taşı
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-secondary block mb-1">Hedef Üst Defter:</label>
                <select
                  value={moveTarget.targetParentPageId}
                  onChange={(e) => setMoveTarget({ ...moveTarget, targetParentPageId: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface"
                >
                  <option value="null">Kök Dizin (Ana Sayfa)</option>
                  {pages
                    .filter((p) => p.id !== activePageId && !p.deletedAt && p.id !== activePage?.parentPageId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMoveModal(false)}
                  className="px-4 py-2 text-xs font-medium text-outline hover:bg-surface-container rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleMovePage}
                  className="px-5 py-2.5 text-xs font-semibold bg-primary text-on-primary rounded-xl shadow-md hover:bg-primary-container transition-colors"
                >
                  Taşı
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NotesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background p-6 flex flex-col justify-center items-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-secondary">Notlar yükleniyor...</p>
      </div>
    }>
      <NotesContent />
    </Suspense>
  );
}
