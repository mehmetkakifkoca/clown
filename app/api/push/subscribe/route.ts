import { NextResponse } from "next/server";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function POST(request: Request) {
  try {
    const subscription = await request.json();
    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: "Geçersiz abonelik" }, { status: 400 });
    }

    const id = Buffer.from(subscription.endpoint).toString("base64url").slice(-40);
    await setDoc(doc(db, "pushSubscriptions", id), {
      subscription,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
