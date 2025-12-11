import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, LayoutDashboard, BrainCircuit, Settings, LogOut, Sun, Moon, Sparkles, 
  ChevronRight, GraduationCap, Award, Flame, Target, BookOpen, TrendingUp, 
  CheckCircle2, XCircle, ArrowRight, HelpCircle 
} from 'lucide-react';

// --- FIREBASE SETUP (Safe Mode) ---
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, writeBatch, onSnapshot, setDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

// Config - Hardcoded here to ensure it exists
const firebaseConfig = {
  apiKey: "AIzaSyDLH5c69JKeFWcJyBpzRUfv720KjnnRIU8",
  authDomain: "e1-und-e2a-lerntool.firebaseapp.com",
  projectId: "e1-und-e2a-lerntool",
  storageBucket: "e1-und-e2a-lerntool.firebasestorage.app",
  messagingSenderId: "28649721297",
  appId: "1:28649721297:web:432abbe98e34dd50fc24f0"
};

// Initialize safely
let db: any = null;
let auth: any = null;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  signInAnonymously(auth).catch(e => console.warn("Auth warning:", e));
} catch (e) {
  console.warn("Offline Mode: Firebase could not initialize", e);
}

// --- TYPES ---
interface Question {
  id: string;
  question: string;
  choices: string[];
  correct: number[];
  explain: string;
  law_ref: string;
  tags: string[];
  last_checked: string;
  difficulty: number;
  __deleted?: boolean;
}

interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'user';
}

interface UserProgress {
  totalAttempts: number;
  totalCorrect: number;
  attemptedIds: Record<string, number>;
  correctIds: Record<string, number>;
}

// --- DATA & CONSTANTS ---
const DEFAULT_QUESTIONS: Question[] = [
  { id: "bdg-43-ma-1", question:"§ 43 BDG: Wie hat ein Beamter seine dienstlichen Aufgaben zu erfüllen? Wählen Sie alle zutreffenden.", choices:["Unter Beachtung der geltenden Rechtsordnung.","Treu, gewissenhaft, engagiert und unparteiisch.","Nur nach ständiger Rücksprache mit dem unmittelbaren Vorgesetzten.","So, dass das Vertrauen der Allgemeinheit erhalten bleibt.","Primär an interne Dienstanweisungen, nicht an Gesetze, gebunden."], correct:[0,1,3], explain:"§ 43 BDG: Rechtstreue, Gewissenhaftigkeit, Engagement, Unparteilichkeit und Wahrung des Vertrauens der Allgemeinheit.", law_ref:"BDG § 43", tags:["BDG"], last_checked:"2025-11-11", difficulty:1 },
  { id:"bdg-44-ma-1", question:"§ 44 BDG (Weisungen): In welchen Fällen ist zu remonstrieren/abzulehnen? Wählen Sie alle zutreffenden.", choices:["Wenn die Weisung von einem unzuständigen Organ erteilt wurde.","Wenn die Befolgung gegen verwaltungsrechtliche Vorschriften verstoßen würde.","Wenn die Befolgung gegen strafrechtliche Vorschriften verstoßen würde.","Wenn der Inhalt unklar ist und trotz Nachfrage unklar bleibt.","Wenn die Weisung mündlich erteilt wurde."], correct:[0,1,2,3], explain:"Unzuständigkeit oder Rechtswidrigkeit → Remonstrationspflicht; Mündlichkeit allein macht eine Weisung nicht unbeachtlich.", law_ref:"BDG § 44", tags:["BDG"], last_checked:"2025-11-11", difficulty:2 },
  { id:"bdg-43a-ma-1", question:"§ 43a BDG (achtungsvoller Umgang): Welche Aussagen treffen zu? Wählen Sie alle zutreffenden.", choices:["Beamte haben menschenwürdeverletzender Verhalten zu unterlassen.","Vorgesetzte und Mitarbeiter begegnen einander mit Achtung.","Spontane Entgleisungen sind disziplinär immer irrelevant.","Vorgesetzte haben für achtungsvollen Umgang Sorge zu tragen.","§ 43a betrifft nur den Umgang mit Parteien."], correct:[0,1,3], explain:"§ 43a BDG verlangt würdevollen, diskriminierungsfreien Umgang; spontane Entgleisungen können relevant sein.", law_ref:"BDG § 43a", tags:["BDG"], last_checked:"2025-11-11", difficulty:1 },
  { id:"bdg-39-ma-1", question:"§ 39 BDG (Dienstzuteilung): Unter welchen Bedingungen ist eine Zuteilung ohne schriftliche Zustimmung über 90 Tage zulässig? Wählen Sie alle zutreffenden.", choices:["Wenn der Dienstbetrieb auf andere Weise nicht aufrechterhalten werden kann.","Wenn sie zum Zwecke einer Ausbildung erfolgt.","Wenn wichtige private Gründe vorliegen.","Wenn der Kommandant der entsendenden Dienststelle zustimmt.","Wenn der Kommandant der Zuteilungsdienststelle zustimmt."], correct:[0,1], explain:">90 Tage ohne Zustimmung: nur zur Aufrechterhaltung des Dienstbetriebs oder zu Ausbildungszwecken.", law_ref:"BDG § 39", tags:["BDG"], last_checked:"2025-11-11", difficulty:2 },
];

const COLOR_PALETTE: any = {
  BDG:   { bg:"bg-amber-50 dark:bg-amber-900/20", border:"border-amber-400", bar:"bg-amber-400", text:"text-amber-700 dark:text-amber-200" },
  SPG:   { bg:"bg-blue-50 dark:bg-blue-900/20",   border:"border-blue-500",   bar:"bg-blue-500",   text:"text-blue-700 dark:text-blue-200" },
  StPO:  { bg:"bg-rose-50 dark:bg-rose-900/20",    border:"border-rose-500",    bar:"bg-rose-500",    text:"text-rose-700 dark:text-rose-200" },
  ADMIN: { bg:"bg-emerald-50 dark:bg-emerald-900/20",  border:"border-emerald-500",  bar:"bg-emerald-500",  text:"text-emerald-700 dark:text-emerald-200" },
};

const GROUPS = [
  { key:"BDG",   title:"Dienstrecht (BDG)" },
  { key:"SPG",   title:"Sicherheitspolizei (SPG)" },
  { key:"STPO",  title:"Strafprozess/StGB" },
  { key:"ADMIN", title:"Verwaltung & Verkehr" },
];

const GROUP_TAGS: Record<string, string[]> = {
  BDG: ["BDG"],
  SPG: ["SPG"],
  STPO: ["StPO", "StGB"],
  ADMIN: ["AVG", "VStG", "WaffG", "StVO", "KFG", "FSG"]
};

// --- HELPER FUNCTIONS ---
function hashPassword(str: string): string {
  let hash = 0;
  for(let i=0;i<str.length;i++){
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash)}`;
}

function seededShuffle<T>(array: T[], seedStr: string): T[] {
  let h = 1779033703 ^ seedStr.length;
  for(let i=0;i<seedStr.length;i++){
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = h << 13 | h >>> 19;
  }
  let seed = function(){
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    return (h ^ h >>> 16) >>> 0;
  }();
  
  const rng = function(){
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  const a = [...array];
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(rng()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

// --- COMPONENTS ---

const DashboardStats = ({ stats, score, rank }: any) => {
  const totalAttempts = stats.reduce((acc: number, s: any) => acc + s.attempted, 0);
  
  return (
    <div className="space-y-6 animate-slide-up">
      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400"><Award size={20} /></div>
            <span className="text-sm text-slate-500">Rang</span>
          </div>
          <div className="text-xl font-bold dark:text-white">{rank}</div>
          <div className="text-xs text-slate-400 mt-1">{score} XP</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400"><BookOpen size={20} /></div>
            <span className="text-sm text-slate-500">Fragen</span>
          </div>
          <div className="text-xl font-bold dark:text-white">{totalAttempts}</div>
          <div className="text-xs text-slate-400 mt-1">Beantwortet</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400"><Target size={20} /></div>
            <span className="text-sm text-slate-500">Schnitt</span>
          </div>
          <div className="text-xl font-bold dark:text-white">
            {totalAttempts > 0 ? Math.round(stats.reduce((acc: number, s: any) => acc + s.correct, 0) / totalAttempts * 100) : 0}%
          </div>
          <div className="text-xs text-slate-400 mt-1">Korrektheit</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400"><Flame size={20} /></div>
            <span className="text-sm text-slate-500">Streak</span>
          </div>
          <div className="text-xl font-bold dark:text-white">1</div>
          <div className="text-xs text-slate-400 mt-1">Tag</div>
        </div>
      </div>

      {/* Subject Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats.map((stat: any) => {
          const colors = COLOR_PALETTE[stat.key] || COLOR_PALETTE.ADMIN;
          const percentage = stat.attempted > 0 ? (stat.correct / stat.attempted) * 100 : 0;
          
          return (
            <div key={stat.key} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
               <div className="flex justify-between items-center mb-3">
                 <span className={`px-2 py-1 rounded text-xs font-bold border ${colors.bg} ${colors.border} ${colors.text}`}>{stat.key}</span>
                 <span className="text-xs text-slate-400">{stat.correct}/{stat.attempted} Richtig</span>
               </div>
               <h4 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">{stat.title}</h4>
               <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                 <div className={`h-full transition-all duration-500 ${colors.bar}`} style={{ width: `${percentage}%` }}></div>
               </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---

export default function App() {
  // State
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS);
  const [progress, setProgress] = useState<UserProgress>({
    totalAttempts: 0, totalCorrect: 0, attemptedIds: {}, correctIds: {}
  });
  
  // Login State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  // UI State
  const [view, setView] = useState<'dashboard' | 'train' | 'admin'>('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  
  // Training State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);

  // Effects
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  // Sync Logic (Simplified)
  useEffect(() => {
    // 1. Load Users
    if (db) {
        try {
            onSnapshot(collection(db, "users"), (snap) => {
                const u: User[] = [];
                snap.forEach(d => u.push(d.data() as User));
                if(u.length) setUsers(u);
            });
        } catch(e) { console.warn("User sync error", e); }
        
        // 2. Load Questions
        try {
            onSnapshot(collection(db, "questions"), (snap) => {
                const q: Question[] = [];
                snap.forEach(d => {
                   const data = d.data() as Question;
                   if(!data.__deleted) q.push(data);
                });
                if(q.length) setQuestions(q);
            });
        } catch(e) { console.warn("Question sync error", e); }
    }
  }, []);

  useEffect(() => {
    if(user && db) {
        try {
            onSnapshot(doc(db, "userProgress", user.id), (doc) => {
                if(doc.exists()) {
                    const data = doc.data();
                    if(data[user.id + ':metrics']) setProgress(data[user.id + ':metrics']);
                }
            });
        } catch(e) {}
    }
  }, [user]);

  // Derived State
  const filteredQuestions = useMemo(() => {
     let q = questions;
     if (activeTag) {
        q = q.filter(item => item.tags.some(t => GROUP_TAGS[activeTag]?.includes(t)));
     }
     // Stable shuffle for the session
     return seededShuffle(q, `session-${user?.id || 'guest'}`);
  }, [questions, activeTag, user]);

  const currentQuestion = filteredQuestions[currentQIndex % filteredQuestions.length];

  const statsGroups = GROUPS.map(g => {
    const groupQs = questions.filter(q => q.tags.some(t => GROUP_TAGS[g.key]?.includes(t)));
    let correct = 0;
    let attempted = 0;
    groupQs.forEach(q => {
        if(progress.attemptedIds[q.id]) {
            attempted += progress.attemptedIds[q.id];
            correct += progress.correctIds[q.id] || 0;
        }
    });
    return { ...g, total: groupQs.length, attempted, correct };
  });

  // Handlers
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if(!username || !password) return;
    
    const hash = hashPassword(password);
    const existing = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    
    if (existing) {
        if(existing.passwordHash === hash) setUser(existing);
        else alert("Falsches Passwort");
    } else {
        // Register new user
        const newUser: User = {
            id: `u-${Date.now()}`,
            username,
            passwordHash: hash,
            role: username.toLowerCase().includes("admin") ? 'admin' : 'user'
        };
        setUser(newUser);
        // Fire & Forget sync
        if(db) setDoc(doc(db, "users", newUser.id), newUser).catch(console.error);
    }
  };

  const submitAnswer = () => {
    if(!currentQuestion) return;
    setSubmitted(true);
    
    // Check correctness
    // Re-shuffle locally to check against original index
    const displayOrder = seededShuffle([0,1,2,3,4], `${currentQuestion.id}#${currentQIndex}`);
    const selectedOriginals = selectedAnswers.map(idx => displayOrder[idx]);
    
    const isCorrect = 
        currentQuestion.correct.length === selectedOriginals.length &&
        currentQuestion.correct.every(c => selectedOriginals.includes(c));

    // Update Progress
    const newP = { ...progress };
    newP.totalAttempts++;
    newP.attemptedIds[currentQuestion.id] = (newP.attemptedIds[currentQuestion.id] || 0) + 1;
    if(isCorrect) {
        newP.totalCorrect++;
        newP.correctIds[currentQuestion.id] = (newP.correctIds[currentQuestion.id] || 0) + 1;
    }
    setProgress(newP);
    
    // Sync
    if(db && user) {
        setDoc(doc(db, "userProgress", user.id), { [user.id + ':metrics']: newP }, { merge: true }).catch(console.error);
    }
  };

  const nextQuestion = () => {
    setSubmitted(false);
    setSelectedAnswers([]);
    setCurrentQIndex(p => p + 1);
  };

  // --- RENDER ---

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900">
        <div className="w-full max-w-md bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl">
           <div className="flex justify-center mb-6">
              <div className="p-4 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-500/30">
                 <Shield size={40} />
              </div>
           </div>
           <h1 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-2">Polizei Lerntool</h1>
           <p className="text-center text-slate-500 dark:text-slate-400 mb-8">Dienstprüfung E1 / E2a</p>
           
           <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-slate-500 ml-1">Nutzername</label>
                <input 
                  value={username} 
                  onChange={e => setUsername(e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-blue-500 outline-none dark:text-white"
                  placeholder="Name"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-500 ml-1">Passwort</label>
                <input 
                  type="password"
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-blue-500 outline-none dark:text-white"
                  placeholder="••••••"
                />
              </div>
              <button className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95">
                Anmelden
              </button>
           </form>
        </div>
      </div>
    );
  }

  // --- Authenticated Layout ---
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20">
      
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 h-16 flex items-center justify-between">
         <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white"><Shield size={18} /></div>
            <span className="font-bold hidden sm:inline">Lerntool</span>
         </div>
         
         <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button onClick={() => setView('dashboard')} className={`p-2 rounded-md transition-all ${view === 'dashboard' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-white' : 'text-slate-500'}`}><LayoutDashboard size={18} /></button>
            <button onClick={() => setView('train')} className={`p-2 rounded-md transition-all ${view === 'train' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-white' : 'text-slate-500'}`}><BrainCircuit size={18} /></button>
            {user.role === 'admin' && <button onClick={() => setView('admin')} className={`p-2 rounded-md transition-all ${view === 'admin' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-white' : 'text-slate-500'}`}><Settings size={18} /></button>}
         </div>

         <div className="flex items-center gap-3">
             <button onClick={() => setDarkMode(!darkMode)} className="text-slate-500">{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
             <button onClick={() => setUser(null)} className="text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg"><LogOut size={18} /></button>
         </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-6">
        
        {/* VIEW: DASHBOARD */}
        {view === 'dashboard' && (
           <DashboardStats stats={statsGroups} score={progress.totalCorrect * 10} rank="Inspektor" />
        )}

        {/* VIEW: TRAIN */}
        {view === 'train' && (
           <div className="animate-slide-up">
              {/* Filter Bar */}
              <div className="flex flex-wrap gap-2 mb-6">
                <button 
                   onClick={() => setActiveTag(null)}
                   className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors ${!activeTag ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
                >
                    Alle
                </button>
                {GROUPS.map(g => (
                    <button 
                       key={g.key}
                       onClick={() => setActiveTag(g.key)}
                       className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors ${activeTag === g.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
                    >
                        {g.key}
                    </button>
                ))}
              </div>

              {currentQuestion ? (
                 <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-800">
                    {/* Progress Line */}
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800"><div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${((currentQIndex % filteredQuestions.length)/filteredQuestions.length)*100}%` }}></div></div>
                    
                    <div className="p-6 md:p-10">
                       <div className="flex gap-2 mb-6">
                          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono text-slate-500">{currentQuestion.id}</span>
                          <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded text-xs font-bold">{currentQuestion.tags[0]}</span>
                       </div>
                       
                       <h2 className="text-xl md:text-2xl font-bold mb-8 leading-snug">{currentQuestion.question}</h2>

                       <div className="space-y-3">
                          {seededShuffle([0,1,2,3,4], `${currentQuestion.id}#${currentQIndex}`).map((originalIdx, displayIdx) => {
                              const isSelected = selectedAnswers.includes(displayIdx);
                              const isCorrect = currentQuestion.correct.includes(originalIdx);
                              
                              let style = "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800";
                              if (submitted) {
                                  if(isCorrect) style = "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20";
                                  else if(isSelected && !isCorrect) style = "border-red-500 bg-red-50 dark:bg-red-900/20 opacity-70";
                                  else style = "opacity-50 grayscale";
                              } else if (isSelected) {
                                  style = "border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500";
                              }

                              return (
                                  <button
                                    key={displayIdx}
                                    onClick={() => {
                                        if(submitted) return;
                                        setSelectedAnswers(prev => prev.includes(displayIdx) ? prev.filter(x => x !== displayIdx) : [...prev, displayIdx]);
                                    }}
                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-4 ${style}`}
                                  >
                                     <div className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${submitted && isCorrect ? 'bg-emerald-500 border-emerald-500 text-white' : isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300'}`}>
                                        {submitted && isCorrect ? <CheckCircle2 size={14} /> : submitted && isSelected ? <XCircle size={14} /> : <span className="text-xs font-bold">{String.fromCharCode(65+displayIdx)}</span>}
                                     </div>
                                     <span className="text-sm md:text-base">{currentQuestion.choices[originalIdx]}</span>
                                  </button>
                              )
                          })}
                       </div>

                       <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                           {!submitted ? (
                               <button 
                                 onClick={submitAnswer} 
                                 disabled={selectedAnswers.length === 0}
                                 className={`px-8 py-3 rounded-xl font-bold flex items-center gap-2 ${selectedAnswers.length > 0 ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-slate-200 text-slate-400'}`}
                               >
                                   Prüfen <ArrowRight size={18} />
                               </button>
                           ) : (
                               <div className="w-full">
                                  <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800 mb-4 text-sm text-slate-700 dark:text-slate-300">
                                     <strong className="block mb-1 text-amber-700 dark:text-amber-400 flex items-center gap-2"><BookOpen size={16}/> Erklärung:</strong>
                                     {currentQuestion.explain} <br/>
                                     <span className="text-xs mt-2 inline-block px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 rounded text-amber-800 dark:text-amber-300 font-mono">§ {currentQuestion.law_ref}</span>
                                  </div>
                                  <div className="flex justify-end">
                                    <button onClick={nextQuestion} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg flex items-center gap-2">
                                        Nächste Frage <ChevronRight size={18} />
                                    </button>
                                  </div>
                               </div>
                           )}
                       </div>
                    </div>
                 </div>
              ) : (
                 <div className="text-center py-20 text-slate-400">Keine Fragen gefunden.</div>
              )}
           </div>
        )}

        {/* VIEW: ADMIN */}
        {view === 'admin' && (
           <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 animate-slide-up">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Settings className="text-blue-500"/> Verwaltung</h2>
              <div className="h-96 overflow-y-auto border rounded-xl dark:border-slate-800 mb-4">
                 {questions.map(q => (
                    <div key={q.id} className="p-3 border-b dark:border-slate-800 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <span className="text-sm truncate max-w-md">{q.question}</span>
                        <button 
                           onClick={() => {
                               const newQs = questions.filter(x => x.id !== q.id);
                               setQuestions(newQs);
                               // Delete Remote
                               if(db) setDoc(doc(db, "questions", q.id), { ...q, __deleted: true }).catch(console.error);
                           }}
                           className="text-red-500 text-xs font-bold px-2 py-1 rounded hover:bg-red-50"
                        >
                            Löschen
                        </button>
                    </div>
                 ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <button className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-medium text-sm hover:bg-slate-200" onClick={() => {
                     const blob = new Blob([JSON.stringify(questions)], {type:'application/json'});
                     const url = URL.createObjectURL(blob);
                     const a = document.createElement('a'); a.href=url; a.download='backup.json'; a.click();
                 }}>Backup Download</button>
                 <div className="relative">
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if(file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                                try {
                                    const parsed = JSON.parse(ev.target?.result as string);
                                    if(Array.isArray(parsed)) {
                                        setQuestions(parsed);
                                        // Sync
                                        if(db) {
                                            const batch = writeBatch(db);
                                            parsed.forEach(p => batch.set(doc(db,"questions",p.id), p));
                                            batch.commit();
                                        }
                                        alert("Import erfolgreich");
                                    }
                                } catch(err) { alert("Fehler beim Import"); }
                            };
                            reader.readAsText(file);
                        }
                    }} />
                    <button className="w-full h-full p-3 bg-blue-600 text-white rounded-xl font-medium text-sm">JSON Import</button>
                 </div>
              </div>
           </div>
        )}

      </div>
    </div>
  );
}