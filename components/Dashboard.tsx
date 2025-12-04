import React from 'react';
import { StatsGroup, UserProgress } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Award, Flame, Target, BookOpen, TrendingUp } from 'lucide-react';

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

  const pieData = stats.map(s => ({
    name: s.key,
    value: s.attempted,
    // Using simple colors for chart
  }));

  const chartColors = ['#fbbf24', '#3b82f6', '#f43f5e', '#10b981']; 

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
      {/* Background decoration */}
      <div className={`absolute -right-6 -top-6 w-32 h-32 rounded-full bg-gradient-to-br ${gradient} opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500`} />
    </div>
  );

  return (
    <div className="space-y-8 animate-slide-up">
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={Award} 
          label="Aktueller Rang" 
          value={rank} 
          sub={`${score} XP`} 
          gradient="from-indigo-500 to-purple-600" 
          textColor="text-indigo-600 dark:text-indigo-400"
        />
        <StatCard 
          icon={Flame} 
          label="Streak" 
          value={streak} 
          sub="Tage in Folge" 
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
          label="Lernfortschritt" 
          value={`${Math.round((totalAttempted/Math.max(totalQuestions,1))*100)}%`} 
          sub={`${totalAttempted}/${totalQuestions}`} 
          gradient="from-blue-400 to-cyan-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Stats Area */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-8">
             <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
               <TrendingUp className="text-blue-500" size={24} />
               Fächeranalyse
             </h3>
          </div>
          
          <div className="grid sm:grid-cols-2 gap-6">
            {stats.map((stat) => (
              <div key={stat.key} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900/50 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <span className={`font-bold text-sm px-3 py-1 rounded-full border ${stat.color.bg} ${stat.color.border} ${stat.color.text}`}>
                     {stat.key}
                  </span>
                  <span className="text-xs font-mono text-slate-400">{stat.total} Fragen</span>
                </div>
                
                <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-4 h-10 line-clamp-2">{stat.title}</h4>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5 font-medium text-slate-500">
                      <span>Abdeckung</span>
                      <span>{Math.round((stat.attempted/Math.max(stat.total,1))*100)}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full bg-slate-400 dark:bg-slate-600`} style={{ width: `${(stat.attempted/Math.max(stat.total,1))*100}%` }} />
                    </div>
                  </div>
                   <div>
                    <div className="flex justify-between text-xs mb-1.5 font-medium text-slate-500">
                      <span>Erfolgsquote</span>
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

        {/* Side Chart */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Verteilung</h3>
          <div className="flex-1 min-h-[250px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={6}
                  dataKey="value"
                  cornerRadius={6}
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    color: '#fff',
                    padding: '8px 12px'
                  }}
                  itemStyle={{ color: '#fff', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
               <span className="text-3xl font-bold text-slate-900 dark:text-white">{totalAttempted}</span>
               <span className="text-xs text-slate-500 uppercase tracking-wide">Beantwortet</span>
            </div>
          </div>
          
          <div className="mt-6 space-y-3">
             {pieData.map((entry, index) => (
               <div key={entry.name} className="flex items-center justify-between text-sm">
                 <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: chartColors[index] }} />
                    {entry.name}
                 </div>
                 <span className="font-semibold text-slate-900 dark:text-white">{entry.value}</span>
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
};