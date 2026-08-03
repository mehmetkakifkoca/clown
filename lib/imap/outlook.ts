/**
 * lib/imap/outlook.ts
 * Hotmail / Outlook.com e-posta okuma ve gönderme
 * IMAP: imap-mail.outlook.com:993 (SSL)
 * SMTP: smtp-mail.outlook.com:587 (STARTTLS)
 */
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

export interface MailCredentials {
  email: string;
  appPassword: string;
}

export interface ParsedEmail {
  id: string;
  uid: number;
  subject: string;
  from: string;
  fromEmail: string;
  to: string;
  date: string;
  snippet: string;
  body: string;
  isRead: boolean;
  hasAttachments: boolean;
  flags: Set<string>;
}

// ─── IMAP: E-postaları Listele ──────────────────────────
export async function fetchInboxEmails(
  creds: MailCredentials,
  limit = 20
): Promise<ParsedEmail[]> {
  const client = new ImapFlow({
    host: "imap-mail.outlook.com",
    port: 993,
    secure: true,
    auth: {
      user: creds.email,
      pass: creds.appPassword,
    },
    logger: false,
  });

  const emails: ParsedEmail[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Son `limit` e-postayı getir (yeniden eskiye)
      const total = client.mailbox ? client.mailbox.exists : 0;
      if (total === 0) return [];
      const from = Math.max(1, total - limit + 1);
      const range = `${from}:${total}`;

      for await (const msg of client.fetch(range, {
        envelope: true,
        bodyStructure: true,
        flags: true,
        bodyParts: ["TEXT"],
      })) {
        const env = msg.envelope;
        const fromAddr = env?.from?.[0];
        const body = msg.bodyParts?.get("TEXT");
        const bodyText = body
          ? Buffer.from(body).toString("utf8").slice(0, 2000)
          : "";

        emails.push({
          id: String(msg.uid),
          uid: msg.uid,
          subject: env?.subject ?? "(Konu yok)",
          from: fromAddr?.name ?? fromAddr?.address ?? "Bilinmiyor",
          fromEmail: fromAddr?.address ?? "",
          to: env?.to?.[0]?.address ?? creds.email,
          date: env?.date?.toLocaleDateString("tr-TR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }) ?? "",
          snippet: bodyText.replace(/\s+/g, " ").trim().slice(0, 160),
          body: bodyText,
          isRead: Boolean(msg.flags?.has("\\Seen")),
          hasAttachments: false,
          flags: msg.flags ?? new Set(),
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return emails.reverse(); // En yeni önce
}

// ─── IMAP: Tek E-postayı Getir ──────────────────────────
export async function fetchEmailById(
  creds: MailCredentials,
  uid: number
): Promise<ParsedEmail | null> {
  const client = new ImapFlow({
    host: "imap-mail.outlook.com",
    port: 993,
    secure: true,
    auth: { user: creds.email, pass: creds.appPassword },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Okundu olarak işaretle
      await client.messageFlagsAdd({ uid }, ["\\Seen"], { uid: true });

      const messages = [];
      for await (const msg of client.fetch(
        { uid },
        { envelope: true, bodyParts: ["TEXT"], flags: true },
        { uid: true }
      )) {
        const env = msg.envelope;
        const fromAddr = env?.from?.[0];
        const body = msg.bodyParts?.get("TEXT");
        const bodyText = body
          ? Buffer.from(body).toString("utf8").slice(0, 10000)
          : "";

        messages.push({
          id: String(msg.uid),
          uid: msg.uid,
          subject: env?.subject ?? "(Konu yok)",
          from: fromAddr?.name ?? fromAddr?.address ?? "Bilinmiyor",
          fromEmail: fromAddr?.address ?? "",
          to: env?.to?.[0]?.address ?? creds.email,
          date: env?.date?.toLocaleString("tr-TR") ?? "",
          snippet: bodyText.slice(0, 200),
          body: bodyText,
          isRead: true,
          hasAttachments: false,
          flags: msg.flags ?? new Set(),
        });
      }

      return messages[0] ?? null;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

// ─── SMTP: E-posta Gönder ───────────────────────────────
export async function sendEmail(
  creds: MailCredentials,
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: "smtp-mail.outlook.com",
    port: 587,
    secure: false, // STARTTLS
    auth: {
      user: creds.email,
      pass: creds.appPassword,
    },
    tls: { ciphers: "SSLv3" },
  });

  await transporter.sendMail({
    from: `"Clown App" <${creds.email}>`,
    to,
    subject,
    text,
    html: html ?? `<p>${text}</p>`,
  });
}

// ─── SMTP: Yanıtla ──────────────────────────────────────
export async function replyToEmail(
  creds: MailCredentials,
  originalFrom: string,
  originalSubject: string,
  replyText: string
): Promise<void> {
  const subject = originalSubject.startsWith("Re:")
    ? originalSubject
    : `Re: ${originalSubject}`;

  await sendEmail(creds, originalFrom, subject, replyText);
}
