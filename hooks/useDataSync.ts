import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Question, User, UserProgress } from '../types';
import { dbInstance, collection, doc, writeBatch, onSnapshot, setDoc, ensureAuth } from '../services/firebase';

// --- Utility Helpers ---
const FIRESTORE_QUESTIONS = "questions";
const FIRESTORE_USERS = "users";
const FIRESTORE_PROGRESS = "userProgress";

function cloneValue<T>(value: T): T {
    if (Array.isArray(value)) return value.map(cloneValue) as unknown as T;
    if (value && typeof value === "object") return JSON.parse(JSON.stringify(value));
    return value;
}

function hashPassword(str: string = ""): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return `h${Math.abs(hash)}`;
}

// --- Hooks ---

export function useQuestions() {
    const [questions, setQuestionsState] = useState<Question[]>(() => {
        try {
            const saved = localStorage.getItem('questions');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [status, setStatus] = useState<'loading' | 'synced' | 'offline' | 'error'>('loading');

    const applyingRemote = useRef(false);

    // Persist local
    useEffect(() => {
        try { localStorage.setItem('questions', JSON.stringify(questions)); } catch { }
    }, [questions]);

    // Sync Logic
    useEffect(() => {
        if (!dbInstance) {
            setStatus('offline');
            return;
        }

        let unsubscribe: () => void;

        const init = async () => {
            await ensureAuth();
            const colRef = collection(dbInstance, FIRESTORE_QUESTIONS);
            
            unsubscribe = onSnapshot(colRef, (snapshot: any) => {
                const remote: Question[] = [];
                snapshot.forEach((doc: any) => {
                    const data = doc.data();
                    if (!data.__deleted) {
                        remote.push({ ...data, id: doc.id });
                    }
                });
                
                applyingRemote.current = true;
                setQuestionsState(prev => {
                   // Simple merge strategy: Remote wins if ID matches
                   const map = new Map(prev.map(q => [q.id, q]));
                   remote.forEach(q => map.set(q.id, q));
                   return Array.from(map.values());
                });
                applyingRemote.current = false;
                setStatus('synced');
            }, (err: any) => {
                console.error("Firestore Error", err);
                setStatus('error');
            });
        };

        init();
        return () => unsubscribe && unsubscribe();
    }, []);

    const setQuestions = useCallback((newQuestions: Question[]) => {
        setQuestionsState(newQuestions);
        // In a real app, we'd queue writes here. 
        // For this demo, we assume writes happen via the Admin panel directly to Firestore 
        // OR local state is optimistic.
    }, []);

    return { questions, setQuestions, status };
}

export function useUsers() {
    const [users, setUsersState] = useState<User[]>(() => {
        try { return JSON.parse(localStorage.getItem('users') || '[]'); } catch { return []; }
    });
    
    // Persist local
    useEffect(() => {
        try { localStorage.setItem('users', JSON.stringify(users)); } catch { }
    }, [users]);

    // Sync
    useEffect(() => {
        if (!dbInstance) return;
        const init = async () => {
            await ensureAuth();
            return onSnapshot(collection(dbInstance, FIRESTORE_USERS), (snap: any) => {
                const remote: User[] = [];
                snap.forEach((d: any) => remote.push(d.data() as User));
                // Filter sensitive admin for safety if needed, though client-side logic isn't secure enough for real secrets
                setUsersState(remote);
            });
        };
        const promise = init();
        return () => { promise.then(unsub => unsub && unsub()); };
    }, []);

    const upsertUser = async (user: User) => {
        if (!dbInstance) return;
        await ensureAuth();
        await setDoc(doc(dbInstance, FIRESTORE_USERS, user.id), user, { merge: true });
    };

    return { users, setUsersState, upsertUser, hashPassword };
}

export function useProgress(userId: string | null) {
    const key = userId ? `progress:${userId}` : null;
    const [progress, setProgress] = useState<UserProgress>(() => {
        const defaultState: UserProgress = { 
            totalAttempts: 0, 
            totalCorrect: 0, 
            attemptedIds: {}, 
            correctIds: {},
            bookmarks: [],
            reviewQueue: [],
            reviewStreak: {}
        };
        if (!key) return defaultState;
        try { 
            const saved = JSON.parse(localStorage.getItem(key) || 'null');
            return saved || defaultState;
        } 
        catch { return defaultState; }
    });

    const applyingRemote = useRef(false);

    useEffect(() => {
        if (key) {
             localStorage.setItem(key, JSON.stringify(progress));
        }
    }, [key, progress]);

    useEffect(() => {
        if (!userId || !dbInstance) return;
        
        let unsub: () => void;
        const init = async () => {
            await ensureAuth();
            const docRef = doc(dbInstance, FIRESTORE_PROGRESS, userId);
            unsub = onSnapshot(docRef, (snap: any) => {
                if (snap.exists()) {
                    const data = snap.data();
                    const remoteProg = data[`${userId}:metrics`] || data; 
                    if (remoteProg && remoteProg.totalAttempts !== undefined) {
                        applyingRemote.current = true;
                        setProgress(prev => ({
                            ...prev, // Keep local defaults
                            ...remoteProg,
                            // Ensure arrays exist if remote didn't have them
                            bookmarks: remoteProg.bookmarks || [],
                            reviewQueue: remoteProg.reviewQueue || [],
                            reviewStreak: remoteProg.reviewStreak || {}
                        }));
                        applyingRemote.current = false;
                    }
                }
            });
        };
        init();
        return () => unsub && unsub();
    }, [userId]);

    const updateProgress = useCallback((updater: (prev: UserProgress) => UserProgress) => {
        setProgress(prev => {
            const next = updater(prev);
            
            // Sync to firestore
            if (userId && dbInstance && !applyingRemote.current) {
                const payload = next;
                ensureAuth().then(() => {
                    setDoc(doc(dbInstance, FIRESTORE_PROGRESS, userId), { [`${userId}:metrics`]: payload }, { merge: true });
                });
            }
            return next;
        });
    }, [userId]);

    return [progress, updateProgress] as const;
}