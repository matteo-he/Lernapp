import React, { useState, useMemo, useEffect } from 'react';
import { Question, GROUPS } from '../types';
import { Card } from './Card';

interface QuizProps {
  question: Question | null;
  idx: number;
  score: number;
  streak: number;
  onAnswer: (indices: number[]) => void;
  onNext: () => void;
  onSkip: () => void;
  showExplain: boolean;
  mode?: string;
  onBookmark?: (id: string) => void;
  isBookmarked?: boolean;
  srsLevel?: number;
}

// Helper for shuffling
function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = h << 13 | h >>> 19;
  }
  return function() {
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    return (h ^ h >>> 16) >>> 0;
  };
}

function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function seededShuffle(array: number[], seedStr: string) {
  const seed = xmur3(seedStr)();
  const rng = mulberry32(seed);
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Explicit color mapping for badges to ensure Tailwind does not purge them
const BADGE_COLORS: Record<string, string> = {
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
};

export const Quiz: React.FC<QuizProps> = ({ 
    question, idx, score, streak, onAnswer, onNext, onSkip, showExplain, 
    mode = 'training', onBookmark, isBookmarked, srsLevel 
}) => {
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    setSelected([]);
  }, [question, idx]);

  const displayOrder = useMemo(() => {
    if (!question) return [];
    return seededShuffle([0, 1, 2, 3, 4], `${question.id}#${idx}`);
  }, [question, idx]);

  const isCorrectAnswer = useMemo(() => {
    if (!question || !showExplain) return false;
    const correctSet = new Set(question.correct);
    const selectedOriginals = selected.map(i => displayOrder[i]);
    const selectedSet = new Set(selectedOriginals);
    
    if (correctSet.size !== selectedSet.size) return false;
    for (let elem of correctSet) {
        if (!selectedSet.has(elem)) return false;
    }
    return true;
  }, [question, showExplain, selected, displayOrder]);

  if (!question) {
    return (
      <Card className="p-12 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h3 className="text-xl font-bold mb-2">Alles erledigt!</h3>
        <p className="text-slate-500">Du hast alle fälligen Wiederholungen für jetzt gemeistert.</p>
        <p className="text-sm text-slate-400 mt-2">Komm später wieder oder lerne neue Bereiche.</p>
      </Card>
    );
  }

  const group = GROUPS.find(g => question.tags.some(t => g.tags.includes(t))) || GROUPS[GROUPS.length - 1];
  const correctSet = new Set(question.correct);
  const badgeClass = BADGE_COLORS[group.color] || BADGE_COLORS.blue;

  const handleSelect = (displayIdx: number) => {
    if (showExplain) return;
    setSelected(prev => 
      prev.includes(displayIdx) ? prev.filter(i => i !== displayIdx) : [...prev, displayIdx]
    );
  };

  const handleSubmit = () => {
    onAnswer(selected);
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in-up pb-20">
      {/* Header Stats */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${badgeClass}`}>
                {group.title}
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 font-medium border border-slate-200 dark:border-slate-700">
                Level {question.difficulty}
            </span>
            {srsLevel !== undefined && (
                <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-800">
                    Wissens-Stufe {srsLevel} 🔥
                </span>
            )}
        </div>
        <div className="flex items-center gap-4">
             {onBookmark && (
                <button 
                  onClick={() => onBookmark(question.id)}
                  className={`text-2xl transition-transform active:scale-90 ${isBookmarked ? 'text-yellow-400 scale-110' : 'text-slate-300 hover:text-yellow-400'}`}
                >
                  {isBookmarked ? '★' : '☆'}
                </button>
             )}
             {mode === 'training' && (
               <div className="flex flex-col items-end">
                   <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Streak</span>
                   <div className="flex items-center text-orange-500 font-black leading-none">
                       <span className="text-xl">{streak}</span>
                       <span className="ml-1 text-lg">🔥</span>
                   </div>
               </div>
             )}
        </div>
      </div>

      <Card className="p-0 overflow-hidden relative shadow-2xl" gradient>
        <div className="p-6 md:p-8">
            
            <h2 className="text-xl md:text-2xl font-semibold leading-relaxed mb-8 text-slate-800 dark:text-slate-100">
                {question.question}
            </h2>

            <div className="space-y-3">
                {displayOrder.map((origIdx, displayIdx) => {
                    const choiceText = question.choices[origIdx];
                    if (!choiceText) return null; // Skip empty
                    
                    const isSelected = selected.includes(displayIdx);
                    const isCorrect = correctSet.has(origIdx);
                    
                    // Base styles
                    let containerClass = "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50";
                    let textClass = "text-slate-700 dark:text-slate-200";
                    let indicator = <div className="w-6 h-6 rounded-md border-2 border-slate-300 dark:border-slate-500 flex items-center justify-center text-xs text-slate-400 font-bold">{String.fromCharCode(65 + displayIdx)}</div>;

                    // Feedback Mode
                    if (showExplain) {
                        if (isCorrect) {
                            // It is a correct answer
                            containerClass = "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]";
                            textClass = "text-emerald-900 dark:text-emerald-100 font-medium";
                            indicator = <div className="w-6 h-6 rounded-md bg-emerald-500 text-white flex items-center justify-center shadow-sm">✓</div>;
                        } else if (isSelected && !isCorrect) {
                            // User selected it, but it's wrong
                            containerClass = "border-rose-500 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-500/50 opacity-90";
                            textClass = "text-rose-900 dark:text-rose-100 opacity-80 decoration-rose-500/30 line-through";
                            indicator = <div className="w-6 h-6 rounded-md bg-rose-500 text-white flex items-center justify-center shadow-sm font-bold">✕</div>;
                        } else {
                            // Not selected, not correct (irrelevant)
                            containerClass = "opacity-40 grayscale border-transparent";
                        }
                    } else if (isSelected) {
                        // Selection Mode
                        containerClass = "border-police-500 bg-police-50 dark:bg-police-900/30 ring-1 ring-police-500 shadow-[0_0_15px_rgba(14,165,233,0.15)] transform scale-[1.01]";
                        indicator = <div className="w-6 h-6 rounded-md bg-police-500 text-white flex items-center justify-center">✓</div>;
                    }

                    return (
                        <button
                            key={displayIdx}
                            onClick={() => handleSelect(displayIdx)}
                            disabled={showExplain}
                            className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-start gap-4 group relative ${containerClass}`}
                        >
                            <div className="mt-0.5 shrink-0 transition-transform duration-200 group-active:scale-90">{indicator}</div>
                            <div className={`text-lg leading-snug transition-colors ${textClass}`}>{choiceText}</div>
                        </button>
                    );
                })}
            </div>

            {/* Consolidated Feedback & Actions Area */}
            <div className="mt-8 pt-2">
                {!showExplain ? (
                    <div className="flex flex-wrap gap-4 justify-between items-center border-t border-slate-100 dark:border-slate-700/50 pt-6">
                        <button onClick={onSkip} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold px-4 py-2 transition-colors text-sm uppercase tracking-wide">
                            Überspringen
                        </button>
                        <button 
                            onClick={handleSubmit}
                            disabled={selected.length === 0}
                            className="bg-gradient-to-r from-police-600 to-indigo-600 hover:from-police-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-10 py-3.5 rounded-xl font-bold shadow-lg shadow-police-500/30 transition-all transform active:scale-95 text-lg"
                        >
                            Prüfen
                        </button>
                    </div>
                ) : (
                    <div className="animate-fade-in-up">
                         {/* Integrated Feedback Card */}
                         <div className={`rounded-2xl p-6 border-2 shadow-xl ${isCorrectAnswer ? 'bg-emerald-50 border-emerald-500/20' : 'bg-rose-50 border-rose-500/20'}`}>
                            <div className="flex items-center gap-4 mb-5 border-b border-black/5 pb-4">
                                <div className={`text-4xl filter drop-shadow-sm ${isCorrectAnswer ? 'animate-bounce' : 'animate-pulse'}`}>
                                    {isCorrectAnswer ? '🎉' : '❌'}
                                </div>
                                <div>
                                    <h3 className={`text-xl font-black ${isCorrectAnswer ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'}`}>
                                        {isCorrectAnswer ? 'Hervorragend!' : 'Leider falsch'}
                                    </h3>
                                    <p className={`text-sm font-medium ${isCorrectAnswer ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                                        {isCorrectAnswer ? 'Die Antwort ist absolut korrekt.' : 'Sieh dir die Lösung genau an.'}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                 <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 m-0 text-base">
                                        💡 Erklärung
                                    </h4>
                                    <span className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded text-slate-500 dark:text-slate-400 font-mono font-bold">
                                        § {question.law_ref}
                                    </span>
                                 </div>
                                 <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed m-0">
                                    {question.explain}
                                 </p>
                            </div>

                            <button 
                                onClick={onNext}
                                className="w-full mt-6 py-4 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all flex justify-center items-center gap-2 group"
                            >
                                Weiter <span className="group-hover:translate-x-1 transition-transform">➔</span>
                            </button>
                         </div>
                    </div>
                )}
            </div>
        </div>
      </Card>
    </div>
  );
};