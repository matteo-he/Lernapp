import { initializeApp, getApp, getApps, FirebaseApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, doc, writeBatch, onSnapshot, setDoc, Firestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInAnonymously, Auth, User as FirebaseUser } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDLH5c69JKeFWcJyBpzRUfv720KjnnRIU8",
  authDomain: "e1-und-e2a-lerntool.firebaseapp.com",
  projectId: "e1-und-e2a-lerntool",
  storageBucket: "e1-und-e2a-lerntool.firebasestorage.app",
  messagingSenderId: "28649721297",
  appId: "1:28649721297:web:432abbe98e34dd50fc24f0"
};

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let authReadyPromise: Promise<FirebaseUser | null>;

try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    
    authReadyPromise = new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                resolve(user);
                unsubscribe();
            } else {
                signInAnonymously(auth).catch((err) => {
                    console.error("Anon Auth failed", err);
                    resolve(null);
                });
            }
        });
    });

} catch (e) {
    console.error("Firebase init error", e);
}

export const dbInstance = db;
export const authInstance = auth;
export const ensureAuth = () => authReadyPromise;

export { collection, doc, writeBatch, onSnapshot, setDoc };