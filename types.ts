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
}

export interface FilterState {
  tags: string[];
  difficulty: number;
}

export interface StatsGroup {
  key: string;
  title: string;
  total: number;
  attempted: number;
  correct: number;
  color: {
    bg: string;
    border: string;
    text: string;
    bar: string;
  };
}

export type ViewMode = 'dashboard' | 'train' | 'admin';
export type TrainingMode = 'training' | 'exam' | 'mission';