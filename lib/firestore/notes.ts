/**
 * lib/firestore/notes.ts
 * Firestore ile Notlar (Pages & Blocks) CRUD işlemleri
 * Koleksiyon yapısı:
 *   pages/{pageId}
 *   pages/{pageId}/blocks/{blockId}
 */
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─── Tipler ─────────────────────────────────────────────
export interface Page {
  id: string;
  title: string;
  icon: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Block {
  id: string;
  pageId: string;
  type: "heading" | "paragraph" | "checklist";
  content: string;
  checked: boolean;
  order: number;
}

// ─── Sayfalar ────────────────────────────────────────────
export async function listPages(): Promise<Page[]> {
  const q = query(collection(db, "pages"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title ?? "Başlıksız",
      icon: data.icon ?? "description",
      createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
      updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
    };
  });
}

export async function createPage(title: string, icon = "description"): Promise<Page> {
  const ref = await addDoc(collection(db, "pages"), {
    title,
    icon,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  // İlk boş paragraf bloğunu ekle
  await addDoc(collection(db, "pages", ref.id, "blocks"), {
    type: "paragraph",
    content: "",
    checked: false,
    order: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return {
    id: ref.id,
    title,
    icon,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function updatePageTitle(pageId: string, title: string): Promise<void> {
  await updateDoc(doc(db, "pages", pageId), {
    title,
    updatedAt: serverTimestamp(),
  });
}

// ─── Bloklar ─────────────────────────────────────────────
export async function listBlocks(pageId: string): Promise<Block[]> {
  const q = query(
    collection(db, "pages", pageId, "blocks"),
    orderBy("order", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      pageId,
      type: data.type ?? "paragraph",
      content: data.content ?? "",
      checked: data.checked ?? false,
      order: data.order ?? 0,
    };
  });
}

export async function saveBlocks(
  pageId: string,
  title: string,
  blocks: Omit<Block, "pageId">[]
): Promise<void> {
  // Başlığı güncelle
  await updateDoc(doc(db, "pages", pageId), {
    title,
    updatedAt: serverTimestamp(),
  }).catch(() =>
    setDoc(doc(db, "pages", pageId), {
      title,
      icon: "description",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  // Mevcut blokları sil, yenileri yaz
  const existingSnap = await getDocs(collection(db, "pages", pageId, "blocks"));
  const deletePromises = existingSnap.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(deletePromises);

  const writePromises = blocks.map((b, i) =>
    setDoc(doc(db, "pages", pageId, "blocks", b.id), {
      type: b.type,
      content: b.content,
      checked: b.checked,
      order: i,
      updatedAt: serverTimestamp(),
    })
  );
  await Promise.all(writePromises);
}
