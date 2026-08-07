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

  // Route query params driving state
  const folderParam = searchParams.get("folder") || "";
  const activePageId = searchParams.get("id") || "";
  const currentView = searchParams.get("view") || ""; // favorites | recent | trash | archive | ""
  const highlightTaskId = searchParams.get("highlightTask") || "";

  // Data states
  const [pages, setPages] = useState<PageItem[]>([]);
  const [recentPages, setRecentPages] = useState<PageItem[]>([]);
  const [activePage, setActivePage] = useState<PageItem | null>(null);
  const [blocks, setBlocks] = useState<BlockItem[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  
  // UI States
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [activeBlockIndex, setActiveBlockIndex] = useState<number | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals for Create/Move
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTarget, setMoveTarget] = useState({ id: "", targetParentPageId: "null" });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTarget, setCreateTarget] = useState({ name: "" });

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to update query parameters
  const updateParams = (newParams: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([key, val]) => {
      if (val === null) {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    });
    router.push(`/notes?${params.toString()}`);
  };

  const clearAllParams = () => {
    router.push("/notes");
  };

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
        if (p) {
          setActivePage(p);
          // Mark page as opened recently
          fetch(`/api/pages`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: p.id, lastOpenedAt: new Date().toISOString() }),
          }).catch(() => {});
        }
      }

      const resBlocks = await fetch(`/api/pages/${pageId}/blocks`);
      const blocksData = await resBlocks.json();
      if (Array.isArray(blocksData)) {
        // Map database blockType to frontend type
        const formatted = blocksData.map((b: any) => ({
          id: b.id,
          type: b.blockType || "paragraph",
          content: b.content || "",
          checked: b.checked || false,
          toggleBody: b.toggleBody || "",
          properties: b.properties || {},
        }));
        setBlocks(formatted);
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
        const payloadBlocks = updatedBlocks.map(b => ({
          id: b.id,
          blockType: b.type,
          content: b.content,
          checked: b.checked,
          toggleBody: b.toggleBody,
          properties: b.properties,
        }));
        const res = await fetch(`/api/pages/${activePageId}/blocks`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: updatedTitle !== undefined ? updatedTitle : (activePage?.title || "Başlıksız Not Defteri"),
            blocks: payloadBlocks,
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
    const updated = blocks.filter((_, idx) => idx !== index);
    setBlocks(updated);
    triggerAutoSave(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number, block: BlockItem) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addBlock("paragraph", index);
    } else if (e.key === "Backspace" && !block.content) {
      e.preventDefault();
      removeBlock(index);
    }
  };

  const handleConvertToSubpage = async (index: number, block: BlockItem) => {
    if (!block.content.trim()) return;
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: block.content,
          parentPageId: activePageId,
        }),
      });
      const newPage = await res.json();
      window.dispatchEvent(new Event("refresh-sidebar"));

      const updatedBlocks = [...blocks];
      updatedBlocks[index] = {
        id: block.id,
        type: "subpage",
        content: block.content,
        checked: false,
        properties: { pageId: newPage.id },
      };
      setBlocks(updatedBlocks);
      triggerAutoSave(updatedBlocks);
    } catch {}
  };

  const handleCreatePage = async (parentId: string | null, customTitle?: string) => {
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: customTitle || "Başlıksız Not",
          parentPageId: parentId,
        }),
      });
      const newPage = await res.json();
      window.dispatchEvent(new Event("refresh-sidebar"));
      updateParams({ folder: parentId || "all", id: newPage.id });
    } catch {}
  };

  const handleSoftDeletePage = async (pageId: string) => {
    try {
      await fetch("/api/pages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pageId, deleted: true }),
      });
      window.dispatchEvent(new Event("refresh-sidebar"));
      if (activePageId === pageId) {
        updateParams({ id: null });
      } else {
        loadAllPages();
      }
    } catch {}
  };

  const handleHardDeletePage = async (pageId: string) => {
    if (!confirm("Bu notu kalıcı olarak silmek istediğinize emin misiniz?")) return;
    try {
      await fetch(`/api/pages?id=${pageId}`, { method: "DELETE" });
      window.dispatchEvent(new Event("refresh-sidebar"));
      if (activePageId === pageId) {
        updateParams({ id: null });
      } else {
        loadAllPages();
      }
    } catch {}
  };

  const handleRestorePage = async (pageId: string) => {
    try {
      await fetch("/api/pages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pageId, restore: true }),
      });
      window.dispatchEvent(new Event("refresh-sidebar"));
      loadAllPages();
    } catch {}
  };

  const handleDuplicatePage = async (pageId: string) => {
    try {
      await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duplicateFromId: pageId }),
      });
      window.dispatchEvent(new Event("refresh-sidebar"));
      loadAllPages();
    } catch {}
  };

  const handleMovePage = async () => {
    if (!moveTarget.id) return;
    try {
      const targetParent = moveTarget.targetParentPageId === "null" ? null : moveTarget.targetParentPageId;
      await fetch("/api/pages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: moveTarget.id, parentPageId: targetParent }),
      });
      setShowMoveModal(false);
      window.dispatchEvent(new Event("refresh-sidebar"));
      loadAllPages();
    } catch {}
  };

  // Helper: Date grouping logic
  const groupNotesByDate = (notesList: PageItem[]) => {
    const groups: Record<string, PageItem[]> = {
      "Letzte 30 Tage": [],
      "Mai": [],
      "April": [],
      "Ältere Notizen": []
    };

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    notesList.forEach(n => {
      const date = new Date(n.updatedAt || n.createdAt);
      if (date >= thirtyDaysAgo) {
        groups["Letzte 30 Tage"].push(n);
      } else {
        const month = date.toLocaleString("tr-TR", { month: "long" });
        if (date.getFullYear() === now.getFullYear()) {
          if (!groups[month]) groups[month] = [];
          groups[month].push(n);
        } else {
          const yearKey = date.getFullYear().toString();
          if (!groups[yearKey]) groups[yearKey] = [];
          groups[yearKey].push(n);
        }
      }
    });

    return Object.entries(groups).filter(([_, val]) => val.length > 0);
  };

  // Get notes for the active view / folder
  let notesToShow = pages;

  // 1. Filter out folders themselves (root pages with subpages or pages meant to act as directories)
  // To keep it clean, any page that has parentPageId !== null is a note.
  // And root pages (parentPageId === null) with NO subpages can also be notes, but if a folder is selected, we show notes inside that folder.
  if (folderParam && folderParam !== "all") {
    notesToShow = notesToShow.filter(p => p.parentPageId === folderParam && !p.deletedAt);
  } else {
    // folderParam === "all" or empty: show all notes (all pages where parentPageId !== null)
    notesToShow = notesToShow.filter(p => p.parentPageId !== null && !p.deletedAt);
  }

  // 2. Filter by views
  if (currentView === "favorites") {
    notesToShow = notesToShow.filter(p => p.isFavorite && !p.deletedAt);
  } else if (currentView === "recent") {
    notesToShow = notesToShow.filter(p => p.lastOpenedAt !== null && !p.deletedAt);
  } else if (currentView === "trash") {
    notesToShow = pages.filter(p => p.deletedAt !== null);
  } else if (currentView === "archive") {
    notesToShow = notesToShow.filter(p => p.isArchived && !p.deletedAt);
  }

  // 3. Search filter
  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase();
    notesToShow = notesToShow.filter(p => 
      p.title.toLowerCase().includes(term)
    );
  }

  // Grouped notes list
  const groupedNotes = groupNotesByDate(notesToShow);

  const activeFolderPage = pages.find(p => p.id === folderParam);
  const activeFolderTitle = folderParam === "all" ? "Hepsi" : (activeFolderPage?.title || "Notlar");

  return (
    <div className="flex h-[calc(100vh-80px)] md:h-[calc(100vh-32px)] w-full bg-background text-on-surface overflow-hidden relative">
      
      {/* ---------------------------------------------------- */}
      {/* COLUMN 1: NOTES LIST PANE (Desktop & Mobile List) */}
      {/* ---------------------------------------------------- */}
      <div
        className={`w-full lg:w-80 flex flex-col border-r border-outline-variant/20 bg-surface-container-lowest h-full overflow-hidden flex-shrink-0 ${
          activePageId ? "hidden lg:flex" : (folderParam ? "flex" : "hidden lg:flex")
        }`}
      >
        <header className="px-4 pt-4 pb-2 border-b border-outline-variant/15 bg-surface-container-lowest select-none">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-2">
              {/* Back Button (Mobile only) */}
              <button
                onClick={clearAllParams}
                className="lg:hidden w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              <h1 className="text-xl font-extrabold tracking-tight font-headline-lg">
                {activeFolderTitle}
              </h1>
            </div>
            
            <div className="flex items-center space-x-1">
              <button
                onClick={() => handleCreatePage(folderParam === "all" ? null : folderParam)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container text-primary"
                title="Yeni Not Yaz"
              >
                <span className="material-symbols-outlined text-[20px]">edit</span>
              </button>
            </div>
          </div>

          <p className="text-[11px] text-secondary font-medium pl-1 mb-3">
            {notesToShow.length} Notizen
          </p>

          {/* Search bar inside header */}
          <div className="relative mb-2.5 pl-1">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[16px]">
              search
            </span>
            <input
              type="text"
              placeholder="Suchen"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-surface-container-low border border-outline-variant/30 rounded-xl focus:outline-none focus:border-primary/50 text-on-surface font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[14px] text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>
        </header>

        {/* Notes list grouped by Date */}
        <div className="flex-1 overflow-y-auto p-2 bg-surface-container-low/40 space-y-4">
          {groupedNotes.length === 0 ? (
            <div className="p-12 text-center text-secondary text-xs italic select-none">
              Not Defteri Boş
            </div>
          ) : (
            groupedNotes.map(([dateGroup, items]) => (
              <div key={dateGroup} className="space-y-1">
                <h3 className="px-2.5 text-[9px] font-bold text-outline uppercase tracking-wider font-label-caps opacity-75 select-none">
                  {dateGroup}
                </h3>
                <div className="space-y-1">
                  {items.map((item) => {
                    const isSelected = activePageId === item.id;
                    const cleanDate = new Date(item.updatedAt || item.createdAt).toLocaleDateString("tr-TR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                    });
                    
                    return (
                      <div
                        key={item.id}
                        onClick={() => updateParams({ id: item.id })}
                        className={`block p-3.5 rounded-xl cursor-pointer border relative overflow-hidden transition-all select-none group ${
                          isSelected
                            ? "bg-primary text-on-primary border-primary shadow-xs"
                            : "bg-surface-container-lowest border-outline-variant/20 hover:border-primary/20 shadow-2xs text-on-surface"
                        }`}
                      >
                        <h4 className="text-xs font-bold truncate mb-0.5 leading-snug">
                          {item.title || "Başlıksız Not"}
                        </h4>
                        
                        <div className="flex items-center space-x-2 text-[10px]">
                          <span className={`font-semibold ${isSelected ? "text-on-primary/80" : "text-secondary"}`}>
                            {cleanDate}
                          </span>
                          <span className={`truncate ${isSelected ? "text-on-primary/60" : "text-outline/70"}`}>
                            {item.isFavorite ? "★ " : ""}Not Defteri
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Mobile footer for list view */}
        <footer className="lg:hidden px-4 py-2 border-t border-outline-variant/20 bg-surface-container-lowest flex items-center justify-between flex-shrink-0">
          <span className="text-[10px] text-secondary font-semibold">
            {notesToShow.length} Notizen
          </span>
          <button
            onClick={() => handleCreatePage(folderParam === "all" ? null : folderParam)}
            className="w-9 h-9 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-md shadow-primary/20"
            title="Yeni Not Yaz"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </button>
        </footer>
      </div>

      {/* ---------------------------------------------------- */}
      {/* COLUMN 2: NOTE EDITOR CANVAS (Desktop & Mobile Editor) */}
      {/* ---------------------------------------------------- */}
      <div
        className={`flex flex-col flex-1 bg-surface-container-lowest h-full overflow-hidden ${
          activePageId ? "flex" : "hidden lg:flex"
        }`}
      >
        {activePageId ? (
          <>
            {/* Apple Notes Style Toolbar */}
            <header className="px-4 py-2.5 border-b border-outline-variant/15 bg-surface-container-lowest flex items-center justify-between flex-shrink-0 select-none">
              <div className="flex items-center space-x-2">
                {/* Back button (Mobile only) */}
                <button
                  onClick={() => updateParams({ id: null })}
                  className="lg:hidden w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>

                <button
                  onClick={() => handleCreatePage(folderParam === "all" ? null : folderParam)}
                  className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center text-secondary"
                  title="Yeni Not"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
              </div>

              {/* Editing shortcut icons */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => addBlock("heading")}
                  className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center text-secondary font-bold text-xs"
                  title="Başlık Ekle (Aa)"
                >
                  <span className="material-symbols-outlined text-[18px]">text_fields</span>
                </button>
                <button
                  onClick={() => addBlock("checklist")}
                  className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center text-secondary"
                  title="Görev Ekle"
                >
                  <span className="material-symbols-outlined text-[18px]">check_box</span>
                </button>
                <button
                  onClick={() => addBlock("table")}
                  className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center text-secondary"
                  title="Tablo Ekle"
                >
                  <span className="material-symbols-outlined text-[18px]">table</span>
                </button>
                <button
                  onClick={() => addBlock("bullet")}
                  className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center text-secondary"
                  title="Noktalı Liste"
                >
                  <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
                </button>

                <div className="w-[1px] h-5 bg-outline-variant/20 mx-1.5" />

                <button
                  onClick={() => {
                    if (activePage) {
                      handleCreatePage(activePageId); // Create subpage
                    }
                  }}
                  className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center text-secondary"
                  title="Alt Sayfa Bağlantısı"
                >
                  <span className="material-symbols-outlined text-[18px]">add_link</span>
                </button>
                <button
                  onClick={() => {
                    if (activePage) {
                      fetch(`/api/pages`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: activePage.id, isFavorite: !activePage.isFavorite }),
                      }).then(() => {
                        window.dispatchEvent(new Event("refresh-sidebar"));
                        loadAllPages();
                      });
                    }
                  }}
                  className={`w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center ${activePage?.isFavorite ? "text-amber-500" : "text-secondary"}`}
                  title="Favorilere Ekle"
                >
                  <span className="material-symbols-outlined text-[18px] fill-current">star</span>
                </button>
                <button
                  onClick={() => activePage && handleSoftDeletePage(activePage.id)}
                  className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center text-error"
                  title="Sil"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
                
                <div className="w-[1px] h-5 bg-outline-variant/20 mx-1.5" />
                
                <button
                  onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                  className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center text-secondary"
                  title="Bilgiler"
                >
                  <span className="material-symbols-outlined text-[18px]">info</span>
                </button>
              </div>
            </header>

            {/* Note Canvas body editor */}
            <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6">
              {/* Header metadata row */}
              <div className="flex items-center justify-between text-[10px] text-outline font-semibold mb-4 select-none">
                <span>
                  {activePage?.createdAt ? new Date(activePage.createdAt).toLocaleString("tr-TR") : ""}
                </span>
                <span>
                  {saveStatus === "saving" && "☁️ Kaydediliyor..."}
                  {saveStatus === "saved" && "✓ Kaydedildi"}
                  {saveStatus === "error" && "⚠️ Kaydedilemedi"}
                </span>
              </div>

              {/* Title input */}
              <div className="mb-6 pb-2 border-b border-outline-variant/15">
                <input
                  type="text"
                  value={activePage?.title || ""}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="text-2xl md:text-3xl font-extrabold font-headline-lg bg-transparent text-on-surface focus:outline-none w-full tracking-tight"
                  placeholder="Not Başlığı"
                />
              </div>

              {/* Dynamic Blocks editor list */}
              {loading ? (
                <div className="space-y-4 py-4">
                  <div className="h-6 bg-surface-container-low animate-pulse rounded-lg w-3/4" />
                  <div className="h-4 bg-surface-container-low animate-pulse rounded-lg w-full" />
                  <div className="h-4 bg-surface-container-low animate-pulse rounded-lg w-5/6" />
                </div>
              ) : (
                <div className="space-y-3 relative pb-20">
                  {blocks.map((block, index) => {
                    const isHighlighted = block.id === highlightTaskId;
                    return (
                      <div
                        key={block.id}
                        className={`group flex items-start space-x-2.5 p-1 rounded-xl transition-all relative ${
                          isHighlighted ? "bg-primary/5 ring-1 ring-primary/20" : "hover:bg-surface-container-low/20"
                        }`}
                      >
                        {/* Drag Handle & Delete (hover tools) */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 pt-1.5 transition-opacity text-outline select-none">
                          <span className="material-symbols-outlined text-[15px] cursor-grab">drag_indicator</span>
                          {block.type !== "subpage" && block.type !== "divider" && (
                            <button
                              onClick={() => handleConvertToSubpage(index, block)}
                              className="text-primary hover:scale-115 transition-transform"
                              title="Detay Klasörüne Dönüştür"
                            >
                              <span className="material-symbols-outlined text-[14px]">swap_horizontal_circle</span>
                            </button>
                          )}
                          <button
                            onClick={() => removeBlock(index)}
                            className="text-error hover:scale-110 transition-transform"
                            title="Sil"
                          >
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                          </button>
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Heading */}
                          {block.type === "heading" && (
                            <input
                              type="text"
                              value={block.content}
                              onChange={(e) => updateBlock(index, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index, block)}
                              placeholder="Başlık..."
                              className="w-full text-base font-extrabold bg-transparent text-on-surface focus:outline-none border-b border-transparent focus:border-primary/20 py-1"
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
                              onChange={(e) => updateBlock(index, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index, block)}
                              placeholder="Yazmaya başlayın..."
                              className="w-full text-xs md:text-sm bg-transparent text-on-surface focus:outline-none py-1 resize-none leading-relaxed"
                            />
                          )}

                          {/* Checklist */}
                          {block.type === "checklist" && (
                            <div className="flex items-center space-x-2.5 py-1">
                              <button
                                type="button"
                                onClick={() => updateBlock(index, block.content, { checked: !block.checked })}
                                className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                                  block.checked
                                    ? "bg-primary border-primary text-on-primary"
                                    : "border-outline-variant/80 hover:border-primary text-transparent"
                                }`}
                              >
                                <span className="material-symbols-outlined text-[13px] font-black">check</span>
                              </button>
                              <input
                                type="text"
                                value={block.content}
                                onChange={(e) => updateBlock(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, index, block)}
                                placeholder="Yapılacak iş..."
                                className={`w-full text-xs md:text-sm bg-transparent focus:outline-none ${
                                  block.checked ? "line-through text-outline/70 font-medium" : "text-on-surface"
                                }`}
                              />
                            </div>
                          )}

                          {/* Bullet List */}
                          {block.type === "bullet" && (
                            <div className="flex items-start space-x-2 py-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-outline-variant/80 mt-2 flex-shrink-0" />
                              <input
                                type="text"
                                value={block.content}
                                onChange={(e) => updateBlock(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, index, block)}
                                placeholder="Liste öğesi..."
                                className="w-full text-xs md:text-sm bg-transparent text-on-surface focus:outline-none"
                              />
                            </div>
                          )}

                          {/* Toggle list */}
                          {block.type === "toggle" && (
                            <div className="w-full py-1">
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => updateBlock(index, block.content, { checked: !block.checked })}
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
                                  onKeyDown={(e) => handleKeyDown(e, index, block)}
                                  placeholder="Açılır liste..."
                                  className="w-full font-semibold text-xs bg-transparent text-on-surface focus:outline-none py-0.5"
                                />
                              </div>
                              {block.checked && (
                                <div className="pl-7 mt-1 border-l border-outline-variant/20 ml-2">
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
                                    className="w-full text-xs leading-relaxed bg-transparent text-secondary focus:outline-none resize-none"
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Code block */}
                          {block.type === "code" && (
                            <div className="w-full py-2 space-y-1">
                              <div className="flex items-center justify-between px-2.5 py-1 bg-surface-container rounded-t-xl select-none">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-outline font-label-caps flex items-center">
                                  <span className="material-symbols-outlined text-[15px] mr-1">code</span>Kod Bloğu
                                </span>
                              </div>
                              <textarea
                                rows={4}
                                value={block.content}
                                onChange={(e) => updateBlock(index, e.target.value)}
                                placeholder="Kodlarınızı buraya yazın..."
                                className="w-full font-mono text-xs p-3 bg-surface-container-low border border-outline-variant/25 rounded-b-xl focus:outline-none resize-none"
                              />
                            </div>
                          )}

                          {/* Table Block */}
                          {block.type === "table" && (
                            <div className="w-full py-2 space-y-2 overflow-x-auto">
                              <div className="flex items-center space-x-2 select-none mb-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const rows = block.properties?.rows || [["", ""], ["", ""]];
                                    const updatedRows = [...rows, Array(rows[0].length).fill("")];
                                    updateBlock(index, block.content, { rows: updatedRows });
                                  }}
                                  className="px-2 py-1 bg-surface-container hover:bg-surface-container-high text-[9px] font-bold rounded-lg text-secondary"
                                >
                                  + Satır Ekle
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const rows = block.properties?.rows || [["", ""], ["", ""]];
                                    const updatedRows = rows.map((r: any) => [...r, ""]);
                                    updateBlock(index, block.content, { rows: updatedRows });
                                  }}
                                  className="px-2 py-1 bg-surface-container hover:bg-surface-container-high text-[9px] font-bold rounded-lg text-secondary"
                                >
                                  + Sütun Ekle
                                </button>
                              </div>
                              <table className="border-collapse border border-outline-variant/30 text-xs w-full bg-surface-container-lowest rounded-xl overflow-hidden">
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
                                className="w-full italic text-xs bg-transparent text-secondary focus:outline-none"
                              />
                            </div>
                          )}

                          {/* Callout Box */}
                          {block.type === "callout" && (
                            <div className="p-3.5 rounded-2xl border flex items-start space-x-3 my-1 bg-surface-container-low/50 border-outline-variant/20">
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
                            <div className="py-2 select-none">
                              <hr className="border-t border-outline-variant/20" />
                            </div>
                          )}

                          {/* Inline subpage card block link */}
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

                  {/* Slash Commands Dropdown Menu */}
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
                        { label: "Kod Bloğu", type: "code" as const, icon: "code", color: "text-slate-600" },
                        { label: "Tablo", type: "table" as const, icon: "table", color: "text-slate-600" },
                      ].map((item) => (
                        <button
                          key={item.type}
                          onClick={() => {
                            if (activeBlockIndex !== null) {
                              const updated = [...blocks];
                              updated[activeBlockIndex].type = item.type;
                              setBlocks(updated);
                              setShowSlashMenu(false);
                              triggerAutoSave(updated);
                            }
                          }}
                          className="w-full flex items-center space-x-3 px-2 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container rounded-xl text-left transition-colors"
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
          </>
        ) : (
          /* Empty reading pane state for desktop */
          <div className="h-full flex flex-col justify-center items-center text-center p-8 bg-surface-container-lowest select-none">
            <span className="material-symbols-outlined text-6xl text-outline/40 mb-4 animate-bounce">
              edit_note
            </span>
            <h2 className="text-base font-extrabold text-secondary mb-1">Not Seçilmedi</h2>
            <p className="text-xs text-outline max-w-[280px] leading-relaxed">
              Detayları görüntülemek ve düzenlemek için sol listeden bir not seçin veya yeni bir tane oluşturun.
            </p>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* MOBILE SCREEN: FOLDERS LIST (Only on mobile) */}
      {/* ---------------------------------------------------- */}
      <div
        className={`w-full h-full flex flex-col bg-surface-container-low lg:hidden select-none ${
          !folderParam && !activePageId ? "flex" : "hidden"
        }`}
      >
        <header className="px-4 pt-5 pb-3 bg-surface-container-low flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight font-headline-lg text-on-surface">
              Klasörler
            </h1>
            <p className="text-[11px] text-secondary font-medium mt-0.5">
              Apple Stil Notlar
            </p>
          </div>
          <button
            onClick={() => handleCreatePage(null, "Yeni Klasör")}
            className="px-4 py-1.5 bg-white text-on-surface text-xs font-bold rounded-full border border-outline-variant/30 shadow-2xs hover:bg-surface-container-high transition-all"
          >
            Yeni Klasör
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 space-y-6 pt-2 pb-24">
          <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-xs divide-y divide-outline-variant/15 overflow-hidden">
            <button
              onClick={() => updateParams({ folder: "all" })}
              className="w-full flex items-center justify-between px-4 py-3.5 text-sm text-left hover:bg-surface-container-low/40 active:bg-surface-container-low transition-colors"
            >
              <div className="flex items-center space-x-3 text-on-surface">
                <span className="material-symbols-outlined text-[20px] text-blue-500 font-bold">folder_copy</span>
                <span className="font-semibold">Hepsi</span>
              </div>
              <span className="material-symbols-outlined text-[18px] text-outline/50">chevron_right</span>
            </button>

            {pages
              .filter((p) => p.parentPageId === null && !p.deletedAt)
              .map((folderPage) => (
                <button
                  key={folderPage.id}
                  onClick={() => updateParams({ folder: folderPage.id })}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-sm text-left hover:bg-surface-container-low/40 active:bg-surface-container-low transition-colors"
                >
                  <div className="flex items-center space-x-3 text-on-surface">
                    <span className="material-symbols-outlined text-[20px] text-secondary">
                      {folderPage.icon || "folder"}
                    </span>
                    <span className="font-semibold">{folderPage.title}</span>
                  </div>
                  <span className="material-symbols-outlined text-[18px] text-outline/50">chevron_right</span>
                </button>
              ))}
          </div>
        </div>
      </div>

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
    <Suspense
      fallback={
        <div className="min-h-screen bg-background p-6 flex flex-col justify-center items-center">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-secondary">Notlar yükleniyor...</p>
        </div>
      }
    >
      <NotesContent />
    </Suspense>
  );
}
