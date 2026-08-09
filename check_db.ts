import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import fs from "fs";

// .env.local dosyasından veya hardcode config'ten alabiliriz.
// Clown'ın lib/firebase.ts dosyasındaki config'i kopyalıyorum:
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkSizes() {
  try {
    const snap = await getDocs(collection(db, "mailAccounts"));
    console.log("mailAccounts count:", snap.size);
    for (const d of snap.docs) {
      const data = d.data();
      const str = JSON.stringify(data);
      console.log(`Doc ${d.id} size: ${str.length} bytes`);
      if (str.length > 10000) {
        console.log("LARGE DOC:", d.id, "Keys:", Object.keys(data));
      }
    }
  } catch (e) {
    console.error("Error reading mailAccounts:", e);
  }
  process.exit(0);
}

checkSizes();
