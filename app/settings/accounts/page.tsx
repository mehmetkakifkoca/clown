"use client";

import { useState } from "react";
import Link from "next/link";

export default function AccountSettingsPage() {
  const [showImapForm, setShowImapForm] = useState(false);
  const [imapHost, setImapHost] = useState("");
  const [imapEmail, setImapEmail] = useState("");

  return (
    <div className="min-h-screen bg-background text-on-surface px-6 md:px-10 lg:px-14 pt-6 pb-28 md:pb-8">
      <header className="flex items-center space-x-3 mb-6">
        <Link href="/inbox" className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div>
          <span className="text-[11px] font-semibold text-primary uppercase tracking-wider font-label-caps block">Entegrasyonlar & OAuth</span>
          <h1 className="text-xl font-bold font-headline-lg text-on-surface">Bağlı Hesaplar</h1>
        </div>
      </header>

      <div className="space-y-4">
        <div className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/30 shadow-xs">
          <h2 className="text-sm font-bold text-on-surface mb-1">Posta & Takvim Senkronizasyon Durumu</h2>
          <p className="text-xs text-secondary leading-relaxed mb-4">
            Dış e-posta ve takvim sağlayıcılarınızı buradan yönetin. Gerçek OAuth kimlik bilgileri ve API anahtarlarını{" "}
            <code className="bg-surface-container px-1 py-0.5 rounded text-[11px] font-label-sm text-primary">.env</code> dosyanıza ekleyebilirsiniz.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 bg-surface-container-low rounded-2xl border border-outline-variant/20">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 border border-red-200">
                  <span className="material-symbols-outlined text-[20px]">mail</span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-on-surface">Google / Gmail</h3>
                  <p className="text-[11px] text-secondary">Bağlı: julianne.deville@gmail.com</p>
                </div>
              </div>
              <button onClick={() => alert("// TODO: Gerçek Gmail OAuth kimlik bilgilerini bağlayın")}
                className="px-3.5 py-1.5 bg-primary text-on-primary text-xs font-semibold rounded-xl hover:bg-primary-container transition-colors shadow-xs">
                OAuth Bağla
              </button>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-surface-container-low rounded-2xl border border-outline-variant/20">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-200">
                  <span className="material-symbols-outlined text-[20px]">domain</span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-on-surface">Microsoft 365 / Outlook</h3>
                  <p className="text-[11px] text-secondary">Bağlı: alex.work@microsoft.com</p>
                </div>
              </div>
              <button onClick={() => alert("// TODO: Gerçek Outlook OAuth kimlik bilgilerini bağlayın")}
                className="px-3.5 py-1.5 bg-secondary text-on-secondary text-xs font-semibold rounded-xl hover:bg-secondary-container hover:text-on-secondary-container transition-colors shadow-xs">
                OAuth Bağla
              </button>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-surface-container-low rounded-2xl border border-outline-variant/20">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-200">
                  <span className="material-symbols-outlined text-[20px]">mark_email_unread</span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-on-surface">Özel IMAP / SMTP</h3>
                  <p className="text-[11px] text-secondary">Bağlı: soren@either-or.org</p>
                </div>
              </div>
              <button onClick={() => setShowImapForm(!showImapForm)}
                className="px-3.5 py-1.5 bg-surface-container-high text-on-surface text-xs font-semibold rounded-xl hover:bg-surface-variant transition-colors">
                {showImapForm ? "Formu Kapat" : "IMAP Ekle"}
              </button>
            </div>
          </div>
        </div>

        {showImapForm && (
          <div className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/40 shadow-md animate-in slide-in-from-top-2 duration-200">
            <h3 className="text-sm font-bold text-on-surface mb-3">Özel IMAP Sunucusu Ekle</h3>
            <form onSubmit={(e) => { e.preventDefault(); alert(`// TODO: ${imapEmail} için IMAP kimlik bilgilerini kaydet (${imapHost})`); setShowImapForm(false); }} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-secondary block mb-1">E-posta Adresi:</label>
                <input type="email" required placeholder="kullanici@domain.com" value={imapEmail} onChange={(e) => setImapEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface" />
              </div>
              <div>
                <label className="text-xs font-medium text-secondary block mb-1">IMAP Sunucusu:</label>
                <input type="text" required placeholder="imap.domain.com:993" value={imapHost} onChange={(e) => setImapHost(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface font-label-sm" />
              </div>
              <div className="pt-2 flex justify-end">
                <button type="submit" className="px-4 py-2 bg-primary text-on-primary text-xs font-semibold rounded-xl shadow-md hover:bg-primary-container transition-colors">
                  IMAP Kimlik Bilgilerini Kaydet
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/30 shadow-xs">
          <div className="flex items-center space-x-2 mb-2">
            <span className="material-symbols-outlined text-primary text-xl">analytics</span>
            <h2 className="text-sm font-bold text-on-surface">Meta Graph API Ayarları</h2>
          </div>
          <p className="text-xs text-secondary leading-relaxed">
            Sosyal hesap takibi{" "}
            <code className="bg-surface-container px-1 py-0.5 rounded text-[11px] font-label-sm text-primary">/lib/integrations/instagram.ts</code>{" "}
            dosyasında yapılandırılmıştır. Canlı etkileşim analitiği için Meta Business Graph API kimlik bilgilerini ekleyebilirsiniz.
          </p>
        </div>
      </div>
    </div>
  );
}
