/**
 * lib/imap/client.ts
 * Genel IMAP/SMTP istemcisi — All-Inkl, Yandex ve diğer özel sunucular için.
 * Sunucu bilgileri (host/port) hesaba göre değişir, bu yüzden lib/imap/outlook.ts'in
 * aksine host burada sabit değil, hesap kaydından (imapHost/smtpHost) gelir.
 */
import { ImapFlow, type MailboxObject, type MessageStructureObject } from "imapflow";
import nodemailer from "nodemailer";

export interface ImapCredentials {
  email: string;
  appPassword: string;
  imapHost: string;
  imapPort?: number;
  smtpHost?: string;
  smtpPort?: number;
}

export interface ImapAttachmentInfo {
  part: string;
  filename?: string;
  contentType: string;
  size?: number;
}

export interface ParsedImapEmail {
  uid: number;
  mailbox: string;
  subject: string;
  from: string;
  fromEmail: string;
  to: string;
  date: string;
  rawDate: number;
  snippet: string;
  body: string;
  isRead: boolean;
  hasAttachments: boolean;
  attachments?: ImapAttachmentInfo[];
}

type FolderKind = "inbox" | "sent" | "spam";

const SENT_NAME_CANDIDATES = ["Sent", "Sent Items", "Sent Messages", "INBOX.Sent", "Gesendet", "INBOX.Gesendet"];
const SPAM_NAME_CANDIDATES = ["Junk", "Spam", "Junk E-Mail", "INBOX.Junk", "INBOX.Spam"];

function makeImapClient(creds: ImapCredentials): ImapFlow {
  return new ImapFlow({
    host: creds.imapHost,
    port: creds.imapPort || 993,
    secure: true,
    auth: { user: creds.email, pass: creds.appPassword },
    logger: false,
  });
}

// Klasör adı sunucudan sunucuya değişir (INBOX.Sent, Gesendet, Sent Items...).
// Önce IMAP'in \Sent / \Junk özel bayrağına, olmazsa yaygın isimlere bakarak eşleştiriyoruz.
async function resolveMailboxPath(client: ImapFlow, folder: FolderKind): Promise<string> {
  if (folder === "inbox") return "INBOX";

  const specialUse = folder === "sent" ? "\\Sent" : "\\Junk";
  const nameCandidates = folder === "sent" ? SENT_NAME_CANDIDATES : SPAM_NAME_CANDIDATES;

  const list = await client.list();
  const bySpecialUse = list.find((b) => b.specialUse === specialUse);
  if (bySpecialUse) return bySpecialUse.path;

  const byName = list.find((b) => nameCandidates.includes(b.path) || nameCandidates.includes(b.name));
  if (byName) return byName.path;

  return nameCandidates[0];
}

// ─── MIME ağacını gezip HTML/metin gövdesini ve resim/ek parçalarını bulur ──
interface MimePartRef {
  part: string;
  type: string;
  contentId?: string;
  filename?: string;
  size?: number;
  encoding?: string;
  charset?: string;
}

interface ResolvedParts {
  html?: MimePartRef;
  text?: MimePartRef;
  images: MimePartRef[]; // inline (Content-ID'li) resimler dahil tüm image/* parçaları
  attachments: MimePartRef[]; // gerçek ekler (inline olmayan)
  isMultipart: boolean;
}

function walkStructure(node: MessageStructureObject | undefined, out: ResolvedParts) {
  if (!node) return;
  if (node.childNodes && node.childNodes.length) {
    for (const child of node.childNodes) walkStructure(child, out);
    return;
  }
  if (!node.part) return;

  const type = (node.type || "").toLowerCase();
  const isAttachmentDisposition = node.disposition === "attachment";
  const contentId = node.id ? node.id.replace(/^<|>$/g, "") : undefined;
  const filename = node.dispositionParameters?.filename || node.parameters?.name;
  const ref: MimePartRef = { part: node.part, type, contentId, filename, size: node.size, encoding: node.encoding, charset: node.parameters?.charset };

  if (type === "text/html" && !isAttachmentDisposition && !out.html) {
    out.html = ref;
  } else if (type === "text/plain" && !isAttachmentDisposition && !out.text) {
    out.text = ref;
  } else if (type.startsWith("image/")) {
    out.images.push(ref);
    if (isAttachmentDisposition || !contentId) out.attachments.push(ref);
  } else if (isAttachmentDisposition || filename) {
    out.attachments.push(ref);
  }
}

function resolveParts(bodyStructure: MessageStructureObject | undefined): ResolvedParts {
  const out: ResolvedParts = { images: [], attachments: [], isMultipart: false };
  if (!bodyStructure) return out;

  const isMultipart = Boolean(bodyStructure.childNodes && bodyStructure.childNodes.length);
  out.isMultipart = isMultipart;

  if (!isMultipart) {
    // Tek parçalı mesaj: gövdenin tamamı bu parça, IMAP'in "TEXT" kısayolu ile erişilir
    const type = (bodyStructure.type || "").toLowerCase();
    const ref: MimePartRef = { part: "TEXT", type, encoding: bodyStructure.encoding, charset: bodyStructure.parameters?.charset };
    if (type === "text/html") out.html = ref;
    else out.text = ref;
    return out;
  }

  walkStructure(bodyStructure, out);
  return out;
}

// client.fetchOne + bodyParts, client.download()'ın aksine Content-Transfer-Encoding'i
// otomatik çözmez; bu yüzden "quoted-printable" ve "base64" gövdeleri elle çözüyoruz.
function decodeQuotedPrintable(raw: Buffer): Buffer {
  const str = raw.toString("latin1"); // 1 bayt = 1 karakter, ham baytları korur
  const cleaned = str.replace(/=\r\n/g, "").replace(/=\n/g, ""); // yumuşak satır sonları
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(cleaned.substr(i + 1, 2))) {
      bytes.push(parseInt(cleaned.substr(i + 1, 2), 16));
      i += 2;
    } else {
      bytes.push(cleaned.charCodeAt(i));
    }
  }
  return Buffer.from(bytes);
}

function decodeBodyBuffer(raw: Buffer, encoding?: string, charset?: string): string {
  const enc = (encoding || "").toLowerCase();
  let bytes: Buffer;
  if (enc === "quoted-printable") {
    bytes = decodeQuotedPrintable(raw);
  } else if (enc === "base64") {
    bytes = Buffer.from(raw.toString("utf8").replace(/[^A-Za-z0-9+/=]/g, ""), "base64");
  } else {
    bytes = raw;
  }
  const cs = (charset || "utf-8").toLowerCase();
  const nodeEncoding: BufferEncoding = cs.includes("8859") || cs.includes("latin") || cs.includes("ansi") ? "latin1" : "utf8";
  return bytes.toString(nodeEncoding);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtmlTags(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
}

// Çok parçalı (multipart) mesajlarda "TEXT" bölümü ham MIME içeriği (sınır çizgileri,
// Content-Type başlıkları, base64/QP gövdeler karışık) döndürür. Bu fonksiyon HENÜZ
// ÇÖZÜLMEMİŞ ham metin üzerinde çalışır (önce ayıklama, sonra çözme sırası önemli —
// QP'yi baştan çözmek base64 gövdelerin sonundaki "=" dolgusunu "yumuşak satır sonu"
// sanıp bir sonraki sınır satırıyla birleştirebiliyor ve ayrıştırmayı bozuyor).
function isolateBestPartRawText(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const kept: string[] = [];
  let skippingHeader = false;
  let skippingBase64Body = false; // base64 gövdeler önizlemede anlamsız kaldığı için tamamen atlanır
  for (const line of lines) {
    if (/^--/.test(line.trim())) { skippingHeader = false; skippingBase64Body = false; continue; }
    if (/^Content-Transfer-Encoding:\s*base64/i.test(line)) { skippingHeader = true; skippingBase64Body = true; continue; }
    if (/^(Content-Type|Content-Transfer-Encoding|Content-Disposition|MIME-Version):/i.test(line)) { skippingHeader = true; continue; }
    if (skippingHeader && line.trim() === "") { skippingHeader = false; continue; }
    if (skippingHeader) continue;
    if (skippingBase64Body) continue;
    kept.push(line);
  }
  return kept.join("\r\n");
}

export async function fetchImapMessages(
  creds: ImapCredentials,
  folder: FolderKind = "inbox",
  limit = 20
): Promise<ParsedImapEmail[]> {
  const client = makeImapClient(creds);
  const emails: ParsedImapEmail[] = [];

  try {
    await client.connect();
    const mailboxPath = await resolveMailboxPath(client, folder);
    const lock = await client.getMailboxLock(mailboxPath);

    try {
      const mailbox = client.mailbox as MailboxObject | false;
      const total = mailbox ? mailbox.exists : 0;
      if (total === 0) return [];

      const from = Math.max(1, total - limit + 1);
      const range = `${from}:${total}`;

      for await (const msg of client.fetch(range, {
        envelope: true,
        flags: true,
        bodyStructure: true,
        bodyParts: ["TEXT"],
      })) {
        const env = msg.envelope;
        const fromAddr = env?.from?.[0];
        const rawBody = msg.bodyParts?.get("text");
        const parts = resolveParts(msg.bodyStructure);
        const bestPart = parts.html || parts.text;
        // Önizleme metni: çok parçalı mesajlarda önce diğer alt parçalar (ör. base64 düz
        // metin alternatifi) ham metinden ayıklanır, ANCAK ÇÖZÜLMEDEN — çünkü QP çözme
        // base64 gövdenin sonundaki "=" dolgusunu yumuşak satır sonu sanıp bir sonraki
        // MIME sınırıyla birleştirebiliyor ve ayrıştırmayı bozuyor. Ayıklamadan sonra
        // ana parçanın kendi kodlamasına (quoted-printable/base64) göre çözülür.
        let cleanText = "";
        if (rawBody) {
          const rawStr = Buffer.from(rawBody).toString("latin1");
          const isolated = parts.isMultipart ? isolateBestPartRawText(rawStr) : rawStr;
          const decoded = decodeBodyBuffer(Buffer.from(isolated, "latin1"), bestPart?.encoding, bestPart?.charset);
          cleanText = bestPart?.type === "text/html" ? stripHtmlTags(decoded) : decoded;
          cleanText = cleanText.slice(0, 1000);
        }

        emails.push({
          uid: msg.uid,
          mailbox: mailboxPath,
          subject: env?.subject ?? "(Konu yok)",
          from: fromAddr?.name ?? fromAddr?.address ?? "Bilinmiyor",
          fromEmail: fromAddr?.address ?? "",
          to: env?.to?.[0]?.address ?? creds.email,
          date: env?.date?.toLocaleString("tr-TR") ?? "",
          rawDate: env?.date ? env.date.getTime() : Date.now(),
          snippet: cleanText.replace(/\s+/g, " ").trim().slice(0, 160),
          body: cleanText,
          isRead: Boolean(msg.flags?.has("\\Seen")),
          hasAttachments: parts.attachments.length > 0,
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  return emails.reverse(); // En yeni önce
}

export async function fetchImapMessageById(
  creds: ImapCredentials,
  mailboxPath: string,
  uid: number
): Promise<ParsedImapEmail | null> {
  const client = makeImapClient(creds);

  try {
    await client.connect();
    const lock = await client.getMailboxLock(mailboxPath);

    try {
      await client.messageFlagsAdd({ uid }, ["\\Seen"], { uid: true });

      const msg = await client.fetchOne(String(uid), { envelope: true, bodyStructure: true, flags: true }, { uid: true });
      if (!msg) return null;

      const env = msg.envelope;
      const fromAddr = env?.from?.[0];
      const parts = resolveParts(msg.bodyStructure);

      let html = "";
      let text = "";

      if (!parts.isMultipart) {
        // Tek parçalı (multipart olmayan) mesajlarda downloadMany "TEXT" bölümüne ".MIME"
        // eki ekliyor ki bu geçersiz bir IMAP komutu oluşturup bazı sunucularda (ör. All-Inkl)
        // "Invalid BODY[..] section" hatasına yol açıyor. Bunun yerine düz fetch kullanılır.
        const plain = await client.fetchOne(String(uid), { bodyParts: ["TEXT"] }, { uid: true });
        const raw = plain && plain.bodyParts?.get("text");
        const partRef = parts.html || parts.text;
        const rawStr = raw ? decodeBodyBuffer(Buffer.from(raw), partRef?.encoding, partRef?.charset) : "";
        if (parts.html) html = rawStr; else text = rawStr;
      } else {
        // Çok parçalı mesajlarda HTML/metin gövdesi ve satır içi (inline) resimleri tek seferde indir
        const partsToDownload = [
          ...(parts.html ? [parts.html.part] : []),
          ...(!parts.html && parts.text ? [parts.text.part] : []),
          ...parts.images.filter((img) => img.contentId).map((img) => img.part),
        ];

        if (partsToDownload.length) {
          const downloaded = await client.downloadMany(String(uid), partsToDownload, { uid: true });

          if (parts.html && downloaded[parts.html.part]?.content) {
            html = downloaded[parts.html.part].content!.toString("utf8");
          } else if (parts.text && downloaded[parts.text.part]?.content) {
            text = downloaded[parts.text.part].content!.toString("utf8");
          }

          // cid: ile referans verilen satır içi resimleri base64 data URI olarak gövdeye göm
          if (html) {
            for (const img of parts.images) {
              if (!img.contentId) continue;
              const dl = downloaded[img.part];
              if (!dl?.content) continue;
              const dataUri = `data:${img.type};base64,${dl.content.toString("base64")}`;
              const escapedCid = img.contentId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              html = html.replace(new RegExp(`cid:${escapedCid}`, "gi"), dataUri);
            }
          }
        }
      }

      const bodyHtml = html || (text ? `<pre style="white-space:pre-wrap;font-family:inherit;margin:0">${escapeHtml(text)}</pre>` : "");
      const plainSnippet = (text || stripHtmlTags(html)).replace(/\s+/g, " ").trim();

      return {
        uid: msg.uid,
        mailbox: mailboxPath,
        subject: env?.subject ?? "(Konu yok)",
        from: fromAddr?.name ?? fromAddr?.address ?? "Bilinmiyor",
        fromEmail: fromAddr?.address ?? "",
        to: env?.to?.[0]?.address ?? creds.email,
        date: env?.date?.toLocaleString("tr-TR") ?? "",
        rawDate: env?.date ? env.date.getTime() : Date.now(),
        snippet: plainSnippet.slice(0, 200),
        body: bodyHtml,
        isRead: true,
        hasAttachments: parts.attachments.length > 0,
        attachments: parts.attachments.map((a) => ({ part: a.part, filename: a.filename, contentType: a.type, size: a.size })),
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

export interface DownloadedAttachment {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

export async function downloadImapAttachment(
  creds: ImapCredentials,
  mailboxPath: string,
  uid: number,
  part: string
): Promise<DownloadedAttachment> {
  const client = makeImapClient(creds);

  try {
    await client.connect();
    const lock = await client.getMailboxLock(mailboxPath);

    try {
      const { meta, content } = await client.download(String(uid), part, { uid: true });
      const chunks: Buffer[] = [];
      for await (const chunk of content) {
        chunks.push(chunk as Buffer);
      }
      return {
        buffer: Buffer.concat(chunks),
        contentType: meta.contentType || "application/octet-stream",
        filename: meta.filename || "dosya",
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function sendImapMail(
  creds: ImapCredentials,
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<void> {
  const port = creds.smtpPort || 465;
  const transporter = nodemailer.createTransport({
    host: creds.smtpHost,
    port,
    secure: port === 465,
    auth: {
      user: creds.email,
      pass: creds.appPassword,
    },
  });

  await transporter.sendMail({
    from: creds.email,
    to,
    subject,
    text,
    html: html ?? `<p>${text}</p>`,
  });
}
