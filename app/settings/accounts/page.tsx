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
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ email: "", appPassword: "", label: "Hotmail" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => { loadAccounts(); }, []);

  const loadAccounts = async () => {
    try {
      const res = await fetch("/api/mail/accounts");
      const data = await res.json();
      if (Array.isArray(data)) setAccounts(data);
    } catch { /* sessiz hata */ }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/mail/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else {
        setSuccess("Hesap başarıyla bağlandı!");
        setShowAddForm(false);
        setFormData({ email: "", appPassword: "", label: "Hotmail" });
        loadAccounts();
      }
    } catch { setError("Bağlantı kurulamadı"); }
    setSaving(false);
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm("Bu hesabı kaldırmak istediğinizden emin misiniz?")) return;
    await fetch(`/api/mail/accounts?id=${id}`, { method: "DELETE" });
    loadAccounts();
  };

  return (
    <div className="min-h-screen bg-background text-on-surface px-6 md:px-10 lg:px-14 pt-6 pb-28 md:pb-8">
      {/* Başlık */}
      <header className="flex items-center space-x-3 mb-8">
        <Link href="/inbox" className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div>
          <span className="text-[11px] font-semibold text-primary uppercase tracking-wider font-label-caps block">Entegrasyonlar</span>
          <h1 className="text-xl font-bold font-headline-lg text-on-surface">Bağlı Hesaplar</h1>
        </div>
      </header>

      {/* Başarı / Hata Bildirimi */}
      {success && (
        <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-2 text-emerald-700 text-sm font-medium">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="mb-4 p-3.5 bg-error-container/30 border border-error/30 rounded-2xl flex items-center space-x-2 text-on-error-container text-sm font-medium">
          <span className="material-symbols-outlined text-[20px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Bağlı Hesaplar */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-secondary font-label-caps">
            E-posta Hesapları ({accounts.length})
          </h2>
          <button onClick={() => { setShowAddForm(!showAddForm); setError(null); setSuccess(null); }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-primary text-on-primary text-xs font-semibold rounded-xl shadow-sm hover:bg-primary-container transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">{showAddForm ? "close" : "add"}</span>
            <span>{showAddForm ? "İptal" : "Hesap Ekle"}</span>
          </button>
        </div>

        {/* Hesap Ekle Formu */}
        {showAddForm && (
          <div className="bg-surface-container-lowest rounded-3xl p-6 border border-primary/30 shadow-md animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center space-x-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-200">
                <span className="material-symbols-outlined text-[22px] text-blue-600">mail</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-on-surface">Hotmail / Outlook Bağla</h3>
                <p className="text-[11px] text-secondary">IMAP + SMTP ile Azure gerekmez</p>
              </div>
            </div>

            {/* App Password Talimatı */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 mb-5 text-xs text-amber-800 leading-relaxed">
              <p className="font-bold mb-1 flex items-center">
                <span className="material-symbols-outlined text-[16px] mr-1">info</span>
                Uygulama Şifresi Nasıl Alınır?
              </p>
              <ol className="list-decimal pl-4 space-y-1">
                <li><strong>account.microsoft.com/security</strong> → Gelişmiş güvenlik seçenekleri</li>
                <li><strong>Uygulama şifreleri</strong> → Yeni uygulama şifresi oluştur</li>
                <li>Verilen 16 karakterli şifreyi kopyalayın</li>
              </ol>
            </div>

            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-secondary block mb-1">Hotmail Adresi:</label>
                <input type="email" required
                  placeholder="adresiniz@hotmail.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-secondary block mb-1">Uygulama Şifresi:</label>
                <input type="password" required
                  placeholder="xxxx xxxx xxxx xxxx"
                  value={formData.appPassword}
                  onChange={(e) => setFormData({ ...formData, appPassword: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface font-label-sm tracking-widest"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-secondary block mb-1">Etiket (isteğe bağlı):</label>
                <input type="text"
                  placeholder="örn. Kişisel Hotmail"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface"
                />
              </div>
              <button type="submit" disabled={saving}
                className="w-full py-3 bg-primary text-on-primary text-sm font-bold rounded-2xl shadow-md hover:bg-primary-container transition-colors flex items-center justify-center space-x-2 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[20px]">{saving ? "hourglass_empty" : "link"}</span>
                <span>{saving ? "Bağlanıyor..." : "Hotmail'i Bağla"}</span>
              </button>
            </form>
          </div>
        )}

        {/* Bağlı Hesap Listesi */}
        {accounts.length === 0 && !showAddForm ? (
          <div className="text-center py-12 bg-surface-container-lowest rounded-3xl border border-dashed border-outline-variant/50 p-6">
            <span className="material-symbols-outlined text-4xl text-outline mb-2">mail_lock</span>
            <p className="text-sm text-secondary font-medium mb-4">Henüz e-posta hesabı bağlanmadı</p>
            <button onClick={() => setShowAddForm(true)}
              className="px-5 py-2.5 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-md hover:bg-primary-container transition-colors"
            >
              İlk Hesabı Bağla
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((acc) => (
              <div key={acc.id} className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 flex items-center justify-between shadow-xs">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-200">
                    <span className="material-symbols-outlined text-[22px] text-blue-600">mail</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface">{acc.label}</p>
                    <p className="text-xs text-secondary">{acc.email}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1" />
                    Bağlı
                  </span>
                  <button onClick={() => handleDisconnect(acc.id)}
                    className="w-8 h-8 rounded-full bg-error-container/20 flex items-center justify-center text-error hover:bg-error-container transition-colors"
                    title="Bağlantıyı Kes"
                  >
                    <span className="material-symbols-outlined text-[16px]">link_off</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Instagram Bölümü */}
        <div className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/30 shadow-xs mt-4">
          <div className="flex items-center space-x-2 mb-2">
            <span className="material-symbols-outlined text-primary text-xl">analytics</span>
            <h2 className="text-sm font-bold text-on-surface">Meta Graph API (Instagram)</h2>
          </div>
          <p className="text-xs text-secondary leading-relaxed">
            Sosyal hesap takibi için Meta Business API kimlik bilgileri gereklidir.
            <code className="bg-surface-container px-1 py-0.5 rounded text-[11px] ml-1 text-primary">Yakında</code>
          </p>
        </div>
      </div>
    </div>
  );
}
