"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { emailProvider, EmailMessage } from "@/lib/integrations/email";

export default function EmailDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [message, setMessage] = useState<EmailMessage | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadThread();
  }, [id]);

  const loadThread = async () => {
    const data = await emailProvider.getThread(id);
    setMessage(data);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setSending(true);
    await emailProvider.sendReply(id, replyText);
    alert("Yanıt başarıyla gönderildi!");
    setReplyText("");
    setSending(false);
  };

  if (!message) {
    return (
      <div className="min-h-screen bg-background p-6 flex flex-col justify-center items-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-secondary">Mesaj yükleniyor...</p>
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
          <button className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors" title="Arşivle">
            <span className="material-symbols-outlined text-[18px]">archive</span>
          </button>
          <button className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors" title="Sil">
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
          <button className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors" title="Daha fazla">
            <span className="material-symbols-outlined text-[18px]">more_vert</span>
          </button>
        </div>
      </header>

      {/* E-posta İçeriği */}
      <div className="p-4 md:px-10 lg:px-14 space-y-4 flex-1">
        {/* Konu Başlığı */}
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-[10px] uppercase font-label-sm font-semibold tracking-widest text-primary bg-primary-fixed px-2 py-0.5 rounded-md">
              {message.provider}
            </span>
            {message.isFlagged && (
              <span className="material-symbols-outlined text-[16px] text-amber-500 fill-1">star</span>
            )}
          </div>
          <h1 className="text-xl font-bold font-headline-lg text-on-surface leading-tight">
            {message.subject}
          </h1>
        </div>

        {/* Gönderen Bilgisi */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-xs flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <img
              src={message.avatarUrl}
              alt={message.senderName}
              className="w-12 h-12 rounded-full object-cover border border-outline-variant/30"
            />
            <div>
              <h2 className="text-sm font-bold text-on-surface">{message.senderName}</h2>
              <p className="text-xs text-secondary">{message.senderEmail}</p>
            </div>
          </div>
          <span className="text-[11px] text-outline font-label-sm font-medium">
            {message.timestamp}
          </span>
        </div>

        {/* E-posta Gövdesi */}
        <div className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/30 shadow-xs leading-relaxed text-sm text-on-surface whitespace-pre-line">
          {message.body}
        </div>

        {/* Ekler */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary font-label-caps">
              Ekler ({message.attachments.length})
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {message.attachments.map((att, i) => (
                <div
                  key={i}
                  className="bg-surface-container-lowest p-3 rounded-2xl border border-outline-variant/30 flex items-center justify-between shadow-xs hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-fixed/40 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-[20px]">
                        {att.type === "pdf" ? "picture_as_pdf" : att.type === "image" ? "image" : "folder_zip"}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-on-surface truncate max-w-[200px]">{att.name}</p>
                      <p className="text-[11px] text-secondary font-label-sm">{att.size}</p>
                    </div>
                  </div>
                  <button className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary hover:bg-primary hover:text-on-primary transition-colors" title="İndir">
                    <span className="material-symbols-outlined text-[18px]">download</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Alt Yanıt Kutusu */}
      <div className="sticky bottom-0 left-0 right-0 p-3 bg-surface-container-lowest border-t border-outline-variant/30 shadow-2xl">
        <form onSubmit={handleSendReply} className="flex items-end space-x-2">
          <div className="flex-1 bg-surface-container-low rounded-2xl px-3 py-2 border border-outline-variant/30 focus-within:border-primary transition-colors">
            <textarea
              rows={2}
              placeholder={`${message.senderName} kişisine yanıtla...`}
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
            <span className="material-symbols-outlined text-[20px]">send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
