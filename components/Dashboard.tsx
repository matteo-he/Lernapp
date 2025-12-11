import React from 'react';
import { StatsGroup, UserProgress } from '../types';
import { Award, Flame, Target, BookOpen, TrendingUp, Circle } from 'lucide-react';

interface DashboardProps {
  stats: StatsGroup[];
  rank: string;
  score: number;
  streak: number;
  progress: UserProgress;
}

export const Dashboard: React.FC<DashboardProps> = ({ stats, rank, score, streak, progress }) => {
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