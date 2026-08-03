"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { emailProvider, EmailMessage } from "@/lib/integrations/email";

export default function InboxPage() {
  const [filter, setFilter] = useState<string>("all");
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showCompose, setShowCompose] = useState<boolean>(false);
  const [composeData, setComposeData] = useState({ to: "", subject: "", body: "" });

  useEffect(() => {
    loadMessages();
  }, [filter]);

  const loadMessages = async () => {
    setLoading(true);
    const data = await emailProvider.fetchMessages(filter);
    setMessages(data);
    setLoading(false);
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "gmail":
        return <span className="material-symbols-outlined text-[14px] text-red-600">mail</span>;
      case "outlook":
        return <span className="material-symbols-outlined text-[14px] text-blue-600">domain</span>;
      default:
        return <span className="material-symbols-outlined text-[14px] text-purple-600">mark_email_unread</span>;
    }
  };

  const handleSendCompose = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Mesaj ${composeData.to} adresine gönderildi!`);
    setShowCompose(false);
    setComposeData({ to: "", subject: "", body: "" });
  };

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
                Birleşik Posta Merkezi
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold font-headline-lg text-on-surface tracking-tight mt-0.5">
              Gelen Kutusu
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

          <Link
            href="/settings/accounts"
            className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-variant transition-colors border border-outline-variant/30"
            title="Hesap Ayarları"
          >
            <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
          </Link>
        </div>
      </header>

      {/* Filtre Çipleri */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
        {[
          { id: "all", label: "Tüm Mesajlar", icon: "inbox" },
          { id: "unread", label: "Okunmamış", icon: "mark_email_unread" },
          { id: "flagged", label: "İşaretli", icon: "star" },
          { id: "attachments", label: "Ekler", icon: "attach_file" },
        ].map((chip) => {
          const isActive = filter === chip.id;
          return (
            <button
              key={chip.id}
              onClick={() => setFilter(chip.id)}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                isActive
                  ? "bg-primary text-on-primary shadow-sm"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{chip.icon}</span>
              <span>{chip.label}</span>
            </button>
          );
        })}
      </div>

      {/* E-posta Listesi */}
      {loading ? (
        <div className="space-y-3 mt-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 bg-surface-container-low animate-pulse rounded-2xl border border-outline-variant/20" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-16 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 p-6">
          <span className="material-symbols-outlined text-4xl text-outline mb-2">drafts</span>
          <p className="text-sm text-secondary font-medium">Bu görünümde mesaj bulunamadı</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <Link
              key={msg.id}
              href={`/inbox/${msg.id}`}
              className={`block bg-surface-container-lowest rounded-2xl p-4 md:p-5 border border-outline-variant/30 shadow-[0_4px_20px_-2px_rgba(182,23,34,0.06)] hover:border-primary/40 transition-all duration-200 relative overflow-hidden group ${
                msg.isUnread ? "bg-surface-container-lowest" : "opacity-90"
              }`}
            >
              {msg.isUnread && (
                <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-primary" />
              )}

              <div className="flex items-start space-x-4">
                <div className="relative flex-shrink-0">
                  <img
                    src={msg.avatarUrl}
                    alt={msg.senderName}
                    className="w-12 h-12 rounded-full object-cover border border-outline-variant/30 shadow-xs"
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-surface-container-lowest flex items-center justify-center shadow-xs border border-outline-variant/40">
                    {getProviderIcon(msg.provider)}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className={`text-sm md:text-base font-bold truncate ${msg.isUnread ? "text-on-surface" : "text-secondary"}`}>
                      {msg.senderName}
                    </h3>
                    <span className="text-[11px] md:text-xs text-outline font-label-sm font-medium">
                      {msg.timestamp}
                    </span>
                  </div>

                  <h4 className={`text-xs md:text-sm truncate mb-1 ${msg.isUnread ? "font-semibold text-on-surface" : "font-normal text-on-surface-variant"}`}>
                    {msg.subject}
                  </h4>

                  <p className="text-xs text-secondary line-clamp-2 md:line-clamp-1 leading-relaxed">
                    {msg.snippet}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-surface-container-high/50">
                    <div className="flex items-center space-x-2">
                      {msg.hasAttachments && (
                        <span className="inline-flex items-center text-[10px] md:text-xs font-medium text-tertiary bg-tertiary-fixed/40 px-2.5 py-0.5 rounded-md">
                          <span className="material-symbols-outlined text-[14px] mr-1">attach_file</span>
                          Ek Dosya
                        </span>
                      )}
                      <span className="text-[10px] uppercase font-label-sm text-outline tracking-wider">
                        {msg.provider}
                      </span>
                    </div>

                    {msg.isFlagged && (
                      <span className="material-symbols-outlined text-[18px] text-amber-500 fill-1">star</span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Mobil FAB */}
      <button
        onClick={() => setShowCompose(true)}
        className="md:hidden fixed bottom-20 right-5 z-40 w-14 h-14 bg-primary text-on-primary rounded-full shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200"
        title="E-posta Yaz"
      >
        <span className="material-symbols-outlined text-2xl">edit</span>
      </button>

      {/* E-posta Yaz Modalı */}
      {showCompose && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface-container-lowest rounded-3xl p-6 shadow-2xl border border-outline-variant/30 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-surface-container-high">
              <h2 className="text-lg font-bold font-headline-lg text-on-surface">Yeni Mesaj</h2>
              <button
                onClick={() => setShowCompose(false)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSendCompose} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-secondary block mb-1">Alıcı:</label>
                <input
                  type="email"
                  required
                  placeholder="alici@domain.com"
                  value={composeData.to}
                  onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-secondary block mb-1">Konu:</label>
                <input
                  type="text"
                  required
                  placeholder="E-posta konusu"
                  value={composeData.subject}
                  onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-secondary block mb-1">İçerik:</label>
                <textarea
                  rows={5}
                  required
                  placeholder="E-posta içeriğinizi yazın..."
                  value={composeData.body}
                  onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCompose(false)}
                  className="px-4 py-2 text-xs font-medium text-secondary hover:bg-surface-container rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-xs font-semibold bg-primary text-on-primary rounded-xl shadow-md hover:bg-primary-container transition-colors flex items-center space-x-2"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  <span>Gönder</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
