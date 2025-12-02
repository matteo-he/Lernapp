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

export const Quiz: React.FC<QuizProps> = ({ question, idx, score, streak, onAnswer, onNext, onSkip, showExplain, mode = 'training' }) => {
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
        <p className="text-slate-500">Für die gewählten Filter gibt es keine weiteren Fragen.</p>
      </Card>
    );
  }

  const group = GROUPS.find(g => question.tags.some(t => g.tags.includes(t))) || GROUPS[GROUPS.length - 1];
  const correctSet = new Set(question.correct);

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
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-${group.color}-100 text-${group.color}-700 dark:bg-${group.color}-900/50 dark:text-${group.color}-300`}>
                {group.title}
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 font-medium border border-slate-200 dark:border-slate-700">
                Level {question.difficulty}
            </span>
        </div>
        <div className="flex items-center gap-4">
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
                            containerClass = "border-rose-500 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-500/50";
                            textClass = "text-rose-900 dark:text-rose-100 opacity-80 decoration-rose-500/30";
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

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700/50 flex flex-wrap gap-4 justify-between items-center">
                {!showExplain ? (
                    <>
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
                    </>
                ) : (
                    <div className="w-full animate-fade-in space-y-4">
                        <div className={`rounded-xl p-5 border-l-4 ${isCorrectAnswer ? 'bg-emerald-50 border-emerald-500 dark:bg-emerald-900/10' : 'bg-rose-50 border-rose-500 dark:bg-rose-900/10'}`}>
                             <div className="flex items-center gap-3 mb-2">
                                <span className={`text-2xl ${isCorrectAnswer ? 'animate-bounce' : 'animate-pulse'}`}>{isCorrectAnswer ? '🎉' : '🤔'}</span>
                                <h4 className={`font-black text-lg ${isCorrectAnswer ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'}`}>
                                    {isCorrectAnswer ? 'Exakt richtig!' : 'Nicht ganz...'}
                                </h4>
                             </div>
                             {!isCorrectAnswer && <p className="text-sm text-rose-700 dark:text-rose-300 mb-2 font-medium">Sieh dir die markierte korrekte Lösung an.</p>}
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5 text-6xl">💡</div>
                            <h4 className="font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2 relative z-10">
                                Erklärung
                            </h4>
                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4 relative z-10 text-base">{question.explain}</p>
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold font-mono uppercase tracking-wide relative z-10">
                                <span>§</span> {question.law_ref}
                            </div>
                        </div>

                        <button 
                            onClick={onNext}
                            className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-6 py-4 rounded-xl font-bold text-lg hover:shadow-xl hover:scale-[1.01] transition-all flex items-center justify-center gap-2 group mt-4"
                        >
                            Weiter <span className="group-hover:translate-x-1 transition-transform">➔</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
      </Card>
    </div>
  );
};