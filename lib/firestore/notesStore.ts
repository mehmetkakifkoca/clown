/**
 * lib/firestore/notesStore.ts
 * Notlar, Görevler ve Projeler için Firestore CRUD katmanı.
 * Koleksiyonlar: notePages, noteBlocks, noteTasks, noteProjects,
 *                noteLabels, noteLabelRelations, notePageVersions, noteRecentItems
 *
 * Tüm tarihler ISO string olarak saklanır (Firestore Timestamp yerine),
 * böylece API route'ları doğrudan NextResponse.json() ile serileştirebilir.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const nowIso = () => new Date().toISOString();

// ─── Sayfalar (Pages / Not Defterleri) ─────────────────────────────
export interface NotePage {
  id: string;
  userId: string;
  parentPageId: string | null;
  title: string;
  icon: string;
  coverImage: string | null;
  sortOrder: number;
  isArchived: boolean;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  deletedAt: string | null;
}

const PAGES = "notePages";

export async function listAllPages(): Promise<NotePage[]> {
  const snap = await getDocs(collection(db, PAGES));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NotePage, "id">) }));
}

export async function getPage(id: string): Promise<NotePage | null> {
  const snap = await getDoc(doc(db, PAGES, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<NotePage, "id">) };
}

export async function createPage(data: {
  title: string;
  parentPageId: string | null;
  icon: string;
  coverImage?: string | null;
  isFavorite: boolean;
}): Promise<NotePage> {
  const ts = nowIso();
  const payload = {
    userId: "akif",
    parentPageId: data.parentPageId,
    title: data.title,
    icon: data.icon,
    coverImage: data.coverImage ?? null,
    sortOrder: 0,
    isArchived: false,
    isFavorite: data.isFavorite,
    createdAt: ts,
    updatedAt: ts,
    lastOpenedAt: null,
    deletedAt: null,
  };
  const ref = await addDoc(collection(db, PAGES), payload);
  return { id: ref.id, ...payload };
}

export async function updatePage(id: string, data: Partial<Omit<NotePage, "id">>): Promise<NotePage> {
  await updateDoc(doc(db, PAGES, id), { ...data, updatedAt: nowIso() });
  const updated = await getPage(id);
  if (!updated) throw new Error("Sayfa bulunamadı");
  return updated;
}

export async function deletePageHard(id: string): Promise<void> {
  await deleteDoc(doc(db, PAGES, id));
}

export async function listChildPages(parentPageId: string): Promise<NotePage[]> {
  const q = query(collection(db, PAGES), where("parentPageId", "==", parentPageId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NotePage, "id">) }));
}

export async function setDeletedAtForChildPages(parentPageId: string, deletedAt: string | null): Promise<void> {
  const children = await listChildPages(parentPageId);
  const batch = writeBatch(db);
  children.forEach((c) => batch.update(doc(db, PAGES, c.id), { deletedAt, updatedAt: nowIso() }));
  await batch.commit();
}

// ─── Bloklar ─────────────────────────────────────────────────────
export interface NoteBlock {
  id: string;
  pageId: string;
  parentBlockId: string | null;
  blockType: string;
  content: string;
  properties: Record<string, any>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

const BLOCKS = "noteBlocks";

export async function listBlocksByPage(pageId: string): Promise<NoteBlock[]> {
  const q = query(collection(db, BLOCKS), where("pageId", "==", pageId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<NoteBlock, "id">) }))
    .filter((b) => !b.deletedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function replaceBlocksForPage(
  pageId: string,
  blocks: Array<{
    id: string;
    blockType: string;
    content: string;
    properties: Record<string, any>;
  }>
): Promise<void> {
  const existing = await getDocs(query(collection(db, BLOCKS), where("pageId", "==", pageId)));
  const batch = writeBatch(db);
  existing.docs.forEach((d) => batch.delete(d.ref));
  const ts = nowIso();
  blocks.forEach((b, index) => {
    batch.set(doc(db, BLOCKS, b.id), {
      pageId,
      parentBlockId: null,
      blockType: b.blockType,
      content: b.content,
      properties: b.properties || {},
      sortOrder: index,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    });
  });
  await batch.commit();
}

export async function deleteBlocksByPage(pageId: string): Promise<void> {
  const snap = await getDocs(query(collection(db, BLOCKS), where("pageId", "==", pageId)));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

export async function searchBlocksByContent(q: string): Promise<NoteBlock[]> {
  const snap = await getDocs(collection(db, BLOCKS));
  const needle = q.toLowerCase();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<NoteBlock, "id">) }))
    .filter((b) => !b.deletedAt && b.content.toLowerCase().includes(needle));
}

// ─── Görevler (Tasks) ───────────────────────────────────────────────
export interface NoteTask {
  id: string;
  userId: string;
  pageId: string | null;
  blockId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  reminderDate: string | null;
  completedAt: string | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

const TASKS = "noteTasks";

export async function listAllTasks(): Promise<NoteTask[]> {
  const snap = await getDocs(collection(db, TASKS));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<NoteTask, "id">) }))
    .filter((t) => !t.deletedAt);
}

export async function getTask(id: string): Promise<NoteTask | null> {
  const snap = await getDoc(doc(db, TASKS, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<NoteTask, "id">) };
}

export async function createStandaloneTask(data: {
  title: string;
  description?: string | null;
  priority?: string;
  dueDate?: string | null;
  reminderDate?: string | null;
  projectId?: string | null;
}): Promise<NoteTask> {
  const ts = nowIso();
  const payload = {
    userId: "akif",
    pageId: null,
    blockId: null,
    title: data.title,
    description: data.description ?? null,
    status: "TODO",
    priority: data.priority || "NORMAL",
    dueDate: data.dueDate ?? null,
    reminderDate: data.reminderDate ?? null,
    completedAt: null,
    projectId: data.projectId ?? null,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
  const ref = await addDoc(collection(db, TASKS), payload);
  return { id: ref.id, ...payload };
}

export async function updateTask(id: string, data: Partial<Omit<NoteTask, "id">>): Promise<NoteTask> {
  await updateDoc(doc(db, TASKS, id), { ...data, updatedAt: nowIso() });
  const updated = await getTask(id);
  if (!updated) throw new Error("Görev bulunamadı");
  return updated;
}

export async function softDeleteTask(id: string): Promise<void> {
  await updateDoc(doc(db, TASKS, id), { deletedAt: nowIso() });
}

export async function replaceTasksForPage(
  pageId: string,
  tasks: Array<{
    id: string;
    blockId: string;
    title: string;
    description?: string | null;
    status: string;
    priority: string;
    dueDate: string | null;
    reminderDate?: string | null;
    completedAt: string | null;
    projectId: string | null;
  }>
): Promise<void> {
  const existing = await getDocs(query(collection(db, TASKS), where("pageId", "==", pageId)));
  const batch = writeBatch(db);
  existing.docs.forEach((d) => batch.delete(d.ref));
  const ts = nowIso();
  tasks.forEach((t) => {
    batch.set(doc(db, TASKS, t.id), {
      userId: "akif",
      pageId,
      blockId: t.blockId,
      title: t.title,
      description: t.description ?? null,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      reminderDate: t.reminderDate ?? null,
      completedAt: t.completedAt,
      projectId: t.projectId,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    });
  });
  await batch.commit();
}

export async function deleteTasksByPage(pageId: string): Promise<void> {
  const snap = await getDocs(query(collection(db, TASKS), where("pageId", "==", pageId)));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

export async function clearProjectFromTasks(projectId: string): Promise<void> {
  const snap = await getDocs(query(collection(db, TASKS), where("projectId", "==", projectId)));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { projectId: null, updatedAt: nowIso() }));
  await batch.commit();
}

// ─── Projeler ────────────────────────────────────────────────────
export interface NoteProject {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon: string;
  isArchived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

const PROJECTS = "noteProjects";

export async function listProjects(): Promise<NoteProject[]> {
  const snap = await getDocs(collection(db, PROJECTS));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NoteProject, "id">) }));
}

export async function createProject(data: { name: string; color?: string; icon?: string }): Promise<NoteProject> {
  const ts = nowIso();
  const payload = {
    userId: "akif",
    name: data.name,
    color: data.color || "#6366f1",
    icon: data.icon || "folder",
    isArchived: false,
    sortOrder: 0,
    createdAt: ts,
    updatedAt: ts,
  };
  const ref = await addDoc(collection(db, PROJECTS), payload);
  return { id: ref.id, ...payload };
}

export async function updateProject(id: string, data: Partial<Omit<NoteProject, "id">>): Promise<NoteProject> {
  await updateDoc(doc(db, PROJECTS, id), { ...data, updatedAt: nowIso() });
  const snap = await getDoc(doc(db, PROJECTS, id));
  if (!snap.exists()) throw new Error("Proje bulunamadı");
  return { id: snap.id, ...(snap.data() as Omit<NoteProject, "id">) };
}

export async function deleteProject(id: string): Promise<void> {
  await deleteDoc(doc(db, PROJECTS, id));
  await clearProjectFromTasks(id);
}

// ─── Etiketler (Labels) ────────────────────────────────────────────
export interface NoteLabel {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

const LABELS = "noteLabels";

export async function listLabels(): Promise<NoteLabel[]> {
  const snap = await getDocs(collection(db, LABELS));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<NoteLabel, "id">) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function findLabelByName(name: string): Promise<NoteLabel | null> {
  const q = query(collection(db, LABELS), where("name", "==", name));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<NoteLabel, "id">) };
}

export async function upsertLabel(name: string, color: string): Promise<NoteLabel> {
  const existing = await findLabelByName(name);
  const ts = nowIso();
  if (existing) {
    await updateDoc(doc(db, LABELS, existing.id), { color, updatedAt: ts });
    return { ...existing, color, updatedAt: ts };
  }
  const payload = { userId: "akif", name, color, createdAt: ts, updatedAt: ts };
  const ref = await addDoc(collection(db, LABELS), payload);
  return { id: ref.id, ...payload };
}

export async function updateLabel(id: string, data: { name?: string; color?: string }): Promise<NoteLabel> {
  await updateDoc(doc(db, LABELS, id), { ...data, updatedAt: nowIso() });
  const snap = await getDoc(doc(db, LABELS, id));
  if (!snap.exists()) throw new Error("Etiket bulunamadı");
  return { id: snap.id, ...(snap.data() as Omit<NoteLabel, "id">) };
}

export async function deleteLabel(id: string): Promise<void> {
  await deleteDoc(doc(db, LABELS, id));
  const relSnap = await getDocs(query(collection(db, "noteLabelRelations"), where("labelId", "==", id)));
  const batch = writeBatch(db);
  relSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ─── Etiket İlişkileri (Label Relations) ───────────────────────────
export interface NoteLabelRelation {
  id: string;
  labelId: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

const LABEL_RELATIONS = "noteLabelRelations";

export async function listRelationsForEntity(entityId: string, entityType: string): Promise<NoteLabelRelation[]> {
  const q = query(collection(db, LABEL_RELATIONS), where("entityId", "==", entityId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<NoteLabelRelation, "id">) }))
    .filter((r) => r.entityType === entityType);
}

export async function listRelationsForLabel(labelId: string): Promise<NoteLabelRelation[]> {
  const q = query(collection(db, LABEL_RELATIONS), where("labelId", "==", labelId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NoteLabelRelation, "id">) }));
}

export async function findRelation(
  labelId: string,
  entityType: string,
  entityId: string
): Promise<NoteLabelRelation | null> {
  const q = query(collection(db, LABEL_RELATIONS), where("labelId", "==", labelId));
  const snap = await getDocs(q);
  const match = snap.docs.find((d) => {
    const data = d.data();
    return data.entityType === entityType && data.entityId === entityId;
  });
  if (!match) return null;
  return { id: match.id, ...(match.data() as Omit<NoteLabelRelation, "id">) };
}

export async function createRelation(
  labelId: string,
  entityType: string,
  entityId: string
): Promise<NoteLabelRelation> {
  const payload = { labelId, entityType, entityId, createdAt: nowIso() };
  const ref = await addDoc(collection(db, LABEL_RELATIONS), payload);
  return { id: ref.id, ...payload };
}

export async function deleteRelation(labelId: string, entityType: string, entityId: string): Promise<void> {
  const q = query(collection(db, LABEL_RELATIONS), where("labelId", "==", labelId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    const data = d.data();
    if (data.entityType === entityType && data.entityId === entityId) batch.delete(d.ref);
  });
  await batch.commit();
}

// ─── Sayfa Versiyonları ─────────────────────────────────────────────
export interface NotePageVersion {
  id: string;
  pageId: string;
  contentSnapshot: string;
  createdAt: string;
}

const PAGE_VERSIONS = "notePageVersions";

export async function listVersionsByPage(pageId: string): Promise<NotePageVersion[]> {
  const q = query(collection(db, PAGE_VERSIONS), where("pageId", "==", pageId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<NotePageVersion, "id">) }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getLatestVersion(pageId: string): Promise<NotePageVersion | null> {
  const versions = await listVersionsByPage(pageId);
  return versions[0] ?? null;
}

export async function getVersion(id: string): Promise<NotePageVersion | null> {
  const snap = await getDoc(doc(db, PAGE_VERSIONS, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<NotePageVersion, "id">) };
}

export async function createVersion(pageId: string, contentSnapshot: string): Promise<void> {
  await addDoc(collection(db, PAGE_VERSIONS), { pageId, contentSnapshot, createdAt: nowIso() });
}

// ─── Son Kullanılanlar (Recent Items) ──────────────────────────────
const RECENT_ITEMS = "noteRecentItems";

export async function logRecentItem(pageId: string): Promise<void> {
  await addDoc(collection(db, RECENT_ITEMS), { userId: "akif", pageId, openedAt: nowIso() });

  // Kayıt sayısını sınırlı tut (en fazla 30)
  const snap = await getDocs(collection(db, RECENT_ITEMS));
  if (snap.size > 30) {
    const sorted = snap.docs.sort(
      (a, b) => (a.data().openedAt as string).localeCompare(b.data().openedAt as string)
    );
    await deleteDoc(sorted[0].ref);
  }
}

export async function listRecentPageIds(limitCount = 20): Promise<string[]> {
  const snap = await getDocs(collection(db, RECENT_ITEMS));
  const sorted = snap.docs
    .map((d) => d.data() as { pageId: string; openedAt: string })
    .sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1));
  const unique: string[] = [];
  for (const item of sorted) {
    if (!unique.includes(item.pageId)) unique.push(item.pageId);
    if (unique.length >= limitCount) break;
  }
  return unique;
}
