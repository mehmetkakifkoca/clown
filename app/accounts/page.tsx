"use client";

import { useEffect, useState } from "react";
import { instagramProvider, InstagramAccount, SocialOverviewStats } from "@/lib/integrations/instagram";

export default function AccountsTrackerPage() {
  const [stats, setStats] = useState<SocialOverviewStats | null>(null);
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newHandle, setNewHandle] = useState<string>("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const overview = await instagramProvider.getOverviewStats();
    const list = await instagramProvider.listAccounts();
    setStats(overview);
    setAccounts(list);
    setLoading(false);
  };

  const handleTrackAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHandle.trim()) return;
    await instagramProvider.trackAccount(newHandle);
    setNewHandle("");
    setShowAddModal(false);
    loadData();
  };

  return (
    <div className="min-h-screen bg-background text-on-surface px-6 md:px-10 lg:px-14 pt-6 pb-28 md:pb-8">
      <header className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 bg-primary rounded-full animate-ping" />
            <span className="text-[11px] font-semibold text-primary uppercase tracking-wider font-label-caps">Sosyal Büyüme Motoru</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-headline-lg text-on-surface tracking-tight mt-0.5">Hesap Takibi</h1>
        </div>
        <button onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-primary text-on-primary rounded-2xl font-semibold text-xs shadow-md hover:bg-primary-container transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          <span className="hidden sm:inline">Hesap Takibe Al</span>
        </button>
      </header>

      {/* KPI Metrikleri */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-5 mb-8">
          {[
            { label: "Ort. Büyüme Oranı", value: stats.avgGrowth, color: "text-primary" },
            { label: "Ort. Etkileşim", value: stats.avgEngagement, color: "text-tertiary" },
            { label: "Toplam Erişim", value: stats.totalReach, color: "text-on-surface" },
          ].map((metric) => (
            <div key={metric.label} className="bg-surface-container-lowest p-4 md:p-5 rounded-3xl border border-outline-variant/30 shadow-xs">
              <p className="text-[10px] md:text-xs uppercase font-label-caps text-secondary font-semibold">{metric.label}</p>
              <p className={`text-xl md:text-2xl font-bold font-headline-lg mt-1.5 ${metric.color}`}>{metric.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Hesap Kartları */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-secondary font-label-caps">
            Takip Edilen Profiller ({accounts.length})
          </h2>
          <span className="text-[11px] text-outline font-label-sm font-medium">Meta Graph API</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((n) => (
              <div key={n} className="h-64 bg-surface-container-low animate-pulse rounded-3xl border border-outline-variant/20" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {accounts.map((acc) => (
              <div key={acc.id} className="bg-surface-container-lowest rounded-3xl p-5 md:p-6 border border-outline-variant/30 shadow-[0_4px_20px_-2px_rgba(182,23,34,0.06)] hover:border-primary/40 transition-all duration-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3.5">
                    <img src={acc.avatarUrl} alt={acc.name} className="w-13 h-13 rounded-full object-cover border-2 border-primary/20 shadow-xs" />
                    <div>
                      <h3 className="text-base font-bold text-on-surface leading-tight">{acc.name}</h3>
                      <p className="text-xs text-primary font-semibold">{acc.handle}</p>
                      <span className="inline-block text-[10px] font-label-sm text-secondary bg-surface-container px-2.5 py-0.5 rounded-md mt-1">{acc.category}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold font-headline-lg text-on-surface">{acc.followers}</p>
                    <span className="inline-flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <span className="material-symbols-outlined text-[14px] mr-0.5">trending_up</span>
                      {acc.growth}
                    </span>
                  </div>
                </div>

                {/* Trend Grafiği */}
                <div className="mb-4 bg-surface-container-low/50 p-3 rounded-2xl border border-outline-variant/20">
                  <div className="flex items-center justify-between text-[11px] text-secondary font-label-sm mb-1 px-1">
                    <span>30 Günlük Büyüme Trendi</span>
                    <span className="text-tertiary font-semibold">{acc.engagement} Etkileşim</span>
                  </div>
                  <svg className="w-full h-12 text-primary" viewBox="0 0 100 25" fill="none">
                    <path d="M0,20 Q15,18 30,12 T60,10 T90,3 L100,2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M0,20 Q15,18 30,12 T60,10 T90,3 L100,2 V25 H0 Z" fill="currentColor" fillOpacity="0.1" />
                  </svg>
                </div>

                {/* Son Gönderiler */}
                <div>
                  <p className="text-[11px] font-semibold text-secondary uppercase tracking-wider font-label-caps mb-2">Son İçerik Performansı</p>
                  <div className="grid grid-cols-3 gap-2.5">
                    {acc.posts.map((imgUrl, i) => (
                      <div key={i} className="aspect-square rounded-2xl overflow-hidden relative group border border-outline-variant/20">
                        <img src={imgUrl} alt={`Gönderi ${i + 1}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                        <div className="absolute inset-0 bg-inverse-surface/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-on-primary">
                          <span className="material-symbols-outlined text-[20px]">favorite</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* Yeni Hesap Ekle Kartı */}
            <button onClick={() => setShowAddModal(true)}
              className="bg-surface-container-low rounded-3xl p-6 border-2 border-dashed border-outline-variant/50 hover:border-primary/50 text-center flex flex-col items-center justify-center space-y-3 transition-all duration-200 group min-h-[300px]"
            >
              <div className="w-14 h-14 rounded-full bg-primary-fixed/50 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">add_circle</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-on-surface">Yeni Hesap Takibe Al</h3>
                <p className="text-xs text-secondary mt-1">Instagram hesabı ekleyerek analitik takibi başlatın</p>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Hesap Ekle Modalı */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-6 shadow-2xl border border-outline-variant/30 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-surface-container-high">
              <h2 className="text-lg font-bold font-headline-lg text-on-surface">Sosyal Hesap Takibe Al</h2>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <form onSubmit={handleTrackAccount} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-secondary block mb-1">Instagram Kullanıcı Adı:</label>
                <input type="text" required placeholder="@kullanici_adi" value={newHandle} onChange={(e) => setNewHandle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface"
                />
                <p className="text-[11px] text-outline mt-1 font-label-sm">// TODO: Meta Graph API bağlantısı gereklidir</p>
              </div>
              <div className="flex items-center justify-end space-x-3 pt-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-xs font-medium text-secondary hover:bg-surface-container rounded-xl transition-colors">İptal</button>
                <button type="submit" className="px-5 py-2.5 text-xs font-semibold bg-primary text-on-primary rounded-xl shadow-md hover:bg-primary-container transition-colors flex items-center space-x-1.5">
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  <span>Takibe Al</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
