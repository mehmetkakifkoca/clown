import { collection, doc, getDocs, setDoc, deleteDoc, updateDoc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  createdAt?: string;
  updatedAt?: any;
}

export async function listTasks(): Promise<TaskItem[]> {
  const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<TaskItem, "id">),
  }));
}

export async function createTask(id: string, title: string): Promise<void> {
  await setDoc(doc(db, "tasks", id), {
    title,
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTask(id: string, updates: Partial<TaskItem>): Promise<void> {
  await updateDoc(doc(db, "tasks", id), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTask(id: string): Promise<void> {
  await deleteDoc(doc(db, "tasks", id));
}
