"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface SearchResults {
  folders: any[];
  notebooks: any[];
  pages: any[];
  tasks: any[];
}

export function SearchModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({ folders: [], notebooks: [], pages: [], tasks: [] });
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleOpenEvent = () => setIsOpen(true);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-search-modal", handleOpenEvent);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-search-modal", handleOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults({ folders: [], notebooks: [], pages: [], tasks: [] });
      setActiveIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults({ folders: [], notebooks: [], pages: [], tasks: [] });
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
        setActiveIndex(0);
      } catch (err) {
        console.error("Search fetch error:", err);
      }
      setLoading(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const flatList = [
    ...results.folders.map((f) => ({ ...f, type: "folder" })),
    ...results.notebooks.map((n) => ({ ...n, type: "notebook" })),
    ...results.pages.map((p) => ({ ...p, type: "page" })),
    ...results.tasks.map((t) => ({ ...t, type: "task" })),
  ];

  const handleNavigate = (item: any) => {
    setIsOpen(false);
    if (item.type === "page") {
      router.push(`/notes?id=${item.id}`);
    } else if (item.type === "notebook") {
      router.push(`/notes?notebookId=${item.id}`);
    } else if (item.type === "task") {
      router.push(`/notes?id=${item.pageId}&highlightTask=${item.id}`);
    }
  };

  const handleArrowKeys = (e: React.KeyboardEvent) => {
    if (flatList.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % flatList.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + flatList.length) % flatList.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = flatList[activeIndex];
      if (selected) handleNavigate(selected);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-start justify-center p-4 pt-[12vh]">
      <div className="w-full max-w-xl bg-surface-container-lowest rounded-3xl overflow-hidden shadow-2xl border border-outline-variant/30 flex flex-col max-h-[70vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Search Input */}
        <div className="flex items-center space-x-3 px-4 py-3.5 border-b border-outline-variant/15 flex-shrink-0">
          <span className="material-symbols-outlined text-secondary text-[22px]">search</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Klasör, defter, sayfa veya görev arayın..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleArrowKeys}
            className="flex-1 bg-transparent text-sm text-on-surface focus:outline-none placeholder:text-outline"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
          <span className="text-[10px] bg-surface-container-low border border-outline-variant/20 px-2 py-0.5 rounded font-mono text-outline select-none">ESC</span>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          {!query.trim() ? (
            <div className="text-center py-10 text-outline text-xs">
              <span className="material-symbols-outlined text-4xl mb-1.5 opacity-60">search_key</span>
              <p>Arama yapmak için yazmaya başlayın</p>
              <p className="text-[10px] opacity-75 mt-0.5">Command + K kısayolu ile istediğiniz an açabilirsiniz.</p>
            </div>
          ) : flatList.length === 0 && !loading ? (
            <div className="text-center py-10 text-outline text-xs">
              <span className="material-symbols-outlined text-4xl mb-1.5 opacity-60">info</span>
              <p>Herhangi bir eşleşme bulunamadı</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Grouped results display */}
              {results.folders.length > 0 && (
                <div>
                  <span className="px-3 py-1 text-[9px] font-bold text-outline uppercase tracking-wider block font-label-caps">Klasörler</span>
                  {results.folders.map((f, idx) => {
                    const itemIdx = flatList.findIndex((x) => x.id === f.id && x.type === "folder");
                    const active = itemIdx === activeIndex;
                    return (
                      <button
                        key={f.id}
                        onClick={() => handleNavigate({ ...f, type: "folder" })}
                        className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-2xl text-xs font-semibold transition-colors ${
                          active ? "bg-primary/10 text-primary" : "text-on-surface hover:bg-surface-container"
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <span className="material-symbols-outlined text-[17px] text-outline">folder</span>
                          <span>{f.name}</span>
                        </div>
                        <span className="text-[9px] opacity-75">Klasör</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {results.notebooks.length > 0 && (
                <div>
                  <span className="px-3 py-1 text-[9px] font-bold text-outline uppercase tracking-wider block font-label-caps">Defterler</span>
                  {results.notebooks.map((n) => {
                    const itemIdx = flatList.findIndex((x) => x.id === n.id && x.type === "notebook");
                    const active = itemIdx === activeIndex;
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleNavigate({ ...n, type: "notebook" })}
                        className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-2xl text-xs font-semibold transition-colors ${
                          active ? "bg-primary/10 text-primary" : "text-on-surface hover:bg-surface-container"
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <span className="material-symbols-outlined text-[17px] text-outline">book</span>
                          <span>{n.name}</span>
                        </div>
                        <span className="text-[9px] opacity-75">Defter</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {results.pages.length > 0 && (
                <div>
                  <span className="px-3 py-1 text-[9px] font-bold text-outline uppercase tracking-wider block font-label-caps">Sayfalar</span>
                  {results.pages.map((p) => {
                    const itemIdx = flatList.findIndex((x) => x.id === p.id && x.type === "page");
                    const active = itemIdx === activeIndex;
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleNavigate({ ...p, type: "page" })}
                        className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-2xl text-xs font-semibold transition-colors ${
                          active ? "bg-primary/10 text-primary" : "text-on-surface hover:bg-surface-container"
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                          <span className="material-symbols-outlined text-[17px] text-outline flex-shrink-0">{p.icon || "description"}</span>
                          <span className="truncate">{p.title}</span>
                        </div>
                        <span className="text-[9px] opacity-75 ml-2 flex-shrink-0">Sayfa</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {results.tasks.length > 0 && (
                <div>
                  <span className="px-3 py-1 text-[9px] font-bold text-outline uppercase tracking-wider block font-label-caps">Görevler</span>
                  {results.tasks.map((t) => {
                    const itemIdx = flatList.findIndex((x) => x.id === t.id && x.type === "task");
                    const active = itemIdx === activeIndex;
                    return (
                      <button
                        key={t.id}
                        onClick={() => handleNavigate({ ...t, type: "task" })}
                        className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-2xl text-xs font-semibold transition-colors ${
                          active ? "bg-primary/10 text-primary" : "text-on-surface hover:bg-surface-container"
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                          <span className="material-symbols-outlined text-[17px] text-outline flex-shrink-0">check_box</span>
                          <span className="truncate">{t.title}</span>
                          {t.page && (
                            <span className="text-[9px] text-outline truncate opacity-75">({t.page.title})</span>
                          )}
                        </div>
                        <span className="text-[9px] opacity-75 ml-2 flex-shrink-0">Görev</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
