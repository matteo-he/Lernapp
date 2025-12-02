import React, { useState, useMemo } from 'react';
import { useQuestions, useUsers, useProgress } from './hooks/useDataSync';
import { Layout } from './components/Layout';
import { GlassCard } from './components/Card';
import { Quiz } from './components/Quiz';
import { Chat } from './components/Chat';
import { Question, GROUPS, FilterState } from './types';
import { collection, doc, writeBatch, dbInstance, setDoc } from './services/firebase';

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
  const [filter, setFilter] = useState<FilterState>({ tags: [], difficulty: 0, bookmarkOnly: false });

  // Admin Search & Edit State
  const [adminSearch, setAdminSearch] = useState("");
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Stats Detail Modal State
  const [detailedStatsGroup, setDetailedStatsGroup] = useState<any | null>(null);

  // Exam Results
  const [examResults, setExamResults] = useState({ correct: 0, total: 0, done: false });

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

  const getCandidateQuestions = useMemo(() => {
      let q = questions;
      if (filter.bookmarkOnly) {
          q = q.filter(x => (progress.bookmarks || []).includes(x.id));
      } else if (filter.tags.length > 0) {
          q = q.filter(x => x.tags.some(t => filter.tags.includes(t)));
      }
      return q;
  }, [questions, filter, progress.bookmarks]);

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

    if(view === 'exam') {
       setExamResults(p => ({ ...p, total: p.total + 1, correct: p.correct + (isCorrect ? 1 : 0) }));
       if(examResults.total >= 19) { 
           setExamResults(p => ({ ...p, done: true }));
       } else {
           nextQuestion();
       }
       return; 
    }
    
    setShowExplain(true);
    
    if (isCorrect) {
        setScore(s => s + 10);
        setStreak(s => s + 1);
        if(streak > 0 && (streak+1) % 5 === 0 && (window as any).confetti) (window as any).confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } else {
        setStreak(0);
    }

    updateProgress(prev => {
        const attemptedIds = { ...prev.attemptedIds };
        attemptedIds[currentQuestion.id] = (attemptedIds[currentQuestion.id] || 0) + 1;
        const correctIds = { ...prev.correctIds };
        if (isCorrect) correctIds[currentQuestion.id] = (correctIds[currentQuestion.id] || 0) + 1;
        
        return {
            ...prev,
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
  
  const toggleBookmark = (id: string) => {
      updateProgress(p => {
          const b = p.bookmarks || [];
          const next = b.includes(id) ? b.filter(x => x !== id) : [...b, id];
          return { ...p, bookmarks: next };
      });
  };

  // --- Derived State ---

  // Simple sequential logic for now, can be replaced by smart shuffle if needed
  const currentQuestion = getCandidateQuestions.length > 0 ? getCandidateQuestions[quizIdx % getCandidateQuestions.length] : null;

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
            <AuthForm users={users} onLogin={handleLogin} onRegister={(u: any) => { upsertUser(u); handleLogin(u.id); }} hashPassword={hashPassword} />
         </GlassCard>
      </Layout>
    );
  }

  // Admin View
  if (view === 'admin') {
      if (editingQuestion) {
          return (
             <Layout user={activeUser} onLogout={handleLogout} currentView="admin" setView={setView} theme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
                <h2 className="text-3xl font-bold mb-6">Frage bearbeiten</h2>
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
             </Layout>
          );
      }

      return (
        <Layout user={activeUser} onLogout={handleLogout} currentView="admin" setView={setView} theme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
            <h2 className="text-3xl font-bold mb-6">Verwaltung</h2>
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
                                                // Soft delete
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
        </Layout>
      );
  }

  // Dashboard View
  if (view === 'dashboard') {
    return (
      <Layout user={activeUser} onLogout={handleLogout} currentView="dashboard" setView={setView} theme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
         <div className="mb-8 animate-fade-in flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Hallo, {activeUser.username} 👋</h2>
                <p className="text-slate-500 mt-1">Hier ist dein aktueller Lernfortschritt.</p>
            </div>
            <div className="flex gap-2">
                {activeUser.role === 'admin' && <button onClick={() => setView('admin')} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-xl text-sm font-bold">Verwaltung</button>}
                {(progress.bookmarks || []).length > 0 && (
                    <button onClick={() => { setFilter({tags:[], difficulty:0, bookmarkOnly:true}); setView('train'); }} className="px-6 py-3 rounded-2xl bg-amber-100 text-amber-800 font-bold shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 hover:scale-105 transition-all flex items-center gap-2">
                        <span>★</span> {(progress.bookmarks || []).length} Gemerkte Fragen üben
                    </button>
                )}
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
             <StatCard label="Aktueller Rang" value={rankFor(score)} icon="🏆" color="yellow" />
             <StatCard label="XP Gesamt" value={score} icon="⚡" color="blue" />
             <StatCard label="Fragen beantwortet" value={progress.totalAttempts} icon="📝" color="indigo" />
             <StatCard label="Trefferquote" value={`${progress.totalAttempts ? Math.round((progress.totalCorrect/progress.totalAttempts)*100) : 0}%`} icon="🎯" color="emerald" />
         </div>

         <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">Fachbereiche (Details & Analyse)</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {stats.map(s => {
                const percentage = s.total ? Math.round((s.correct / Math.max(s.attempted, 1)) * 100) : 0;
                const coverage = s.total ? Math.round((s.attempted / s.total) * 100) : 0;
                return (
                    <GlassCard 
                        key={s.key} 
                        className="p-6 cursor-pointer hover:shadow-xl hover:translate-y-[-4px] transition-all relative group border-l-4"
                        style={{ borderLeftColor: `var(--color-${s.color}-500)` }}
                        onClick={() => setDetailedStatsGroup(s)} // Trigger Modal
                    >
                         <div className="absolute top-4 right-4 text-slate-300 group-hover:text-police-500 transition-colors bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                             </svg>
                         </div>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className={`font-bold text-lg text-slate-800 dark:text-white group-hover:text-police-600 transition-colors`}>{s.title}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-500">{s.key}</span>
                                    <span className="text-xs text-slate-400">{s.attempted} / {s.total} Fragen</span>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-xs mb-1.5 font-semibold text-slate-500"><span>Wissensstand</span> <span>{percentage}%</span></div>
                                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                                    <div className={`bg-${s.color}-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(0,0,0,0.1)]`} style={{width: `${percentage}%`}}></div>
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

         {/* Detailed Analysis Modal */}
         {detailedStatsGroup && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in" onClick={() => setDetailedStatsGroup(null)}>
                <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700 animate-slide-up overflow-hidden" onClick={e => e.stopPropagation()}>
                    
                    {/* Modal Header */}
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50 dark:bg-slate-950">
                        <div className="flex items-center gap-6">
                            <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-${detailedStatsGroup.color}-100 dark:bg-${detailedStatsGroup.color}-900/20 flex items-center justify-center text-3xl md:text-4xl shadow-inner`}>
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
                    
                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                        {/* Sidebar / KPIs */}
                        <div className="w-full md:w-80 bg-slate-50/50 dark:bg-slate-900/50 border-r border-slate-100 dark:border-slate-800 p-6 overflow-y-auto">
                            
                            {/* KPI Cards */}
                            <div className="space-y-4 mb-6">
                                <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Erfolgsquote</div>
                                    <div className={`text-3xl font-black text-${detailedStatsGroup.color}-600`}>
                                        {detailedStatsGroup.attempted ? Math.round((detailedStatsGroup.correct / detailedStatsGroup.attempted) * 100) : 0}%
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1">Basierend auf allen Versuchen</div>
                                </div>
                                <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Offene Fragen</div>
                                    <div className="text-3xl font-black text-slate-400">
                                        {detailedStatsGroup.total - (questions.filter(q => q.tags.some(t => detailedStatsGroup.tags.includes(t)) && progress.attemptedIds[q.id]).length)}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1">Noch nie bearbeitet</div>
                                </div>
                            </div>

                            <button onClick={() => {
                                setFilter({ tags: detailedStatsGroup.tags, difficulty: 0, bookmarkOnly: false });
                                setDetailedStatsGroup(null);
                                setView('train');
                            }} className="w-full py-4 bg-police-600 hover:bg-police-700 text-white rounded-xl font-bold shadow-lg shadow-police-500/20 transition-all active:scale-95 flex justify-center items-center gap-2">
                                <span>🚀</span> Bereich trainieren
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 p-6 md:p-8">
                             {(() => {
                                // Logic to sort questions & tags
                                const groupQs = questions.filter(q => q.tags.some(t => detailedStatsGroup.tags.includes(t)));
                                const groupTags = detailedStatsGroup.tags;
                                
                                // Tag Stats Calculation
                                const tagStats = groupTags.map((tag: string) => {
                                    const tagQs = questions.filter(q => q.tags.includes(tag));
                                    let tAtt = 0;
                                    let tCorr = 0;
                                    tagQs.forEach(q => {
                                        tAtt += (progress.attemptedIds[q.id] || 0);
                                        tCorr += (progress.correctIds[q.id] || 0);
                                    });
                                    return { tag, tAtt, tCorr, total: tagQs.length };
                                }).filter((t: any) => t.total > 0).sort((a: any,b: any) => {
                                    const effA = a.tAtt ? a.tCorr/a.tAtt : 0;
                                    const effB = b.tAtt ? b.tCorr/b.tAtt : 0;
                                    return effA - effB; // Sort ascending efficiency (weakest first)
                                });

                                // Categorize Questions
                                const critical = groupQs.filter(q => {
                                    const att = progress.attemptedIds[q.id] || 0;
                                    const corr = progress.correctIds[q.id] || 0;
                                    return att > 0 && (corr / att) <= 0.6; // High error rate
                                });

                                const stable = groupQs.filter(q => {
                                    const att = progress.attemptedIds[q.id] || 0;
                                    const corr = progress.correctIds[q.id] || 0;
                                    return att > 0 && (corr / att) > 0.6 && (corr / att) < 1;
                                });

                                const mastered = groupQs.filter(q => {
                                    const att = progress.attemptedIds[q.id] || 0;
                                    const corr = progress.correctIds[q.id] || 0;
                                    return att > 0 && att === corr;
                                });
                                
                                const unseen = groupQs.filter(q => !progress.attemptedIds[q.id]);

                                const Section = ({ title, items, color, info }: any) => (
                                    <div className="mb-8">
                                        <div className="flex items-baseline justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                                            <h4 className={`text-lg font-bold ${color}`}>{title} <span className="text-sm opacity-60 ml-2">({items.length})</span></h4>
                                            <span className="text-xs text-slate-400 hidden md:inline">{info}</span>
                                        </div>
                                        {items.length === 0 ? (
                                            <div className="text-sm text-slate-400 italic py-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-center">Keine Fragen in dieser Kategorie.</div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-3">
                                                {items.slice(0, 10).map((q: Question) => {
                                                     const att = progress.attemptedIds[q.id] || 0;
                                                     const corr = progress.correctIds[q.id] || 0;
                                                     const rate = att ? Math.round((corr/att)*100) : 0;
                                                     
                                                     return (
                                                        <div key={q.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                                            <div className="flex-1">
                                                                <div className="font-medium text-slate-800 dark:text-slate-200 text-sm md:text-base">{q.question}</div>
                                                                <div className="flex gap-2 mt-2">
                                                                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded text-[10px] font-bold uppercase">Lvl {q.difficulty}</span>
                                                                    <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 rounded text-[10px] font-bold font-mono">§ {q.law_ref}</span>
                                                                </div>
                                                            </div>
                                                            
                                                            {att > 0 && (
                                                                <div className="w-full md:w-32 shrink-0">
                                                                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                                                                        <span>{rate}%</span>
                                                                        <span>{corr}/{att}</span>
                                                                    </div>
                                                                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                        <div 
                                                                            className={`h-full rounded-full ${rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`} 
                                                                            style={{width: `${rate}%`}}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                     )
                                                })}
                                                {items.length > 10 && <div className="text-center text-xs text-slate-400 italic pt-2">... und {items.length - 10} weitere</div>}
                                            </div>
                                        )}
                                    </div>
                                );

                                return (
                                    <div className="animate-fade-in">
                                        {/* Tag Breakdown & Weakest Link */}
                                        <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            {/* Tag Breakdown */}
                                            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm">
                                                <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><span className="text-lg">📈</span> Themen-Deep-Dive</h4>
                                                <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                                                    {tagStats.map((ts: any) => {
                                                        const eff = ts.tAtt ? Math.round((ts.tCorr / ts.tAtt) * 100) : 0;
                                                        return (
                                                            <div key={ts.tag}>
                                                                <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                                                                    <span>{ts.tag} <span className="text-[10px] font-normal opacity-70">({ts.total})</span></span>
                                                                    <span className={eff < 50 ? 'text-rose-500' : eff > 80 ? 'text-emerald-500' : 'text-amber-500'}>{eff}%</span>
                                                                </div>
                                                                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                    <div className={`h-full rounded-full ${eff < 50 ? 'bg-rose-500' : eff > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{width: `${eff}%`}} />
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>

                                            {/* Recommendation Card */}
                                            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-lg flex flex-col justify-center">
                                                <h4 className="font-bold mb-1 opacity-90 text-sm uppercase tracking-wide">Fokus-Empfehlung</h4>
                                                {tagStats.length > 0 && tagStats[0].tAtt > 0 ? (
                                                    <div>
                                                        <div className="text-3xl font-black mb-1">{tagStats[0].tag}</div>
                                                        <p className="text-xs opacity-80 mb-4 leading-relaxed">In diesem Bereich hast du die niedrigste Erfolgsquote. Wir empfehlen eine gezielte Trainingseinheit.</p>
                                                        <button onClick={()=>{
                                                            setFilter({tags: [tagStats[0].tag], difficulty: 0, bookmarkOnly: false});
                                                            setDetailedStatsGroup(null);
                                                            setView('train');
                                                        }} className="px-4 py-2 bg-white text-indigo-600 font-bold rounded-lg text-xs shadow hover:bg-indigo-50 transition-colors">
                                                            Jetzt {tagStats[0].tag} üben
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <div className="text-2xl font-black mb-1">Starte das Training</div>
                                                        <p className="text-xs opacity-80">Sobald du erste Fragen beantwortet hast, zeigen wir dir hier deine Schwachstellen.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <Section 
                                            title="⚠️ Kritisch / Fokusbereich" 
                                            items={critical} 
                                            color="text-rose-600" 
                                            info="Hohe Fehlerrate – dringend wiederholen!"
                                        />
                                        <Section 
                                            title="🔄 In Arbeit" 
                                            items={stable} 
                                            color="text-amber-500"
                                            info="Teilweise richtig, aber noch nicht sattelfest."
                                        />
                                        <Section 
                                            title="✅ Gemeistert" 
                                            items={mastered} 
                                            color="text-emerald-600"
                                            info="Fehlerfrei beantwortet."
                                        />
                                        <Section 
                                            title="⚪ Neu / Unbekannt" 
                                            items={unseen} 
                                            color="text-slate-500"
                                            info="Noch nie bearbeitet."
                                        />
                                    </div>
                                );
                             })()}
                        </div>
                    </div>
                </div>
            </div>
         )}
      </Layout>
    );
  }

  // Chat View
  if (view === 'chat') {
    return (
      <Layout user={activeUser} onLogout={handleLogout} currentView="chat" setView={setView} theme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
         <Chat />
      </Layout>
    );
  }

  // Exam View
  if (view === 'exam') {
      if(examResults.done) {
        return (
            <Layout user={activeUser} onLogout={handleLogout} currentView="exam" setView={setView} theme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
                <div className="flex flex-col items-center justify-center py-20 text-center animate-slide-up">
                    <h2 className="text-3xl font-bold mb-4">Prüfung Beendet</h2>
                    <div className="text-6xl font-black mb-2 text-police-600">{Math.round((examResults.correct/Math.max(examResults.total,1))*100)}%</div>
                    <p className="text-slate-500 mb-8">{examResults.correct} von {examResults.total} richtig beantwortet</p>
                    <button onClick={() => { setExamResults({correct:0,total:0,done:false}); setQuizIdx(0); }} className="px-8 py-3 bg-police-600 text-white rounded-xl font-bold shadow-lg hover:bg-police-700 transition-colors">Neue Prüfung starten</button>
                </div>
            </Layout>
        );
      }
      return (
        <Layout user={activeUser} onLogout={handleLogout} currentView="exam" setView={setView} theme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
            <div className="mb-6 flex justify-between items-center">
                <h2 className="text-xl font-bold">Prüfungsmodus</h2>
                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded text-sm font-mono">Frage {examResults.total + 1} / 20</div>
            </div>
            <Quiz 
                question={currentQuestion} 
                idx={quizIdx} 
                score={score} 
                streak={streak} 
                onAnswer={handleAnswer} 
                onNext={()=>{}} 
                onSkip={()=>{}} 
                showExplain={false} 
                mode="exam"
                onBookmark={toggleBookmark}
                isBookmarked={currentQuestion && (progress.bookmarks || []).includes(currentQuestion.id)}
            />
        </Layout>
      );
  }

  // Training View
  return (
    <Layout user={activeUser} onLogout={handleLogout} currentView="train" setView={setView} theme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
        <div className="mb-6 flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
            <button 
                onClick={() => setFilter({ ...filter, tags: [], bookmarkOnly: false })}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${!filter.bookmarkOnly && filter.tags.length === 0 ? 'bg-police-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}
            >
                Alle Bereiche
            </button>
            {GROUPS.map(g => (
                <button 
                    key={g.key}
                    onClick={() => setFilter({ ...filter, tags: g.tags, bookmarkOnly: false })}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${!filter.bookmarkOnly && filter.tags[0] === g.tags[0] ? `bg-${g.color}-500 text-white` : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}
                >
                    {g.title}
                </button>
            ))}
            <button 
                onClick={() => setFilter({ ...filter, bookmarkOnly: true, tags: [] })}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter.bookmarkOnly ? 'bg-amber-400 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-amber-500'}`}
            >
                ★ Gemerkte
            </button>
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
            onBookmark={toggleBookmark}
            isBookmarked={currentQuestion && (progress.bookmarks || []).includes(currentQuestion.id)}
        />
    </Layout>
  );
}

// Subcomponents

const StatCard = ({ label, value, icon, color }: any) => (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4 hover:scale-[1.02] transition-transform">
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
                    <label className="block text-sm font-bold mb-1">Frage</label>
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