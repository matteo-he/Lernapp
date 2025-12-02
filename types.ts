export interface Question {
  id: string;
  question: string;
  choices: string[];
  correct: number[];
  explain: string;
  law_ref: string;
  tags: string[];
  last_checked: string;
  difficulty: number;
  __deleted?: boolean;
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'user';
}

export interface UserProgress {
  totalAttempts: number;
  totalCorrect: number;
  attemptedIds: Record<string, number>;
  correctIds: Record<string, number>;
  bookmarks?: string[];
  reviewQueue?: string[];
  reviewStreak?: Record<string, number>;
}

export interface FilterState {
  tags: string[];
  difficulty: number;
  bookmarkOnly: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface AppStats {
  total: number;
  attempted: number;
  correct: number;
  color: any;
  title: string;
  key: string;
}

export const GROUPS = [
  { key:"BDG",   title:"Dienstrecht (BDG)",           tags:["BDG"], color: "yellow" },
  { key:"SPG",   title:"Sicherheitspolizei (SPG)",     tags:["SPG"], color: "blue" },
  { key:"STPO",  title:"Strafprozess/StGB",            tags:["StPO","StGB"], color: "red" },
  { key:"ADMIN", title:"Verwaltung & Verkehr",          tags:["AVG","VStG","WaffG","StVO","KFG","FSG"], color: "green" },
];