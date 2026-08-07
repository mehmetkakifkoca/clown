import { NextResponse } from "next/server";
import { saveMailAccount, listMailAccounts, removeMailAccount, toggleMailAccountVisibility, updateMailAccountCapabilities, renameMailAccount } from "@/lib/firestore/mailAccounts";

// GET /api/mail/accounts → bağlı hesapları listele
export async function GET() {
  try {
    const accounts = await listMailAccounts();
    const safe = accounts.map(({ id, email, provider, label, isHidden, useForMail, useForCalendar }) => ({
      id, email, provider, label, isHidden, useForMail, useForCalendar,
    }));
    return NextResponse.json(safe);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/mail/accounts → yeni hesap ekle
export async function POST(request: Request) {
  try {
    const { email, appPassword, label, provider, imapHost, imapPort, smtpHost, smtpPort } = await request.json();
    if (!email || !appPassword) {
      return NextResponse.json({ error: "E-posta ve şifre zorunludur" }, { status: 400 });
    }

    const accProvider = provider || "hotmail";
    const id = `${accProvider}_${email.replace(/[@.]/g, "_")}`;
    
    await saveMailAccount(
      id, 
      email, 
      appPassword, 
      accProvider, 
      label ?? (accProvider === "imap" ? "Webmail" : "Hotmail"),
      undefined, // accessToken
      undefined, // refreshToken
      undefined, // expiresAt
      imapHost,
      Number(imapPort) || undefined,
      smtpHost,
      Number(smtpPort) || undefined
    );
    
    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/mail/accounts → görünürlüğü veya özellikleri değiştir
export async function PATCH(request: Request) {
  try {
    const { id, isHidden, useForMail, useForCalendar, label } = await request.json();
    if (!id) return NextResponse.json({ error: "ID gerekli" }, { status: 400 });

    if (typeof isHidden !== "undefined") {
      await toggleMailAccountVisibility(id, Boolean(isHidden));
    }
    if (typeof useForMail !== "undefined" || typeof useForCalendar !== "undefined") {
      await updateMailAccountCapabilities(id, {
        ...(typeof useForMail !== "undefined" && { useForMail: Boolean(useForMail) }),
        ...(typeof useForCalendar !== "undefined" && { useForCalendar: Boolean(useForCalendar) }),
      });
    }
    if (typeof label === "string") {
      const trimmed = label.trim();
      if (!trimmed) return NextResponse.json({ error: "İsim boş olamaz" }, { status: 400 });
      await renameMailAccount(id, trimmed);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/mail/accounts?id=xxx → hesabı kaldır
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID gerekli" }, { status: 400 });
    await removeMailAccount(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
