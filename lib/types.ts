export type TxnType = 'expense' | 'saving' | 'windfall';

export interface Transaction {
  id: string;
  amount: number;
  description: string;
  category: string;
  type: TxnType;
  indulgence: boolean;
  essential: boolean;
  regret: boolean;
  tag: string | null;
  notes: string | null;
  date: string; // YYYY-MM-DD
  repeats: 'none' | 'weekly' | 'monthly';
  created_at: string;
}

export type NewTransaction = Omit<Transaction, 'id' | 'created_at'>;

export interface RecurringTemplate {
  id: string;
  name: string;
  amount: number;
  category: string;
  indulgence: boolean;
  essential: boolean;
  cadence: 'monthly' | 'weekly';
  sort_order: number;
}

export interface Category {
  id: string;
  name: string;
  sort_order: number;
}

export interface Goal {
  id: string;
  name: string;
  icon: string;
  target_amount: number;
  target_date: string | null;
  achieved_at: string | null;
  created_at: string;
}

export interface GoalContribution {
  id: string;
  goal_id: string;
  amount: number;
  date: string;
  created_at: string;
}

export interface Digest {
  id: string;
  kind: 'friday' | 'sunday';
  period_end: string;
  spent: number;
  indulgence_pct: number;
  top_categories: { category: string; amount: number }[];
  insight: string;
  created_at: string;
}
