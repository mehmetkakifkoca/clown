/**
 * lib/assistant/tools.ts
 * Claude entegrasyonu için ortak tool tanımları ve çalıştırıcıları.
 * Hem app/api/mcp/[transport]/route.ts (MCP server) hem de
 * app/api/assistant/route.ts (uygulama içi asistan) buradan beslenir.
 * Mevcut lib fonksiyonlarını doğrudan import edip yeniden kullanır —
 * kendi API'sini fetch ile çağırmaz.
 */
import { z } from "zod";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { listMailAccounts, saveMailAccount, type StoredMailAccount } from "@/lib/firestore/mailAccounts";
import {
  fetchGmailMessages,
  sendGmail,
  getValidGoogleAccessToken,
  fetchGoogleCalendarEvents,
  fetchGoogleCalendarList,
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
} from "@/lib/google";
import { fetchGraphMessages, sendGraphMail, refreshAccessToken } from "@/lib/microsoft-graph";
import {
  listAllPages,
  getPage,
  createPage,
  listBlocksByPage,
  replaceBlocksForPage,
  listAllTasks,
  updateTask,
  createStandaloneTask,
  replaceTasksForPage,
  listProjects,
  type NoteBlock,
} from "@/lib/firestore/notesStore";

// ─── Ortak Hesap Çözümleme Yardımcıları ────────────────────────────

async function resolveMailAccount(accountId?: string): Promise<StoredMailAccount> {
  const accounts = await listMailAccounts();
  if (accountId) {
    const found = accounts.find((a) => a.id === accountId);
    if (!found) throw new Error(`Hesap bulunamadı: ${accountId}`);
    return found;
  }
  if (accounts.length === 0) throw new Error("Bağlı e-posta hesabı yok.");
  return accounts[0];
}

async function getValidMailAccessToken(acc: StoredMailAccount): Promise<string> {
  if (acc.provider === "gmail") {
    return getValidGoogleAccessToken(acc);
  }
  // hotmail
  if (acc.expiresAt && Date.now() > acc.expiresAt - 60000 && acc.refreshToken) {
    const newTokens = await refreshAccessToken(acc.refreshToken);
    await saveMailAccount(
      acc.id,
      acc.email,
      "",
      "hotmail",
      acc.label,
      newTokens.access_token,
      newTokens.refresh_token,
      Date.now() + newTokens.expires_in * 1000
    );
    return newTokens.access_token;
  }
  if (!acc.accessToken) throw new Error(`${acc.email} için erişim tokenı yok.`);
  return acc.accessToken;
}

async function getGoogleAccounts(): Promise<StoredMailAccount[]> {
  const accounts = await listMailAccounts();
  return accounts.filter((a) => a.provider === "gmail" && a.accessToken);
}

async function resolveGoogleAccount(accountEmail?: string): Promise<StoredMailAccount> {
  const accounts = await getGoogleAccounts();
  if (accountEmail) {
    const found = accounts.find((a) => a.email === accountEmail);
    if (!found) throw new Error(`Google hesabı bulunamadı: ${accountEmail}`);
    return found;
  }
  if (accounts.length === 0) throw new Error("Bağlı Google hesabı yok.");
  return accounts[0];
}

function blocksToText(blocks: NoteBlock[]): string {
  return blocks
    .map((b) => {
      if (b.blockType === "heading") return `## ${b.content}`;
      if (b.blockType === "checklist") return `- [${b.properties?.checked ? "x" : " "}] ${b.content}`;
      if (b.blockType === "bullet") return `- ${b.content}`;
      if (b.blockType === "quote") return `> ${b.content}`;
      return b.content;
    })
    .join("\n");
}

// ─── Tool Tanımı ────────────────────────────────────────────────────

export interface AssistantTool<Input = any> {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
  run: (input: Input) => Promise<string>;
}

function tool<S extends z.ZodObject<any>>(
  name: string,
  description: string,
  inputSchema: S,
  run: (input: z.infer<S>) => Promise<string>
): AssistantTool {
  return { name, description, inputSchema, run: run as (input: any) => Promise<string> };
}

// ─── Mail Tool'ları ─────────────────────────────────────────────────

const list_mails = tool(
  "list_mails",
  "Bağlı e-posta hesaplarından (Gmail/Hotmail) son mailleri özet alanlarla listeler.",
  z.object({
    accountId: z.string().optional().describe("Belirli bir mailAccounts doküman ID'si. Boş bırakılırsa tüm hesaplar taranır."),
    folder: z.enum(["inbox", "sent", "spam"]).optional().describe("Klasör, varsayılan: inbox."),
    limit: z.number().int().min(1).max(50).optional().describe("Maksimum sonuç sayısı, varsayılan: 10."),
  }),
  async ({ accountId, folder, limit }) => {
    const accounts = await listMailAccounts();
    const targets = accountId ? accounts.filter((a) => a.id === accountId) : accounts;
    if (targets.length === 0) return JSON.stringify({ error: "Bağlı e-posta hesabı bulunamadı." });

    const max = limit || 10;
    const folderFilter = folder || "inbox";
    const results: any[] = [];

    for (const acc of targets) {
      try {
        const token = await getValidMailAccessToken(acc);
        if (acc.provider === "gmail") {
          const gmailFolder = folderFilter === "sent" ? "SENT" : folderFilter === "spam" ? "SPAM" : "INBOX";
          const msgs = await fetchGmailMessages(token, max, gmailFolder);
          results.push(
            ...msgs.map((m: any) => ({
              id: m.id,
              from: m.from,
              subject: m.subject,
              date: m.date,
              snippet: m.snippet,
              isRead: m.isRead,
              accountId: acc.id,
              accountEmail: acc.email,
              provider: "gmail",
            }))
          );
        } else if (acc.provider === "hotmail") {
          const folderPath = folderFilter === "sent" ? "sentitems" : folderFilter === "spam" ? "junkemail" : "inbox";
          const msgs = await fetchGraphMessages(token, max, folderPath);
          results.push(
            ...msgs.map((m: any) => ({
              id: m.id,
              from: m.from?.emailAddress?.name || m.from?.emailAddress?.address || "",
              subject: m.subject || "(Konu yok)",
              date: m.receivedDateTime,
              snippet: m.bodyPreview || "",
              isRead: m.isRead,
              accountId: acc.id,
              accountEmail: acc.email,
              provider: "hotmail",
            }))
          );
        }
      } catch (e: any) {
        results.push({ accountEmail: acc.email, error: e?.message || "Mailler çekilemedi." });
      }
    }

    return JSON.stringify(results.slice(0, max), null, 2);
  }
);

const read_mail = tool(
  "read_mail",
  "Belirli bir e-postanın tam içeriğini (gövde dahil) getirir.",
  z.object({
    uid: z.string().describe("Mailin ID'si (list_mails veya search_mails sonucundaki id)."),
    accountId: z.string().describe("Mailin ait olduğu mailAccounts doküman ID'si."),
  }),
  async ({ uid, accountId }) => {
    const acc = await resolveMailAccount(accountId);
    const token = await getValidMailAccessToken(acc);

    if (acc.provider === "gmail") {
      const msgs = await fetchGmailMessages(token, 50);
      const target = msgs.find((m: any) => m.id === uid);
      if (!target) return JSON.stringify({ error: "E-posta bulunamadı." });
      return JSON.stringify({ ...target, accountEmail: acc.email });
    }

    const msgs = await fetchGraphMessages(token, 50);
    const target = msgs.find((m: any) => m.id === uid);
    if (!target) return JSON.stringify({ error: "E-posta bulunamadı." });
    return JSON.stringify({
      id: target.id,
      subject: target.subject || "(Konu yok)",
      from: target.from?.emailAddress?.name || target.from?.emailAddress?.address || "",
      date: target.receivedDateTime,
      body: target.body?.content || target.bodyPreview || "",
      accountEmail: acc.email,
    });
  }
);

const send_mail = tool(
  "send_mail",
  "Bağlı hesaplardan biriyle e-posta gönderir.",
  z.object({
    to: z.string().describe("Alıcı e-posta adresi."),
    subject: z.string().describe("Konu."),
    body: z.string().describe("E-posta içeriği (düz metin)."),
    accountId: z.string().optional().describe("Gönderen mailAccounts doküman ID'si. Boş bırakılırsa ilk bağlı hesap kullanılır."),
  }),
  async ({ to, subject, body, accountId }) => {
    const acc = await resolveMailAccount(accountId);
    const token = await getValidMailAccessToken(acc);
    if (acc.provider === "gmail") {
      await sendGmail(token, to, subject, body);
    } else {
      await sendGraphMail(token, to, subject, body);
    }
    return JSON.stringify({ success: true, from: acc.email, to, subject });
  }
);

const search_mails = tool(
  "search_mails",
  "Bağlı tüm hesapların gelen kutusunda konu/gönderen/önizleme metnine göre arama yapar.",
  z.object({
    query: z.string().describe("Aranacak metin."),
    limit: z.number().int().min(1).max(50).optional().describe("Maksimum sonuç sayısı, varsayılan: 10."),
  }),
  async ({ query, limit }) => {
    const accounts = await listMailAccounts();
    const needle = query.toLowerCase();
    const max = limit || 10;
    const results: any[] = [];

    for (const acc of accounts) {
      try {
        const token = await getValidMailAccessToken(acc);
        let msgs: any[] = [];
        if (acc.provider === "gmail") {
          msgs = await fetchGmailMessages(token, 30, "INBOX");
        } else {
          const raw = await fetchGraphMessages(token, 30, "inbox");
          msgs = raw.map((m: any) => ({
            id: m.id,
            subject: m.subject || "",
            from: m.from?.emailAddress?.name || m.from?.emailAddress?.address || "",
            snippet: m.bodyPreview || "",
            date: m.receivedDateTime,
            isRead: m.isRead,
          }));
        }
        const filtered = msgs.filter(
          (m) =>
            (m.subject || "").toLowerCase().includes(needle) ||
            (m.from || "").toLowerCase().includes(needle) ||
            (m.snippet || "").toLowerCase().includes(needle)
        );
        results.push(
          ...filtered.map((m) => ({ ...m, accountId: acc.id, accountEmail: acc.email, provider: acc.provider }))
        );
      } catch {
        // hesap hatası arama sonucunu bloklamasın
      }
    }

    return JSON.stringify(results.slice(0, max), null, 2);
  }
);

// ─── Not Tool'ları ──────────────────────────────────────────────────

const list_notes = tool("list_notes", "Tüm not defterlerini/sayfalarını listeler.", z.object({}), async () => {
  const pages = await listAllPages();
  const active = pages
    .filter((p) => !p.deletedAt)
    .map((p) => ({
      id: p.id,
      title: p.title,
      icon: p.icon,
      isFavorite: p.isFavorite,
      isArchived: p.isArchived,
      parentPageId: p.parentPageId,
      updatedAt: p.updatedAt,
    }));
  return JSON.stringify(active, null, 2);
});

const read_note = tool(
  "read_note",
  "Bir not sayfasının tam içeriğini metin olarak getirir.",
  z.object({ pageId: z.string().describe("Sayfa ID'si.") }),
  async ({ pageId }) => {
    const page = await getPage(pageId);
    if (!page || page.deletedAt) return JSON.stringify({ error: "Not bulunamadı." });
    const blocks = await listBlocksByPage(pageId);
    return JSON.stringify({ id: page.id, title: page.title, content: blocksToText(blocks) }, null, 2);
  }
);

const create_note = tool(
  "create_note",
  "Yeni bir not sayfası oluşturur.",
  z.object({
    title: z.string().describe("Not başlığı."),
    content: z.string().optional().describe("Not içeriği (paragraflar çift satır ile ayrılır)."),
  }),
  async ({ title, content }) => {
    const page = await createPage({ title, parentPageId: null, icon: "description", isFavorite: true });
    const paragraphs = (content || "").split("\n\n").filter((p) => p.trim().length > 0);
    const blocks = (paragraphs.length > 0 ? paragraphs : [""]).map((text, i) => ({
      id: `b-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      blockType: "paragraph",
      content: text,
      properties: {},
    }));
    await replaceBlocksForPage(page.id, blocks);
    return JSON.stringify({ id: page.id, title: page.title });
  }
);

const append_to_note = tool(
  "append_to_note",
  "Mevcut bir not sayfasının sonuna yeni bir paragraf ekler.",
  z.object({
    pageId: z.string().describe("Sayfa ID'si."),
    content: z.string().describe("Eklenecek metin."),
  }),
  async ({ pageId, content }) => {
    const page = await getPage(pageId);
    if (!page) return JSON.stringify({ error: "Not bulunamadı." });
    const existing = await listBlocksByPage(pageId);
    const newBlock = {
      id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      blockType: "paragraph",
      content,
      properties: {},
    };
    const allBlocks = [
      ...existing.map((b) => ({ id: b.id, blockType: b.blockType, content: b.content, properties: b.properties })),
      newBlock,
    ];
    await replaceBlocksForPage(pageId, allBlocks);
    return JSON.stringify({ success: true, pageId, addedBlockId: newBlock.id });
  }
);

// ─── Görev Tool'ları ────────────────────────────────────────────────

const list_tasks = tool(
  "list_tasks",
  "Görevleri (opsiyonel olarak duruma göre filtrelenmiş) listeler.",
  z.object({
    status: z.enum(["TODO", "IN_PROGRESS", "ON_HOLD", "DONE", "CANCELLED"]).optional().describe("Durum filtresi."),
  }),
  async ({ status }) => {
    const [tasks, pages, projects] = await Promise.all([listAllTasks(), listAllPages(), listProjects()]);
    const pageMap = new Map(pages.map((p) => [p.id, p.title]));
    const projectMap = new Map(projects.map((p) => [p.id, p.name]));
    const filtered = status ? tasks.filter((t) => t.status === status) : tasks;
    const result = filtered.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      page: t.pageId ? pageMap.get(t.pageId) || null : null,
      project: t.projectId ? projectMap.get(t.projectId) || null : null,
    }));
    return JSON.stringify(result, null, 2);
  }
);

const create_task = tool(
  "create_task",
  "Yeni bir görev oluşturur. pageId verilirse görev o not sayfasına checklist maddesi olarak eklenir, verilmezse bağımsız görev olarak oluşturulur.",
  z.object({
    title: z.string().describe("Görev başlığı."),
    dueDate: z.string().optional().describe("Son tarih, YYYY-MM-DD formatında."),
    pageId: z.string().optional().describe("Görevin ekleneceği not sayfası ID'si."),
  }),
  async ({ title, dueDate, pageId }) => {
    if (pageId) {
      const page = await getPage(pageId);
      if (!page) return JSON.stringify({ error: "Sayfa bulunamadı." });

      const existing = await listBlocksByPage(pageId);
      const blockId = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newBlock = {
        id: blockId,
        blockType: "checklist",
        content: title,
        properties: { checked: false, priority: "NORMAL", dueDate: dueDate || null },
      };
      const allBlocks = [
        ...existing.map((b) => ({ id: b.id, blockType: b.blockType, content: b.content, properties: b.properties })),
        newBlock,
      ];
      await replaceBlocksForPage(pageId, allBlocks);

      const taskBlocks = allBlocks.filter((b) => b.blockType === "checklist");
      const tasksData = taskBlocks.map((b: any) => {
        const props = b.properties || {};
        const isDone = props.checked === true;
        return {
          id: b.id,
          blockId: b.id,
          title: b.content || "Başlıksız Görev",
          description: props.description || null,
          status: isDone ? "DONE" : props.status || "TODO",
          priority: props.priority || "NORMAL",
          dueDate: props.dueDate || null,
          reminderDate: props.reminderDate || null,
          completedAt: isDone ? new Date().toISOString() : null,
          projectId: props.projectId || null,
        };
      });
      await replaceTasksForPage(pageId, tasksData);

      return JSON.stringify({ id: blockId, title, pageId });
    }

    const task = await createStandaloneTask({ title, dueDate: dueDate || null, priority: "NORMAL" });
    return JSON.stringify({ id: task.id, title: task.title });
  }
);

const complete_task = tool(
  "complete_task",
  "Bir görevi tamamlandı olarak işaretler.",
  z.object({ taskId: z.string().describe("Görev ID'si.") }),
  async ({ taskId }) => {
    const task = await updateTask(taskId, { status: "DONE", completedAt: new Date().toISOString() });

    if (task.blockId) {
      const blockRef = doc(db, "noteBlocks", task.blockId);
      const blockSnap = await getDoc(blockRef);
      if (blockSnap.exists()) {
        const props = { ...(blockSnap.data().properties || {}), checked: true, status: "DONE" };
        await updateDoc(blockRef, { content: task.title, properties: props, updatedAt: new Date().toISOString() });
      }
    }

    return JSON.stringify({ id: task.id, title: task.title, status: task.status });
  }
);

// ─── Takvim Tool'ları ───────────────────────────────────────────────

const list_calendar_events = tool(
  "list_calendar_events",
  "Bağlı Google hesaplarının takvim etkinliklerini listeler.",
  z.object({
    days: z.number().int().min(1).max(90).optional().describe("Kaç gün ileriye kadar bakılacağı, varsayılan: 14."),
    calendarId: z.string().optional().describe("Belirli bir takvime göre filtrele."),
  }),
  async ({ days, calendarId }) => {
    const accounts = await getGoogleAccounts();
    if (accounts.length === 0) return JSON.stringify([]);

    const d = days || 14;
    const results = await Promise.all(
      accounts.map(async (acc) => {
        try {
          const token = await getValidGoogleAccessToken(acc);
          const events = await fetchGoogleCalendarEvents(token, d);
          return events.map((e: any) => ({ ...e, accountEmail: acc.email }));
        } catch {
          return [];
        }
      })
    );

    let events = results.flat();
    if (calendarId) events = events.filter((e: any) => e.calendarId === calendarId);

    return JSON.stringify(
      events.map((e: any) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location,
        calendarId: e.calendarId,
        calendarName: e.calendarName,
        accountEmail: e.accountEmail,
      })),
      null,
      2
    );
  }
);

const create_calendar_event = tool(
  "create_calendar_event",
  "Google Takvim'de yeni bir etkinlik oluşturur.",
  z.object({
    title: z.string().describe("Etkinlik başlığı."),
    start: z.string().describe("Başlangıç zamanı, ISO 8601 (örn. 2026-08-10T14:00:00)."),
    end: z.string().describe("Bitiş zamanı, ISO 8601."),
    description: z.string().optional().describe("Açıklama."),
    location: z.string().optional().describe("Konum."),
    calendarId: z.string().optional().describe("Hedef takvim ID'si. Boş bırakılırsa 'primary' kullanılır."),
    accountEmail: z.string().optional().describe("Hangi Google hesabına ekleneceği. Boş bırakılırsa ilk bağlı hesap kullanılır."),
  }),
  async ({ title, start, end, description, location, calendarId, accountEmail }) => {
    const acc = await resolveGoogleAccount(accountEmail);
    const token = await getValidGoogleAccessToken(acc);
    const targetCalendarId = calendarId || "primary";
    const event = await createGoogleCalendarEvent(token, targetCalendarId, {
      title,
      description,
      location,
      start,
      end,
      timeZone: "Europe/Vienna",
    });
    return JSON.stringify({ id: event.id, title, start, end, accountEmail: acc.email, calendarId: targetCalendarId });
  }
);

const delete_calendar_event = tool(
  "delete_calendar_event",
  "Google Takvim'den bir etkinliği siler.",
  z.object({
    eventId: z.string().describe("Silinecek etkinlik ID'si."),
    calendarId: z.string().optional().describe("Etkinliğin bulunduğu takvim ID'si. Boş bırakılırsa 'primary' kullanılır."),
    accountEmail: z.string().optional().describe("Hangi Google hesabından silineceği. Boş bırakılırsa ilk bağlı hesap kullanılır."),
  }),
  async ({ eventId, calendarId, accountEmail }) => {
    const acc = await resolveGoogleAccount(accountEmail);
    const token = await getValidGoogleAccessToken(acc);
    const targetCalendarId = calendarId || "primary";
    await deleteGoogleCalendarEvent(token, targetCalendarId, eventId);
    return JSON.stringify({ success: true, eventId, calendarId: targetCalendarId });
  }
);

// ─── Toplu Liste ve Yardımcılar ─────────────────────────────────────

export const assistantTools: AssistantTool[] = [
  list_mails,
  read_mail,
  send_mail,
  search_mails,
  list_notes,
  read_note,
  create_note,
  append_to_note,
  list_tasks,
  create_task,
  complete_task,
  list_calendar_events,
  create_calendar_event,
  delete_calendar_event,
];

export function getAssistantTool(name: string): AssistantTool | undefined {
  return assistantTools.find((t) => t.name === name);
}

export async function executeAssistantTool(name: string, input: unknown): Promise<string> {
  const t = getAssistantTool(name);
  if (!t) throw new Error(`Bilinmeyen tool: ${name}`);
  const parsed = t.inputSchema.parse(input ?? {});
  return t.run(parsed);
}

const TOOL_LABELS: Record<string, string> = {
  list_mails: "📧 Mailler okunuyor...",
  read_mail: "📧 Mail içeriği okunuyor...",
  send_mail: "📤 Mail gönderiliyor...",
  search_mails: "🔍 Mailler aranıyor...",
  list_notes: "📝 Notlar listeleniyor...",
  read_note: "📝 Not okunuyor...",
  create_note: "📝 Not oluşturuluyor...",
  append_to_note: "📝 Nota ekleniyor...",
  list_tasks: "✅ Görevler listeleniyor...",
  create_task: "✅ Görev oluşturuluyor...",
  complete_task: "✅ Görev tamamlanıyor...",
  list_calendar_events: "📅 Takvim etkinlikleri getiriliyor...",
  create_calendar_event: "📅 Etkinlik oluşturuluyor...",
  delete_calendar_event: "📅 Etkinlik siliniyor...",
};

export function toolLabel(name: string): string {
  return TOOL_LABELS[name] || `🔧 ${name} çalıştırılıyor...`;
}

// Anthropic Messages API tool-use şeması (input_schema JSON Schema bekler)
export const anthropicToolDefinitions = assistantTools.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: z.toJSONSchema(t.inputSchema) as Record<string, unknown>,
}));
