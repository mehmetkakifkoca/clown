"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar() {
  const pathname = usePathname();

  const tabs = [
    { name: "Gelen Kutusu", path: "/inbox", icon: "inbox", description: "E-posta & Birleşik Mesajlar" },
    { name: "Takvim", path: "/calendar", icon: "calendar_today", description: "Program & Zaman Çizelgesi" },
    { name: "Notlar", path: "/notes", icon: "edit_note", description: "Notion Tarzı Tuval" },
    { name: "Hesaplar", path: "/accounts", icon: "analytics", description: "Instagram & Büyüme İstatistikleri" },
    { name: "Ayarlar", path: "/settings/accounts", icon: "settings", description: "OAuth & Entegrasyon Ayarları" },
  ];

  return (
    <aside className="hidden md:flex flex-col w-72 bg-surface-container-lowest border-r border-outline-variant/30 flex-shrink-0 fixed top-0 left-0 h-screen z-40 justify-between">
      {/* Scrollable inner content */}
      <div className="flex flex-col flex-1 overflow-y-auto p-6 min-h-0">
        {/* Brand / Full Logo */}
        <div className="mb-8 px-1 flex-shrink-0">
          <img
            src="/logo-full.png"
            alt="Clown"
            className="w-full h-auto max-h-14 object-contain object-left"
          />
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5 flex-1">
          {tabs.map((tab) => {
            const isActive =
              pathname === tab.path ||
              (tab.path === "/inbox" && pathname.startsWith("/inbox") && pathname !== "/settings/accounts");

            return (
              <Link
                key={tab.name}
                href={tab.path}
                className={`flex items-center space-x-3 px-3.5 py-3 rounded-2xl transition-all duration-200 group relative ${
                  isActive
                    ? "bg-primary text-on-primary shadow-md shadow-primary/15 font-semibold"
                    : "text-secondary hover:bg-surface-container hover:text-on-surface"
                }`}
              >
                <span className={`material-symbols-outlined text-[22px] ${isActive ? "text-on-primary" : "text-secondary group-hover:text-on-surface"}`}>
                  {tab.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold leading-none">{tab.name}</p>
                  <p className={`text-[10px] truncate mt-1 ${isActive ? "text-on-primary/80" : "text-outline"}`}>
                    {tab.description}
                  </p>
                </div>
                {isActive && (
                  <span className="w-2 h-2 rounded-full bg-on-primary absolute right-3 shadow-xs" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User / Profile Footer Widget — always at bottom */}
      <div className="flex-shrink-0 p-6 pt-4 border-t border-outline-variant/20 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
            alt="Kullanıcı avatarı"
            className="w-9 h-9 rounded-full object-cover border border-outline-variant/40"
          />
          <div>
            <p className="text-xs font-bold text-on-surface leading-tight">Mehmet Akif Koca</p>
            <p className="text-[10px] text-outline font-label-sm">akif@clown.app</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
