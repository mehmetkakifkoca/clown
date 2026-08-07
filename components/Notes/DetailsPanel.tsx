"use client";

import { useEffect, useState } from "react";

interface PageDetails {
  id: string;
  title: string;
  icon: string;
  coverImage: string | null;
  isArchived: boolean;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
}

interface BlockItem {
  id: string;
  type: string;
  content: string;
  checked: boolean;
  toggleBody?: string;
}

interface DetailsPanelProps {
  page: PageDetails;
  blocks: BlockItem[];
  isOpen: boolean;
  onClose: () => void;
  onRefreshPage: () => void;
}

interface PageLabel {
  id: string;
  label: {
    id: string;
    name: string;
    color: string;
  };
}

interface GlobalLabel {
  id: string;
  name: string;
  color: string;
}

export function DetailsPanel({ page, blocks, isOpen, onClose, onRefreshPage }: DetailsPanelProps) {
  const [pageLabels, setPageLabels] = useState<PageLabel[]>([]);
  const [allLabels, setAllLabels] = useState<GlobalLabel[]>([]);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#b61722");
  const [showAddLabel, setShowAddLabel] = useState(false);

  useEffect(() => {
    if (isOpen && page.id) {
      loadPageLabels();
      loadAllLabels();
    }
  }, [isOpen, page.id]);

  const loadPageLabels = async () => {
    try {
      const res = await fetch(`/api/label-relations?entityId=${page.id}&entityType=page`);
      const data = await res.json();
      if (Array.isArray(data)) setPageLabels(data);
    } catch {}
  };

  const loadAllLabels = async () => {
    try {
      const res = await fetch("/api/labels");
      const data = await res.json();
      if (Array.isArray(data)) setAllLabels(data);
    } catch {}
  };

  const handleToggleFavorite = async () => {
    try {
      await fetch("/api/pages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: page.id, isFavorite: !page.isFavorite }),
      });
      onRefreshPage();
    } catch {}
  };

  const handleToggleArchive = async () => {
    try {
      await fetch("/api/pages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: page.id, isArchived: !page.isArchived }),
      });
      onRefreshPage();
    } catch {}
  };

  const handleAddLabelRelation = async (labelId: string) => {
    try {
      await fetch("/api/label-relations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelId, entityType: "page", entityId: page.id }),
      });
      loadPageLabels();
    } catch {}
  };

  const handleRemoveLabelRelation = async (labelId: string) => {
    try {
      await fetch(`/api/label-relations?labelId=${labelId}&entityType=page&entityId=${page.id}`, {
        method: "DELETE",
      });
      loadPageLabels();
    } catch {}
  };

  const handleCreateAndAddLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabelName.trim()) return;

    try {
      // 1. Create label
      const res = await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newLabelName.trim(), color: newLabelColor }),
      });
      const label = await res.json();

      // 2. Add connection
      await handleAddLabelRelation(label.id);
      
      setNewLabelName("");
      setShowAddLabel(false);
      loadAllLabels();
    } catch {}
  };

  // Export handlers
  const exportAsFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportMarkdown = () => {
    let md = `# ${page.title}\n\n`;
    blocks.forEach((b) => {
      if (b.type === "heading") {
        md += `## ${b.content}\n\n`;
      } else if (b.type === "paragraph") {
        md += `${b.content}\n\n`;
      } else if (b.type === "checklist") {
        md += `- [${b.checked ? "x" : " "}] ${b.content}\n\n`;
      } else if (b.type === "bullet") {
        md += `- ${b.content}\n`;
      } else if (b.type === "toggle") {
        md += `<details>\n<summary>${b.content}</summary>\n${b.toggleBody || ""}\n</details>\n\n`;
      }
    });
    exportAsFile(`${page.title.toLowerCase().replace(/\s+/g, "_")}.md`, md, "text/markdown");
  };

  const exportHTML = () => {
    let html = `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>${page.title}</title>\n<style>body{font-family:sans-serif;line-height:1.6;padding:2rem;max-width:800px;margin:0 auto;} h1,h2{color:#b61722;} ul{padding-left:1.5rem;}</style>\n</head>\n<body>\n`;
    html += `<h1>${page.title}</h1>\n`;
    
    blocks.forEach((b) => {
      if (b.type === "heading") {
        html += `<h2>${b.content}</h2>\n`;
      } else if (b.type === "paragraph") {
        html += `<p>${b.content}</p>\n`;
      } else if (b.type === "checklist") {
        html += `<div><input type="checkbox" ${b.checked ? "checked" : ""} disabled> ${b.content}</div>\n`;
      } else if (b.type === "bullet") {
        html += `<li>${b.content}</li>\n`;
      } else if (b.type === "toggle") {
        html += `<details>\n<summary>${b.content}</summary>\n<p>${b.toggleBody || ""}</p>\n</details>\n`;
      }
    });

    html += `</body>\n</html>`;
    exportAsFile(`${page.title.toLowerCase().replace(/\s+/g, "_")}.html`, html, "text/html");
  };

  const exportPlainText = () => {
    let text = `${page.title}\n====================\n\n`;
    blocks.forEach((b) => {
      if (b.type === "heading") {
        text += `\n${b.content.toUpperCase()}\n\n`;
      } else if (b.type === "checklist") {
        text += `[${b.checked ? "X" : " "}] ${b.content}\n`;
      } else if (b.type === "bullet") {
        text += `• ${b.content}\n`;
      } else {
        text += `${b.content}\n`;
        if (b.type === "toggle" && b.toggleBody) {
          text += `  > ${b.toggleBody}\n`;
        }
      }
    });
    exportAsFile(`${page.title.toLowerCase().replace(/\s+/g, "_")}.txt`, text, "text/plain");
  };

  const exportPDF = () => {
    window.print();
  };

  if (!isOpen) return null;

  const checklistItems = blocks.filter((b) => b.type === "checklist");
  const completedTasks = checklistItems.filter((b) => b.checked);

  return (
    <aside className="w-80 h-screen fixed top-0 right-0 z-30 bg-surface-container-lowest border-l border-outline-variant/20 px-4 py-5 shadow-xs flex flex-col justify-between overflow-y-auto select-none">
      <div className="space-y-6">
        {/* Panel Header */}
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/15">
          <h2 className="text-xs font-bold uppercase tracking-wider text-secondary font-label-caps flex items-center">
            <span className="material-symbols-outlined text-[16px] mr-1 text-primary">info</span>
            Sayfa Özellikleri
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-surface-container rounded-lg text-outline">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleToggleFavorite}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              page.isFavorite
                ? "bg-amber-50 border-amber-200 text-amber-700 font-bold"
                : "bg-surface-container-low border-outline-variant/20 text-secondary hover:bg-surface-container"
            }`}
          >
            <span className={`material-symbols-outlined text-[16px] ${page.isFavorite ? "fill-1 text-amber-500" : ""}`}>
              star
            </span>
            <span>{page.isFavorite ? "Favorilerde" : "Favori Yap"}</span>
          </button>

          <button
            onClick={handleToggleArchive}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              page.isArchived
                ? "bg-orange-50 border-orange-200 text-orange-700 font-bold"
                : "bg-surface-container-low border-outline-variant/20 text-secondary hover:bg-surface-container"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">archive</span>
            <span>{page.isArchived ? "Arşivden Çıkar" : "Arşivle"}</span>
          </button>
        </div>

        {/* Labels Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider font-label-caps">Etiketler</span>
            <button
              onClick={() => setShowAddLabel(!showAddLabel)}
              className="text-[10px] font-bold text-primary hover:underline flex items-center space-x-0.5"
            >
              <span className="material-symbols-outlined text-[12px]">{showAddLabel ? "close" : "add"}</span>
              <span>{showAddLabel ? "Kapat" : "Ekle"}</span>
            </button>
          </div>

          {/* Add label subform */}
          {showAddLabel && (
            <div className="bg-surface-container-low p-3 rounded-2xl border border-outline-variant/20 space-y-3">
              <form onSubmit={handleCreateAndAddLabel} className="space-y-2">
                <input
                  type="text"
                  placeholder="Etiket adı..."
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-surface-container-lowest rounded-lg border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    {["#b61722", "#006765", "#0078d4", "#f59e0b", "#10b981", "#7c3aed"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewLabelColor(c)}
                        className={`w-4 h-4 rounded-full border ${newLabelColor === c ? "ring-1 ring-primary scale-110" : ""}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <button type="submit" className="px-2.5 py-1 bg-primary text-on-primary text-[10px] font-bold rounded-lg shadow-sm">
                    Oluştur
                  </button>
                </div>
              </form>
              
              {/* Existing label list */}
              {allLabels.filter((l) => !pageLabels.some((pl) => pl.label.id === l.id)).length > 0 && (
                <div className="pt-2 border-t border-outline-variant/10">
                  <span className="text-[9px] text-outline uppercase font-label-caps block mb-1">Mevcut Etiketler</span>
                  <div className="flex flex-wrap gap-1">
                    {allLabels
                      .filter((l) => !pageLabels.some((pl) => pl.label.id === l.id))
                      .map((l) => (
                        <button
                          key={l.id}
                          onClick={() => handleAddLabelRelation(l.id)}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold text-white hover:scale-105 transition-transform"
                          style={{ backgroundColor: l.color }}
                        >
                          + {l.name}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Current Page Labels list */}
          {pageLabels.length === 0 ? (
            <p className="text-[10px] text-outline italic">Bu sayfaya etiket eklenmemiş.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {pageLabels.map((pl) => (
                <span
                  key={pl.id}
                  className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-xs"
                  style={{ backgroundColor: pl.label.color }}
                >
                  <span>{pl.label.name}</span>
                  <button
                    onClick={() => handleRemoveLabelRelation(pl.label.id)}
                    className="hover:scale-115 transition-transform text-white opacity-80"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Task progress indicator */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-outline uppercase tracking-wider block font-label-caps">Görev Durumu</span>
          {checklistItems.length === 0 ? (
            <p className="text-[10px] text-outline italic">Sayfada yapılacak iş listesi bulunmuyor.</p>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-secondary">
                <span>Tamamlanan</span>
                <span>{completedTasks.length} / {checklistItems.length} (%{Math.round((completedTasks.length / checklistItems.length) * 100)})</span>
              </div>
              <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(completedTasks.length / checklistItems.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Page Timestamps */}
        <div className="space-y-2 bg-surface-container-low p-3 rounded-2xl border border-outline-variant/15 text-[10px] text-secondary font-semibold">
          <div className="flex justify-between">
            <span>Oluşturulma:</span>
            <span className="text-on-surface">{new Date(page.createdAt).toLocaleString("tr-TR")}</span>
          </div>
          <div className="flex justify-between">
            <span>Son Güncelleme:</span>
            <span className="text-on-surface">{new Date(page.updatedAt).toLocaleString("tr-TR")}</span>
          </div>
          {page.lastOpenedAt && (
            <div className="flex justify-between">
              <span>Son Açılma:</span>
              <span className="text-on-surface">{new Date(page.lastOpenedAt).toLocaleString("tr-TR")}</span>
            </div>
          )}
        </div>
      </div>

      {/* Export Section */}
      <div className="space-y-3 pt-6 border-t border-outline-variant/15">
        <span className="text-[10px] font-bold text-outline uppercase tracking-wider block font-label-caps">Dışa Aktar</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={exportMarkdown}
            className="flex items-center justify-center space-x-1 px-3 py-2 bg-surface-container-low hover:bg-surface-container text-[11px] font-bold rounded-xl text-secondary border border-outline-variant/20 transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">markdown</span>
            <span>Markdown</span>
          </button>
          <button
            onClick={exportHTML}
            className="flex items-center justify-center space-x-1 px-3 py-2 bg-surface-container-low hover:bg-surface-container text-[11px] font-bold rounded-xl text-secondary border border-outline-variant/20 transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">html</span>
            <span>HTML</span>
          </button>
          <button
            onClick={exportPlainText}
            className="flex items-center justify-center space-x-1 px-3 py-2 bg-surface-container-low hover:bg-surface-container text-[11px] font-bold rounded-xl text-secondary border border-outline-variant/20 transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">description</span>
            <span>Düz Metin</span>
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center justify-center space-x-1 px-3 py-2 bg-surface-container-low hover:bg-surface-container text-[11px] font-bold rounded-xl text-secondary border border-outline-variant/20 transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">picture_as_pdf</span>
            <span>PDF / Yazdır</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
