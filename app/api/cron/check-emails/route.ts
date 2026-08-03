import { NextResponse } from "next/server";
import webpush from "web-push";
import { getDocs, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { listMailAccounts } from "@/lib/firestore/mailAccounts";
import { fetchGraphMessages } from "@/lib/microsoft-graph";

const PUBLIC_VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BCjcDNJGZB5GlGBIdo3P1kE6c0djIKGJROvtEICWBor1Xze7LxcDChqpYIufLE90ZMcMxBZEWwrg1JCyiU5L1vA";
const PRIVATE_VAPID_KEY = process.env.VAPID_PRIVATE_KEY || "m9HoT-tq2BjGPhgRzA2_H0wJEKIPqxDjyks8fj6xbDo";

webpush.setVapidDetails(
  "mailto:akif@clown.app",
  PUBLIC_VAPID_KEY,
  PRIVATE_VAPID_KEY
);

// GET /api/cron/check-emails (Vercel Cron veya Manuel Tetikleme)
export async function GET() {
  try {
    const accounts = await listMailAccounts();
    const activeAccount = accounts[0];

    if (!activeAccount || !activeAccount.accessToken) {
      return NextResponse.json({ message: "Bağlı e-posta yok." });
    }

    // Okunmamış e-postaları çek
    const messages = await fetchGraphMessages(activeAccount.accessToken, 5);
    const unreadMessages = messages.filter((m: any) => !m.isRead);

    if (unreadMessages.length === 0) {
      return NextResponse.json({ message: "Yeni okunmamış e-posta yok." });
    }

    const latest = unreadMessages[0];
    const payload = JSON.stringify({
      title: `Yeni E-posta: ${latest.from?.emailAddress?.name || "Bilinmeyen Gönderen"}`,
      body: latest.subject || "Yeni e-postanız var.",
      url: `/inbox`,
    });

    // Kayıtlı PWA abonelerine push gönder
    const subSnap = await getDocs(collection(db, "pushSubscriptions"));
    const sendPromises = subSnap.docs.map((docSnap) => {
      const sub = docSnap.data().subscription;
      return webpush.sendNotification(sub, payload).catch((err) => console.error("Push gönderme hatası:", err));
    });

    await Promise.all(sendPromises);

    return NextResponse.json({ success: true, count: unreadMessages.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
