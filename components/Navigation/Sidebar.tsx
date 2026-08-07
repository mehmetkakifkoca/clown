"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

interface ConnectedAccount {
  id: string;
  email: string;
  provider: string;
  label: string;
  isHidden?: boolean;
  useForMail?: boolean;
}

interface SidebarPage {
  id: string;
  title: string;
  icon: string;
  parentPageId: string | null;
  isArchived: boolean;
  isFavorite: boolean;
  deletedAt: string | null;
}

function SidebarNavContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [pages, setPages] = useState<SidebarPage[]>([]);
  
  const [mailOpen, setMailOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(true);

  const currentAccount = searchParams.get("account") || "all";
  // Ayarlar'da gizlenen veya "Mail Özelliği" kapatılan hesaplar burada gösterilmez
  const visibleAccounts = accounts.filter((a) => !a.isHidden && a.useForMail !== false);
  const mailFolder = searchParams.get("folder") || "inbox";
  const notesFolder = searchParams.get("folder") || "all";

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
      const title = parentPageId === null ? "Yeni Klasör" : "Yeni Not";
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          parentPageId,
        }),
      });
      const newPage = await res.json();
      window.dispatchEvent(new Event("refresh-sidebar"));
      
      if (parentPageId === null) {
        // Created folder
        router.push(`/notes?folder=${newPage.id}`);
      } else {
        // Created note inside folder
        router.push(`/notes?folder=${parentPageId}&id=${newPage.id}`);
      }
    } catch {}
  };

  const menuItems = [
    { label: "Takvim", icon: "calendar_today", href: "/calendar", subtext: "Ajanda" },
    { label: "Asistan", icon: "smart_toy", href: "/assistant", subtext: "Claude Destekli" },
    { label: "Görevler", icon: "task_alt", href: "/tasks", subtext: "To-Do List" },
    { label: "Ayarlar", icon: "settings", href: "/settings/accounts", subtext: "OAuth Entegrasyon" },
  ];

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

            {visibleAccounts.map((acc) => {
              const isAccActive = currentAccount === acc.id;
              const dotColor = acc.provider === "gmail" ? "bg-red-500" : acc.provider === "imap" ? "bg-orange-500" : "bg-blue-500";
              return (
                <div key={acc.id} className="pt-1.5 space-y-0.5">
                  <div className="flex items-center space-x-1.5 px-2 py-0.5 text-[9px] font-bold text-outline uppercase font-label-caps tracking-wider">
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                    <span className="truncate">{acc.label} ({acc.email.split("@")[0]})</span>
                  </div>

                  <Link href={`/inbox?account=${acc.id}&folder=inbox`} className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    pathname.startsWith("/inbox") && isAccActive && mailFolder === "inbox" ? "bg-surface-container-highest text-primary font-bold" : "text-secondary hover:bg-surface-container-high"
                  }`}>
                    <span className="material-symbols-outlined text-[14px]">move_to_inbox</span>
                    <span>Gelen Kutusu</span>
                  </Link>

                  <Link href={`/inbox?account=${acc.id}&folder=sent`} className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    pathname.startsWith("/inbox") && isAccActive && mailFolder === "sent" ? "bg-surface-container-highest text-primary font-bold" : "text-secondary hover:bg-surface-container-high"
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

      {/* 2. Notlar (Notes) Accordion Group */}
      <div className="space-y-1">
        <div className={`flex items-center justify-between px-3 py-2 rounded-2xl transition-all duration-200 ${
          pathname.startsWith("/notes") ? "bg-primary-fixed/30 text-primary font-bold" : "text-on-surface hover:bg-surface-container-high"
        }`}>
          <Link href="/notes?folder=all" className="flex items-center space-x-3 flex-1 min-w-0">
            <span className="material-symbols-outlined text-[20px]">edit_note</span>
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-tight">Notlar</span>
              <span className="text-[9px] opacity-75 font-label-caps">Apple Stil Defterler</span>
            </div>
          </Link>
          <div className="flex items-center space-x-1 select-none">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAddPageDirectly(null); // Create Folder
              }}
              className="p-1 hover:bg-surface-container rounded-lg text-primary"
              title="Yeni Klasör Ekle"
            >
              <span className="material-symbols-outlined text-[16px]">create_new_folder</span>
            </button>
            <button onClick={() => setNotesOpen(!notesOpen)} className="p-1 hover:bg-surface-container rounded-lg text-secondary">
              <span className="material-symbols-outlined text-[16px] transition-transform duration-200" style={{ transform: notesOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                expand_more
              </span>
            </button>
          </div>
        </div>

        {notesOpen && (
          <div className="pl-3 pr-1 space-y-1 border-l-2 border-primary/20 ml-5 py-1">
            <Link href="/notes?folder=all" className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              pathname.startsWith("/notes") && notesFolder === "all" ? "bg-primary text-on-primary shadow-xs" : "text-secondary hover:bg-surface-container-high"
            }`}>
              <div className="flex items-center space-x-2">
                <span className="material-symbols-outlined text-[15px]">folder_copy</span>
                <span>Hepsi</span>
              </div>
            </Link>

            {pages
              .filter((p) => p.parentPageId === null && !p.deletedAt)
              .map((folderPage) => {
                const isActive = notesFolder === folderPage.id;
                return (
                  <div key={folderPage.id} className="flex items-center justify-between group/folder">
                    <Link
                      href={`/notes?folder=${folderPage.id}`}
                      className={`flex-1 flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                        pathname.startsWith("/notes") && isActive
                          ? "bg-surface-container-highest text-primary font-bold"
                          : "text-secondary hover:bg-surface-container-high"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">{folderPage.icon || "folder"}</span>
                      <span className="truncate">{folderPage.title}</span>
                    </Link>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAddPageDirectly(folderPage.id); // Create note inside folder
                      }}
                      className="opacity-0 group-hover/folder:opacity-100 p-1 hover:bg-surface-container rounded-lg text-primary transition-opacity"
                      title="Yeni Not Ekle"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                    </button>
                  </div>
                );
              })}
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
