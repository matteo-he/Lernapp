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

export const Quiz: React.FC<QuizProps> = ({ question, idx, score, streak, onAnswer, onNext, onSkip, showExplain }) => {
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    setSelected([]);
  }, [question, idx]);

  const displayOrder = useMemo(() => {
    if (!question) return [];
    return seededShuffle([0, 1, 2, 3, 4], `${question.id}#${idx}`);
  }, [question, idx]);

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
    <div className="max-w-3xl mx-auto animate-fade-in-up">
      {/* Header Stats */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-${group.color}-100 text-${group.color}-700 dark:bg-${group.color}-900/50 dark:text-${group.color}-300`}>
                {group.title}
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 font-medium">
                Schwierigkeit {question.difficulty}
            </span>
        </div>
        <div className="flex items-center gap-4">
             <div className="flex flex-col items-end">
                 <span className="text-xs text-slate-400 uppercase font-bold">Streak</span>
                 <div className="flex items-center text-orange-500 font-bold">
                     <span className="text-lg">{streak}</span>
                     <span className="ml-1 text-xl">🔥</span>
                 </div>
             </div>
             <div className="flex flex-col items-end">
                 <span className="text-xs text-slate-400 uppercase font-bold">XP</span>
                 <span className="text-lg font-bold text-police-600 dark:text-police-400">{score}</span>
             </div>
        </div>
      </div>

      <Card className="p-0 overflow-hidden" gradient>
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
                    
                    let stateClass = "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50";
                    let indicator = <div className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-500 flex items-center justify-center text-xs text-slate-400 font-bold">{String.fromCharCode(65 + displayIdx)}</div>;

                    if (showExplain) {
                        if (isCorrect) {
                            stateClass = "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-500/50";
                            indicator = <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">✓</div>;
                        } else if (isSelected && !isCorrect) {
                            stateClass = "border-rose-500 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-500/50";
                            indicator = <div className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center">✕</div>;
                        } else {
                            stateClass = "opacity-50 grayscale";
                        }
                    } else if (isSelected) {
                        stateClass = "border-police-500 bg-police-50 dark:bg-police-900/30 ring-1 ring-police-500";
                        indicator = <div className="w-6 h-6 rounded-full bg-police-500 text-white flex items-center justify-center">✓</div>;
                    }

                    return (
                        <button
                            key={displayIdx}
                            onClick={() => handleSelect(displayIdx)}
                            disabled={showExplain}
                            className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-start gap-4 group ${stateClass}`}
                        >
                            <div className="mt-0.5 shrink-0">{indicator}</div>
                            <div className="text-lg text-slate-700 dark:text-slate-200">{choiceText}</div>
                        </button>
                    );
                })}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700/50 flex flex-wrap gap-4 justify-between items-center">
                {!showExplain ? (
                    <>
                        <button onClick={onSkip} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium px-4 py-2 transition-colors">
                            Überspringen
                        </button>
                        <button 
                            onClick={handleSubmit}
                            disabled={selected.length === 0}
                            className="bg-police-600 hover:bg-police-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-police-500/30 transition-all transform active:scale-95"
                        >
                            Antwort prüfen
                        </button>
                    </>
                ) : (
                    <div className="w-full animate-fade-in">
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 mb-6 border border-slate-200 dark:border-slate-700">
                            <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                                💡 Erklärung
                            </h4>
                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">{question.explain}</p>
                            <div className="text-xs font-mono text-slate-400 bg-slate-200 dark:bg-slate-800 inline-block px-2 py-1 rounded">
                                {question.law_ref}
                            </div>
                        </div>
                        <button 
                            onClick={onNext}
                            className="w-full bg-slate-800 dark:bg-white dark:text-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all"
                        >
                            Nächste Frage ➔
                        </button>
                    </div>
                )}
            </div>
        </div>
      </Card>
    </div>
  );
};