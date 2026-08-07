"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

interface ConnectedAccount {
  id: string;
  email: string;
  provider: string;
  label: string;
}

interface SidebarPage {
  id: string;
  title: string;
  icon: string;
  parentPageId: string | null;
  isArchived: boolean;
  isFavorite: boolean;
}

function SidebarNavContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [pages, setPages] = useState<SidebarPage[]>([]);
  
  const [mailOpen, setMailOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(true);
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});

  const currentAccount = searchParams.get("account") || "all";
  const currentFolder = searchParams.get("folder") || "inbox";
  const activePageId = searchParams.get("id") || "";
  const currentView = searchParams.get("view") || "";

  useEffect(() => {
    loadAccounts();
    loadPages();
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleRefresh = () => {
      loadPages();
    };
    window.addEventListener("refresh-sidebar", handleRefresh);
    return () => {
      window.removeEventListener("refresh-sidebar", handleRefresh);
    };
  }, []);

  const loadAccounts = async () => {
    try {
      const res = await fetch("/api/mail/accounts");
      const data = await res.json();
      if (Array.isArray(data)) setAccounts(data);
    } catch {}
  };

  const loadPages = async () => {
    try {
      const res = await fetch("/api/pages?all=true");
      const data = await res.json();
      if (Array.isArray(data)) setPages(data);
    } catch {}
  };

  const handleAddPageDirectly = async (parentPageId: string | null) => {
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Yeni Not Defteri",
          parentPageId,
        }),
      });
      const newPage = await res.json();
      window.dispatchEvent(new Event("refresh-sidebar"));
      if (parentPageId) {
        setExpandedPages((prev) => ({ ...prev, [parentPageId]: true }));
      }
      router.push(`/notes?id=${newPage.id}`);
    } catch {}
  };

  // Recursively render pages and subpages tree
  const renderPagesTree = (allPages: SidebarPage[], parentId: string | null, depth = 0) => {
    const levelPages = allPages.filter((p) => p.parentPageId === parentId);
    if (levelPages.length === 0) return null;

    return (
      <div className={`space-y-0.5 ${depth > 0 ? "pl-2 border-l border-outline-variant/15 ml-2.5" : "pl-1.5"}`}>
        {levelPages.map((p) => {
          const hasChildren = allPages.some((child) => child.parentPageId === p.id);
          const isExpanded = expandedPages[p.id];
          const isActive = pathname === "/notes" && activePageId === p.id && !currentView;

          return (
            <div key={p.id} className="space-y-0.5">
              <div className={`flex items-center justify-between px-2 py-0.5 rounded-xl text-xs transition-colors group/page ${
                isActive ? "bg-primary text-on-primary font-bold shadow-xs" : "text-secondary hover:bg-surface-container-high"
              }`}>
                <Link
                  href={`/notes?id=${p.id}`}
                  className="flex items-center space-x-2 flex-1 truncate min-w-0"
                >
                  <span className="material-symbols-outlined text-[15px]">{p.icon || "description"}</span>
                  <span className="truncate">{p.title}</span>
                </Link>
                <div className="flex items-center space-x-1 select-none">
                  {/* + button to add a subpage directly inside this page */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAddPageDirectly(p.id);
                    }}
                    className="opacity-0 group-hover/page:opacity-100 p-0.5 hover:bg-black/5 rounded-md text-primary transition-opacity flex items-center justify-center"
                    title="Alt Sayfa Ekle"
                  >
                    <span className="material-symbols-outlined text-[13px]">add</span>
                  </button>
                  {hasChildren && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setExpandedPages((prev) => ({ ...prev, [p.id]: !prev[p.id] }));
                      }}
                      className="p-0.5 hover:bg-black/5 rounded-md flex items-center justify-center text-current"
                    >
                      <span className={`material-symbols-outlined text-[13px] transition-transform duration-100 ${isExpanded ? "rotate-90" : "rotate-0"}`}>
                        chevron_right
                      </span>
                    </button>
                  )}
                </div>
              </div>
              {hasChildren && isExpanded && renderPagesTree(allPages, p.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  const menuItems = [
    { label: "Takvim", icon: "calendar_today", href: "/calendar", subtext: "Ajanda" },
    { label: "Hesaplar", icon: "analytics", href: "/accounts", subtext: "Instagram Analiz" },
    { label: "Ayarlar", icon: "settings", href: "/settings/accounts", subtext: "OAuth Entegrasyon" },
  ];

  // Root pages are favorited pages that either have no parent or their parent is not favorited (to avoid duplicate trees)
  const rootPages = pages.filter(
    (p) => p.isFavorite && (!p.parentPageId || !pages.some((parent) => parent.id === p.parentPageId && parent.isFavorite))
  );

  return (
    <nav className="flex-1 space-y-2 overflow-y-auto pr-1 scrollbar-thin select-none">
      {/* 1. Posta (Mail) Accordion Group */}
      <div className="space-y-1">
        <div className={`flex items-center justify-between px-3 py-2 rounded-2xl transition-all duration-200 ${
          pathname.startsWith("/inbox") ? "bg-primary-fixed/30 text-primary font-bold" : "text-on-surface hover:bg-surface-container-high"
        }`}>
          <Link href="/inbox?account=all&folder=inbox" className="flex items-center space-x-3 flex-1 min-w-0">
            <span className="material-symbols-outlined text-[20px]">mail</span>
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-tight">Posta</span>
              <span className="text-[9px] opacity-75 font-label-caps">Gmail & Outlook</span>
            </div>
          </Link>
          <button onClick={() => setMailOpen(!mailOpen)} className="p-1 hover:bg-surface-container rounded-lg text-secondary">
            <span className="material-symbols-outlined text-[16px] transition-transform duration-200" style={{ transform: mailOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
              expand_more
            </span>
          </button>
        </div>

        {mailOpen && (
          <div className="pl-3 pr-1 space-y-1 border-l-2 border-primary/20 ml-5 py-1">
            <Link href="/inbox?account=all&folder=inbox" className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              pathname.startsWith("/inbox") && currentAccount === "all" ? "bg-primary text-on-primary shadow-xs" : "text-secondary hover:bg-surface-container-high"
            }`}>
              <span className="material-symbols-outlined text-[15px]">inbox</span>
              <span>Tüm Mailler</span>
            </Link>

            {accounts.map((acc) => {
              const isAccActive = currentAccount === acc.provider;
              return (
                <div key={acc.id} className="pt-1.5 space-y-0.5">
                  <div className="flex items-center space-x-1.5 px-2 py-0.5 text-[9px] font-bold text-outline uppercase font-label-caps tracking-wider">
                    <span className={`w-1.5 h-1.5 rounded-full ${acc.provider === "gmail" ? "bg-red-500" : "bg-blue-500"}`} />
                    <span className="truncate">{acc.provider === "gmail" ? "Google" : "Hotmail"} ({acc.email.split("@")[0]})</span>
                  </div>

                  <Link href={`/inbox?account=${acc.provider}&folder=inbox`} className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    pathname.startsWith("/inbox") && isAccActive && currentFolder === "inbox" ? "bg-surface-container-highest text-primary font-bold" : "text-secondary hover:bg-surface-container-high"
                  }`}>
                    <span className="material-symbols-outlined text-[14px]">move_to_inbox</span>
                    <span>Gelen Kutusu</span>
                  </Link>

                  <Link href={`/inbox?account=${acc.provider}&folder=sent`} className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    pathname.startsWith("/inbox") && isAccActive && currentFolder === "sent" ? "bg-surface-container-highest text-primary font-bold" : "text-secondary hover:bg-surface-container-high"
                  }`}>
                    <span className="material-symbols-outlined text-[14px]">send</span>
                    <span>Gönderilenler</span>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Gelişmiş Notlar (Workspace) Accordion Group */}
      <div className="space-y-1">
        <div className={`flex items-center justify-between px-3 py-2 rounded-2xl transition-all duration-200 ${
          pathname.startsWith("/notes") ? "bg-primary-fixed/30 text-primary font-bold" : "text-on-surface hover:bg-surface-container-high"
        }`}>
          <Link href="/notes" className="flex items-center space-x-3 flex-1 min-w-0">
            <span className="material-symbols-outlined text-[20px]">edit_note</span>
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-tight">Notlar</span>
              <span className="text-[9px] opacity-75 font-label-caps">Notion Defterleri</span>
            </div>
          </Link>
          <button onClick={() => setNotesOpen(!notesOpen)} className="p-1 hover:bg-surface-container rounded-lg text-secondary">
            <span className="material-symbols-outlined text-[16px] transition-transform duration-200" style={{ transform: notesOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
              expand_more
            </span>
          </button>
        </div>

        {notesOpen && (
          <div className="pl-3 pr-1 space-y-1 border-l-2 border-primary/20 ml-5 py-1">
            {/* Ara (cmd+K) */}
            <button
              onClick={() => {
                window.dispatchEvent(new Event("open-search-modal"));
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold text-secondary hover:bg-surface-container-high text-left"
            >
              <div className="flex items-center space-x-2">
                <span className="material-symbols-outlined text-[15px]">search</span>
                <span>Hızlı Arama</span>
              </div>
              <span className="text-[9px] bg-surface-container px-1.5 py-0.5 rounded font-mono text-outline select-none">⌘K</span>
            </button>

            {/* Tüm Notlar */}
            <Link href="/notes" className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              pathname === "/notes" && !activePageId && !currentView ? "bg-primary text-on-primary shadow-xs" : "text-secondary hover:bg-surface-container-high"
            }`}>
              <span className="material-symbols-outlined text-[15px]">description</span>
              <span>Tüm Notlar</span>
            </Link>

            {/* Favoriler */}
            <Link href="/notes?view=favorites" className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              pathname === "/notes" && currentView === "favorites" ? "bg-primary text-on-primary shadow-xs" : "text-secondary hover:bg-surface-container-high"
            }`}>
              <span className="material-symbols-outlined text-[15px] fill-1 text-amber-500">star</span>
              <span>Favoriler</span>
            </Link>

            {/* Görev Planlayıcı */}
            <Link href="/notes/tasks" className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              pathname === "/notes/tasks" ? "bg-primary text-on-primary shadow-xs" : "text-secondary hover:bg-surface-container-high"
            }`}>
              <span className="material-symbols-outlined text-[15px]">assignment_turned_in</span>
              <span>Görev Planlayıcı</span>
            </Link>

            {/* Son Kullanılanlar */}
            <Link href="/notes?view=recent" className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              pathname === "/notes" && currentView === "recent" ? "bg-primary text-on-primary shadow-xs" : "text-secondary hover:bg-surface-container-high"
            }`}>
              <span className="material-symbols-outlined text-[15px]">history</span>
              <span>Son Kullanılanlar</span>
            </Link>

            {/* Çöp Kutusu */}
            <Link href="/notes?view=trash" className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              pathname === "/notes" && currentView === "trash" ? "bg-primary text-on-primary shadow-xs" : "text-secondary hover:bg-surface-container-high"
            }`}>
              <span className="material-symbols-outlined text-[15px]">delete</span>
              <span>Çöp Kutusu</span>
            </Link>

            {/* Arşiv */}
            <Link href="/notes?view=archive" className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              pathname === "/notes" && currentView === "archive" ? "bg-primary text-on-primary shadow-xs" : "text-secondary hover:bg-surface-container-high"
            }`}>
              <span className="material-symbols-outlined text-[15px]">archive</span>
              <span>Arşiv</span>
            </Link>

            {/* Favori Defterler Tree Explorer */}
            <div className="pt-2 border-t border-outline-variant/10 mt-1 space-y-1">
              <div className="flex items-center justify-between px-2 py-0.5 select-none">
                <span className="text-[9px] font-bold text-outline uppercase tracking-wider block font-label-caps">FAVORİ DEFTERLER</span>
                {/* Button to add a new root page */}
                <button
                  onClick={() => handleAddPageDirectly(null)}
                  className="p-0.5 hover:bg-surface-container rounded-md text-primary"
                  title="Yeni Not Defteri Ekle"
                >
                  <span className="material-symbols-outlined text-[13px]">add</span>
                </button>
              </div>
              
              {rootPages.length === 0 ? (
                <span className="px-2 py-1 text-[10px] text-outline italic block">Favori defter yok</span>
              ) : (
                rootPages.map((p) => {
                  const hasChildren = pages.some((child) => child.parentPageId === p.id);
                  const isExpanded = expandedPages[p.id];
                  const isActive = pathname === "/notes" && activePageId === p.id && !currentView;

                  return (
                    <div key={p.id} className="space-y-0.5">
                      {/* Root Item */}
                      <div className={`flex items-center justify-between px-2 py-1 rounded-xl text-xs font-semibold hover:bg-surface-container-high group/page ${
                        isActive ? "bg-primary text-on-primary font-bold shadow-xs" : "text-on-surface"
                      }`}>
                        <Link
                          href={`/notes?id=${p.id}`}
                          className="flex items-center space-x-2 truncate flex-1 min-w-0"
                        >
                          <span className="material-symbols-outlined text-[16px]">{p.icon || "description"}</span>
                          <span className="truncate">{p.title}</span>
                        </Link>
                        <div className="flex items-center space-x-1 select-none">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleAddPageDirectly(p.id);
                            }}
                            className="opacity-0 group-hover/page:opacity-100 p-0.5 hover:bg-black/5 rounded-md text-primary transition-opacity flex items-center justify-center"
                            title="Alt Sayfa Ekle"
                          >
                            <span className="material-symbols-outlined text-[13px]">add</span>
                          </button>
                          {hasChildren && (
                            <button
                              onClick={() => setExpandedPages((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                              className="p-0.5 hover:bg-black/5 rounded-md flex items-center justify-center text-secondary"
                            >
                              <span className={`material-symbols-outlined text-[14px] transition-transform duration-150 ${isExpanded ? "rotate-90" : "rotate-0"}`}>
                                chevron_right
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Render children subpages tree */}
                      {isExpanded && renderPagesTree(pages, p.id, 1)}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Diğer Menü Öğeleri */}
      {menuItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href}
            className={`flex items-center space-x-3 px-3 py-2 rounded-2xl transition-all duration-200 ${
              isActive ? "bg-primary text-on-primary shadow-md font-bold" : "text-on-surface hover:bg-surface-container-high"
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-tight">{item.label}</span>
              <span className="text-[9px] opacity-75 font-label-caps">{item.subtext}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-72 h-screen fixed top-0 left-0 z-30 bg-surface-container-lowest border-r border-r-outline-variant/20 px-4 py-5 shadow-xs overflow-hidden">
      {/* Brand Header */}
      <div className="flex items-center space-x-3 px-2 mb-4 flex-shrink-0">
        <img src="/logo-full.png" alt="Clown" className="h-9 w-auto object-contain" />
      </div>

      <Suspense fallback={<div className="flex-1" />}>
        <SidebarNavContent />
      </Suspense>

      {/* User Footer Profile */}
      <div className="pt-3.5 border-t border-outline-variant/15 flex items-center space-x-3 px-2 flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
          MK
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold text-on-surface truncate">Mehmet Akif Koca</span>
          <span className="text-[9px] text-secondary font-label-sm truncate">m.akifkoca@hotmail.com</span>
        </div>
      </div>
    </aside>
  );
}
