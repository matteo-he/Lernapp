import React, { useState, useMemo, useEffect } from 'react';
import { useQuestions, useUsers, useProgress } from './hooks/useDataSync.ts';
import { Layout } from './components/Layout.tsx';
import { GlassCard } from './components/Card.tsx';
import { Quiz } from './components/Quiz.tsx';
import { Question, GROUPS, FilterState } from './types.ts';
import { collection, doc, writeBatch, dbInstance, setDoc } from './services/firebase.ts';

// --- Helper Functions (Moved outside component) ---
function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for(let i=0;i<str.length;i++) h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
  return function(): number { h = Math.imul(h ^ h >>> 16, 2246822507); return (h ^ h >>> 16) >>> 0; }
}
function mulberry32(a: number) {
  return function(): number { let t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
}
function getOrder(id: string, i: number): number[] {
    const seedFunc = xmur3(`${id}#${i}`);
    const seed = seedFunc();
    const rng = mulberry32(seed);
    const a = [0,1,2,3,4];
    for(let k=a.length-1;k>0;k--){ const j=Math.floor(rng()*(k+1)); [a[k],a[j]]=[a[j],a[k]]; }
    return a;
}

const RANKS = [
  { title: "Anwärter:in", min: 0 },
  { title: "Inspektor:in", min: 150 },
  { title: "Gruppeninspektor:in", min: 400 },
  { title: "Revierinspektor:in", min: 800 },
  { title: "Abteilungsinspektor:in", min: 1300 },
  { title: "Chefinspektor:in", min: 2000 },
];

const COLOR_MAP: Record<string, any> = {
  yellow: { bg: 'bg-yellow-500', text: 'text-yellow-600', badgeBg: 'bg-yellow-100', badgeText: 'text-yellow-800', bar: 'bg-yellow-500', border: 'border-yellow-500' },
  blue:   { bg: 'bg-blue-500',   text: 'text-blue-600',   badgeBg: 'bg-blue-100',   badgeText: 'text-blue-800',   bar: 'bg-blue-500',   border: 'border-blue-500' },
  red:    { bg: 'bg-red-500',    text: 'text-red-600',    badgeBg: 'bg-red-100',    badgeText: 'text-red-800',    bar: 'bg-red-500',    border: 'border-red-500' },
  rose:   { bg: 'bg-rose-500',   text: 'text-rose-600',   badgeBg: 'bg-rose-100',   badgeText: 'text-rose-800',   bar: 'bg-rose-500',   border: 'border-rose-500' },
  green:  { bg: 'bg-emerald-500',text: 'text-emerald-600',badgeBg: 'bg-emerald-100',badgeText: 'text-emerald-800',bar: 'bg-emerald-500',border: 'border-emerald-500' },
  emerald:{ bg: 'bg-emerald-500',text: 'text-emerald-600',badgeBg: 'bg-emerald-100',badgeText: 'text-emerald-800',bar: 'bg-emerald-500',border: 'border-emerald-500' },
};

function getGroupColor(colorKey: string) { return COLOR_MAP[colorKey] || COLOR_MAP.blue; }
function rankFor(score: number){ const r = [...RANKS].reverse().find(r=>score>=r.min); return r? r.title : RANKS[0].title; }

const SRS_INTERVALS = [0, 10*60*1000, 24*3600*1000, 3*24*3600*1000, 7*24*3600*1000, 14*24*3600*1000];
function getSRSLabel(level: number): string {
    const labels = ["Sofort", "10 Minuten", "1 Tag", "3 Tage", "1 Woche", "2 Wochen"];
    return labels[Math.min(level, labels.length-1)] || "Lange Zeit";
}

// --- Subcomponents ---

const StatCard = ({ label, value, icon, color }: any) => {
    const colors: any = { yellow: 'text-yellow-600 bg-yellow-100', blue: 'text-blue-600 bg-blue-100', indigo: 'text-indigo-600 bg-indigo-100', emerald: 'text-emerald-600 bg-emerald-100' };
    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4 hover:scale-[1.02] transition-transform">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${colors[color] || colors.blue} dark:bg-opacity-20`}>{icon}</div>
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
            <div><label className="block text-sm font-bold mb-1">Benutzername</label><input value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-lg border bg-slate-50 dark:bg-slate-900 dark:border-slate-700" placeholder="Max" /></div>
            <div><label className="block text-sm font-bold mb-1">Passwort</label><input type="password" value={pass} onChange={e => setPass(e.target.value)} className="w-full px-4 py-3 rounded-lg border bg-slate-50 dark:bg-slate-900 dark:border-slate-700" placeholder="••••" /></div>
            {error && <div className="text-rose-500 text-sm">{error}</div>}
            <button type="submit" className="w-full bg-police-600 text-white py-3 rounded-lg font-bold hover:bg-police-700 shadow-lg">{isLogin ? 'Anmelden' : 'Registrieren'}</button>
            <div className="text-center text-sm text-slate-500 cursor-pointer hover:underline" onClick={() => setIsLogin(!isLogin)}>{isLogin ? 'Registrieren' : 'Login'}</div>
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
    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
            <h3 className="text-xl font-bold mb-6">Frage bearbeiten</h3>
            <div className="space-y-4">
                <div><label className="block text-sm font-bold">Frage</label><textarea value={q.question} onChange={e=>setQ({...q, question: e.target.value})} className="w-full p-3 border rounded-lg bg-transparent" rows={3}/></div>
                <div className="grid gap-2">
                    <label className="block text-sm font-bold">Antworten</label>
                    {q.choices.map((c: string, i: number) => (
                        <div key={i} className="flex gap-3 items-center">
                            <input type="checkbox" checked={q.correct.includes(i)} onChange={()=>toggleCorrect(i)} className="w-5 h-5 accent-police-600" />
                            <input value={c} onChange={e=> { const nc = [...q.choices]; nc[i] = e.target.value; setQ({...q, choices: nc}); }} className="flex-1 p-2 border rounded-lg bg-transparent" />
                        </div>
                    ))}
                </div>
                <div><label className="block text-sm font-bold">Erklärung</label><textarea value={q.explain} onChange={e=>setQ({...q, explain: e.target.value})} className="w-full p-3 border rounded-lg bg-transparent" rows={3} /></div>
                <div className="flex justify-end gap-3 pt-6"><button onClick={onCancel} className="px-4 py-2 font-bold text-slate-500">Abbrechen</button><button onClick={()=>onSave(q)} className="px-6 py-2 bg-police-600 text-white rounded-lg font-bold">Speichern</button></div>
            </div>
        </div>
    );
};

// --- Main App ---

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  React.useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const { questions } = useQuestions();
  const { users, upsertUser, hashPassword } = useUsers();
  const [activeUserId, setActiveUserId] = useState<string | null>(() => localStorage.getItem('activeUserId'));
  const activeUser = useMemo(() => users.find(u => u.id === activeUserId) || null, [users, activeUserId]);
  const [progress, updateProgress] = useProgress(activeUserId);

  const [view, setView] = useState('dashboard');
  const [quizIdx, setQuizIdx] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showExplain, setShowExplain] = useState(false);
  const [score, setScore] = useState(0);
  const [feedbackMeta, setFeedbackMeta] = useState<{ label: string, isCorrect: boolean } | null>(null);
  const [filter, setFilter] = useState<FilterState>({ tags: [], difficulty: 0, bookmarkOnly: false, searchQuery: "" });
  const [adminSearch, setAdminSearch] = useState("");
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [detailedStatsGroup, setDetailedStatsGroup] = useState<any | null>(null);

  React.useEffect(() => { if(progress.totalCorrect) setScore(progress.totalCorrect * 10); }, [progress.totalCorrect]);

  // Reset quiz index when filtering changes to prevent seeing "All done" or jumping to random questions
  useEffect(() => {
    setQuizIdx(0);
    setShowExplain(false);
  }, [filter, view]);

  const handleLogin = (id: string) => { setActiveUserId(id); localStorage.setItem('activeUserId', id); setView('dashboard'); };
  const handleLogout = () => { setActiveUserId(null); localStorage.removeItem('activeUserId'); setView('dashboard'); };

  const getCandidateQuestions = useMemo(() => {
      let q = questions || []; // Default to empty array safety
      if (view === 'review') {
          const now = Date.now();
          return q.filter(x => {
              const inQueue = (progress.reviewQueue || []).includes(x.id);
              const nextDate = (progress.nextReviewDate || {})[x.id] || 0;
              return inQueue && nextDate <= now;
          });
      }
      if (filter.bookmarkOnly) q = q.filter(x => (progress.bookmarks || []).includes(x.id));
      else if (filter.tags.length > 0) q = q.filter(x => (x.tags || []).some(t => filter.tags.includes(t)));
      
      if (filter.searchQuery.trim()) {
          const term = filter.searchQuery.toLowerCase();
          q = q.filter(x => 
              (x.question || "").toLowerCase().includes(term) || 
              (x.explain || "").toLowerCase().includes(term) || 
              (x.tags || []).some(t => t.toLowerCase().includes(term))
          );
      }
      return q;
  }, [questions, filter, progress.bookmarks, progress.reviewQueue, progress.nextReviewDate, view]);

  const currentQuestion = getCandidateQuestions.length > 0 ? getCandidateQuestions[quizIdx % getCandidateQuestions.length] : null;

  const handleAnswer = (selectedIndices: number[]) => {
    if (showExplain || !currentQuestion) return;
    
    const displayOrder = getOrder(currentQuestion.id, quizIdx);
    const selectedOriginals: number[] = selectedIndices.map((i: number) => displayOrder[i]);
    const correctSet = new Set(currentQuestion.correct);
    const selectedSet = new Set(selectedOriginals);
    const isCorrect = correctSet.size === selectedSet.size && [...correctSet].every((val: number) => selectedSet.has(val));

    let nextLabel = "Sofort";
    if (isCorrect) {
        const currentS = progress.reviewStreak?.[currentQuestion.id] ?? 0;
        nextLabel = getSRSLabel(currentS + 1);
        setScore(s => s + 10);
        setStreak(s => s + 1);
        if(streak > 0 && (streak+1) % 5 === 0 && (window as any).confetti) (window as any).confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } else {
        setStreak(0);
    }
    
    setFeedbackMeta({ label: nextLabel, isCorrect });
    setShowExplain(true);

    updateProgress(prev => {
        const attemptedIds = { ...prev.attemptedIds, [currentQuestion.id]: (prev.attemptedIds[currentQuestion.id] || 0) + 1 };
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
                 reviewStreak[currentQuestion.id] = currentS + 1;
                 const interval = SRS_INTERVALS[Math.min(currentS + 1, SRS_INTERVALS.length - 1)];
                 nextReviewDate[currentQuestion.id] = Date.now() + interval;
             }
        }
        return { ...prev, totalAttempts: prev.totalAttempts + 1, totalCorrect: prev.totalCorrect + (isCorrect ? 1 : 0), attemptedIds, correctIds, reviewQueue, reviewStreak, nextReviewDate };
    });
  };

  const nextQuestion = () => {
    setShowExplain(false);
    const wasCorrect = feedbackMeta?.isCorrect;
    setFeedbackMeta(null);
    if (view === 'review' && wasCorrect) setQuizIdx(i => i); 
    else setQuizIdx(i => i + 1);
  };

  const toggleBookmark = (id: string) => {
      updateProgress(p => {
          const b = p.bookmarks || [];
          return { ...p, bookmarks: b.includes(id) ? b.filter(x => x !== id) : [...b, id] };
      });
  };

  const stats = useMemo(() => {
    return GROUPS.map(g => {
        const groupQuestions = questions.filter(q => (q.tags || []).some(t => g.tags.includes(t)));
        let attempted = 0; let correct = 0;
        groupQuestions.forEach(q => { attempted += (progress.attemptedIds[q.id] || 0); correct += (progress.correctIds[q.id] || 0); });
        return { ...g, total: groupQuestions.length, attempted, correct };
    });
  }, [questions, progress]);

  const dueReviewsCount = useMemo(() => {
      if (!progress.reviewQueue) return 0;
      const now = Date.now();
      return progress.reviewQueue.filter(id => ((progress.nextReviewDate || {})[id] || 0) <= now).length;
  }, [progress]);

  if (!activeUser) {
    return (
      <Layout user={null} onLogout={()=>{}} currentView="" setView={()=>{}} theme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
         <GlassCard className="p-8">
            <div className="text-center mb-8"><h2 className="text-2xl font-bold">Willkommen zurück</h2></div>
            <AuthForm users={users} onLogin={handleLogin} onRegister={(u: any) => { upsertUser(u); handleLogin(u.id); }} hashPassword={hashPassword} />
         </GlassCard>
      </Layout>
    );
  }

  return (
    <Layout user={activeUser} onLogout={handleLogout} currentView={view} setView={setView} theme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
        {view === 'dashboard' && (
             <div className="animate-fade-in space-y-8">
                 <div className="flex justify-between items-center">
                    <div><h2 className="text-3xl font-bold">Hallo, {activeUser.username} 👋</h2></div>
                    {activeUser.role === 'admin' && <button onClick={() => setView('admin')} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-xl font-bold">Verwaltung</button>}
                 </div>
                 
                 {/* Review Card */}
                 <div onClick={() => { if(progress.reviewQueue?.length > 0) { setView('review'); setQuizIdx(0); } }}
                    className={`rounded-2xl p-6 cursor-pointer relative overflow-hidden transition-all ${progress.reviewQueue?.length > 0 ? 'bg-gradient-to-r from-rose-500 to-orange-600 shadow-xl' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}>
                     <div className="relative z-10 flex justify-between items-center">
                         <div className={progress.reviewQueue?.length > 0 ? 'text-white' : ''}>
                             <div className="text-sm font-bold uppercase tracking-wider mb-2 opacity-80">Wiederholung</div>
                             <h3 className="text-3xl font-extrabold">{dueReviewsCount > 0 ? `${dueReviewsCount} Fällig` : `${progress.reviewQueue?.length || 0} Archiviert`}</h3>
                         </div>
                         <div className="text-4xl">🩹</div>
                     </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                     <StatCard label="Rang" value={rankFor(score)} icon="🏆" color="yellow" />
                     <StatCard label="XP" value={score} icon="⚡" color="blue" />
                     <StatCard label="Fragen" value={progress.totalAttempts} icon="📝" color="indigo" />
                     <StatCard label="Quote" value={`${progress.totalAttempts ? Math.round((progress.totalCorrect/progress.totalAttempts)*100) : 0}%`} icon="🎯" color="emerald" />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {stats.map(s => {
                        const pct = s.total ? Math.round((s.correct / Math.max(s.attempted, 1)) * 100) : 0;
                        const colors = getGroupColor(s.color);
                        return (
                            <GlassCard key={s.key} className={`p-6 cursor-pointer hover:shadow-xl border-l-4 ${colors.border}`} onClick={() => setDetailedStatsGroup(s)}>
                                <h4 className="font-bold text-lg mb-2">{s.title}</h4>
                                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                                    <div className={`${colors.bar} h-full`} style={{width: `${pct}%`}}></div>
                                </div>
                                <div className="text-xs text-slate-400 mt-2">{pct}% Korrekt • {s.attempted}/{s.total} Fragen</div>
                            </GlassCard>
                        );
                    })}
                 </div>
             </div>
        )}
        
        {(view === 'train' || view === 'review') && (
            <div className="animate-fade-in">
                <div className="mb-6 space-y-4">
                    <div className="flex items-center justify-between">
                         <button onClick={() => setView('dashboard')} className="text-sm font-bold text-slate-400 hover:text-police-600">← Dashboard</button>
                         <h2 className="text-2xl font-bold">{view === 'review' ? 'Wiederholung' : 'Training'}</h2>
                    </div>
                    {view !== 'review' && (
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4">
                            <input type="text" placeholder="Suche..." value={filter.searchQuery} onChange={e => setFilter(prev => ({...prev, searchQuery: e.target.value}))} className="flex-1 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700" />
                            <select value={filter.tags[0] || ""} onChange={e => setFilter(prev => ({...prev, tags: e.target.value ? [e.target.value] : []}))} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 md:w-64">
                                <option value="">Alle Themen</option>
                                {GROUPS.map(g => <option key={g.key} value={g.tags[0]}>{g.title}</option>)}
                            </select>
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
                    mode={view}
                    onBookmark={toggleBookmark}
                    isBookmarked={currentQuestion ? (progress.bookmarks || []).includes(currentQuestion.id) : false}
                    srsLevel={currentQuestion ? progress.reviewStreak?.[currentQuestion.id] : undefined}
                    feedbackMeta={feedbackMeta}
                />
            </div>
        )}
        
        {view === 'admin' && (
            <div className="animate-fade-in">
                {editingQuestion ? (
                    <QuestionEditor 
                        question={editingQuestion} 
                        onSave={async (q: Question) => { 
                             if (dbInstance) { await setDoc(doc(dbInstance, 'questions', q.id), q, { merge: true }); alert('Gespeichert'); setEditingQuestion(null); }
                             else { alert('Offline: Kann nicht speichern'); }
                        }}
                        onCancel={() => setEditingQuestion(null)}
                    />
                ) : (
                    <div className="space-y-4">
                        <div className="flex justify-between"><h2 className="text-3xl font-bold">Verwaltung</h2><button className="text-sm bg-slate-200 px-3 py-1 rounded" onClick={() => setEditingQuestion({id: 'new-'+Date.now(), question:'', choices:['','','',''], correct:[], explain:'', tags:[], law_ref:'', last_checked:'', difficulty:1} as any)}>+ Neu</button></div>
                        <input value={adminSearch} onChange={e=>setAdminSearch(e.target.value)} placeholder="Frage suchen..." className="w-full p-2 border rounded" />
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                            {/* Added safety check (q.question || "") to prevent crashes on bad data */}
                            {questions.filter(q => (q.question || "").toLowerCase().includes((adminSearch || "").toLowerCase())).map(q => (
                                <div key={q.id} className="p-3 bg-white dark:bg-slate-800 rounded border flex justify-between items-center">
                                    <div className="truncate flex-1 pr-4">{q.question || "Ohne Titel"}</div>
                                    <button onClick={() => setEditingQuestion(q)}>✏️</button>
                                </div>
                            ))}
                        </div>
                        {/* Import/Export could go here */}
                    </div>
                )}
            </div>
        )}

        {detailedStatsGroup && (
             <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDetailedStatsGroup(null)}>
                <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                    <h2 className="text-2xl font-bold mb-4">{detailedStatsGroup.title}</h2>
                    <div className="space-y-4 mb-6">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                            <div className="text-sm text-slate-500">Erfolgsquote</div>
                            <div className="text-3xl font-black">{detailedStatsGroup.attempted ? Math.round((detailedStatsGroup.correct / detailedStatsGroup.attempted) * 100) : 0}%</div>
                        </div>
                    </div>
                    <button onClick={() => { setFilter({ tags: detailedStatsGroup.tags, difficulty: 0, bookmarkOnly: false, searchQuery: "" }); setDetailedStatsGroup(null); setView('train'); }} className="w-full py-3 bg-police-600 text-white rounded-xl font-bold">Bereich trainieren</button>
                </div>
             </div>
        )}
    </Layout>
  );
}