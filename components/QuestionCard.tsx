import React, { useState, useMemo } from 'react';
import { Question } from '../types';
import { seededShuffle, COLOR_PALETTE, GROUP_TAGS } from '../constants';
import { CheckCircle2, XCircle, BookOpen, ArrowRight, HelpCircle } from 'lucide-react';

interface QuestionCardProps {
  question: Question;
  idx: number;
  submitted: boolean;
  onSubmit: (selectedIndices: number[]) => void;
  onNext: () => void;
  tier: number;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ 
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