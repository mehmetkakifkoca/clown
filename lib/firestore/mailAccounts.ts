/**
 * lib/firestore/mailAccounts.ts
 * Posta hesabı kimlik bilgilerini Firestore'da sakla
 */
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { MailCredentials } from "@/lib/imap/outlook";

export interface StoredMailAccount {
  id: string;
  email: string;
  appPassword: string; // Gerçek uygulamada şifrelenmiş olmalı
  provider: "hotmail" | "gmail" | "imap";
  label: string;
  createdAt: Date;
}

// Tüm bağlı hesapları listele
export async function listMailAccounts(): Promise<StoredMailAccount[]> {
  const snap = await getDocs(collection(db, "mailAccounts"));
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<StoredMailAccount, "id">),
  }));
}

// Hesap ekle / güncelle
export async function saveMailAccount(
  id: string,
  email: string,
  appPassword: string,
  provider: "hotmail" | "gmail" | "imap" = "hotmail",
  label = "Hotmail"
): Promise<void> {
  await setDoc(doc(db, "mailAccounts", id), {
    email,
    appPassword,
    provider,
    label,
    createdAt: serverTimestamp(),
  });
}

// Hesabı sil
export async function removeMailAccount(id: string): Promise<void> {
  await deleteDoc(doc(db, "mailAccounts", id));
}

// Tek hesabı getir
export async function getMailAccount(
  id: string
): Promise<StoredMailAccount | null> {
  const snap = await getDoc(doc(db, "mailAccounts", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<StoredMailAccount, "id">) };
}

// İlk kayıtlı hesabı getir (varsayılan)
export async function getDefaultMailAccount(): Promise<MailCredentials | null> {
  const accounts = await listMailAccounts();
  if (accounts.length === 0) return null;
  const acc = accounts[0];
  return { email: acc.email, appPassword: acc.appPassword };
}
