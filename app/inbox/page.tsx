"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

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
  provider?: string;
}

function InboxContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Search parameters for driving UI state
  const accountParam = searchParams.get("account") || "";
  const folderParam = searchParams.get("folder") || "";
  const selectedId = searchParams.get("id") || "";

  // Filter chips / Categories
  const [filter, setFilter] = useState("all"); // all | unread | attachments
  const [categoryFilter, setCategoryFilter] = useState("all"); // all | personal | transactions | social | promotions
  const [searchTerm, setSearchTerm] = useState("");

  // Data states
  const [messages, setMessages] = useState<RealEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  
  // Compose modal states
  const [showCompose, setShowCompose] = useState(false);
  const [compose, setCompose] = useState({ to: "", subject: "", body: "", provider: "gmail" });
  const [sending, setSending] = useState(false);

  // Single email detail states
  const [selectedMail, setSelectedMail] = useState<RealEmailDetail | null>(null);
  const [mailLoading, setMailLoading] = useState(false);
  const [mailError, setMailError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);

  // Helper to update search params without breaking history
  const updateParams = (newParams: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([key, val]) => {
      if (val === null) {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    });
    router.push(`/inbox?${params.toString()}`);
  };

  const clearAllParams = () => {
    router.push("/inbox");
  };

  useEffect(() => {
    checkAccounts();
  }, []);

  // Fetch email list when account, folder, or status filter changes
  useEffect(() => {
    // If not on mobile root, fetch messages. On desktop, always fetch.
    const isDesktop = window.innerWidth >= 1024;
    if (isDesktop || accountParam || folderParam) {
      loadMessages();
    } else {
      setLoading(false);
    }
  }, [filter, accountParam, folderParam]);

  // Fetch individual email detail when id changes
  useEffect(() => {
    if (!selectedId) {
      setSelectedMail(null);
      return;
    }
    const loadMailDetail = async () => {
      setMailLoading(true);
      setMailError(null);
      try {
        const res = await fetch(`/api/mail/${encodeURIComponent(selectedId)}`);
        const data = await res.json();
        if (data.error) {
          setMailError(data.error);
        } else {
          setSelectedMail(data);
          // Mark as read locally
          setMessages(prev => prev.map(m => m.id === selectedId ? { ...m, isRead: true } : m));
        }
      } catch {
        setMailError("E-posta detayı yüklenemedi.");
      }
      setMailLoading(false);
    };
    loadMailDetail();
  }, [selectedId]);

  const checkAccounts = async () => {
    try {
      const res = await fetch("/api/mail/accounts");
      const accounts = await res.json();
      if (Array.isArray(accounts)) {
        const visibleAccounts = accounts.filter(acc => !acc.isHidden && acc.useForMail !== false);
        setConnectedAccounts(visibleAccounts);
        if (visibleAccounts.length > 0 && !compose.provider) {
          setCompose(prev => ({ ...prev, provider: visibleAccounts[0].provider }));
        }
      }
    } catch {
      /* ignore */
    }
  };

  const loadMessages = async () => {
    setLoading(true);
    setError(null);
    try {
      // Default to "all" and "inbox" on desktop if not specified
      const acc = accountParam || "all";
      const fld = folderParam || "inbox";
      const res = await fetch(`/api/mail/inbox?filter=${filter}&account=${acc}&folder=${fld}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setMessages([]);
      } else {
        setMessages(data);
      }
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
      if (data.error) {
        alert(`Hata: ${data.error}`);
      } else {
        alert("E-posta gönderildi!");
        setShowCompose(false);
        setCompose(prev => ({ ...prev, to: "", subject: "", body: "" }));
        loadMessages();
      }
    } catch {
      alert("Gönderim başarısız");
    }
    setSending(false);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedMail) return;
    setReplySending(true);
    try {
      const res = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedMail.fromEmail || selectedMail.from,
          subject: selectedMail.subject.startsWith("Re:") ? selectedMail.subject : `Re: ${selectedMail.subject}`,
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
    setReplySending(false);
  };

  // Helper check for categories matching user screenshots
  const isMailInTransaction = (m: RealEmail | RealEmailDetail) => {
    const subject = (m.subject || "").toLowerCase();
    const snippet = (m.snippet || "").toLowerCase();
    const from = (m.from || "").toLowerCase();
    return subject.includes("order") || subject.includes("receipt") || subject.includes("fatura") || 
           subject.includes("sipariş") || subject.includes("payment") || subject.includes("ödeme") || 
           subject.includes("transaktion") || subject.includes("azure") || subject.includes("invoice") ||
           snippet.includes("receipt") || snippet.includes("invoice") || snippet.includes("fatura") ||
           from.includes("azure") || from.includes("wienenergie");
  };

  const isMailInSocial = (m: RealEmail | RealEmailDetail) => {
    const subject = (m.subject || "").toLowerCase();
    const from = (m.from || "").toLowerCase();
    return subject.includes("social") || subject.includes("reply") || subject.includes("comment") || 
           subject.includes("mention") || subject.includes("linkedin") || subject.includes("facebook") || 
           subject.includes("twitter") || subject.includes("instagram") || from.includes("linkedin") ||
           from.includes("facebook") || from.includes("twitter") || from.includes("instagram") ||
           from.includes("lovable");
  };

  const isMailInPromotion = (m: RealEmail | RealEmailDetail) => {
    const subject = (m.subject || "").toLowerCase();
    const snippet = (m.snippet || "").toLowerCase();
    const from = (m.from || "").toLowerCase();
    return subject.includes("newsletter") || subject.includes("offer") || subject.includes("discount") || 
           subject.includes("kampanya") || subject.includes("indirim") || subject.includes("promosyon") || 
           subject.includes("bülten") || subject.includes("advertising") || snippet.includes("newsletter") ||
           snippet.includes("kampanya") || snippet.includes("indirim") || from.includes("newsletter") || 
           from.includes("promotions");
  };

  // Filter messages dynamically based on unread/attachments filters, category filter, and search text
  let filteredMessages = messages;
  
  if (categoryFilter !== "all") {
    filteredMessages = filteredMessages.filter(m => {
      const isTx = isMailInTransaction(m);
      const isSoc = isMailInSocial(m);
      const isPromo = isMailInPromotion(m);
      
      if (categoryFilter === "transactions") return isTx;
      if (categoryFilter === "social") return isSoc;
      if (categoryFilter === "promotions") return isPromo;
      if (categoryFilter === "personal") return !isTx && !isSoc && !isPromo;
      return true;
    });
  }

  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase();
    filteredMessages = filteredMessages.filter(m => 
      (m.subject || "").toLowerCase().includes(term) ||
      (m.snippet || "").toLowerCase().includes(term) ||
      (m.from || "").toLowerCase().includes(term)
    );
  }

  // Statistics
  const unreadCount = messages.filter(m => !m.isRead).length;

  const currentFolderTitle = folderParam === "sent" ? "Gönderilenler" : folderParam === "spam" ? "Spam / Çöp" : "Gelen Kutusu";
  const currentAccountTitle = accountParam === "gmail" ? "Gmail" : accountParam === "hotmail" ? "Outlook" : "Tüm Postalar";

  return (
    <div className="flex h-[calc(100vh-80px)] md:h-[calc(100vh-32px)] w-full bg-background text-on-surface overflow-hidden relative">
      

      {/* ---------------------------------------------------- */}
      {/* COLUMN 2: EMAIL LIST PANE (Desktop & Mobile) */}
      {/* ---------------------------------------------------- */}
      <div
        className={`w-full lg:w-96 flex flex-col border-r border-outline-variant/20 bg-surface-container-lowest h-full overflow-hidden flex-shrink-0 ${
          // Visibility triggers for responsive layout
          selectedId ? "hidden lg:flex" : (accountParam ? "flex" : "hidden lg:flex")
        }`}
      >
        {/* Header section matching Apple Mail list header */}
        <header className="px-4 pt-4 pb-2 border-b border-outline-variant/15 bg-surface-container-lowest">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-2">
              {/* Back Button (Mobile only) */}
              <button
                onClick={clearAllParams}
                className="lg:hidden w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              <h1 className="text-xl font-extrabold tracking-tight font-headline-lg">
                {currentFolderTitle}
              </h1>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setShowCompose(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container text-secondary"
                title="Yeni E-posta"
              >
                <span className="material-symbols-outlined text-[20px]">edit</span>
              </button>
              <button
                onClick={loadMessages}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container text-secondary"
                title="Yenile"
              >
                <span className="material-symbols-outlined text-[20px] spin-on-hover">refresh</span>
              </button>
            </div>
          </div>

          <p className="text-[11px] text-secondary font-medium pl-1 mb-3">
            {currentAccountTitle} • {filteredMessages.length} E-posta
            {unreadCount > 0 ? `, ${unreadCount} okunmamış` : ""}
          </p>

          {/* Search bar inside header */}
          <div className="relative mb-3 pl-1">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[16px]">
              search
            </span>
            <input
              type="text"
              placeholder="Ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-1.5 text-xs bg-surface-container-low border border-outline-variant/30 rounded-xl focus:outline-none focus:border-primary/50 text-on-surface font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[14px] text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>

          {/* Category tabs matching Apple Mail filter bar (Person, Cart, Chat, Megaphone, All) */}
          <div className="flex items-center justify-between pb-1 pt-1.5 scrollbar-none overflow-x-auto">
            <div className="flex items-center space-x-1.5 w-full">
              <button
                onClick={() => setCategoryFilter("personal")}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  categoryFilter === "personal"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "bg-surface-container hover:bg-surface-container-high text-secondary"
                }`}
                title="Kişisel"
              >
                <span className="material-symbols-outlined text-[16px]">person</span>
              </button>

              <button
                onClick={() => setCategoryFilter("transactions")}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  categoryFilter === "transactions"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "bg-surface-container hover:bg-surface-container-high text-secondary"
                }`}
                title="İşlemler (Fatura, Sipariş vb.)"
              >
                <span className="material-symbols-outlined text-[16px]">shopping_cart</span>
              </button>

              <button
                onClick={() => setCategoryFilter("social")}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  categoryFilter === "social"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "bg-surface-container hover:bg-surface-container-high text-secondary"
                }`}
                title="Sosyal"
              >
                <span className="material-symbols-outlined text-[16px]">chat_bubble</span>
              </button>

              <button
                onClick={() => setCategoryFilter("promotions")}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  categoryFilter === "promotions"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "bg-surface-container hover:bg-surface-container-high text-secondary"
                }`}
                title="Tanıtımlar"
              >
                <span className="material-symbols-outlined text-[16px]">campaign</span>
              </button>

              <button
                onClick={() => setCategoryFilter("all")}
                className={`flex-1 py-1.5 px-3 rounded-full text-[10px] font-bold text-center tracking-wider uppercase transition-all ${
                  categoryFilter === "all"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "bg-surface-container hover:bg-surface-container-high text-secondary"
                }`}
              >
                Alle E-Mails
              </button>
            </div>
          </div>
        </header>

        {/* Email list container */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-surface-container-low/40">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-20 bg-surface-container-low animate-pulse rounded-xl border border-outline-variant/10" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <span className="material-symbols-outlined text-3xl text-error mb-2">error</span>
              <p className="text-xs text-secondary">{error}</p>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="p-12 text-center text-secondary text-xs italic">
              E-posta bulunamadı.
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const isSelected = selectedId === msg.id;
              return (
                <div
                  key={msg.id}
                  onClick={() => updateParams({ id: msg.id })}
                  className={`block p-3.5 rounded-xl cursor-pointer transition-all border relative overflow-hidden group select-none ${
                    isSelected
                      ? "bg-primary/10 border-primary/30 shadow-xs"
                      : "bg-surface-container-lowest border-outline-variant/20 hover:border-primary/20 shadow-2xs"
                  }`}
                >
                  {/* Unread indicator blue dot */}
                  {!msg.isRead && (
                    <div className="absolute left-2.5 top-4.5 w-2 h-2 bg-blue-500 rounded-full" />
                  )}

                  <div className="pl-3.5">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3
                        className={`text-xs truncate max-w-[160px] ${
                          !msg.isRead ? "font-extrabold text-on-surface" : "font-semibold text-secondary"
                        }`}
                      >
                        {msg.from}
                      </h3>
                      <div className="flex items-center space-x-1 text-[10px] text-outline font-medium">
                        <span>{msg.date.split(" ")[0]}</span>
                        <span className="material-symbols-outlined text-[10px] text-outline/60 group-hover:translate-x-0.5 transition-transform">
                          chevron_right
                        </span>
                      </div>
                    </div>

                    <h4
                      className={`text-xs truncate mb-1 ${
                        !msg.isRead ? "font-bold text-on-surface" : "font-medium text-on-surface-variant"
                      }`}
                    >
                      {msg.subject}
                    </h4>

                    <p className="text-[11px] text-secondary line-clamp-2 leading-relaxed mb-1.5 opacity-85">
                      {msg.snippet}
                    </p>

                    <div className="flex items-center justify-between mt-1 text-[9px]">
                      <div className="flex items-center space-x-1.5">
                        {msg.hasAttachments && (
                          <span className="inline-flex items-center text-outline">
                            <span className="material-symbols-outlined text-[11px] mr-0.5">attach_file</span>
                          </span>
                        )}
                        <span
                          className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                            msg.provider === "gmail"
                              ? "bg-red-50 text-red-600 border border-red-100"
                              : "bg-blue-50 text-blue-600 border border-blue-100"
                          }`}
                        >
                          {msg.provider === "gmail" ? "GMAIL" : "OUTLOOK"}
                        </span>
                      </div>
                      
                      {msg.accountEmail && (
                        <span className="text-outline/70 font-mono text-[8px] truncate max-w-[120px]">
                          {msg.accountEmail.split("@")[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Mobile footer navigation matching Apple Mail bottom bar (only on mobile) */}
        <footer className="lg:hidden px-4 py-2 border-t border-outline-variant/20 bg-surface-container-lowest flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => setFilter(filter === "unread" ? "all" : "unread")}
            className={`w-9 h-9 rounded-full flex items-center justify-center ${
              filter === "unread" ? "bg-primary/10 text-primary" : "text-secondary"
            }`}
            title="Okunmamışları Filtrele"
          >
            <span className="material-symbols-outlined text-[20px]">filter_list</span>
          </button>

          <p className="text-[10px] text-secondary font-semibold">
            {loading ? "E-postalar güncelleniyor..." : `Son güncelleme: ${new Date().toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' })}`}
          </p>

          <button
            onClick={() => setShowCompose(true)}
            className="w-9 h-9 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-md shadow-primary/20"
            title="Yeni E-posta"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </button>
        </footer>
      </div>

      {/* ---------------------------------------------------- */}
      {/* COLUMN 3: EMAIL READING PANE (Desktop & Mobile Detail) */}
      {/* ---------------------------------------------------- */}
      <div
        className={`flex flex-col flex-1 bg-surface-container-lowest h-full overflow-hidden ${
          selectedId ? "flex" : "hidden lg:flex"
        }`}
      >
        {selectedId ? (
          <>
            {/* Toolbar at top matching macOS/iOS Mail */}
            <header className="px-4 py-2.5 border-b border-outline-variant/15 bg-surface-container-lowest/80 backdrop-blur-md flex items-center justify-between flex-shrink-0 select-none">
              <div className="flex items-center space-x-2">
                {/* Back button (Mobile only) */}
                <button
                  onClick={() => updateParams({ id: null })}
                  className="lg:hidden w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>

                {/* Left controls: compose inside pane */}
                <button
                  onClick={() => setShowCompose(true)}
                  className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center text-secondary"
                  title="Yeni E-posta"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
              </div>

              {/* Central control tools */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => {
                    if (selectedMail) {
                      setReplyText(`\n\nOn ${selectedMail.date}, ${selectedMail.from} wrote:\n> ${selectedMail.snippet}`);
                      const textarea = document.getElementById("reply-textarea");
                      textarea?.focus();
                    }
                  }}
                  className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center text-secondary"
                  title="Yanıtla"
                >
                  <span className="material-symbols-outlined text-[18px]">reply</span>
                </button>
                <button
                  className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center text-secondary"
                  title="Tümünü Yanıtla"
                >
                  <span className="material-symbols-outlined text-[18px]">reply_all</span>
                </button>
                <button
                  className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center text-secondary"
                  title="İlet"
                >
                  <span className="material-symbols-outlined text-[18px]">forward</span>
                </button>

                <div className="w-[1px] h-6 bg-outline-variant/20 mx-1.5" />

                <button
                  className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center text-secondary"
                  title="Arşivle"
                >
                  <span className="material-symbols-outlined text-[18px]">archive</span>
                </button>
                <button
                  className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center text-secondary"
                  title="Sil"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
                <button
                  className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center text-secondary"
                  title="Spam"
                >
                  <span className="material-symbols-outlined text-[18px]">report</span>
                </button>

                <div className="w-[1px] h-6 bg-outline-variant/20 mx-1.5" />

                <button
                  className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center text-secondary"
                  title="Klasöre Taşı"
                >
                  <span className="material-symbols-outlined text-[18px]">folder_open</span>
                </button>
                <button
                  className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center text-secondary"
                  title="Bayrak Ekle"
                >
                  <span className="material-symbols-outlined text-[18px] text-amber-500">flag</span>
                </button>
              </div>
            </header>

            {/* Email detail scroll area */}
            <div className="flex-1 overflow-y-auto">
              {mailLoading ? (
                <div className="h-full flex flex-col justify-center items-center">
                  <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-xs text-secondary">Mesaj yükleniyor...</p>
                </div>
              ) : mailError || !selectedMail ? (
                <div className="h-full flex flex-col justify-center items-center text-center p-6">
                  <span className="material-symbols-outlined text-4xl text-error mb-2">error</span>
                  <p className="text-sm font-semibold text-on-surface mb-1">E-posta Yüklenemedi</p>
                  <p className="text-xs text-secondary">{mailError || "E-posta bulunamadı."}</p>
                </div>
              ) : (
                <div className="p-6 md:p-8 space-y-6">
                  {/* Category Banner if email belongs to transaction/social/promos */}
                  {isMailInTransaction(selectedMail) && (
                    <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-2xs">
                      <span className="material-symbols-outlined text-[18px] text-emerald-600">shopping_cart</span>
                      <span>Zeitkritische Infos in „Transaktion“</span>
                    </div>
                  )}
                  {isMailInSocial(selectedMail) && (
                    <div className="flex items-center space-x-2 bg-indigo-50 text-indigo-800 border border-indigo-100 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-2xs">
                      <span className="material-symbols-outlined text-[18px] text-indigo-600">chat_bubble</span>
                      <span>Soğuk Sosyal Bildirimler kategorisinde</span>
                    </div>
                  )}

                  {/* Message Meta Info */}
                  <div className="space-y-4">
                    <div className="flex items-start justify-between border-b border-outline-variant/15 pb-4">
                      <div className="flex items-center space-x-3.5">
                        {/* Custom initials avatar */}
                        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-base flex-shrink-0">
                          {selectedMail.from.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h2 className="text-sm font-extrabold text-on-surface leading-tight">
                            {selectedMail.from}
                          </h2>
                          <p className="text-[11px] text-secondary font-medium mt-0.5">
                            Kimden: <span className="font-mono text-outline">{selectedMail.fromEmail}</span>
                          </p>
                          <p className="text-[11px] text-secondary font-medium mt-0.5">
                            Alıcı: <span className="font-mono text-outline">{selectedMail.to || "m.akifkoca@hotmail.com"}</span>
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-outline font-semibold uppercase bg-surface-container-high px-2 py-1 rounded-md">
                        {selectedMail.date}
                      </span>
                    </div>

                    <h1 className="text-xl md:text-2xl font-extrabold font-headline-lg text-on-surface leading-snug tracking-tight">
                      {selectedMail.subject}
                    </h1>
                  </div>

                  {/* Mail Body Frame */}
                  <div className="bg-white rounded-3xl p-5 border border-outline-variant/15 shadow-2xs leading-relaxed text-sm text-on-surface overflow-x-auto min-h-[300px]">
                    <div
                      className="prose prose-sm max-w-none text-on-surface"
                      dangerouslySetInnerHTML={{ __html: selectedMail.body }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom inline reply box */}
            {selectedMail && (
              <div className="p-3.5 border-t border-outline-variant/15 bg-surface-container-lowest flex-shrink-0 shadow-2xl">
                <form onSubmit={handleSendReply} className="flex items-end space-x-2.5">
                  <div className="flex-1 bg-surface-container-low rounded-2xl px-4 py-2.5 border border-outline-variant/30 focus-within:border-primary/50 transition-colors">
                    <textarea
                      id="reply-textarea"
                      rows={2}
                      placeholder={`${selectedMail.from} kişisine yanıtla...`}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="w-full text-xs bg-transparent text-on-surface focus:outline-none resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={replySending || !replyText.trim()}
                    className="w-11 h-11 bg-primary text-on-primary rounded-2xl flex items-center justify-center shadow-md hover:bg-primary-container disabled:opacity-50 transition-all flex-shrink-0"
                    title="Yanıt Gönder"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {replySending ? "hourglass_empty" : "send"}
                    </span>
                  </button>
                </form>
              </div>
            )}
          </>
        ) : (
          /* Empty reading pane state for desktop */
          <div className="h-full flex flex-col justify-center items-center text-center p-8 bg-surface-container-lowest select-none">
            <span className="material-symbols-outlined text-6xl text-outline/40 mb-4 animate-bounce">
              drafts
            </span>
            <h2 className="text-base font-extrabold text-secondary mb-1">E-posta Seçilmedi</h2>
            <p className="text-xs text-outline max-w-[280px] leading-relaxed">
              Detayları görüntülemek ve yanıtlamak için sol listeden bir e-posta seçin.
            </p>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* MOBILE SCREEN: MAILBOXES "POSTFÄCHER" (Only on mobile) */}
      {/* ---------------------------------------------------- */}
      <div
        className={`w-full h-full flex flex-col bg-surface-container-low lg:hidden select-none ${
          !accountParam && !selectedId ? "flex" : "hidden"
        }`}
      >
        <header className="px-4 pt-5 pb-3 bg-surface-container-low flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight font-headline-lg text-on-surface">
              Postfächer
            </h1>
            <p className="text-[11px] text-secondary font-medium mt-0.5">
              Gerade aktualisiert
            </p>
          </div>
          <Link href="/settings/accounts" className="px-4 py-1.5 bg-white text-on-surface text-xs font-bold rounded-full border border-outline-variant/30 shadow-2xs hover:bg-surface-container-high transition-all">
            Bearbeiten
          </Link>
        </header>

        <div className="flex-1 overflow-y-auto px-4 space-y-6 pt-2 pb-24">
          {/* Main folder group with rounded corners */}
          <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-xs divide-y divide-outline-variant/15 overflow-hidden">
            <button
              onClick={() => updateParams({ account: "all", folder: "inbox" })}
              className="w-full flex items-center justify-between px-4 py-3.5 text-sm text-left hover:bg-surface-container-low/40 active:bg-surface-container-low transition-colors"
            >
              <div className="flex items-center space-x-3 text-on-surface">
                <span className="material-symbols-outlined text-[20px] text-blue-500 font-bold">inbox</span>
                <span className="font-semibold">Alle</span>
              </div>
              <div className="flex items-center space-x-1">
                {unreadCount > 0 && (
                  <span className="text-xs font-bold text-secondary">{unreadCount}</span>
                )}
                <span className="material-symbols-outlined text-[18px] text-outline/50">chevron_right</span>
              </div>
            </button>

            {connectedAccounts.map((acc) => {
              const isGoogle = acc.provider === "gmail";
              const accountLabel = isGoogle ? "Gmail" : "Outlook";
              return (
                <button
                  key={acc.id}
                  onClick={() => updateParams({ account: acc.provider, folder: "inbox" })}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-sm text-left hover:bg-surface-container-low/40 active:bg-surface-container-low transition-colors"
                >
                  <div className="flex items-center space-x-3 text-on-surface">
                    <span className={`material-symbols-outlined text-[20px] font-bold ${isGoogle ? "text-red-500" : "text-blue-500"}`}>
                      move_to_inbox
                    </span>
                    <span className="font-semibold">{accountLabel}</span>
                  </div>
                  <span className="material-symbols-outlined text-[18px] text-outline/50">chevron_right</span>
                </button>
              );
            })}
          </div>

          {/* Account Subfolders tree */}
          <div className="space-y-4">
            {connectedAccounts.map((acc) => {
              const isGoogle = acc.provider === "gmail";
              const label = isGoogle ? "Gmail" : "Outlook";
              return (
                <details key={acc.id} className="group space-y-1.5">
                  <summary className="px-2 flex items-center justify-between text-xs font-bold text-secondary uppercase tracking-wider font-label-caps opacity-80 cursor-pointer list-none select-none">
                    <span>{label} ({acc.email.split("@")[0]})</span>
                    <span className="material-symbols-outlined text-[16px] transition-transform group-open:rotate-180">expand_more</span>
                  </summary>
                  <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-xs divide-y divide-outline-variant/15 overflow-hidden">
                    <button
                      onClick={() => updateParams({ account: acc.provider, folder: "inbox" })}
                      className="w-full flex items-center justify-between px-4 py-3 text-xs text-left hover:bg-surface-container-low/40 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="material-symbols-outlined text-[18px] text-blue-500">inbox</span>
                        <span className="font-medium text-on-surface">Eingang</span>
                      </div>
                      <span className="material-symbols-outlined text-[16px] text-outline/50">chevron_right</span>
                    </button>

                    <button
                      onClick={() => updateParams({ account: acc.provider, folder: "sent" })}
                      className="w-full flex items-center justify-between px-4 py-3 text-xs text-left hover:bg-surface-container-low/40 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="material-symbols-outlined text-[18px] text-secondary">send</span>
                        <span className="font-medium text-on-surface">Gesendet</span>
                      </div>
                      <span className="material-symbols-outlined text-[16px] text-outline/50">chevron_right</span>
                    </button>

                    <button
                      onClick={() => updateParams({ account: acc.provider, folder: "spam" })}
                      className="w-full flex items-center justify-between px-4 py-3 text-xs text-left hover:bg-surface-container-low/40 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="material-symbols-outlined text-[18px] text-secondary">report</span>
                        <span className="font-medium text-on-surface">Spam</span>
                      </div>
                      <span className="material-symbols-outlined text-[16px] text-outline/50">chevron_right</span>
                    </button>
                  </div>
                </details>
              );
            })}
          </div>
        </div>

        {/* Compose Floating Button */}
        <button
          onClick={() => setShowCompose(true)}
          className="fixed bottom-24 right-5 z-40 w-12 h-12 bg-white text-primary rounded-full shadow-lg border border-outline-variant/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-2xl font-bold">edit</span>
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* COMPOSE MAIL MODAL (Shared) */}
      {/* ---------------------------------------------------- */}
      {showCompose && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface-container-lowest rounded-3xl p-6 shadow-2xl border border-outline-variant/20 animate-in slide-in-from-bottom duration-250 select-none">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-surface-container-high">
              <h2 className="text-base font-extrabold font-headline-lg">Yeni E-posta Gönder</h2>
              <button
                onClick={() => setShowCompose(false)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-secondary uppercase font-label-caps block mb-1">
                  Gönderen Hesap:
                </label>
                <select
                  value={compose.provider}
                  onChange={(e) => setCompose({ ...compose, provider: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface font-semibold"
                >
                  {connectedAccounts.map((acc) => (
                    <option key={acc.id} value={acc.provider}>
                      {acc.provider === "gmail" ? "Google" : "Outlook"} — {acc.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-secondary uppercase font-label-caps block mb-1">
                  Alıcı:
                </label>
                <input
                  type="email"
                  required
                  placeholder="alici@example.com"
                  value={compose.to}
                  onChange={(e) => setCompose({ ...compose, to: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary font-medium"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-secondary uppercase font-label-caps block mb-1">
                  Konu:
                </label>
                <input
                  type="text"
                  required
                  placeholder="E-posta konusu"
                  value={compose.subject}
                  onChange={(e) => setCompose({ ...compose, subject: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary font-medium"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-secondary uppercase font-label-caps block mb-1">
                  İçerik:
                </label>
                <textarea
                  rows={5}
                  required
                  placeholder="Mesajınızı yazın..."
                  value={compose.body}
                  onChange={(e) => setCompose({ ...compose, body: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary resize-none font-medium"
                />
              </div>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCompose(false)}
                  className="px-4 py-2 text-xs font-bold text-secondary hover:bg-surface-container rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="px-6 py-2.5 text-xs font-bold bg-primary text-on-primary rounded-xl shadow-md hover:bg-primary-container transition-colors flex items-center space-x-2 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {sending ? "hourglass_empty" : "send"}
                  </span>
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
    <Suspense
      fallback={
        <div className="min-h-screen bg-background p-6 flex flex-col justify-center items-center">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-secondary">Posta yükleniyor...</p>
        </div>
      }
    >
      <InboxContent />
    </Suspense>
  );
}
