import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  gradient?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = "", gradient = false }) => {
  return (
    <div className={`
      relative overflow-hidden rounded-2xl 
      bg-white dark:bg-slate-800 
      border border-slate-200 dark:border-slate-700
      shadow-lg hover:shadow-xl transition-all duration-300
      ${className}
    `}>
      {gradient && (
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-police-500 to-indigo-500" />
      )}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export const GlassCard: React.FC<CardProps> = ({ children, className = "" }) => {
  return (
    <div className={`
      rounded-2xl border border-white/20 shadow-xl
      bg-white/80 dark:bg-slate-900/80 
      backdrop-blur-md
      ${className}
    `}>
      {children}
    </div>
  );
};