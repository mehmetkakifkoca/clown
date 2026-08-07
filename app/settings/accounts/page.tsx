"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ConnectedAccount {
  id: string;
  email: string;
  provider: string;
  label: string;
  isHidden?: boolean;
  useForMail?: boolean;
  useForCalendar?: boolean;
}

export default function AccountSettingsPage() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [notificationSubscribed, setNotificationSubscribed] = useState<boolean>(false);
  const [notifLoading, setNotifLoading] = useState<boolean>(false);
  
  // IMAP State
  const [showImapModal, setShowImapModal] = useState(false);
  const [imapLoading, setImapLoading] = useState(false);
  const [imapForm, setImapForm] = useState({
    email: "",
    password: "",
    imapHost: "imap.all-inkl.com",
    imapPort: 993,
    smtpHost: "smtp.all-inkl.com",
    smtpPort: 465,
  });

  useEffect(() => {
    loadAccounts();
    if (typeof window !== "undefined") {
      if ("Notification" in window && Notification.permission === "granted") {
        setNotificationSubscribed(true);
      }
      const params = new URLSearchParams(window.location.search);
      const details = params.get("details");
      const err = params.get("error");
      if (err || details) {
        setErrorDetails(details ? decodeURIComponent(details) : err);
      }
    }
  }, []);

  const loadAccounts = async () => {
    try {
      const res = await fetch("/api/mail/accounts");
      const data = await res.json();
      if (Array.isArray(data)) {
        // Fallback default capabilities to true if undefined
        setAccounts(data.map(acc => ({
          ...acc,
          useForMail: acc.useForMail !== false,
          useForCalendar: acc.useForCalendar !== false
        })));
      }
    } catch { /* sessiz hata */ }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm("Bu hesabı kaldırmak istediğinizden emin misiniz?")) return;
    await fetch(`/api/mail/accounts?id=${id}`, { method: "DELETE" });
    loadAccounts();
  };

  const handleToggleVisibility = async (id: string, currentIsHidden: boolean) => {
    try {
      setAccounts(prev => prev.map(acc => acc.id === id ? { ...acc, isHidden: !currentIsHidden } : acc));
      await fetch(`/api/mail/accounts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isHidden: !currentIsHidden })
      });
      loadAccounts();
    } catch (e) {
      console.error(e);
      loadAccounts();
    }
  };

  const handleToggleCapability = async (id: string, field: "useForMail" | "useForCalendar", currentValue: boolean) => {
    try {
      setAccounts(prev => prev.map(acc => acc.id === id ? { ...acc, [field]: !currentValue } : acc));
      await fetch(`/api/mail/accounts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, [field]: !currentValue })
      });
      loadAccounts();
    } catch (e) {
      console.error(e);
      loadAccounts();
    }
  };

  const sendTestNotification = async () => {
    try {
      const res = await fetch("/api/cron/check-emails");
      const data = await res.json();
      if (data.success) {
        alert("Test bildirimi cihaza gönderildi!");
      } else {
        alert(`Test uyarısı: ${data.message || JSON.stringify(data)}`);
      }
    } catch (e: any) {
      alert(`Hata: ${e.message}`);
    }
  };

  const handleImapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImapLoading(true);
    try {
      const res = await fetch("/api/mail/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "imap",
          email: imapForm.email,
          appPassword: imapForm.password,
          imapHost: imapForm.imapHost,
          imapPort: imapForm.imapPort,
          smtpHost: imapForm.smtpHost,
          smtpPort: imapForm.smtpPort,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setShowImapModal(false);
      setImapForm({ ...imapForm, email: "", password: "" });
      loadAccounts();
    } catch (err: any) {
      alert(`Bağlantı Hatası: ${err.message}`);
    } finally {
      setImapLoading(false);
    }
  };

  const hotmailAcc = accounts.find((a) => a.provider === "hotmail");
  const googleAccs = accounts.filter((a) => a.provider === "gmail");
  const imapAccs = accounts.filter((a) => a.provider === "imap");

  const AccountItem = ({ acc }: { acc: ConnectedAccount }) => (
    <div className={`flex flex-col p-3 rounded-xl transition-colors ${acc.isHidden ? 'opacity-60 bg-surface-container-lowest' : 'bg-surface-container-low/30'} border border-outline-variant/20 mb-2`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-on-surface">{acc.email}</span>
          {acc.isHidden && <span className="text-[10px] bg-surface-container text-secondary px-2 rounded-md font-label-caps">Gizlendi</span>}
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 hidden sm:inline-block">✓ Bağlı</span>
          <button onClick={() => handleToggleVisibility(acc.id, !!acc.isHidden)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${acc.isHidden ? 'text-secondary hover:bg-surface-container' : 'text-primary hover:bg-primary/10'}`} title={acc.isHidden ? "Ana Sayfada Göster" : "Ana Sayfadan Gizle"}>
            <span className="material-symbols-outlined text-[18px]">{acc.isHidden ? "visibility_off" : "visibility"}</span>
          </button>
          <button onClick={() => handleDisconnect(acc.id)} className="px-3 py-1.5 bg-error-container/20 text-error text-xs font-semibold rounded-xl hover:bg-error-container">
            Kaldır
          </button>
        </div>
      </div>
      
      {/* Capability Toggles */}
      <div className="flex items-center space-x-4 mt-2 pt-2 border-t border-outline-variant/10">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input 
            type="checkbox" 
            checked={!!acc.useForMail} 
            onChange={() => handleToggleCapability(acc.id, "useForMail", !!acc.useForMail)}
            className="w-4 h-4 text-primary rounded border-outline-variant/50 focus:ring-primary"
          />
          <span className="text-xs font-medium text-secondary">Mail Özelliği</span>
        </label>
        
        {acc.provider !== "imap" && (
          <label className="flex items-center space-x-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={!!acc.useForCalendar} 
              onChange={() => handleToggleCapability(acc.id, "useForCalendar", !!acc.useForCalendar)}
              className="w-4 h-4 text-primary rounded border-outline-variant/50 focus:ring-primary"
            />
            <span className="text-xs font-medium text-secondary">Takvim Özelliği</span>
          </label>
        )}
      </div>
    </div>
  );

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

      {errorDetails && (
        <div className="mb-6 p-4 bg-error-container/30 border border-error/30 rounded-2xl flex items-start space-x-3 text-on-error-container text-xs font-medium">
          <span className="material-symbols-outlined text-[20px] text-error flex-shrink-0">error</span>
          <div>
            <p className="font-bold">Bağlantı Hatası Detayı:</p>
            <p className="font-mono mt-1 text-[11px] opacity-90 break-all">{errorDetails}</p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Push Bildirim Kartı */}
        <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
              <span className="material-symbols-outlined text-2xl">notifications_active</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">PWA Anlık Bildirimler (Push)</h2>
              <p className="text-xs text-secondary mt-0.5">
                Yeni e-postalar geldiğinde kilit ekranına bildirim gönderilir (iOS 16.4+).
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={async () => {
                setNotifLoading(true);
                try {
                  const { subscribeToPushNotifications } = await import("@/lib/push");
                  await subscribeToPushNotifications();
                  setNotificationSubscribed(true);
                  alert("Bildirimler başarıyla aktif edildi!");
                } catch (err: any) {
                  alert(`Bildirim hatası: ${err.message}`);
                }
                setNotifLoading(false);
              }}
              disabled={notificationSubscribed || notifLoading}
              className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all ${
                notificationSubscribed
                  ? "bg-emerald-100 text-emerald-800 cursor-default"
                  : "bg-primary text-on-primary hover:bg-primary-container"
              }`}
            >
              {notificationSubscribed ? "✓ Aktif" : notifLoading ? "İzin İsteniyor..." : "Bildirimleri Aç"}
            </button>

            {notificationSubscribed && (
              <button
                onClick={sendTestNotification}
                className="px-3 py-2.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-semibold text-on-surface transition-colors"
                title="Test Bildirimi Gönder"
              >
                Test Et
              </button>
            )}
          </div>
        </div>

        {/* IMAP / Webmail Kartı */}
        <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-xs">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-11 h-11 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600 flex-shrink-0 border border-orange-200">
                <span className="material-symbols-outlined text-2xl">dns</span>
              </div>
              <div>
                <h2 className="text-base font-bold text-on-surface">Webmail / Özel IMAP Sunucusu</h2>
                <p className="text-xs text-secondary mt-0.5">
                  All-Inkl, Yandex veya kendi alan adınızdaki mailleri bağlayın
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowImapModal(true)}
              className="px-4 py-2.5 bg-orange-600 text-white rounded-xl font-bold text-xs shadow-sm hover:bg-orange-700 transition-all flex-shrink-0"
            >
              Hesap Ekle
            </button>
          </div>

          {imapAccs.length > 0 && (
            <div className="space-y-2">
              {imapAccs.map((acc) => <AccountItem key={acc.id} acc={acc} />)}
            </div>
          )}
        </div>

        {/* Microsoft Kartı */}
        <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-xs">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0078d4] flex-shrink-0 border border-blue-200">
                <span className="material-symbols-outlined text-2xl">mail</span>
              </div>
              <div>
                <h2 className="text-base font-bold text-on-surface">Microsoft Hotmail / Outlook</h2>
                <p className="text-xs text-secondary mt-0.5">
                  Microsoft OAuth 2.0 ile e-postalarınızı ve takviminizi bağlayın
                </p>
              </div>
            </div>

            {!hotmailAcc && (
              <a
                href="/api/auth/microsoft"
                className="px-4 py-2.5 bg-[#0078d4] text-white rounded-xl font-bold text-xs shadow-sm hover:bg-[#005a9e] transition-all flex-shrink-0"
              >
                Hotmail Bağla
              </a>
            )}
          </div>
          
          {hotmailAcc && <AccountItem acc={hotmailAcc} />}
        </div>

        {/* Google Kartı(ları) */}
        <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-xs">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-11 h-11 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 flex-shrink-0 border border-red-200">
                <span className="material-symbols-outlined text-2xl">mark_email_unread</span>
              </div>
              <div>
                <h2 className="text-base font-bold text-on-surface">Google / Gmail & Calendar</h2>
                <p className="text-xs text-secondary mt-0.5">
                  Gmail ve Google Calendar etkinliklerinizi canlı senkronize edin
                </p>
              </div>
            </div>

            <a
              href="/api/auth/google"
              className="px-4 py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs shadow-sm hover:bg-red-700 transition-all flex-shrink-0"
            >
              {googleAccs.length > 0 ? "Başka Hesap Ekle" : "Google Bağla"}
            </a>
          </div>

          {googleAccs.length > 0 && (
            <div className="space-y-2">
              {googleAccs.map((acc) => <AccountItem key={acc.id} acc={acc} />)}
            </div>
          )}
        </div>
      </div>

      {/* IMAP Bağlantı Modalı */}
      {showImapModal && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-6 shadow-2xl border border-outline-variant/30">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-surface-container-high">
              <h2 className="text-lg font-bold font-headline-lg text-on-surface">Özel IMAP Hesabı</h2>
              <button
                onClick={() => setShowImapModal(false)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleImapSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-secondary block mb-1">E-posta Adresi:</label>
                <input
                  type="email"
                  required
                  value={imapForm.email}
                  onChange={(e) => setImapForm({ ...imapForm, email: e.target.value })}
                  placeholder="örn. isminiz@alanadiniz.com"
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-orange-500 text-on-surface"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-secondary block mb-1">Şifre:</label>
                <input
                  type="password"
                  required
                  value={imapForm.password}
                  onChange={(e) => setImapForm({ ...imapForm, password: e.target.value })}
                  placeholder="E-posta şifreniz"
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-orange-500 text-on-surface"
                />
              </div>
              
              <div className="p-3 bg-orange-50/50 rounded-xl border border-orange-200/50 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-orange-900/70 block mb-1">IMAP Sunucusu:</label>
                    <input
                      type="text"
                      required
                      value={imapForm.imapHost}
                      onChange={(e) => setImapForm({ ...imapForm, imapHost: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-orange-200 focus:outline-none focus:border-orange-500 text-orange-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-orange-900/70 block mb-1">Port:</label>
                    <input
                      type="number"
                      required
                      value={imapForm.imapPort}
                      onChange={(e) => setImapForm({ ...imapForm, imapPort: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-orange-200 focus:outline-none focus:border-orange-500 text-orange-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-orange-900/70 block mb-1">SMTP Sunucusu:</label>
                    <input
                      type="text"
                      required
                      value={imapForm.smtpHost}
                      onChange={(e) => setImapForm({ ...imapForm, smtpHost: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-orange-200 focus:outline-none focus:border-orange-500 text-orange-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-orange-900/70 block mb-1">Port:</label>
                    <input
                      type="number"
                      required
                      value={imapForm.smtpPort}
                      onChange={(e) => setImapForm({ ...imapForm, smtpPort: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-orange-200 focus:outline-none focus:border-orange-500 text-orange-900"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowImapModal(false)}
                  className="px-4 py-2 text-xs font-bold text-secondary hover:bg-surface-container rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={imapLoading}
                  className="px-5 py-2.5 text-xs font-extrabold bg-orange-600 text-white rounded-xl shadow-md hover:bg-orange-700 transition-all flex items-center disabled:opacity-50"
                >
                  {imapLoading ? "Bağlanıyor..." : "Hesabı Ekle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
