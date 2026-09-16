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
