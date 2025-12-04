import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, writeBatch, onSnapshot, setDoc, Firestore } from "firebase/firestore";
import { getAuth, onAuthStateChanged, signInAnonymously, Auth } from "firebase/auth";
import { Question, User } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyDLH5c69JKeFWcJyBpzRUfv720KjnnRIU8",
  authDomain: "e1-und-e2a-lerntool.firebaseapp.com",
  projectId: "e1-und-e2a-lerntool",
  storageBucket: "e1-und-e2a-lerntool.firebasestorage.app",
  messagingSenderId: "28649721297",
  appId: "1:28649721297:web:432abbe98e34dd50fc24f0"
};

let app;
let db: Firestore | null = null;
let auth: Auth | null = null;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  
  if (auth) {
    // Auto sign-in anonymously for Firestore access rules
    signInAnonymously(auth).catch(err => console.error("Anon Auth Failed", err));
  }
} catch (e) {
  console.warn("Firebase failed to initialize. Falling back to local mode.", e);
}

export { db, auth };

// Sync Hooks Logic
export const FIRESTORE_COLLECTIONS = {
  QUESTIONS: "questions",
  USERS: "users",
  PROGRESS: "userProgress"
};

export const syncUserProgress = async (userId: string, data: any) => {
  if (!db || !userId) return;
  try {
    const ref = doc(db, FIRESTORE_COLLECTIONS.PROGRESS, userId);
    await setDoc(ref, { [userId + ':metrics']: data }, { merge: true });
  } catch (e) {
    console.error("Failed to sync progress", e);
  }
};

export const syncUserList = async (users: User[]) => {
  if (!db) return;
  try {
    const batch = writeBatch(db);
    // In a real app we wouldn't rewrite all users every time, 
    // but preserving original logic for simplicity
    users.forEach(u => {
      const ref = doc(db!, FIRESTORE_COLLECTIONS.USERS, u.id);
      batch.set(ref, u);
    });
    await batch.commit();
  } catch (e) {
    console.error("User sync failed", e);
  }
};

export const deleteQuestionFromRemote = async (id: string) => {
    if(!db) return;
    try {
        const ref = doc(db, FIRESTORE_COLLECTIONS.QUESTIONS, id);
        await setDoc(ref, { id, __deleted: true, deletedAt: new Date().toISOString() });
    } catch(e) {
        console.error("Delete failed", e);
    }
}

export const saveQuestionToRemote = async (q: Question) => {
    if(!db) return;
    try {
        const ref = doc(db, FIRESTORE_COLLECTIONS.QUESTIONS, q.id);
        await setDoc(ref, q);
    } catch(e) {
        console.error("Save failed", e);
    }
}