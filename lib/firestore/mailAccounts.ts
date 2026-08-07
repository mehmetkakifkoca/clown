/**
 * lib/firestore/mailAccounts.ts
 * Posta hesabı kimlik bilgilerini Firestore'da sakla (OAuth Token Destekli & IMAP Destekli)
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
  
  // Visibility toggle
  isHidden?: boolean;

  // Feature toggles
  useForMail?: boolean;
  useForCalendar?: boolean;
  
  // OAuth credentials
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  
  // IMAP/SMTP credentials
  appPassword?: string;
  imapHost?: string;
  imapPort?: number;
  smtpHost?: string;
  smtpPort?: number;
  
  createdAt?: string;
  updatedAt?: any;
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
  expiresAt?: number,
  imapHost?: string,
  imapPort?: number,
  smtpHost?: string,
  smtpPort?: number
): Promise<void> {
  await setDoc(doc(db, "mailAccounts", id), {
    email,
    provider,
    label,
    appPassword, // Stored for IMAP
    accessToken,
    refreshToken,
    expiresAt,
    imapHost,
    imapPort,
    smtpHost,
    smtpPort,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function toggleMailAccountVisibility(id: string, isHidden: boolean): Promise<void> {
  await setDoc(doc(db, "mailAccounts", id), { isHidden }, { merge: true });
}

export async function updateMailAccountCapabilities(id: string, useForMail: boolean, useForCalendar: boolean): Promise<void> {
  await setDoc(doc(db, "mailAccounts", id), { useForMail, useForCalendar }, { merge: true });
}

export async function removeMailAccount(id: string): Promise<void> {
  await deleteDoc(doc(db, "mailAccounts", id));
}
