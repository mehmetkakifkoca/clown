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
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [notificationSubscribed, setNotificationSubscribed] = useState<boolean>(false);
  const [notifLoading, setNotifLoading] = useState<boolean>(false);

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
      if (Array.isArray(data)) setAccounts(data);
    } catch { /* sessiz hata */ }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm("Bu hesabı kaldırmak istediğinizden emin misiniz?")) return;
    await fetch(`/api/mail/accounts?id=${id}`, { method: "DELETE" });
    loadAccounts();
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
