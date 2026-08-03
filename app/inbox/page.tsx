"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface RealEmail {
  id: string;
  uid: number;
  subject: string;
  from: string;
  fromEmail: string;
  date: string;
  snippet: string;
  isRead: boolean;
  hasAttachments: boolean;
  provider?: string;
  accountEmail?: string;
}

interface ConnectedAccount {
  id: string;
  email: string;
  provider: string;
  label: string;
}

import { Suspense } from "react";

function InboxContent() {
  const searchParams = useSearchParams();
  const accountParam = searchParams.get("account") || "all";
  const folderParam = searchParams.get("folder") || "inbox";

  const [filter, setFilter] = useState("all");
  const [messages, setMessages] = useState<RealEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [showCompose, setShowCompose] = useState(false);
  const [compose, setCompose] = useState({ to: "", subject: "", body: "", provider: "gmail" });
  const [sending, setSending] = useState(false);

  useEffect(() => { checkAccounts(); }, []);
  useEffect(() => { loadMessages(); }, [filter, accountParam, folderParam]);

  const checkAccounts = async () => {
    try {
      const res = await fetch("/api/mail/accounts");
      const accounts = await res.json();
      if (Array.isArray(accounts)) {
        setConnectedAccounts(accounts);
      }
    } catch {
      /* ignore */
    }
  };

  const loadMessages = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/mail/inbox?filter=${filter}&account=${accountParam}&folder=${folderParam}`);
      const data = await res.json();
      if (data.error) { setError(data.error); setMessages([]); }
      else setMessages(data);
    } catch {
      setError("E-postalar yüklenemedi");
    }
    setLoading(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: compose.to, subject: compose.subject, text: compose.body, provider: compose.provider }),
      });
      const data = await res.json();
      if (data.error) alert(`Hata: ${data.error}`);
      else { alert("E-posta gönderildi!"); setShowCompose(false); setCompose({ to: "", subject: "", body: "", provider: "gmail" }); loadMessages(); }
    } catch { alert("Gönderim başarısız"); }
    setSending(false);
  };

  const folderTitle = folderParam === "sent" ? "Gönderilenler" : folderParam === "spam" ? "Spam / Çöp Kutusu" : "Gelen Kutusu";
  const accountTitle = accountParam === "gmail" ? "Google / Gmail" : accountParam === "hotmail" ? "Microsoft / Hotmail" : "Tüm Hesaplar (Birleşik)";

  return (
    <div className="min-h-screen bg-background text-on-surface px-6 md:px-10 lg:px-14 pt-6 pb-28 md:pb-8">
      {/* Başlık */}
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="md:hidden w-10 h-10 rounded-2xl bg-white border border-outline-variant/30 shadow-sm overflow-hidden p-1 flex-shrink-0">
            <img src="/logo-mascot.png" alt="Clown" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
              <span className="text-[11px] font-semibold text-primary uppercase tracking-wider font-label-caps">
                {accountTitle}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold font-headline-lg text-on-surface tracking-tight mt-0.5">
              {folderTitle}
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowCompose(true)}
            className="hidden md:flex items-center space-x-2 px-4 py-2 bg-primary text-on-primary rounded-2xl font-semibold text-xs shadow-md hover:bg-primary-container transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
            <span>E-posta Yaz</span>
          </button>
          <button onClick={loadMessages} className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors border border-outline-variant/30" title="Yenile">
            <span className="material-symbols-outlined text-[20px]">refresh</span>
          </button>
          <Link href="/settings/accounts" className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors border border-outline-variant/30" title="Hesap Ayarları">
            <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
          </Link>
        </div>
      </header>

      {/* Durum Filtreleri */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
        {[
          { id: "all", label: "Tüm Mesajlar", icon: "inbox" },
          { id: "unread", label: "Okunmamış", icon: "mark_email_unread" },
          { id: "attachments", label: "Ekler", icon: "attach_file" },
        ].map((chip) => (
          <button key={chip.id} onClick={() => setFilter(chip.id)}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
              filter === chip.id ? "bg-primary text-on-primary shadow-sm" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{chip.icon}</span>
            <span>{chip.label}</span>
          </button>
        ))}
      </div>

      {/* İçerik */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-24 bg-surface-container-low animate-pulse rounded-2xl border border-outline-variant/20" />
          ))}
          <p className="text-center text-xs text-secondary pt-2 animate-pulse">E-postalar senkronize ediliyor...</p>
        </div>
      ) : error ? (
        <div className="text-center py-16 bg-error-container/20 rounded-3xl border border-error/30 p-6">
          <span className="material-symbols-outlined text-4xl text-error mb-2">error</span>
          <p className="text-sm font-semibold text-on-error-container mb-1">Bağlantı Hatası</p>
          <p className="text-xs text-secondary">{error}</p>
          <Link href="/settings/accounts" className="inline-flex items-center mt-4 px-4 py-2 bg-primary text-on-primary text-xs font-semibold rounded-xl">
            Ayarları Kontrol Et
          </Link>
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-16 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 p-6">
          <span className="material-symbols-outlined text-4xl text-outline mb-2">drafts</span>
          <p className="text-sm text-secondary font-medium">Bu klasörde e-posta bulunamadı</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <Link key={msg.id} href={`/inbox/${msg.id}`}
              className={`block bg-surface-container-lowest rounded-2xl p-4 md:p-5 border border-outline-variant/30 shadow-[0_4px_20px_-2px_rgba(182,23,34,0.06)] hover:border-primary/40 transition-all duration-200 relative overflow-hidden group ${!msg.isRead ? "" : "opacity-90"}`}
            >
              {!msg.isRead && <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-primary" />}

              <div className="flex items-start space-x-4">
                {/* Avatar */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.provider === "gmail" ? "bg-red-50 text-red-600 border border-red-200" : "bg-blue-50 text-blue-600 border border-blue-200"
                }`}>
                  <span className="text-lg font-bold">{msg.from.charAt(0).toUpperCase()}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className={`text-sm md:text-base font-bold truncate ${!msg.isRead ? "text-on-surface" : "text-secondary"}`}>{msg.from}</h3>
                    <span className="text-[11px] text-outline font-label-sm ml-2 flex-shrink-0">{msg.date}</span>
                  </div>
                  <h4 className={`text-xs md:text-sm truncate mb-1 ${!msg.isRead ? "font-semibold text-on-surface" : "text-on-surface-variant"}`}>{msg.subject}</h4>
                  <p className="text-xs text-secondary line-clamp-1 leading-relaxed">{msg.snippet}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    {msg.hasAttachments && (
                      <span className="inline-flex items-center text-[10px] font-medium text-tertiary bg-tertiary-fixed/40 px-2 py-0.5 rounded-md">
                        <span className="material-symbols-outlined text-[13px] mr-1">attach_file</span>Ek
                      </span>
                    )}
                    {(() => {
                      const isGmailAccount = msg.accountEmail ? msg.accountEmail.toLowerCase().includes("gmail") : msg.provider === "gmail";
                      return (
                        <>
                          <span className={`text-[10px] uppercase font-label-sm tracking-wider font-semibold px-2 py-0.5 rounded ${
                            isGmailAccount ? "bg-red-50 text-red-600 border border-red-200" : "bg-blue-50 text-blue-600 border border-blue-200"
                          }`}>
                            {isGmailAccount ? "GMAIL" : "HOTMAIL"}
                          </span>
                          {msg.accountEmail && (
                            <span className="text-[10px] text-outline font-mono opacity-75 truncate max-w-[160px]">
                              {msg.accountEmail}
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Mobil FAB */}
      <button onClick={() => setShowCompose(true)}
        className="md:hidden fixed bottom-20 right-5 z-40 w-14 h-14 bg-primary text-on-primary rounded-full shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined text-2xl">edit</span>
      </button>

      {/* E-posta Yaz Modalı */}
      {showCompose && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface-container-lowest rounded-3xl p-6 shadow-2xl border border-outline-variant/30 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-surface-container-high">
              <h2 className="text-lg font-bold font-headline-lg">Yeni E-posta Gönder</h2>
              <button onClick={() => setShowCompose(false)} className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-secondary block mb-1">Gönderen Hesap:</label>
                <select
                  value={compose.provider}
                  onChange={(e) => setCompose({ ...compose, provider: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface"
                >
                  {connectedAccounts.map((acc) => (
                    <option key={acc.id} value={acc.provider}>
                      {acc.provider === "gmail" ? "Google" : "Hotmail"} — {acc.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary block mb-1">Alıcı:</label>
                <input type="email" required placeholder="alici@example.com" value={compose.to}
                  onChange={(e) => setCompose({ ...compose, to: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-secondary block mb-1">Konu:</label>
                <input type="text" required placeholder="E-posta konusu" value={compose.subject}
                  onChange={(e) => setCompose({ ...compose, subject: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-secondary block mb-1">İçerik:</label>
                <textarea rows={5} required placeholder="Mesajınızı yazın..." value={compose.body}
                  onChange={(e) => setCompose({ ...compose, body: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary resize-none"
                />
              </div>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setShowCompose(false)} className="px-4 py-2 text-xs font-medium text-secondary hover:bg-surface-container rounded-xl transition-colors">İptal</button>
                <button type="submit" disabled={sending}
                  className="px-6 py-2.5 text-xs font-semibold bg-primary text-on-primary rounded-xl shadow-md hover:bg-primary-container transition-colors flex items-center space-x-2 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[18px]">{sending ? "hourglass_empty" : "send"}</span>
                  <span>{sending ? "Gönderiliyor..." : "Gönder"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background p-6 flex flex-col justify-center items-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-secondary">Posta yükleniyor...</p>
      </div>
    }>
      <InboxContent />
    </Suspense>
  );
}
