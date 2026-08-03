"use client";

import { useEffect, useState, useRef } from "react";

interface BlockItem {
  id: string;
  type: "heading" | "paragraph" | "checklist";
  content: string;
  checked: boolean;
}

interface PageItem {
  id: string;
  title: string;
  icon: string;
}

export default function NotesPage() {
  const [pages, setPages] = useState<PageItem[]>([]);
  const [activePageId, setActivePageId] = useState<string>("page-1");
  const [pageTitle, setPageTitle] = useState<string>("Verimlilik Stratejisi & Notlar");
  const [blocks, setBlocks] = useState<BlockItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showSlashMenu, setShowSlashMenu] = useState<boolean>(false);
  const [activeBlockIndex, setActiveBlockIndex] = useState<number | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { fetchPages(); }, []);
  useEffect(() => { if (activePageId) fetchPageBlocks(activePageId); }, [activePageId]);

  const fetchPages = async () => {
    try {
      const res = await fetch("/api/notes");
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) setPages(data);
    } catch (e) { console.error(e); }
  };

  const fetchPageBlocks = async (pageId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notes/${pageId}/blocks`);
      const data = await res.json();
      if (Array.isArray(data)) setBlocks(data);
      const currentPage = pages.find((p) => p.id === pageId);
      if (currentPage) setPageTitle(currentPage.title);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const triggerAutoSave = (updatedBlocks: BlockItem[], updatedTitle?: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/notes/${activePageId}/blocks`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: updatedTitle || pageTitle, blocks: updatedBlocks }),
        });
      } catch (err) { console.error("Otomatik kaydetme başarısız:", err); }
    }, 600);
  };

  const handleTitleChange = (newTitle: string) => {
    setPageTitle(newTitle);
    setPages(pages.map((p) => (p.id === activePageId ? { ...p, title: newTitle } : p)));
    triggerAutoSave(blocks, newTitle);
  };

  const updateBlockContent = (index: number, newContent: string) => {
    const updated = [...blocks];
    updated[index].content = newContent;
    setBlocks(updated);
    if (newContent.endsWith("/")) { setActiveBlockIndex(index); setShowSlashMenu(true); }
    else setShowSlashMenu(false);
    triggerAutoSave(updated);
  };

  const toggleChecklist = (index: number) => {
    const updated = [...blocks];
    updated[index].checked = !updated[index].checked;
    setBlocks(updated);
    triggerAutoSave(updated);
  };

  const addBlock = (type: "heading" | "paragraph" | "checklist", index?: number) => {
    const newBlock: BlockItem = { id: `b-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, type, content: "", checked: false };
    const updated = typeof index === "number" ? [...blocks.slice(0, index + 1), newBlock, ...blocks.slice(index + 1)] : [...blocks, newBlock];
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

  const createNewPage = async () => {
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Yeni Sayfa", icon: "note_add" }),
      });
      const newP = await res.json();
      setPages([newP, ...pages]);
      setActivePageId(newP.id);
      setPageTitle(newP.title);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface px-6 md:px-10 lg:px-14 pt-6 pb-28 md:pb-8">
      <header className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 bg-primary rounded-full" />
            <span className="text-[11px] font-semibold text-primary uppercase tracking-wider font-label-caps">Notion Blok Tuvali</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-headline-lg text-on-surface tracking-tight mt-0.5">Notlar Editörü</h1>
        </div>
        <button onClick={createNewPage} className="flex items-center space-x-2 px-4 py-2 bg-primary text-on-primary rounded-2xl font-semibold text-xs shadow-md hover:bg-primary-container transition-colors">
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Yeni Sayfa</span>
        </button>
      </header>

      {/* Sayfa Seçici */}
      <div className="flex items-center space-x-2.5 overflow-x-auto pb-4 mb-6 scrollbar-none">
        {pages.map((p) => {
          const isActive = p.id === activePageId;
          return (
            <button key={p.id} onClick={() => setActivePageId(p.id)}
              className={`flex items-center space-x-2.5 px-4 py-2.5 rounded-2xl border text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                isActive ? "bg-primary text-on-primary border-primary shadow-sm" : "bg-surface-container-lowest text-on-surface border-outline-variant/30 hover:bg-surface-container-low"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{p.icon || "description"}</span>
              <span className="truncate max-w-[180px]">{p.title}</span>
            </button>
          );
        })}
      </div>

      {/* Blok Tuvali */}
      <div className="bg-surface-container-lowest rounded-3xl p-6 md:p-8 border border-outline-variant/30 shadow-[0_4px_20px_-2px_rgba(182,23,34,0.06)] min-h-[500px] flex flex-col justify-between">
        <div>
          <div className="flex items-center space-x-3 pb-5 mb-6 border-b border-surface-container-high">
            <span className="material-symbols-outlined text-3xl text-primary">auto_stories</span>
            <input type="text" value={pageTitle} onChange={(e) => handleTitleChange(e.target.value)}
              className="text-2xl md:text-3xl font-bold font-headline-lg bg-transparent text-on-surface focus:outline-none w-full border-b border-transparent focus:border-outline-variant/50 transition-colors"
              placeholder="Başlıksız Sayfa"
            />
          </div>

          {loading ? (
            <div className="space-y-4 py-8">
              <div className="h-8 bg-surface-container-low animate-pulse rounded-lg w-3/4" />
              <div className="h-5 bg-surface-container-low animate-pulse rounded-lg w-full" />
              <div className="h-5 bg-surface-container-low animate-pulse rounded-lg w-5/6" />
            </div>
          ) : (
            <div className="space-y-3 relative">
              {blocks.map((block, index) => (
                <div key={block.id} className="group flex items-start space-x-3 p-2 rounded-2xl hover:bg-surface-container-low/60 transition-colors relative">
                  <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 pt-1 transition-opacity text-outline">
                    <span className="material-symbols-outlined text-[18px] cursor-grab">drag_indicator</span>
                    <button onClick={() => removeBlock(index)} className="text-error hover:scale-110 transition-transform" title="Bloğu Sil">
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    {block.type === "heading" && (
                      <input type="text" value={block.content} onChange={(e) => updateBlockContent(index, e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBlock("paragraph", index); } }}
                        placeholder="Başlık... (/ yazarak komutlara ulaşın)"
                        className="w-full text-lg md:text-xl font-bold font-headline-lg bg-transparent text-on-surface focus:outline-none border-b border-transparent focus:border-primary/40 py-1"
                      />
                    )}
                    {block.type === "paragraph" && (
                      <textarea rows={1} value={block.content} onChange={(e) => updateBlockContent(index, e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addBlock("paragraph", index); } }}
                        placeholder="Metin yazın veya / ile komut girin..."
                        className="w-full text-xs md:text-sm leading-relaxed bg-transparent text-on-surface focus:outline-none resize-none py-1"
                      />
                    )}
                    {block.type === "checklist" && (
                      <div className="flex items-center space-x-3 py-1">
                        <input type="checkbox" checked={block.checked} onChange={() => toggleChecklist(index)} className="w-4 h-4 accent-primary rounded cursor-pointer" />
                        <input type="text" value={block.content} onChange={(e) => updateBlockContent(index, e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBlock("checklist", index); } }}
                          placeholder="Yapılacak iş..."
                          className={`w-full text-xs md:text-sm bg-transparent focus:outline-none py-0.5 ${block.checked ? "line-through text-outline" : "text-on-surface"}`}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Slash Komut Menüsü */}
              {showSlashMenu && (
                <div className="absolute left-8 z-30 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-2xl p-2.5 w-64 animate-in fade-in zoom-in-95 duration-150">
                  <div className="text-[10px] font-bold font-label-caps uppercase text-outline px-2.5 py-1 border-b border-surface-container">Blok Türü Ekle</div>
                  {[
                    { label: "Başlık Bloğu", type: "heading" as const, icon: "title", color: "text-primary" },
                    { label: "Paragraf Metni", type: "paragraph" as const, icon: "segment", color: "text-secondary" },
                    { label: "Yapılacaklar Listesi", type: "checklist" as const, icon: "check_box", color: "text-tertiary" },
                  ].map((item) => (
                    <button key={item.type}
                      onClick={() => {
                        if (activeBlockIndex !== null) {
                          const updated = [...blocks];
                          updated[activeBlockIndex].content = updated[activeBlockIndex].content.replace(/\/$/, "");
                          updated[activeBlockIndex].type = item.type;
                          setBlocks(updated);
                          setShowSlashMenu(false);
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

        {/* Alt Araç Çubuğu */}
        <div className="pt-4 mt-8 border-t border-surface-container-high flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {[
              { label: "Başlık", type: "heading" as const, icon: "title" },
              { label: "Metin", type: "paragraph" as const, icon: "short_text" },
              { label: "Görev", type: "checklist" as const, icon: "check_box" },
            ].map((btn) => (
              <button key={btn.type} onClick={() => addBlock(btn.type)}
                className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-semibold text-on-surface flex items-center space-x-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">{btn.icon}</span>
                <span>{btn.label}</span>
              </button>
            ))}
          </div>
          <span className="text-[11px] text-outline font-label-sm font-medium">&apos;/&apos; ile komutlara ulaşın</span>
        </div>
      </div>
    </div>
  );
}
