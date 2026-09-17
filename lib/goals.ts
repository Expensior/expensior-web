import type { Goal, GoalContribution } from './types';

export interface GoalPace {
  savedSoFar: number;
  progressPct: number;
  weeksRemaining: number | null;
  requiredWeeklyPace: number | null;
  actualWeeklyPace: number | null;
  status: 'no-date' | 'on-pace' | 'behind' | 'ahead' | 'complete';
  message: string | null;
}

export function computeGoalPace(goal: Goal, contributions: GoalContribution[], today = new Date()): GoalPace {
  const savedSoFar = contributions.reduce((s, c) => s + c.amount, 0);
  const progressPct = Math.min(100, Math.round((savedSoFar / goal.target_amount) * 100));

  if (savedSoFar >= goal.target_amount) {
    return { savedSoFar, progressPct: 100, weeksRemaining: 0, requiredWeeklyPace: null, actualWeeklyPace: null, status: 'complete', message: null };
  }

  const remaining = goal.target_amount - savedSoFar;

  const createdAt = new Date(goal.created_at);
  const daysSinceCreated = Math.max(1, (today.getTime() - createdAt.getTime()) / 86400000);
  const weeksSinceCreated = Math.max(1, daysSinceCreated / 7);
  const actualWeeklyPace = savedSoFar / weeksSinceCreated;

  if (!goal.target_date) {
    return { savedSoFar, progressPct, weeksRemaining: null, requiredWeeklyPace: null, actualWeeklyPace, status: 'no-date', message: null };
  }

  const targetDate = new Date(goal.target_date + 'T23:59:59');
  const daysRemaining = (targetDate.getTime() - today.getTime()) / 86400000;
  const weeksRemaining = Math.max(1, Math.ceil(daysRemaining / 7));
  const requiredWeeklyPace = remaining / weeksRemaining;

  let status: GoalPace['status'];
  let message: string;

  if (actualWeeklyPace >= requiredWeeklyPace * 0.95) {
    status = 'on-pace';
    message = `Save ₹${Math.round(requiredWeeklyPace).toLocaleString('en-IN')}/week to reach this on time — you're on pace.`;
  } else {
    status = 'behind';
    const gap = requiredWeeklyPace - actualWeeklyPace;
    message = `₹${Math.round(gap).toLocaleString('en-IN')}/week behind pace — you'd need ₹${Math.round(requiredWeeklyPace).toLocaleString('en-IN')}/week now instead of ₹${Math.round(actualWeeklyPace).toLocaleString('en-IN')}/week to still make it.`;
  }

  return { savedSoFar, progressPct, weeksRemaining, requiredWeeklyPace, actualWeeklyPace, status, message };
}

export function computeLoggingStreak(transactionDates: string[], today = new Date()): number {
  const dateSet = new Set(transactionDates);
  const todayStr = today.toISOString().split('T')[0];

  const cursor = new Date(today);
  // If nothing logged today yet, that's fine — the day isn't over. Start counting from yesterday.
  if (!dateSet.has(todayStr)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (true) {
    const key = cursor.toISOString().split('T')[0];
    if (dateSet.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}
