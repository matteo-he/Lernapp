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

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;
let authReadyPromise: Promise<FirebaseUser | null> = Promise.resolve(null);

try {
    if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
    } else {
        app = getApp();
    }
    
    if (app) {
        db = getFirestore(app);
        auth = getAuth(app);
        
        authReadyPromise = new Promise((resolve) => {
            if (!auth) {
                resolve(null);
                return;
            }
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                if (user) {
                    resolve(user);
                    unsubscribe();
                } else {
                    signInAnonymously(auth).then((userCred) => {
                         // Authenticated anonymously
                    }).catch((err) => {
                        console.warn("Anon Auth failed, offline mode", err);
                        resolve(null);
                    });
                }
            });
        });
    }

} catch (e) {
    console.error("Firebase init critical error - App will run in Offline Mode", e);
}

// Export safe accessors
export const dbInstance = db;
export const authInstance = auth;
export const ensureAuth = () => authReadyPromise;

// Re-export firebase functions so consumers don't need to import from URL directly
export { collection, doc, writeBatch, onSnapshot, setDoc };
