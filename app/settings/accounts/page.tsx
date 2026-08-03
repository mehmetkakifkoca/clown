"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ConnectedAccount {
  id: string;
  email: string;
  provider: string;
  label: string;
}

export default function AccountSettingsPage() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);

  useEffect(() => { loadAccounts(); }, []);

  const loadAccounts = async () => {
    try {
      const res = await fetch("/api/mail/accounts");
      const data = await res.json();
      if (Array.isArray(data)) setAccounts(data);
    } catch { /* sessiz hata */ }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm("Bu hesabı kaldırmak istediğinizden emin misiniz?")) return;
    await fetch(`/api/mail/accounts?id=${id}`, { method: "DELETE" });
    loadAccounts();
  };

  return (
    <div className="min-h-screen bg-background text-on-surface px-6 md:px-10 lg:px-14 pt-6 pb-28 md:pb-8">
      <header className="flex items-center space-x-3 mb-8">
        <Link href="/inbox" className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div>
          <span className="text-[11px] font-semibold text-primary uppercase tracking-wider font-label-caps block">Entegrasyonlar & OAuth</span>
          <h1 className="text-xl font-bold font-headline-lg text-on-surface">Bağlı Hesaplar</h1>
        </div>
      </header>

      <div className="space-y-6">
        <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-xs">
          <h2 className="text-base font-bold text-on-surface mb-2">Microsoft Hotmail / Outlook Entegrasyonu</h2>
          <p className="text-xs text-secondary leading-relaxed mb-6">
            E-postalarınızı güvenle okumak ve yanıtlamak için resmi Microsoft OAuth 2.0 servisini kullanabilirsiniz.
          </p>

          {accounts.length === 0 ? (
            <a
              href="/api/auth/microsoft"
              className="inline-flex items-center space-x-3 px-6 py-3.5 bg-[#0078d4] text-white rounded-2xl font-bold text-sm shadow-md hover:bg-[#005a9e] transition-all duration-200"
            >
              <span className="material-symbols-outlined text-xl">login</span>
              <span>Microsoft ile Giriş Yap & Bağla</span>
            </a>
          ) : (
            <div className="space-y-3">
              {accounts.map((acc) => (
                <div key={acc.id} className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/30 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-[#0078d4]">
                      <span className="material-symbols-outlined text-xl">mail</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">{acc.label}</p>
                      <p className="text-xs text-secondary">{acc.email}</p>
                    </div>
                  </div>
                  <button onClick={() => handleDisconnect(acc.id)} className="px-3 py-1.5 bg-error-container/20 text-error text-xs font-semibold rounded-xl hover:bg-error-container">
                    Bağlantıyı Kes
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
