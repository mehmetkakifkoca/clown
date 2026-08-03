"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

interface ConnectedAccount {
  id: string;
  email: string;
  provider: string;
  label: string;
}

function SidebarNavContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [mailOpen, setMailOpen] = useState(true);

  const currentAccount = searchParams.get("account") || "all";
  const currentFolder = searchParams.get("folder") || "inbox";

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const res = await fetch("/api/mail/accounts");
      const data = await res.json();
      if (Array.isArray(data)) setAccounts(data);
    } catch { /* ignore */ }
  };

  const navItems = [
    { label: "Takvim", icon: "calendar_today", href: "/calendar", subtext: "Program & Zaman Çizelgesi" },
    { label: "Notlar", icon: "edit_note", href: "/notes", subtext: "Notion Tarzı Tuval" },
    { label: "Hesaplar", icon: "analytics", href: "/accounts", subtext: "Instagram & Büyüme İstatistikleri" },
    { label: "Ayarlar", icon: "settings", href: "/settings/accounts", subtext: "OAuth & Entegrasyon Ayarları" },
  ];

  return (
    <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
      {/* Posta (Mail) Akordeon Grubu */}
      <div className="space-y-1">
        <div className={`flex items-center justify-between px-3 py-2.5 rounded-2xl transition-all duration-200 ${
          pathname.startsWith("/inbox") ? "bg-primary-fixed/30 text-primary font-bold" : "text-on-surface hover:bg-surface-container-high"
        }`}>
          <Link href="/inbox?account=all&folder=inbox" className="flex items-center space-x-3 flex-1 min-w-0">
            <span className="material-symbols-outlined text-[22px]">mail</span>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight">Posta</span>
              <span className="text-[10px] opacity-75 font-label-caps">Tüm Hesaplar & Klasörler</span>
            </div>
          </Link>
          <button onClick={() => setMailOpen(!mailOpen)} className="p-1 hover:bg-surface-container rounded-lg text-secondary">
            <span className="material-symbols-outlined text-[18px] transition-transform duration-200" style={{ transform: mailOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
              expand_more
            </span>
          </button>
        </div>

        {/* Akordeon Alt Sayfaları */}
        {mailOpen && (
          <div className="pl-4 pr-1 space-y-1 border-l-2 border-primary/20 ml-5 py-1">
            {/* Tüm Mailler */}
            <Link href="/inbox?account=all&folder=inbox" className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              pathname.startsWith("/inbox") && currentAccount === "all" ? "bg-primary text-on-primary shadow-xs" : "text-secondary hover:bg-surface-container-high hover:text-on-surface"
            }`}>
              <span className="material-symbols-outlined text-[16px]">inbox</span>
              <span>Tüm Mailler</span>
            </Link>

            {/* Hesap Bazlı Akordeonlar */}
            {accounts.map((acc) => {
              const isAccActive = currentAccount === acc.provider;
              return (
                <div key={acc.id} className="pt-1.5 space-y-0.5">
                  <div className="flex items-center space-x-1.5 px-2 py-1 text-[11px] font-bold text-outline uppercase font-label-caps tracking-wider">
                    <span className={`w-2 h-2 rounded-full ${acc.provider === "gmail" ? "bg-red-500" : "bg-blue-500"}`} />
                    <span className="truncate">{acc.provider === "gmail" ? "Google" : "Hotmail"} ({acc.email.split("@")[0]})</span>
                  </div>

                  <Link href={`/inbox?account=${acc.provider}&folder=inbox`} className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    pathname.startsWith("/inbox") && isAccActive && currentFolder === "inbox" ? "bg-surface-container-highest text-primary font-bold" : "text-secondary hover:bg-surface-container-high"
                  }`}>
                    <span className="material-symbols-outlined text-[15px]">move_to_inbox</span>
                    <span>Gelen Kutusu</span>
                  </Link>

                  <Link href={`/inbox?account=${acc.provider}&folder=sent`} className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    pathname.startsWith("/inbox") && isAccActive && currentFolder === "sent" ? "bg-surface-container-highest text-primary font-bold" : "text-secondary hover:bg-surface-container-high"
                  }`}>
                    <span className="material-symbols-outlined text-[15px]">send</span>
                    <span>Gönderilenler</span>
                  </Link>

                  <Link href={`/inbox?account=${acc.provider}&folder=spam`} className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    pathname.startsWith("/inbox") && isAccActive && currentFolder === "spam" ? "bg-surface-container-highest text-primary font-bold" : "text-secondary hover:bg-surface-container-high"
                  }`}>
                    <span className="material-symbols-outlined text-[15px]">report</span>
                    <span>Spam / Çöp</span>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Diğer Menü Öğeleri */}
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href}
            className={`flex items-center space-x-3 px-3 py-2.5 rounded-2xl transition-all duration-200 ${
              isActive ? "bg-primary text-on-primary shadow-md font-bold" : "text-on-surface hover:bg-surface-container-high"
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight">{item.label}</span>
              <span className="text-[10px] opacity-75 font-label-caps">{item.subtext}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-72 h-screen fixed top-0 left-0 z-30 bg-surface-container-lowest border-r border-outline-variant/30 px-4 py-6 shadow-sm overflow-hidden">
      {/* Brand Header */}
      <div className="flex items-center space-x-3 px-2 mb-6 flex-shrink-0">
        <img src="/logo-full.svg" alt="Clown" className="h-10 w-auto object-contain" />
      </div>

      <Suspense fallback={<div className="flex-1" />}>
        <SidebarNavContent />
      </Suspense>

      {/* User Footer Profile */}
      <div className="pt-4 border-t border-outline-variant/30 flex items-center space-x-3 px-2 flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
          MK
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold text-on-surface truncate">Mehmet Akif Koca</span>
          <span className="text-[10px] text-secondary font-label-sm truncate">m.akifkoca@hotmail.com</span>
        </div>
      </div>
    </aside>
  );
}
