import { NextResponse } from "next/server";
import { saveMailAccount, listMailAccounts, removeMailAccount } from "@/lib/firestore/mailAccounts";

// GET /api/mail/accounts → bağlı hesapları listele
export async function GET() {
  try {
    const accounts = await listMailAccounts();
    // Şifreyi döndürme
    const safe = accounts.map(({ id, email, provider, label }) => ({
      id, email, provider, label,
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
    const { email, appPassword, label } = await request.json();
    if (!email || !appPassword) {
      return NextResponse.json({ error: "E-posta ve uygulama şifresi zorunludur" }, { status: 400 });
    }

    const id = `hotmail_${email.replace(/[@.]/g, "_")}`;
    await saveMailAccount(id, email, appPassword, "hotmail", label ?? "Hotmail");
    return NextResponse.json({ success: true, id });
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
