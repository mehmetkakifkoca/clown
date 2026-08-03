"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomTabBar() {
  const pathname = usePathname();

  const tabs = [
    { name: "Gelen Kutusu", path: "/inbox", icon: "inbox" },
    { name: "Takvim", path: "/calendar", icon: "calendar_today" },
    { name: "Notlar", path: "/notes", icon: "edit_note" },
    { name: "Hesaplar", path: "/accounts", icon: "analytics" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant/30 px-4 py-2 shadow-lg">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive = pathname === tab.path || (tab.path === "/inbox" && pathname.startsWith("/inbox") && pathname !== "/settings/accounts");

          return (
            <Link
              key={tab.name}
              href={tab.path}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-200 relative ${
                isActive
                  ? "text-primary font-semibold scale-105"
                  : "text-secondary hover:text-on-surface transition-colors"
              }`}
            >
              <span className={`material-symbols-outlined text-[24px] ${isActive ? "text-primary fill-1" : ""}`}>
                {tab.icon}
              </span>
              <span className="text-[10px] font-medium tracking-tight mt-0.5">{tab.name}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 bg-primary rounded-full absolute -bottom-1 left-1/2 transform -translate-x-1/2 shadow-sm" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
