import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { ActivityLog } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyDrRKKGislQ3K_5-5sHHj7c_5AGhtsq7jc",
  authDomain: "bnfe-training.firebaseapp.com",
  projectId: "bnfe-training",
  storageBucket: "bnfe-training.firebasestorage.app",
  messagingSenderId: "927658163728",
  appId: "1:927658163728:web:3ab6bcbeeb71368f3a5495"
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Activity Logger helper
export async function logActivity(
  userId: string,
  userName: string,
  action: string,
  module: string,
  recordId: string,
  details?: string
) {
  try {
    await addDoc(collection(db, 'activityLogs'), {
      userId,
      userName,
      action,
      module,
      recordId,
      details: details || '',
      timestamp: Date.now()
    } as Omit<ActivityLog, 'id'>);
  } catch (error) {
    console.warn("Failed to log activity to Firestore:", error);
  }
}
