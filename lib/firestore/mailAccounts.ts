/**
 * lib/firestore/mailAccounts.ts
 * Posta hesabı kimlik bilgilerini Firestore'da sakla (OAuth Token Destekli)
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

export interface StoredMailAccount {
  id: string;
  email: string;
  provider: "hotmail" | "gmail" | "imap";
  label: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  createdAt?: string;
}

export async function listMailAccounts(): Promise<StoredMailAccount[]> {
  const snap = await getDocs(collection(db, "mailAccounts"));
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<StoredMailAccount, "id">),
  }));
}

export async function saveMailAccount(
  id: string,
  email: string,
  appPassword = "",
  provider: "hotmail" | "gmail" | "imap" = "hotmail",
  label = "Hotmail",
  accessToken?: string,
  refreshToken?: string,
  expiresAt?: number
): Promise<void> {
  await setDoc(doc(db, "mailAccounts", id), {
    email,
    provider,
    label,
    accessToken,
    refreshToken,
    expiresAt,
    updatedAt: serverTimestamp(),
  });
}

export async function removeMailAccount(id: string): Promise<void> {
  await deleteDoc(doc(db, "mailAccounts", id));
}
