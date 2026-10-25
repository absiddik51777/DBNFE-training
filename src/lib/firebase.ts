import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { ActivityLog } from "../types";
import firebaseConfig from "../../firebase-applet-config.json";

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

// Activity Logger helper saving directly to Cloud Firestore
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
    console.warn("Failed to log activity to Cloud Firestore:", error);
  }
}
