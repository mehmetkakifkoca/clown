"use client";

import { useEffect, useRef, useState } from "react";

type Part = { type: "text"; text: string } | { type: "tool"; label: string };

interface ChatMessage {
  role: "user" | "assistant";
  parts: Part[];
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const messageText = (m: ChatMessage) =>
    m.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const history = [...messages, { role: "user" as const, parts: [{ type: "text" as const, text }] }];
    setMessages([...history, { role: "assistant", parts: [] }]);
    setInput("");
    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: messageText(m) })),
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Asistan yanıt vermedi.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const raw of events) {
          const line = raw.trim();
          if (!line.startsWith("data:")) continue;
          const payload = JSON.parse(line.slice(5).trim());

          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (!last || last.role !== "assistant") return prev;

            const parts = [...last.parts];
            if (payload.type === "text") {
              const lastPart = parts[parts.length - 1];
              if (lastPart && lastPart.type === "text") {
                parts[parts.length - 1] = { type: "text", text: lastPart.text + payload.text };
              } else {
                parts.push({ type: "text", text: payload.text });
              }
            } else if (payload.type === "tool_call") {
              parts.push({ type: "tool", label: payload.label });
            } else if (payload.type === "error") {
              setError(payload.error);
            }

            updated[updated.length - 1] = { ...last, parts };
            return updated;
          });
        }
      }
    } catch (err: any) {
      setError(err?.message || "Asistan hatası.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface px-6 md:px-10 lg:px-14 pt-6 pb-28 md:pb-8 flex flex-col">
      {/* Başlık */}
      <header className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
            <span className="text-[11px] font-semibold text-primary uppercase tracking-wider font-label-caps">
              Clown Asistanı
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-headline-lg text-on-surface tracking-tight mt-0.5">
            Asistan
          </h1>
        </div>
      </header>

      {/* Mesaj Geçmişi */}
      <div className="flex-1 max-w-3xl w-full mx-auto space-y-4 overflow-y-auto pb-6">
        {messages.length === 0 && (
          <div className="text-center py-16 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 p-6">
            <span className="material-symbols-outlined text-4xl text-outline mb-2">smart_toy</span>
            <p className="text-sm text-secondary font-medium">
              Mailleriniz, notlarınız, görevleriniz ve takviminiz hakkında bir şeyler sorun.
            </p>
          </div>
        )}

        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                m.role === "user"
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-lowest border border-outline-variant/30 text-on-surface"
              }`}
            >
              {m.parts.length === 0 && m.role === "assistant" && sending && idx === messages.length - 1 ? (
                <span className="flex items-center space-x-1.5 text-secondary">
                  <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce [animation-delay:0.15s]" />
                  <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce [animation-delay:0.3s]" />
                </span>
              ) : (
                m.parts.map((p, pIdx) =>
                  p.type === "tool" ? (
                    <div key={pIdx} className="text-[11px] text-outline italic my-1 flex items-center space-x-1">
                      <span>{p.label}</span>
                    </div>
                  ) : (
                    <span key={pIdx} className="whitespace-pre-wrap leading-relaxed">
                      {p.text}
                    </span>
                  )
                )
              )}
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      {error && (
        <div className="max-w-3xl w-full mx-auto mb-3 px-4 py-2.5 bg-error-container/20 border border-error/30 rounded-xl text-xs text-on-error-container">
          {error}
        </div>
      )}

      {/* Mesaj Girişi */}
      <form
        onSubmit={handleSend}
        className="max-w-3xl w-full mx-auto flex items-end space-x-2.5 p-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-md flex-shrink-0"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
          rows={1}
          placeholder="Bir şey sorun (örn. bugün ne toplantım var?)..."
          className="flex-1 resize-none bg-transparent text-[16px] md:text-sm text-on-surface focus:outline-none py-2 px-1 max-h-32"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-primary text-on-primary rounded-xl shadow-sm disabled:opacity-50 hover:bg-primary-container transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">send</span>
        </button>
      </form>
    </div>
  );
}
