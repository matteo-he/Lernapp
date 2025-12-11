import React, { useState, useEffect, useMemo } from 'react';
import { db, FIRESTORE_COLLECTIONS, syncUserProgress, syncUserList } from './services/firebase';
import { onSnapshot, collection, doc } from 'firebase/firestore';
import { seededShuffle, generateId, hashPassword, DEFAULT_QUESTIONS, GROUPS, GROUP_TAGS, COLOR_PALETTE } from './constants';
import { Question, User, UserProgress, FilterState, ViewMode, StatsGroup } from './types';
import { 
  Shield, LayoutDashboard, BrainCircuit, Settings, LogOut, Sun, Moon, Sparkles, 
  ChevronRight, GraduationCap, Award, Flame, Target, BookOpen, TrendingUp, 
  CheckCircle2, XCircle, ArrowRight, HelpCircle 
} from 'lucide-react';

// ==========================================
// COMPONENT: QuestionCard
// ==========================================

interface QuestionCardProps {
  question: Question;
  idx: number;
  submitted: boolean;
  onSubmit: (selectedIndices: number[]) => void;
  onNext: () => void;
  tier: number;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ 
  question: q, idx, submitted, onSubmit, onNext, tier 
}) => {
  const [selectedDisplayIndices, setSelectedDisplayIndices] = useState<number[]>([]);

  // Stable shuffle for choices
  const displayOrder = useMemo(() => {
    return seededShuffle([0, 1, 2, 3, 4], `${q.id}#${idx}`);
  }, [q.id, idx]);

  // Determine styling based on tags
  const groupKey = Object.keys(GROUP_TAGS).find(key => 
    q.tags.some(t => GROUP_TAGS[key].includes(t))
  ) || "ADMIN";
  
  const styles = (COLOR_PALETTE as any)[groupKey] || COLOR_PALETTE.ADMIN;

  const toggleSelection = (displayIndex: number) => {
    if (submitted) return;
    setSelectedDisplayIndices(prev => 
      prev.includes(displayIndex) 
        ? prev.filter(i => i !== displayIndex) 
        : [...prev, displayIndex]
    );
  };

  const handleSubmit = () => {
    if (selectedDisplayIndices.length === 0) return;
    onSubmit(selectedDisplayIndices);
  };

  return (
    <div className="w-full animate-slide-up">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden border border-slate-100 dark:border-slate-800">
        
        {/* Progress Bar Top */}
        <div className={`h-1.5 w-full bg-slate-100 dark:bg-slate-800`}>
             <div className={`h-full ${styles.bar} transition-all duration-1000`} style={{width: '100%'}}></div>
        </div>
        
        <div className="p-6 md:p-10">
          {/* Header / Meta */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${styles.bg} ${styles.border} ${styles.text} uppercase tracking-wide`}>
              {q.tags[0] || "Allgemein"}
            </span>
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
               {[...Array(5)].map((_, i) => (
                 <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < q.difficulty ? 'bg-slate-400 dark:bg-slate-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
               ))}
            </div>
            <span className="text-xs font-medium text-slate-400 ml-auto">ID: {q.id}</span>
          </div>

          {/* Question */}
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-8 leading-snug">
            {q.question}
          </h2>

          {/* Choices Grid */}
          <div className="grid gap-3">
            {displayOrder.map((originalIndex, displayIndex) => {
              const isSelected = selectedDisplayIndices.includes(displayIndex);
              const isCorrect = q.correct.includes(originalIndex);
              
              let cardClass = "relative flex items-center gap-4 p-4 md:p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer group ";
              
              if (submitted) {
                if (isCorrect) {
                  cardClass += "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-500/50 z-10 scale-[1.01]";
                } else if (isSelected && !isCorrect) {
                  cardClass += "border-red-500 bg-red-50 dark:bg-red-900/10 dark:border-red-500/50 opacity-80";
                } else {
                  cardClass += "border-slate-100 dark:border-slate-800 opacity-50 grayscale";
                }
              } else {
                if (isSelected) {
                  cardClass += "border-blue-500 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-500 shadow-md ring-1 ring-blue-200 dark:ring-blue-900";
                } else {
                  cardClass += "border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50";
                }
              }

              return (
                <div 
                  key={displayIndex} 
                  onClick={() => toggleSelection(displayIndex)}
                  className={cardClass}
                >
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300
                    ${submitted && isCorrect ? 'border-emerald-500 bg-emerald-500 text-white scale-110' : 
                      submitted && isSelected && !isCorrect ? 'border-red-500 bg-red-500 text-white scale-110' :
                      isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 dark:border-slate-600 text-slate-400'
                    }`}
                  >
                    {submitted && isCorrect ? <CheckCircle2 size={18} /> : 
                     submitted && isSelected && !isCorrect ? <XCircle size={18} /> :
                     <span className="text-sm font-bold">{String.fromCharCode(65 + displayIndex)}</span>}
                  </div>
                  <div className="flex-1">
                    <span className={`text-base md:text-lg leading-relaxed ${submitted && isCorrect ? 'font-semibold text-emerald-900 dark:text-emerald-100' : 'text-slate-700 dark:text-slate-200'}`}>
                      {q.choices[originalIndex]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="mt-10 pt-6 border-t border-slate-100 dark:border-slate-800">
            {!submitted ? (
              <div className="flex justify-between items-center animate-fade-in">
                <button 
                  onClick={onNext}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm font-medium px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Überspringen
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={selectedDisplayIndices.length === 0}
                  className={`flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold shadow-xl transition-all transform active:scale-[0.98] 
                    ${selectedDisplayIndices.length > 0 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30 ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900' 
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'}`}
                >
                  Antwort prüfen
                  <ArrowRight size={20} />
                </button>
              </div>
            ) : (
              <div className="animate-slide-up">
                <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl p-6 border border-amber-100 dark:border-amber-900/30 mb-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
                       <BookOpen size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white mb-2 text-lg">Erklärung</h4>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                        {q.explain}
                      </p>
                      <div className="flex items-center gap-2 text-xs font-mono text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/20 px-3 py-1.5 rounded-md inline-block">
                        <span className="font-bold">§</span> {q.law_ref}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button 
                    onClick={onNext}
                    className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/30 transition-all transform active:scale-[0.98] hover:pr-6"
                  >
                    Nächste Frage
                    <ArrowRight size={20} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// COMPONENT: Dashboard
// ==========================================

interface DashboardProps {
  stats: StatsGroup[];
  rank: string;
  score: number;
  streak: number;
  progress: UserProgress;
}

const Dashboard: React.FC<DashboardProps> = ({ stats, rank, score, streak, progress }) => {
  const totalQuestions = stats.reduce((acc, s) => acc + s.total, 0);
  const totalAttempted = stats.reduce((acc, s) => acc + s.attempted, 0);
  const totalCorrect = stats.reduce((acc, s) => acc + s.correct, 0);
  const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;

  // Simple color mapping without external library dependency
  const colorMap = ['bg-amber-400', 'bg-blue-500', 'bg-rose-500', 'bg-emerald-500'];

  const StatCard = ({ icon: Icon, label, value, sub, gradient, textColor }: any) => (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden group hover:shadow-md transition-shadow">
      <div className="relative z-10 flex flex-col h-full justify-between">
        <div className="flex justify-between items-start mb-4">
           <div className={`p-3 rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg`}>
              <Icon size={24} strokeWidth={2} />
           </div>
           {sub && <span className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full text-slate-500">{sub}</span>}
        </div>
        <div>
           <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</p>
           <h3 className={`text-3xl font-bold ${textColor || 'text-slate-900 dark:text-white'}`}>{value}</h3>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-slide-up">
      
      {/* Top Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={Award} 
          label="Rang" 
          value={rank} 
          sub={`${score} XP`} 
          gradient="from-indigo-500 to-purple-600" 
          textColor="text-indigo-600 dark:text-indigo-400"
        />
        <StatCard 
          icon={Flame} 
          label="Streak" 
          value={streak} 
          sub="Tage" 
          gradient="from-orange-400 to-red-500" 
        />
        <StatCard 
          icon={Target} 
          label="Genauigkeit" 
          value={`${overallAccuracy}%`} 
          gradient="from-emerald-400 to-teal-500" 
          textColor="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard 
          icon={BookOpen} 
          label="Fortschritt" 
          value={`${Math.round((totalAttempted/Math.max(totalQuestions,1))*100)}%`} 
          sub={`${totalAttempted}/${totalQuestions}`} 
          gradient="from-blue-400 to-cyan-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Stats Area - Subjects */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-8">
             <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
               <TrendingUp className="text-blue-500" size={24} />
               Fächeranalyse
             </h3>
          </div>
          
          <div className="grid sm:grid-cols-2 gap-6">
            {stats.map((stat) => (
              <div key={stat.key} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-start mb-4">
                  <span className={`font-bold text-sm px-3 py-1 rounded-full border ${stat.color.bg} ${stat.color.border} ${stat.color.text}`}>
                     {stat.key}
                  </span>
                  <span className="text-xs font-mono text-slate-400">{stat.total} Fragen</span>
                </div>
                
                <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-4 h-10 line-clamp-2">{stat.title}</h4>
                
                <div className="space-y-4">
                  {/* Progress Bar 1 */}
                  <div>
                    <div className="flex justify-between text-xs mb-1.5 font-medium text-slate-500">
                      <span>Gelernt</span>
                      <span>{Math.round((stat.attempted/Math.max(stat.total,1))*100)}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full bg-slate-400 dark:bg-slate-600`} style={{ width: `${(stat.attempted/Math.max(stat.total,1))*100}%` }} />
                    </div>
                  </div>
                  {/* Progress Bar 2 */}
                   <div>
                    <div className="flex justify-between text-xs mb-1.5 font-medium text-slate-500">
                      <span>Richtig</span>
                      <span className={stat.correct/Math.max(stat.attempted,1) > 0.8 ? 'text-emerald-500' : 'text-slate-500'}>
                        {stat.attempted ? Math.round((stat.correct/stat.attempted)*100) : 0}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full ${stat.color.bar}`} style={{ width: `${stat.attempted ? (stat.correct/stat.attempted)*100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Side Stats - Simple List instead of Chart to prevent crashes */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Verteilung</h3>
          
          <div className="flex-1 flex flex-col justify-center items-center py-8">
             <div className="relative w-48 h-48 rounded-full border-8 border-slate-100 dark:border-slate-800 flex items-center justify-center">
                <div className="text-center">
                   <span className="block text-4xl font-bold text-slate-900 dark:text-white">{totalAttempted}</span>
                   <span className="text-xs text-slate-500 uppercase tracking-wide">Beantwortet</span>
                </div>
             </div>
          </div>
          
          <div className="mt-6 space-y-4">
             {stats.map((stat, index) => (
               <div key={stat.key} className="flex items-center justify-between text-sm group">
                 <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                    <div className={`w-3 h-3 rounded-full ${colorMap[index % colorMap.length]}`} />
                    <span className="font-medium">{stat.key}</span>
                 </div>
                 <div className="flex items-center gap-4">
                    <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                       <div className={`h-full ${colorMap[index % colorMap.length]}`} style={{ width: `${(stat.attempted / Math.max(totalAttempted, 1)) * 100}%` }}></div>
                    </div>
                    <span className="font-semibold text-slate-900 dark:text-white w-8 text-right">{stat.attempted}</span>
                 </div>
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// COMPONENT: AdminPanel
// ==========================================

const AdminPanel = ({ questions, onDelete, onSave }: any) => {
  const [json, setJson] = useState("");
  return (
    <div className="space-y-6 animate-slide-up">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
            <Settings size={20} className="text-blue-500" />
            Fragen verwalten
          </h3>
          <span className="text-sm text-slate-500">{questions.length} Fragen in der Datenbank</span>
        </div>
        
        <div className="h-96 overflow-y-auto mb-6 border rounded-xl dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50">
          {questions.map((q: Question) => (
             <div key={q.id} className="p-4 border-b dark:border-slate-800 flex justify-between items-center hover:bg-white dark:hover:bg-slate-900 transition-colors">
                <div className="flex flex-col gap-1 overflow-hidden">
                   <div className="flex items-center gap-2">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">{q.id}</span>
                      <div className="flex gap-1">
                        {q.tags.map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">{t}</span>)}
                      </div>
                   </div>
                   <span className="truncate text-sm text-slate-700 dark:text-slate-300 font-medium">{q.question}</span>
                </div>
                <button onClick={() => onDelete(q.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors text-xs font-semibold">
                  Löschen
                </button>
             </div>
          ))}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="flex flex-col gap-2">
               <label className="text-sm font-medium text-slate-700 dark:text-slate-300">JSON Import / Export</label>
               <textarea 
                  className="w-full p-4 border rounded-xl dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  rows={6}
                  placeholder='Format: [{"id":"...", "question":"...", ...}]'
                  value={json}
                  onChange={e => setJson(e.target.value)}
               />
             </div>
             <div className="flex flex-col gap-3 justify-end">
                <button 
                  onClick={() => {
                    try {
                        const parsed = JSON.parse(json);
                        if(Array.isArray(parsed)) parsed.forEach(onSave);
                        setJson("");
                        alert(`${parsed.length} Fragen erfolgreich importiert!`);
                    } catch(e) { alert("Fehlerhaftes JSON Format"); }
                  }}
                  className="bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 hover:scale-[1.02] transition-all font-medium flex items-center justify-center gap-2"
                >
                    <Sparkles size={18} />
                    JSON Importieren
                </button>
                 <button 
                  onClick={() => {
                      const blob = new Blob([JSON.stringify(questions, null, 2)], {type: "application/json"});
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url; a.download = `backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
                  }}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 hover:scale-[1.02] transition-all font-medium"
                >
                    Backup Herunterladen
                </button>
             </div>
        </div>
      </div>
    </div>
  )
}

// ==========================================
// MAIN APP COMPONENT
// ==========================================

export default function App() {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  
  // Data State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [progress, setProgress] = useState<UserProgress>({
    totalAttempts: 0,
    totalCorrect: 0,
    attemptedIds: {},
    correctIds: {}
  });

  // UI State
  const [view, setView] = useState<ViewMode>('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);

  // Training State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [filter, setFilter] = useState<FilterState>({ tags: [], difficulty: 0 });

  // --- Effects ---

  // Dark Mode
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  // Load Initial Data (Firestore or LocalStorage fallback)
  useEffect(() => {
    // Safety timeout to ensure loading screen doesn't get stuck if firebase fails
    const safetyTimer = setTimeout(() => setLoading(false), 2000);

    // 1. Listen for Users
    let unsubUsers = () => {};
    if (db) {
      try {
        unsubUsers = onSnapshot(collection(db, FIRESTORE_COLLECTIONS.USERS), (snap) => {
          const uList: User[] = [];
          snap.forEach(d => uList.push(d.data() as User));
          setUsers(uList.length ? uList : []);
          setLoading(false);
        }, (err) => {
           console.warn("Firestore users error", err);
           setLoading(false);
        });
      } catch (e) { console.error(e); setLoading(false); }
    } else {
       const localUsers = localStorage.getItem("users");
       if(localUsers) setUsers(JSON.parse(localUsers));
       setLoading(false);
    }

    // 2. Listen for Questions
    let unsubQuestions = () => {};
    if (db) {
      try {
        unsubQuestions = onSnapshot(collection(db, FIRESTORE_COLLECTIONS.QUESTIONS), (snap) => {
          const qList: Question[] = [];
          snap.forEach(d => {
              const data = d.data() as Question;
              if(!data.__deleted) qList.push(data);
          });
          setQuestions(qList.length ? qList : DEFAULT_QUESTIONS);
        }, (err) => console.warn("Firestore questions error", err));
      } catch (e) { console.error(e); }
    } else {
        setQuestions(DEFAULT_QUESTIONS);
    }

    return () => { 
      unsubUsers(); 
      unsubQuestions(); 
      clearTimeout(safetyTimer);
    };
  }, []);

  // Listen for active user progress
  useEffect(() => {
    if (!user || !db) return;
    try {
      const unsub = onSnapshot(doc(db, FIRESTORE_COLLECTIONS.PROGRESS, user.id), (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          const metrics = data[user.id + ':metrics'];
          if (metrics) setProgress(metrics);
        }
      });
      return () => unsub();
    } catch (e) {
      console.warn("Progress sync failed", e);
    }
  }, [user]);

  // --- Logic ---

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const found = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (found && found.passwordHash === hashPassword(password)) {
      setUser(found);
    } else if (!found && username.length > 2 && password.length > 3) {
      // Auto-register for demo purposes if not found
      const newUser: User = {
        id: generateId("user"),
        username,
        passwordHash: hashPassword(password),
        role: username.toLowerCase().includes("admin") ? "admin" : "user"
      };
      setUsers([...users, newUser]);
      setUser(newUser);
      syncUserList([...users, newUser]); // Fire and forget
    } else {
      alert("Ungültige Anmeldedaten.");
    }
  };

  const filteredQuestions = useMemo(() => {
    let q = questions;
    if (filter.tags.length > 0) {
      q = q.filter(item => item.tags.some(t => filter.tags.includes(t)));
    }
    if (filter.difficulty > 0) {
      q = q.filter(item => item.difficulty === filter.difficulty);
    }
    // Simple shuffle for session
    return seededShuffle(q, `session-${user?.id}-${new Date().getHours()}`);
  }, [questions, filter, user]);

  const currentQuestion = filteredQuestions[currentQIndex % filteredQuestions.length];

  const handleAnswer = (selectedIndices: number[]) => {
    if (!currentQuestion || submitted) return;
    
    // Re-derive display order to verify answer logic matches visual component
    const displayOrder = seededShuffle([0, 1, 2, 3, 4], `${currentQuestion.id}#${currentQIndex}`);
    const selectedOriginals = selectedIndices.map(i => displayOrder[i]);
    
    const correctSet = new Set(currentQuestion.correct);
    const selectedSet = new Set(selectedOriginals);
    const isCorrect = [0,1,2,3,4].every(i => correctSet.has(i) === selectedSet.has(i));

    setSubmitted(true);

    const newProgress = { ...progress };
    newProgress.totalAttempts++;
    newProgress.attemptedIds[currentQuestion.id] = (newProgress.attemptedIds[currentQuestion.id] || 0) + 1;
    
    if (isCorrect) {
      newProgress.totalCorrect++;
      newProgress.correctIds[currentQuestion.id] = (newProgress.correctIds[currentQuestion.id] || 0) + 1;
    }

    setProgress(newProgress);
    syncUserProgress(user!.id, newProgress);
  };

  const nextQuestion = () => {
    setSubmitted(false);
    setCurrentQIndex(prev => prev + 1);
  };

  const statsGroups = useMemo(() => {
    return GROUPS.map(g => {
        const groupQs = questions.filter(q => q.tags.some(t => GROUP_TAGS[g.key]?.includes(t)));
        let groupCorrect = 0;
        groupQs.forEach(q => {
            const rawCorrect = progress.correctIds[q.id] || 0;
            if(progress.attemptedIds[q.id] > 0) {
               groupCorrect += rawCorrect; 
            }
        });
        const totalGroupAttempts = groupQs.reduce((sum, q) => sum + (progress.attemptedIds[q.id] || 0), 0);

        return {
            ...g,
            total: groupQs.length,
            attempted: totalGroupAttempts,
            correct: groupCorrect
        };
    });
  }, [questions, progress]);

  // Calculate Rank and XP
  const xp = progress.totalCorrect * 10;
  const ranks = [
      { title: "Anwärter:in", min: 0 },
      { title: "Inspektor:in", min: 150 },
      { title: "Gruppeninspektor:in", min: 400 },
      { title: "Revierinspektor:in", min: 800 },
      { title: "Abt. Inspektor:in", min: 1300 },
      { title: "Chefinspektor:in", min: 2000 },
  ];
  
  const currentRankIndex = [...ranks].reverse().findIndex(r => xp >= r.min);
  const actualRankIndex = currentRankIndex === -1 ? 0 : ranks.length - 1 - currentRankIndex;
  const currentRank = ranks[actualRankIndex];
  const nextRank = ranks[actualRankIndex + 1];
  
  const xpForCurrentRank = currentRank.min;
  const xpForNextRank = nextRank ? nextRank.min : xp;
  const progressToNextRank = nextRank 
    ? Math.min(100, Math.max(0, ((xp - xpForCurrentRank) / (xpForNextRank - xpForCurrentRank)) * 100))
    : 100;

  // --- Render ---

  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
         <div className="animate-pulse flex flex-col items-center">
            <Shield className="text-blue-500 mb-4" size={48} />
            <div className="text-slate-400 font-medium">Lade Anwendung...</div>
         </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 animate-fade-in">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>
        <div className="bg-white/10 backdrop-blur-xl p-8 sm:p-12 rounded-3xl shadow-2xl w-full max-w-md border border-white/20 relative overflow-hidden">
           {/* Decorative elements */}
           <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500 rounded-full blur-3xl opacity-20"></div>
           <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500 rounded-full blur-3xl opacity-20"></div>
           
          <div className="text-center mb-10 relative z-10">
            <div className="inline-flex p-5 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white mb-6 shadow-lg shadow-blue-500/30 ring-4 ring-white/10">
              <Shield size={48} strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Polizei Lerntool</h1>
            <p className="text-blue-200 mt-2 font-medium">E1 / E2a Dienstprüfung</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5 relative z-10">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-blue-200 uppercase tracking-wider ml-1">Nutzername</label>
              <input 
                type="text" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-5 py-3.5 rounded-xl bg-slate-900/50 border border-white/10 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                placeholder="Name eingeben"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-blue-200 uppercase tracking-wider ml-1">Passwort</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-5 py-3.5 rounded-xl bg-slate-900/50 border border-white/10 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                placeholder="••••••"
              />
            </div>
            <button type="submit" className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-blue-900/40 transition-all transform active:scale-[0.98] mt-2">
              Anmelden
            </button>
          </form>
          <div className="mt-6 text-center text-slate-400 text-xs">
            Bei neuem Namen wird automatisch ein Profil erstellt.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      {/* Navigation & Header */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg text-white shadow-md shadow-blue-500/20">
                <Shield size={24} />
              </div>
              <div className="hidden sm:block">
                <h1 className="font-bold text-lg leading-none text-slate-900 dark:text-white">Lerntool</h1>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">E1 / E2a</span>
              </div>
            </div>

            {/* Nav Items */}
            <div className="flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-xl">
              <button 
                onClick={() => setView('dashboard')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-sm font-medium ${view === 'dashboard' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                <LayoutDashboard size={18} />
                <span className="hidden sm:inline">Übersicht</span>
              </button>
              <button 
                onClick={() => setView('train')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-sm font-medium ${view === 'train' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                <BrainCircuit size={18} />
                <span className="hidden sm:inline">Training</span>
              </button>
              {user.role === 'admin' && (
                <button 
                  onClick={() => setView('admin')}
                  className={`px-3 py-2 rounded-lg flex items-center transition-all ${view === 'admin' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                >
                  <Settings size={18} />
                </button>
              )}
            </div>

            {/* User Profile & XP */}
            <div className="flex items-center gap-4">
               {/* Rank Progress - Desktop */}
               <div className="hidden md:flex flex-col items-end min-w-[140px]">
                  <div className="flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <GraduationCap size={14} className="text-blue-500" />
                    <span>{currentRank.title}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-1.5 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${progressToNextRank}%` }}></div>
                  </div>
                  {nextRank && <span className="text-[10px] text-slate-400 mt-0.5">{Math.floor(xp)} / {nextRank.min} XP</span>}
               </div>

               <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>

               <div className="flex items-center gap-2">
                  <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400">
                    {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                  </button>
                  <div className="group relative">
                     <button className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-white dark:ring-slate-900">
                        {user.username.substring(0,2).toUpperCase()}
                     </button>
                     <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 py-1 hidden group-hover:block animate-fade-in origin-top-right">
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                          <p className="text-sm font-semibold dark:text-white">{user.username}</p>
                          <p className="text-xs text-slate-500">{user.role}</p>
                        </div>
                        <button onClick={() => setUser(null)} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
                           <LogOut size={14} /> Abmelden
                        </button>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-slide-up">
        
        {view === 'dashboard' && (
          <Dashboard 
            stats={statsGroups} 
            rank={currentRank.title}
            score={xp} 
            streak={0} 
            progress={progress} 
          />
        )}

        {view === 'train' && (
          <div className="max-w-4xl mx-auto">
             {/* Filter & Status Bar */}
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                   <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2">
                      Training
                      <span className="px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-xs font-mono">
                         #{currentQIndex + 1}
                      </span>
                   </h2>
                   <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                      Wähle ein Thema oder starte den Mix-Modus.
                   </p>
                </div>
                
                <div className="flex gap-2 flex-wrap">
                   <button 
                      onClick={() => setFilter({tags:[], difficulty:0})}
                      className={`text-xs px-4 py-2 rounded-full border transition-all font-medium ${
                          filter.tags.length === 0
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' 
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                      }`}
                   >
                     Alle Themen
                   </button>
                   {Object.keys(GROUP_TAGS).map(k => (
                      <button 
                        key={k}
                        onClick={() => setFilter(prev => {
                            const tag = GROUP_TAGS[k][0];
                            const isActive = prev.tags.includes(tag);
                            return { ...prev, tags: isActive ? [] : [tag] }
                        })}
                        className={`text-xs px-4 py-2 rounded-full border transition-all font-medium ${
                            filter.tags.includes(GROUP_TAGS[k][0]) 
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20' 
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300'
                        }`}
                      >
                        {GROUPS.find(g => g.key === k)?.title.split(' ')[0] || k}
                      </button>
                   ))}
                </div>
             </div>
             
             {filteredQuestions.length > 0 ? (
                <div key={currentQuestion.id}> {/* Key forces remount/animation on question change */}
                  <QuestionCard 
                    question={currentQuestion}
                    idx={currentQIndex}
                    submitted={submitted}
                    onSubmit={handleAnswer}
                    onNext={nextQuestion}
                    tier={2} 
                  />
                </div>
             ) : (
                <div className="flex flex-col items-center justify-center p-16 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 text-center animate-fade-in">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-400">
                      <Settings size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Keine Fragen gefunden</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-xs mx-auto">
                      Für die gewählten Filter sind derzeit keine Fragen verfügbar.
                    </p>
                    <button 
                      onClick={() => setFilter({tags:[], difficulty:0})} 
                      className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-lg shadow-blue-500/20"
                    >
                      Filter zurücksetzen
                    </button>
                </div>
             )}
          </div>
        )}

        {view === 'admin' && (
          <div className="max-w-4xl mx-auto">
             <AdminPanel 
                questions={questions} 
                onDelete={(id: string) => {
                    const newQ = questions.filter(q => q.id !== id);
                    setQuestions(newQ);
                }}
                onSave={(q: Question) => {
                     setQuestions(prev => {
                        const exists = prev.find(p => p.id === q.id);
                        if(exists) return prev.map(p => p.id === q.id ? q : p);
                        return [...prev, q];
                     });
                }}
              />
          </div>
        )}

      </main>
    </div>
  );
}