import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Next.js hot-reload'da app'i tekrar tekrar başlatmamak için kontrol
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// IMAP/OAuth hesaplarında bazı alanlar (accessToken, refreshToken vb.) undefined
// gelebiliyor; Firestore SDK'sı bunu varsayılan olarak reddediyor (setDoc hatası).
// ignoreUndefinedProperties bu alanları sessizce atlar.
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, { ignoreUndefinedProperties: true });
} catch {
  // Hot-reload sırasında zaten başlatılmışsa mevcut instance'ı kullan
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;
export default app;
