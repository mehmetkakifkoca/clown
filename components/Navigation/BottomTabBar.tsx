"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomTabBar() {
  const pathname = usePathname();

  const tabs = [
    { name: "Posta", path: "/inbox", icon: "mail" },
    { name: "Takvim", path: "/calendar", icon: "calendar_today" },
    { name: "Asistan", path: "/assistant", icon: "smart_toy", featured: true },
    { name: "Notlar", path: "/notes", icon: "edit_note" },
    { name: "Hesaplar", path: "/accounts", icon: "analytics" },
  ];

  const featuredTab = tabs.find((tab) => tab.featured)!;
  const isFeaturedActive = pathname === featuredTab.path;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant/30 px-2 pt-2 pb-2 shadow-lg">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {tabs.map((tab) => {
          if (tab.featured) {
            // Ortadaki büyük Asistan butonu ayrı, mutlak konumlu olarak render edilir.
            // Burada sadece diğer sekmeler arasında eşit boşluk bırakan görünmez bir yer tutucu var.
            return <span key={tab.name} className="w-14 flex-shrink-0" aria-hidden="true" />;
          }

          const isActive =
            pathname === tab.path ||
            (tab.path === "/inbox" && pathname.startsWith("/inbox") && pathname !== "/settings/accounts");

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

      {/* Ortada yükselen, öne çıkan Asistan butonu */}
      <Link
        href={featuredTab.path}
        className="absolute left-1/2 -translate-x-1/2 -top-6 flex flex-col items-center"
      >
        <span className="relative flex items-center justify-center">
          <span
            className={`absolute inset-0 rounded-full bg-primary/40 ${isFeaturedActive ? "animate-ping" : ""}`}
          />
          <span
            className={`relative w-14 h-14 rounded-full overflow-hidden shadow-lg shadow-primary/30 ring-4 ring-surface-container-lowest transition-all duration-200 active:scale-95 ${
              isFeaturedActive ? "scale-105" : "hover:scale-105"
            }`}
          >
            <img src="/logo-icon.png" alt="Asistan" className="w-full h-full object-cover" />
          </span>
        </span>
        <span
          className={`text-[10px] font-bold tracking-tight mt-1 ${
            isFeaturedActive ? "text-primary" : "text-secondary"
          }`}
        >
          {featuredTab.name}
        </span>
      </Link>
    </nav>
  );
}
