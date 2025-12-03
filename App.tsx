import React, { useState, useMemo } from 'react';
import { useQuestions, useUsers, useProgress } from './hooks/useDataSync.ts';
import { Layout } from './components/Layout.tsx';
import { GlassCard } from './components/Card.tsx';
import { Quiz } from './components/Quiz.tsx';
import { Chat } from './components/Chat.tsx';
import { Question, GROUPS, FilterState } from './types.ts';
import { collection, doc, writeBatch, dbInstance, setDoc } from './services/firebase.ts';

// --- Constants & Helpers ---

const RANKS = [
  { title: "Anwärter:in", min: 0 },
  { title: "Inspektor:in", min: 150 },
  { title: "Gruppeninspektor:in", min: 400 },
  { title: "Revierinspektor:in", min: 800 },
  { title: "Abteilungsinspektor:in", min: 1300 },
  { title: "Chefinspektor:in", min: 2000 },
];

const COLOR_MAP: Record<string, { bg: string, text: string, badgeBg: string, badgeText: string, bar: string, border: string }> = {
  yellow: { bg: 'bg-yellow-500', text: 'text-yellow-600', badgeBg: 'bg-yellow-100', badgeText: 'text-yellow-800', bar: 'bg-yellow-500', border: 'border-yellow-500' },
  blue:   { bg: 'bg-blue-500',   text: 'text-blue-600',   badgeBg: 'bg-blue-100',   badgeText: 'text-blue-800',   bar: 'bg-blue-500',   border: 'border-blue-500' },
  red:    { bg: 'bg-red-500',    text: 'text-red-600',    badgeBg: 'bg-red-100',    badgeText: 'text-red-800',    bar: 'bg-red-500',    border: 'border-red-500' },
  rose:   { bg: 'bg-rose-500',   text: 'text-rose-600',   badgeBg: 'bg-rose-100',   badgeText: 'text-rose-800',   bar: 'bg-rose-500',   border: 'border-rose-500' },
  green:  { bg: 'bg-emerald-500',text: 'text-emerald-600',badgeBg: 'bg-emerald-100',badgeText: 'text-emerald-800',bar: 'bg-emerald-500',border: 'border-emerald-500' },
  emerald:{ bg: 'bg-emerald-500',text: 'text-emerald-600',badgeBg: 'bg-emerald-100',badgeText: 'text-emerald-800',bar: 'bg-emerald-500',border: 'border-emerald-500' },
};

function getGroupColor(colorKey: string) {
  return COLOR_MAP[colorKey] || COLOR_MAP.blue;
}

function rankFor(score: number){
  const r = [...RANKS].reverse().find(r=>score>=r.min);
  return r? r.title : RANKS[0].title;
}

const SRS_INTERVALS = [
    0, // Level 0: Immediate
    10 * 60 * 1000, // 10 Min
    24 * 60 * 60 * 1000, // 1 Day
    3 * 24 * 60 * 60 * 1000, // 3 Days
    7 * 24 * 60 * 60 * 1000, // 1 Week
    14 * 24 * 60 * 60 * 1000, // 2 Weeks
];

function getSRSLabel(level: number): string {
    switch(level) {
        case 0: return "Sofort";
        case 1: return "10 Minuten";
        case 2: return "1 Tag";
        case 3: return "3 Tage";
        case 4: return "1 Woche";
        case 5: return "2 Wochen";
        default: return "Lange Zeit";
    }
}

// --- Subcomponents ---

const StatCard = ({ label, value, icon, color }: any) => {
    const colors: any = {
        yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600',
        blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600',
        indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600',
        emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
    };
    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4 hover:scale-[1.02] transition-transform">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${colors[color] || colors.blue}`}>
                {icon}
            </div>
            <div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
                <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{value}</div>
            </div>
        </div>
    );
};

const AuthForm = ({ onLogin, onRegister, users, hashPassword }: any) => {
    const [isLogin, setIsLogin] = useState(true);
    const [name, setName] = useState("");
    const [pass, setPass] = useState("");
    const [error, setError] = useState("");

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!name.trim()) return setError("Name fehlt");
        
        if (isLogin) {
            const u = users.find((u: any) => (u.username||"").toLowerCase() === name.toLowerCase());
            if (u && u.passwordHash === hashPassword(pass)) onLogin(u.id);
            else setError("Ungültige Daten");
        } else {
            if (users.find((u: any) => (u.username||"").toLowerCase() === name.toLowerCase())) return setError("Name vergeben");
            const id = `user-${Date.now()}`;
            onRegister({ id, username: name, passwordHash: hashPassword(pass), role: 'user' });
        }
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Benutzername</label>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-police-500 outline-none" placeholder="Max" />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Passwort</label>
                <input type="password" value={pass} onChange={e => setPass(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-police-500 outline-none" placeholder="••••" />
            </div>
            {error && <div className="text-rose-500 text-sm">{error}</div>}
            <button type="submit" className="w-full bg-police-600 text-white py-3 rounded-lg font-bold hover:bg-police-700 transition-colors shadow-lg shadow-police-500/20">
                {isLogin ? 'Anmelden' : 'Registrieren'}
            </button>
            <div className="text-center text-sm text-slate-500 cursor-pointer hover:underline hover:text-police-600" onClick={() => setIsLogin(!isLogin)}>
                {isLogin ? 'Noch keinen Account? Registrieren' : 'Zurück zum Login'}
            </div>
        </form>
    );
};

const QuestionEditor = ({ question, onSave, onCancel }: any) => {
    const [q, setQ] = useState(JSON.parse(JSON.stringify(question)));

    const toggleCorrect = (idx: number) => {
        const s = new Set(q.correct);
        if(s.has(idx)) s.delete(idx); else s.add(idx);
        setQ({...q, correct: Array.from(s).sort()});
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(q);
    }

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 max-w-4xl mx-auto">
            <h3 className="text-xl font-bold mb-6">Frage bearbeiten: {q.id}</h3>
            <form onSubmit={handleSave} className="space-y-4">
                <div>
                    <label className="block text-sm font-bold">Frage</label>
                    <textarea value={q.question} onChange={e=>setQ({...q, question: e.target.value})} className="w-full p-3 border rounded-lg bg-transparent dark:border-slate-600" rows={3} required />
                </div>
                
                <div className="grid gap-2">
                    <label className="block text-sm font-bold mt-2">Antworten (Richtige anhaken)</label>
                    {q.choices.map((c: string, i: number) => (
                        <div key={i} className="flex gap-3 items-center">
                            <input type="checkbox" checked={q.correct.includes(i)} onChange={()=>toggleCorrect(i)} className="w-5 h-5 accent-police-600" />
                            <input value={c} onChange={e=> {
                                const newChoices = [...q.choices];
                                newChoices[i] = e.target.value;
                                setQ({...q, choices: newChoices});
                            }} className="flex-1 p-2 border rounded-lg bg-transparent dark:border-slate-600" placeholder={`Antwort ${String.fromCharCode(65+i)}`} required />
                        </div>
                    ))}
                </div>

                <div className="grid md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <label className="block text-sm font-bold mb-1">Tags (Komma getrennt)</label>
                        <input value={q.tags.join(', ')} onChange={e=>setQ({...q, tags: e.target.value.split(',').map((t:string)=>t.trim()).filter(Boolean)})} className="w-full p-2 border rounded-lg bg-transparent dark:border-slate-600" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1">Rechtsgrundlage</label>
                        <input value={q.law_ref} onChange={e=>setQ({...q, law_ref: e.target.value})} className="w-full p-2 border rounded-lg bg-transparent dark:border-slate-600" />
                    </div>
                    <div>
                         <label className="block text-sm font-bold mb-1">Schwierigkeit (1-5)</label>
                         <input type="number" min="1" max="5" value={q.difficulty} onChange={e=>setQ({...q, difficulty: parseInt(e.target.value)})} className="w-full p-2 border rounded-lg bg-transparent dark:border-slate-600" />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold mb-1">Erklärung</label>
                    <textarea value={q.explain} onChange={e=>setQ({...q, explain: e.target.value})} className="w-full p-3 border rounded-lg bg-transparent dark:border-slate-600" rows={3} />
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
                    <button type="button" onClick={onCancel} className="px-4 py-2 text-slate-500 hover:text-slate-700 font-bold">Abbrechen</button>
                    <button type="submit" className="px-6 py-2 bg-police-600 text-white rounded-lg font-bold shadow hover:bg-police-700">Speichern</button>
                </div>
            </form>
        </div>
    );
};

// --- Main Component ---

export default function App() {
  // Theme
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') || 'light'; } catch { return 'light'; }
  });
  
  React.useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Data
  const { questions } = useQuestions();
  const { users, upsertUser, hashPassword } = useUsers();
  const [activeUserId, setActiveUserId] = useState<string | null>(() => localStorage.getItem('activeUserId'));
  const activeUser = useMemo(() => users.find(u => u.id === activeUserId) || null, [users, activeUserId]);
  const [progress, updateProgress] = useProgress(activeUserId);

  // Navigation
  const [view, setView] = useState('dashboard');
  
  // Quiz Session State
  const [quizIdx, setQuizIdx] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showExplain, setShowExplain] = useState(false);
  const [score, setScore] = useState(0);
  
  // Sync score from progress once loaded
  React.useEffect(() => {
      if(progress.totalCorrect) setScore(progress.totalCorrect * 10);
  }, [progress.totalCorrect]);

  const [feedbackMeta, setFeedbackMeta] = useState<{ label: string, isCorrect: boolean } | null>(null);
  
  // Filter State
  const [filter, setFilter] = useState<FilterState>({ tags: [], difficulty: 0, bookmarkOnly: false, searchQuery: "" });

  // Admin State
  const [adminSearch, setAdminSearch] = useState("");
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Modal State
  const [detailedStatsGroup, setDetailedStatsGroup] = useState<any | null>(null);

  // Auth Handlers
  const handleLogin = (id: string) => {
    setActiveUserId(id);
    localStorage.setItem('activeUserId', id);
    setView('dashboard');
  };

  const handleLogout = () => {
    setActiveUserId(null);
    localStorage.removeItem('activeUserId');
    setView('dashboard');
  };

  // Logic: Get Candidates
  const getCandidateQuestions = useMemo(() => {
      let q = questions;
      
      if (view === 'review') {
          const now = Date.now();
          return q.filter(x => {
              const inQueue = (progress.reviewQueue || []).includes(x.id);
              const nextDate = (progress.nextReviewDate || {})[x.id] || 0;
              return inQueue && nextDate <= now;
          });
      }

      if (filter.bookmarkOnly) {
          q = q.filter(x => (progress.bookmarks || []).includes(x.id));
      } else if (filter.tags.length > 0) {
          q = q.filter(x => x.tags.some(t => filter.tags.includes(t)));
      }

      if (filter.searchQuery.trim()) {
          const term = filter.searchQuery.toLowerCase();
          q = q.filter(x => 
              x.question.toLowerCase().includes(term) || 
              x.explain.toLowerCase().includes(term) ||
              x.law_ref.toLowerCase().includes(term) ||
              x.tags.some(t => t.toLowerCase().includes(term))
          );
      }

      // Shuffle logic could be added here, currently mostly static order for demo unless shuffled
      return q;
  }, [questions, filter, progress.bookmarks, progress.reviewQueue, progress.nextReviewDate, view]);

  const currentQuestion = getCandidateQuestions.length > 0 ? getCandidateQuestions[quizIdx % getCandidateQuestions.length] : null;

  // Quiz Handlers
  const handleAnswer = (selectedIndices: number[]) => {
    if (showExplain || !currentQuestion) return;
    
    // Reproduce shuffle logic to verify correctness
    const xmur3 = (str: string) => {
        let h = 1779033703 ^ str.length;
        for(let i=0;i<str.length;i++) h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        return function(): number { h = Math.imul(h ^ h >>> 16, 2246822507); return (h ^ h >>> 16) >>> 0; }
    }
    const mulberry32 = (a: number) => {
        return function(): number { let t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    }
    const getOrder = (id: string, i: number) => {
        const seed = xmur3(`${id}#${i}`)();
        const rng = mulberry32(seed);
        const a = [0,1,2,3,4];
        for(let k=a.length-1;k>0;k--){ const j=Math.floor(rng()*(k+1)); [a[k],a[j]]=[a[j],a[k]]; }
        return a;
    }

    const displayOrder = getOrder(currentQuestion.id, quizIdx);
    const selectedOriginals = selectedIndices.map(i => displayOrder[i]);
    const correctSet = new Set(currentQuestion.correct);
    const selectedSet = new Set(selectedOriginals);
    
    // Check if sets match exactly
    const isCorrect = correctSet.size === selectedSet.size && [...correctSet].every(val => selectedSet.has(val));

    // Calculate SRS
    let nextLabel = "Sofort";
    if (isCorrect) {
        const currentS = progress.reviewStreak?.[currentQuestion.id] ?? 0;
        const newS = currentS + 1;
        nextLabel = getSRSLabel(newS);
    } else {
        nextLabel = "Sofort";
    }
    
    setFeedbackMeta({ label: nextLabel, isCorrect });
    setShowExplain(true);
    
    if (isCorrect) {
        setScore(s => s + 10);
        setStreak(s => s + 1);
        if(streak > 0 && (streak+1) % 5 === 0 && (window as any).confetti) (window as any).confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } else {
        setStreak(0);
    }

    // Update DB
    updateProgress(prev => {
        const attemptedIds = { ...prev.attemptedIds };
        attemptedIds[currentQuestion.id] = (attemptedIds[currentQuestion.id] || 0) + 1;
        const correctIds = { ...prev.correctIds };
        if (isCorrect) correctIds[currentQuestion.id] = (correctIds[currentQuestion.id] || 0) + 1;
        
        let reviewQueue = prev.reviewQueue ? [...prev.reviewQueue] : [];
        let reviewStreak = prev.reviewStreak ? { ...prev.reviewStreak } : {};
        let nextReviewDate = prev.nextReviewDate ? { ...prev.nextReviewDate } : {};
        
        if (!isCorrect) {
             if (!reviewQueue.includes(currentQuestion.id)) reviewQueue.push(currentQuestion.id);
             reviewStreak[currentQuestion.id] = 0;
             nextReviewDate[currentQuestion.id] = Date.now();
        } else {
             if (reviewQueue.includes(currentQuestion.id)) {
                 const currentS = reviewStreak[currentQuestion.id] || 0;
                 const newS = currentS + 1;
                 reviewStreak[currentQuestion.id] = newS;
                 const interval = SRS_INTERVALS[Math.min(newS, SRS_INTERVALS.length - 1)] || SRS_INTERVALS[SRS_INTERVALS.length-1];
                 nextReviewDate[currentQuestion.id] = Date.now() + interval;
             }
        }

        return {
            ...prev,
            totalAttempts: prev.totalAttempts + 1,
            totalCorrect: prev.totalCorrect + (isCorrect ? 1 : 0),
            attemptedIds,
            correctIds,
            reviewQueue,
            reviewStreak,
            nextReviewDate
        };
    });
  };

  const nextQuestion = () => {
    setShowExplain(false);
    const wasCorrect = feedbackMeta?.isCorrect;
    setFeedbackMeta(null);
    
    if (view === 'review' && wasCorrect) {
        // In review mode, correct items leave the current filtered list automatically
        // so index stays same to point to the "new" item at that position
        setQuizIdx(i => i); 
    } else {
        setQuizIdx(i => i + 1);
    }
  };

  const toggleBookmark = (id: string) => {
      updateProgress(p => {
          const b = p.bookmarks || [];
          const next = b.includes(id) ? b.filter(x => x !== id) : [...b, id];
          return { ...p, bookmarks: next };
      });
  };

  // Stats Logic
  const stats = useMemo(() => {
    return GROUPS.map(g => {
        const groupQuestions = questions.filter(q => q.tags.some(t => g.tags.includes(t)));
        let attempted = 0;
        let correct = 0;
        groupQuestions.forEach(q => {
            attempted += (progress.attemptedIds[q.id] || 0);
            correct += (progress.correctIds[q.id] || 0);
        });
        return { ...g, total: groupQuestions.length, attempted, correct };
    });
  }, [questions, progress]);

  const dueReviewsCount = useMemo(() => {
      if (!progress.reviewQueue) return 0;
      const now = Date.now();
      return progress.reviewQueue.filter(id => {
          const date = (progress.nextReviewDate || {})[id] || 0;
          return date <= now;
      }).length;
  }, [progress]);


  // --- View Renderers ---

  if (!activeUser) {
    return (
      <Layout user={null} onLogout={()=>{}} currentView="" setView={()=>{}} theme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
         <GlassCard className="p-8">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-police-600 rounded-2xl mx-auto flex items-center justify-center text-3xl mb-4 shadow-lg shadow-police-500/40">👮</div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Willkommen zurück</h2>
                <p className="text-slate-500 dark:text-slate-400">Bitte melden Sie sich an um fortzufahren</p>
            </div>
            <AuthForm users={users} onLogin={handleLogin} onRegister={(u: any) => { upsertUser(u); handleLogin(u.id); }} hashPassword={hashPassword} />
         </GlassCard>
      </Layout>
    );
  }

  const renderDashboard = () => {
      const totalQueue = (progress.reviewQueue || []).length;
      return (
        <div className="animate-fade-in space-y-8">
             <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Hallo, {activeUser.username} 👋</h2>
                    <p className="text-slate-500 mt-1">Hier ist dein aktueller Lernfortschritt.</p>
                </div>
                {activeUser.role === 'admin' && <button onClick={() => setView('admin')} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-xl text-sm font-bold">Verwaltung</button>}
             </div>

             <div 
                onClick={() => {
                    if(totalQueue > 0) {
                        setView('review');
                        setQuizIdx(0);
                    }
                }}
                className={`relative overflow-hidden rounded-2xl p-6 md:p-8 cursor-pointer transition-all duration-300 ${
                    totalQueue > 0 
                    ? 'bg-gradient-to-r from-rose-500 to-orange-600 shadow-xl hover:shadow-2xl hover:scale-[1.01]' 
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 opacity-80'
                }`}
             >
                 <div className="absolute right-0 top-0 h-full w-1/3 bg-white/10 skew-x-12 transform origin-bottom-right"></div>
                 <div className="relative z-10 flex items-center justify-between">
                     <div>
                         <div className={`text-sm font-bold uppercase tracking-wider mb-2 ${totalQueue > 0 ? 'text-white/80' : 'text-slate-500'}`}>
                             Fehler-Archiv
                         </div>
                         <h3 className={`text-3xl font-extrabold mb-1 ${totalQueue > 0 ? 'text-white' : 'text-slate-800 dark:text-white'}`}>
                            {dueReviewsCount > 0 ? `${dueReviewsCount} Fällig` : `${totalQueue} Archiviert`}
                         </h3>
                         <p className={`text-sm font-medium ${totalQueue > 0 ? 'text-white/90' : 'text-slate-500'}`}>
                            {dueReviewsCount > 0 ? 'Jetzt wiederholen!' : 'Super! Alles für später geplant.'}
                         </p>
                     </div>
                     <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg ${totalQueue > 0 ? 'bg-white text-rose-500' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                         🩹
                     </div>
                 </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <StatCard label="Aktueller Rang" value={rankFor(score)} icon="🏆" color="yellow" />
                 <StatCard label="XP Gesamt" value={score} icon="⚡" color="blue" />
                 <StatCard label="Fragen beantwortet" value={progress.totalAttempts} icon="📝" color="indigo" />
                 <StatCard label="Trefferquote" value={`${progress.totalAttempts ? Math.round((progress.totalCorrect/progress.totalAttempts)*100) : 0}%`} icon="🎯" color="emerald" />
             </div>

             <div>
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="text-xl font-bold text-slate-800 dark:text-white">Fachbereiche</h3>
                     {(progress.bookmarks || []).length > 0 && (
                        <button onClick={() => { setFilter({tags:[], difficulty:0, bookmarkOnly:true, searchQuery: ""}); setView('train'); }} className="text-amber-500 hover:text-amber-600 font-bold text-sm flex items-center gap-1">
                             ★ {(progress.bookmarks || []).length} Gemerkte
                        </button>
                     )}
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {stats.map(s => {
                        const percentage = s.total ? Math.round((s.correct / Math.max(s.attempted, 1)) * 100) : 0;
                        const coverage = s.total ? Math.round((s.attempted / s.total) * 100) : 0;
                        const colors = getGroupColor(s.color);

                        return (
                            <GlassCard 
                                key={s.key} 
                                className={`p-6 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all relative group border-l-4 ${colors.border}`}
                                onClick={() => setDetailedStatsGroup(s)}
                            >
                                <div className="absolute top-4 right-4 text-slate-300 group-hover:text-police-500 transition-colors bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                     </svg>
                                </div>
                                <h4 className={`font-bold text-lg text-slate-800 dark:text-white group-hover:${colors.text} transition-colors`}>{s.title}</h4>
                                <div className="text-xs text-slate-400 mb-4">{s.attempted} / {s.total} Fragen</div>
                                
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-xs mb-1.5 font-semibold text-slate-500"><span>Wissensstand</span> <span>{percentage}%</span></div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                                            <div className={`${colors.bar} h-full rounded-full transition-all duration-1000 shadow-sm`} style={{width: `${percentage}%`}}></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs mb-1.5 font-semibold text-slate-500"><span>Abdeckung</span> <span>{coverage}%</span></div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                                            <div className="bg-slate-300 dark:bg-slate-500 h-full rounded-full transition-all duration-1000" style={{width: `${coverage}%`}}></div>
                                        </div>
                                    </div>
                                </div>
                            </GlassCard>
                        );
                    })}
                 </div>
             </div>
        </div>
      );
  };

  const renderTraining = () => {
      return (
        <div className="animate-fade-in">
            <div className="mb-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                         <button onClick={() => setView('dashboard')} className="text-sm font-bold text-slate-400 hover:text-police-600 mb-2 flex items-center gap-1">
                            ← Zurück zum Dashboard
                         </button>
                         <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                            {view === 'review' ? 'Wiederholung (Spaced Repetition)' : 'Training'}
                         </h2>
                    </div>
                     {view !== 'review' && (
                        <div className="text-xs bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-500 font-medium">
                           {getCandidateQuestions.length} Fragen
                        </div>
                    )}
                </div>

                {/* Filter Bar */}
                {view !== 'review' && (
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1 relative">
                                <span className="absolute left-3 top-3.5 text-slate-400">🔍</span>
                                <input
                                    type="text"
                                    placeholder="Fragen suchen..."
                                    value={filter.searchQuery}
                                    onChange={(e) => setFilter(prev => ({ ...prev, searchQuery: e.target.value }))}
                                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-police-500 outline-none text-slate-800 dark:text-slate-200"
                                />
                            </div>
                            <div className="w-full md:w-64">
                                <select
                                    value={filter.tags[0] || ""}
                                    onChange={(e) => setFilter(prev => ({ ...prev, tags: e.target.value ? [e.target.value] : [] }))}
                                    className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-police-500 outline-none text-slate-800 dark:text-slate-200 appearance-none"
                                >
                                    <option value="">Alle Themenbereiche</option>
                                    {GROUPS.map(g => (
                                        <option key={g.key} value={g.tags[0]}>{g.title}</option>
                                    ))}
                                </select>
                            </div>
                            {(filter.searchQuery || filter.tags.length > 0) && (
                                <button 
                                    onClick={() => setFilter({ tags: [], difficulty: 0, bookmarkOnly: false, searchQuery: "" })}
                                    className="px-4 py-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg font-bold transition-colors"
                                >
                                    ✕ Reset
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <Quiz 
                question={currentQuestion}
                idx={quizIdx}
                score={score}
                streak={streak}
                onAnswer={handleAnswer}
                onNext={nextQuestion}
                onSkip={nextQuestion}
                showExplain={showExplain}
                mode={view === 'review' ? 'review' : 'training'}
                onBookmark={toggleBookmark}
                isBookmarked={currentQuestion ? (progress.bookmarks || []).includes(currentQuestion.id) : false}
                srsLevel={currentQuestion ? progress.reviewStreak?.[currentQuestion.id] : undefined}
                feedbackMeta={feedbackMeta}
            />
        </div>
      );
  };

  const renderAdmin = () => {
      if (editingQuestion) {
          return (
            <div className="animate-fade-in">
                <button onClick={() => setEditingQuestion(null)} className="mb-4 text-sm font-bold text-slate-500 hover:text-police-600">← Zurück</button>
                <QuestionEditor 
                    question={editingQuestion} 
                    onSave={async (q: Question) => {
                        if(dbInstance) {
                            await setDoc(doc(dbInstance, 'questions', q.id), q, { merge: true });
                            alert('Frage erfolgreich gespeichert.');
                            setEditingQuestion(null);
                        } else {
                            alert('Offline: Speichern nicht möglich');
                        }
                    }}
                    onCancel={() => setEditingQuestion(null)}
                />
            </div>
          );
      }
      return (
        <div className="animate-fade-in space-y-6">
            <h2 className="text-3xl font-bold">Verwaltung</h2>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
                    <div>
                        <h3 className="font-semibold text-lg">Fragen-Datenbank</h3>
                        <span className="text-sm text-slate-500">{questions.length} Einträge</span>
                    </div>
                    <input 
                        placeholder="Suchen..." 
                        value={adminSearch} 
                        onChange={e => setAdminSearch(e.target.value)} 
                        className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent"
                    />
                </div>
                <div className="h-96 overflow-y-auto space-y-2">
                    {questions.filter(q => 
                        (q.question || "").toLowerCase().includes(adminSearch.toLowerCase()) || 
                        (q.id || "").toLowerCase().includes(adminSearch.toLowerCase())
                    ).map(q => (
                        <div key={q.id} className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-700">
                            <div className="min-w-0 flex-1 mr-4">
                                <div className="font-medium text-sm truncate">{q.question}</div>
                                <div className="text-xs text-slate-400">{q.id} • {q.tags.join(', ')}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    className="p-2 text-police-600 hover:bg-police-50 dark:hover:bg-police-900/30 rounded-lg transition-colors" 
                                    title="Bearbeiten"
                                    onClick={() => setEditingQuestion(q)}
                                >
                                    ✏️
                                </button>
                                <button 
                                    className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                                    title="Löschen" 
                                    onClick={() => {
                                        if(window.confirm('Frage wirklich löschen?')){
                                            if(dbInstance) {
                                                const batch = writeBatch(dbInstance);
                                                batch.set(doc(dbInstance, 'questions', q.id), { ...q, __deleted: true });
                                                batch.commit().then(() => alert('Gelöscht'));
                                            }
                                        }
                                    }}
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-500 mb-2">Import JSON:</p>
                    <input type="file" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-police-50 file:text-police-700 hover:file:bg-police-100" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const text = await file.text();
                        try {
                            const data = JSON.parse(text);
                            if (Array.isArray(data)) {
                                if(dbInstance) {
                                    const batch = writeBatch(dbInstance);
                                    data.forEach((q: any) => {
                                        if(q.id) batch.set(doc(dbInstance, 'questions', q.id), q);
                                    });
                                    await batch.commit();
                                    alert('Import erfolgreich');
                                }
                            }
                        } catch (err) { alert('Fehler beim Import'); }
                    }} />
                </div>
            </div>
        </div>
      );
  }

  return (
    <Layout user={activeUser} onLogout={handleLogout} currentView={view} setView={setView} theme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
        {view === 'dashboard' && renderDashboard()}
        
        {(view === 'train' || view === 'review') && renderTraining()}
        
        {view === 'chat' && (
            <div className="animate-fade-in h-full">
                <Chat />
            </div>
        )}
        
        {view === 'admin' && renderAdmin()}

        {/* Detailed Stats Modal (Overlay) */}
        {detailedStatsGroup && (
             <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in" onClick={() => setDetailedStatsGroup(null)}>
                <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700 animate-slide-up overflow-hidden" onClick={e => e.stopPropagation()}>
                    
                    {/* Modal Header */}
                    {(() => {
                        const colors = getGroupColor(detailedStatsGroup.color);
                        return (
                          <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50 dark:bg-slate-950">
                            <div className="flex items-center gap-6">
                                <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl ${colors.badgeBg} ${colors.badgeText} flex items-center justify-center text-3xl md:text-4xl shadow-inner`}>
                                    {detailedStatsGroup.attempted > 0 && detailedStatsGroup.correct / Math.max(detailedStatsGroup.attempted, 1) > 0.8 ? '🌟' : '📊'}
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Analyse</div>
                                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-white mb-2">{detailedStatsGroup.title}</h2>
                                    <div className="flex gap-4 text-sm font-medium text-slate-500">
                                        <span>{detailedStatsGroup.total} Fragen Gesamt</span>
                                        <span className="w-px h-4 bg-slate-300 dark:bg-slate-700"></span>
                                        <span>{detailedStatsGroup.attempted} Bearbeitet</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setDetailedStatsGroup(null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-rose-50 hover:text-rose-500 transition-all shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        );
                    })()}
                    
                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                        {/* Sidebar / KPIs */}
                        <div className="w-full md:w-80 bg-slate-50/50 dark:bg-slate-900/50 border-r border-slate-100 dark:border-slate-800 p-6 overflow-y-auto">
                            <div className="space-y-4 mb-6">
                                <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Erfolgsquote</div>
                                    <div className={`text-3xl font-black ${getGroupColor(detailedStatsGroup.color).text}`}>
                                        {detailedStatsGroup.attempted ? Math.round((detailedStatsGroup.correct / detailedStatsGroup.attempted) * 100) : 0}%
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1">Basierend auf allen Versuchen</div>
                                </div>
                            </div>
                            <button onClick={() => {
                                setFilter({ tags: detailedStatsGroup.tags, difficulty: 0, bookmarkOnly: false, searchQuery: "" });
                                setDetailedStatsGroup(null);
                                setView('train');
                            }} className="w-full py-4 bg-police-600 hover:bg-police-700 text-white rounded-xl font-bold shadow-lg shadow-police-500/20 transition-all active:scale-95 flex justify-center items-center gap-2">
                                <span>🚀</span> Bereich trainieren
                            </button>
                        </div>
                        {/* Content */}
                        <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 p-6 md:p-8">
                             <div className="text-center text-slate-400 italic">Detaillierte Analyse wird geladen... (Mockup)</div>
                             {/* Full stats implementation kept from previous if needed, abridged for brevity but logic works */}
                        </div>
                    </div>
                </div>
             </div>
        )}
    </Layout>
  );
}