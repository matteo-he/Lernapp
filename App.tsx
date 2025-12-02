import React, { useState, useMemo } from 'react';
import { useQuestions, useUsers, useProgress } from './hooks/useDataSync';
import { Layout } from './components/Layout';
import { GlassCard } from './components/Card';
import { Quiz } from './components/Quiz';
import { Chat } from './components/Chat';
import { Question, GROUPS, FilterState } from './types';
import { collection, doc, writeBatch, dbInstance } from './services/firebase';

// Helper for ranking
const RANKS = [
  { title: "Anwärter:in", min: 0 },
  { title: "Inspektor:in", min: 150 },
  { title: "Gruppeninspektor:in", min: 400 },
  { title: "Revierinspektor:in", min: 800 },
  { title: "Abteilungsinspektor:in", min: 1300 },
  { title: "Chefinspektor:in", min: 2000 },
];

function rankFor(score: number){
  const r = [...RANKS].reverse().find(r=>score>=r.min);
  return r? r.title : RANKS[0].title;
}

export default function App() {
  // Theme State
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') || 'light'; } catch { return 'light'; }
  });
  
  // Apply theme to html
  React.useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Data Hooks
  const { questions, setQuestions } = useQuestions();
  const { users, upsertUser, hashPassword } = useUsers();
  
  // Auth State
  const [activeUserId, setActiveUserId] = useState<string | null>(() => localStorage.getItem('activeUserId'));
  const activeUser = useMemo(() => users.find(u => u.id === activeUserId) || null, [users, activeUserId]);
  
  const [progress, updateProgress] = useProgress(activeUserId);

  // View State
  const [view, setView] = useState('dashboard');
  
  // Quiz State
  const [quizIdx, setQuizIdx] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showExplain, setShowExplain] = useState(false);
  const [score, setScore] = useState(() => {
     // Calculate simplistic score from progress for display
     return progress.totalCorrect * 10;
  });

  // Filter
  const [filter, setFilter] = useState<FilterState>({ tags: [], difficulty: 0 });

  // --- Actions ---

  const handleLogin = (id: string) => {
    setActiveUserId(id);
    localStorage.setItem('activeUserId', id);
  };

  const handleLogout = () => {
    setActiveUserId(null);
    localStorage.removeItem('activeUserId');
    setView('dashboard');
  };

  const handleAnswer = (selectedIndices: number[]) => {
    if (showExplain || !currentQuestion) return;
    
    // Shuffle check logic...
    const xmur3 = (str: string) => {
        let h = 1779033703 ^ str.length;
        for(let i=0;i<str.length;i++) h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        return function(){ h = Math.imul(h ^ h >>> 16, 2246822507); return (h ^ h >>> 16) >>> 0; }
    }
    const mulberry32 = (a: number) => {
        return function(){ let t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
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
    
    const isCorrect = [0,1,2,3,4].every(i => correctSet.has(i) === selectedSet.has(i));
    
    setShowExplain(true);
    
    if (isCorrect) {
        setScore(s => s + 10);
        setStreak(s => s + 1);
    } else {
        setStreak(0);
    }

    updateProgress(prev => {
        const attemptedIds = { ...prev.attemptedIds };
        attemptedIds[currentQuestion.id] = (attemptedIds[currentQuestion.id] || 0) + 1;
        const correctIds = { ...prev.correctIds };
        if (isCorrect) correctIds[currentQuestion.id] = (correctIds[currentQuestion.id] || 0) + 1;
        
        return {
            totalAttempts: prev.totalAttempts + 1,
            totalCorrect: prev.totalCorrect + (isCorrect ? 1 : 0),
            attemptedIds,
            correctIds
        };
    });
  };

  const nextQuestion = () => {
    setShowExplain(false);
    setQuizIdx(i => i + 1);
  };

  // --- Derived State ---

  const filteredQuestions = useMemo(() => {
      let q = questions;
      if (filter.tags.length > 0) q = q.filter(x => x.tags.some(t => filter.tags.includes(t)));
      return q;
  }, [questions, filter]);

  const currentQuestion = filteredQuestions.length > 0 ? filteredQuestions[quizIdx % filteredQuestions.length] : null;

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

  // --- Render ---

  // Auth Screen
  if (!activeUser) {
    return (
      <Layout user={null} onLogout={()=>{}} currentView="" setView={()=>{}} theme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
         <GlassCard className="p-8">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-police-600 rounded-2xl mx-auto flex items-center justify-center text-3xl mb-4 shadow-lg shadow-police-500/40">👮</div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Willkommen zurück</h2>
                <p className="text-slate-500 dark:text-slate-400">Bitte melden Sie sich an um fortzufahren</p>
            </div>
            <AuthForm users={users} onLogin={handleLogin} onRegister={(u) => { upsertUser(u); handleLogin(u.id); }} hashPassword={hashPassword} />
         </GlassCard>
      </Layout>
    );
  }

  // Admin View
  if (view === 'admin') {
      return (
        <Layout user={activeUser} onLogout={handleLogout} currentView="admin" setView={setView} theme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
            <h2 className="text-3xl font-bold mb-6">Verwaltung</h2>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-lg">Fragen-Datenbank</h3>
                    <span className="text-sm text-slate-500">{questions.length} Einträge</span>
                </div>
                <div className="h-96 overflow-y-auto space-y-2">
                    {questions.map(q => (
                        <div key={q.id} className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-700">
                            <div>
                                <div className="font-medium text-sm">{q.question.substring(0, 60)}...</div>
                                <div className="text-xs text-slate-400">{q.id} • {q.tags.join(', ')}</div>
                            </div>
                            <button className="text-xs bg-slate-100 dark:bg-slate-600 px-2 py-1 rounded" onClick={() => {
                                if(window.confirm('Löschen?')){
                                    const batch = writeBatch(dbInstance);
                                    batch.delete(doc(dbInstance, 'questions', q.id));
                                    batch.commit().then(() => alert('Gelöscht (Sync aktiv)'));
                                }
                            }}>Löschen</button>
                        </div>
                    ))}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-500 mb-2">Import JSON:</p>
                    <input type="file" className="block w-full text-sm text-slate-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-police-50 file:text-police-700
                      hover:file:bg-police-100
                    " onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const text = await file.text();
                        try {
                            const data = JSON.parse(text);
                            if (Array.isArray(data)) {
                                const batch = writeBatch(dbInstance);
                                data.forEach((q: any) => {
                                    if(q.id) batch.set(doc(dbInstance, 'questions', q.id), q);
                                });
                                await batch.commit();
                                alert('Import erfolgreich');
                            }
                        } catch (err) { alert('Fehler beim Import'); }
                    }} />
                </div>
            </div>
        </Layout>
      );
  }

  // Dashboard View
  if (view === 'dashboard') {
    return (
      <Layout user={activeUser} onLogout={handleLogout} currentView="dashboard" setView={setView} theme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
         <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Hallo, {activeUser.username} 👋</h2>
            <p className="text-slate-500 mt-1">Hier ist dein aktueller Lernfortschritt.</p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
             <StatCard label="Aktueller Rang" value={rankFor(score)} icon="🏆" color="yellow" />
             <StatCard label="XP Gesamt" value={score} icon="⚡" color="blue" />
             <StatCard label="Fragen beantwortet" value={progress.totalAttempts} icon="📝" color="indigo" />
             <StatCard label="Trefferquote" value={`${progress.totalAttempts ? Math.round((progress.totalCorrect/progress.totalAttempts)*100) : 0}%`} icon="🎯" color="emerald" />
         </div>

         <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">Fachbereiche</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {stats.map(s => {
                const percentage = s.total ? Math.round((s.correct / Math.max(s.attempted, 1)) * 100) : 0;
                const coverage = s.total ? Math.round((s.attempted / s.total) * 100) : 0;
                return (
                    <GlassCard key={s.key} className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className={`font-bold text-lg text-${s.color}-600 dark:text-${s.color}-400`}>{s.title}</h4>
                                <p className="text-sm text-slate-500">{s.attempted} / {s.total} Fragen bearbeitet</p>
                            </div>
                            <div className={`w-10 h-10 rounded-full bg-${s.color}-100 dark:bg-${s.color}-900/30 flex items-center justify-center text-${s.color}-600`}>
                                {percentage}%
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-xs mb-1"><span>Wissensstand</span></div>
                                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                                    <div className={`bg-${s.color}-500 h-2 rounded-full transition-all duration-1000`} style={{width: `${percentage}%`}}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs mb-1"><span>Abdeckung</span></div>
                                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                                    <div className="bg-slate-400 h-2 rounded-full transition-all duration-1000" style={{width: `${coverage}%`}}></div>
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                );
            })}
         </div>
      </Layout>
    );
  }

  // Chat View (New)
  if (view === 'chat') {
    return (
      <Layout user={activeUser} onLogout={handleLogout} currentView="chat" setView={setView} theme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
         <Chat />
      </Layout>
    );
  }

  // Training View (Default Fallback)
  return (
    <Layout user={activeUser} onLogout={handleLogout} currentView="train" setView={setView} theme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
        <div className="mb-6 flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
            <button 
                onClick={() => setFilter({ ...filter, tags: [] })}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter.tags.length === 0 ? 'bg-police-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}
            >
                Alle Bereiche
            </button>
            {GROUPS.map(g => (
                <button 
                    key={g.key}
                    onClick={() => setFilter({ ...filter, tags: g.tags })}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter.tags[0] === g.tags[0] ? `bg-${g.color}-500 text-white` : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}
                >
                    {g.title}
                </button>
            ))}
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
        />
    </Layout>
  );
}

// Subcomponents for App.tsx to keep it single file structure compliant as per request, 
// usually these go in separate files.

const StatCard = ({ label, value, icon, color }: any) => (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl bg-${color}-100 dark:bg-${color}-900/30 flex items-center justify-center text-2xl`}>
            {icon}
        </div>
        <div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
            <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{value}</div>
        </div>
    </div>
);

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
            const u = users.find((u: any) => u.username.toLowerCase() === name.toLowerCase());
            if (u && u.passwordHash === hashPassword(pass)) onLogin(u.id);
            else setError("Ungültige Daten");
        } else {
            if (users.find((u: any) => u.username.toLowerCase() === name.toLowerCase())) return setError("Name vergeben");
            // Basic ID gen
            const id = `user-${Date.now()}`;
            onRegister({ id, username: name, passwordHash: hashPassword(pass), role: 'user' });
        }
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Benutzername</label>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Passwort</label>
                <input type="password" value={pass} onChange={e => setPass(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" />
            </div>
            {error && <div className="text-rose-500 text-sm">{error}</div>}
            <button type="submit" className="w-full bg-police-600 text-white py-2 rounded-lg font-semibold hover:bg-police-700 transition-colors">
                {isLogin ? 'Anmelden' : 'Registrieren'}
            </button>
            <div className="text-center text-sm text-slate-500 cursor-pointer hover:underline" onClick={() => setIsLogin(!isLogin)}>
                {isLogin ? 'Noch keinen Account? Registrieren' : 'Zurück zum Login'}
            </div>
        </form>
    );
};