"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface RealEmailDetail {
  id: string;
  subject: string;
  from: string;
  fromEmail: string;
  to: string;
  date: string;
  snippet: string;
  body: string;
  isRead: boolean;
  hasAttachments: boolean;
}

export default function EmailDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [message, setMessage] = useState<RealEmailDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadMail();
  }, [id]);

  const loadMail = async () => {
    setLoading(true);
    setError(null);
    try {
      const encodedId = encodeURIComponent(id);
      const res = await fetch(`/api/mail/${encodedId}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setMessage(data);
      }
    } catch {
      setError("E-posta yüklenirken bir hata oluştu.");
    }
    setLoading(false);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !message) return;
    setSending(true);
    try {
      const res = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: message.fromEmail || message.from,
          subject: message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`,
          text: replyText,
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(`Yanıt gönderilemedi: ${data.error}`);
      } else {
        alert("Yanıt başarıyla gönderildi!");
        setReplyText("");
      }
    } catch {
      alert("Gönderim başarısız.");
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex flex-col justify-center items-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-secondary">E-posta yükleniyor...</p>
      </div>
    );
  }

  if (error || !message) {
    return (
      <div className="min-h-screen bg-background p-6 flex flex-col justify-center items-center text-center">
        <span className="material-symbols-outlined text-4xl text-error mb-2">error</span>
        <h2 className="text-base font-bold text-on-surface mb-1">E-posta Yüklenemedi</h2>
        <p className="text-xs text-secondary mb-4">{error || "Mesaj bulunamadı."}</p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-primary text-on-primary text-xs font-semibold rounded-xl"
        >
          Geri Dön
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col pb-28">
      {/* Üst Başlık */}
      <header className="sticky top-0 z-40 bg-surface-container-lowest/90 backdrop-blur-md px-4 py-3 border-b border-outline-variant/30 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>

        <div className="flex items-center space-x-2">
          <button className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors" title="Yenile" onClick={loadMail}>
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>
        </div>
      </header>

      {/* E-posta İçeriği */}
      <div className="p-4 md:px-10 lg:px-14 space-y-4 flex-1">
        {/* Konu Başlığı */}
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-[10px] uppercase font-label-sm font-semibold tracking-widest text-primary bg-primary-fixed px-2 py-0.5 rounded-md">
              HOTMAIL
            </span>
          </div>
          <h1 className="text-xl font-bold font-headline-lg text-on-surface leading-tight">
            {message.subject}
          </h1>
        </div>

        {/* Gönderen Bilgisi */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-xs flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-bold text-primary">{message.from.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-on-surface">{message.from}</h2>
              <p className="text-xs text-secondary">{message.fromEmail}</p>
            </div>
          </div>
          <span className="text-[11px] text-outline font-label-sm font-medium">
            {message.date}
          </span>
        </div>

        {/* E-posta Gövdesi */}
        <div
          className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/30 shadow-xs leading-relaxed text-sm text-on-surface overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: message.body }}
        />
      </div>

      {/* Alt Yanıt Kutusu */}
      <div className="sticky bottom-0 left-0 right-0 p-3 bg-surface-container-lowest border-t border-outline-variant/30 shadow-2xl">
        <form onSubmit={handleSendReply} className="flex items-end space-x-2">
          <div className="flex-1 bg-surface-container-low rounded-2xl px-3 py-2 border border-outline-variant/30 focus-within:border-primary transition-colors">
            <textarea
              rows={2}
              placeholder={`${message.from} kişisine yanıtla...`}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="w-full text-xs bg-transparent text-on-surface focus:outline-none resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={sending || !replyText.trim()}
            className="w-11 h-11 bg-primary text-on-primary rounded-2xl flex items-center justify-center shadow-md hover:bg-primary-container disabled:opacity-50 transition-all flex-shrink-0"
            title="Gönder"
          >
            <span className="material-symbols-outlined text-[20px]">{sending ? "hourglass_empty" : "send"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
