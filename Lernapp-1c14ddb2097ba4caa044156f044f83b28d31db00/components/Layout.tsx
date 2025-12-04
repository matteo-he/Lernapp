import React from 'react';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  currentView: string;
  setView: (v: string) => void;
  theme: string;
  toggleTheme: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, currentView, setView, theme, toggleTheme }) => {
  if (!user) {
    return (
      <div className="min-h-screen bg-[url('https://picsum.photos/1920/1080?grayscale&blur=2')] bg-cover bg-center flex items-center justify-center p-4">
         <div className="absolute inset-0 bg-police-900/80 dark:bg-slate-950/90" />
         <div className="relative z-10 w-full max-w-md">
            {children}
         </div>
      </div>
    );
  }

  const NavItem = ({ id, label, icon }: { id: string, label: string, icon: string }) => (
    <button 
      onClick={() => setView(id)}
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 w-full group
        ${currentView === id 
          ? 'bg-police-600 text-white shadow-lg shadow-police-500/30 font-medium' 
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-[1.02]'}
      `}
    >
      <span className={`text-xl transition-transform ${currentView === id ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</span>
      <span className="hidden md:inline">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 p-4 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 fixed h-full z-20">
        <div className="flex items-center gap-3 px-2 mb-8 mt-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-police-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
            P
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Polizei<br/>Lerntool</h1>
          </div>
        </div>

        <nav className="space-y-2 flex-1">
          <NavItem id="dashboard" label="Dashboard" icon="📊" />
          <NavItem id="train" label="Training" icon="🎯" />
          <NavItem id="chat" label="KI-Tutor" icon="💬" />
          {user.role === 'admin' && <NavItem id="admin" label="Verwaltung" icon="⚡" />}
        </nav>

        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2">
           <div className="px-4 py-2 mb-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
             <div className="text-xs uppercase text-slate-400 font-semibold tracking-wider mb-1">Benutzer</div>
             <div className="font-medium truncate">{user.username}</div>
             {user.role === 'admin' && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full inline-block mt-1">Admin</span>}
           </div>
           
           <button onClick={toggleTheme} className="flex items-center gap-3 px-4 py-2 w-full text-sm text-slate-500 hover:text-police-600 transition-colors">
             <span>{theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}</span>
           </button>
           
           <button onClick={onLogout} className="flex items-center gap-3 px-4 py-2 w-full text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors">
             🚪 Abmelden
           </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 z-50">
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-white/20 dark:border-slate-700 p-2 flex justify-around shadow-2xl rounded-2xl">
          <button onClick={() => setView('dashboard')} className={`p-3 rounded-xl transition-all ${currentView === 'dashboard' ? 'text-police-600 bg-police-50 dark:bg-police-900/20 scale-110' : 'text-slate-400'}`}>📊</button>
          <button onClick={() => setView('train')} className={`p-3 rounded-xl transition-all ${currentView === 'train' ? 'text-police-600 bg-police-50 dark:bg-police-900/20 scale-110' : 'text-slate-400'}`}>🎯</button>
          <button onClick={() => setView('chat')} className={`p-3 rounded-xl transition-all ${currentView === 'chat' ? 'text-police-600 bg-police-50 dark:bg-police-900/20 scale-110' : 'text-slate-400'}`}>💬</button>
          {user.role === 'admin' && <button onClick={() => setView('admin')} className={`p-3 rounded-xl transition-all ${currentView === 'admin' ? 'text-police-600 bg-police-50 dark:bg-police-900/20 scale-110' : 'text-slate-400'}`}>⚡</button>}
          <button onClick={onLogout} className="p-3 rounded-xl text-rose-500">🚪</button>
        </div>
      </div>

      <main className="flex-1 md:ml-64 w-full h-screen overflow-hidden relative">
        <div className="h-full overflow-y-auto scroll-smooth">
          <div className="max-w-6xl mx-auto p-4 md:p-8 pb-28 md:pb-8 min-h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};