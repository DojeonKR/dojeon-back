export const DEFAULT_TIMEZONE = 'UTC';

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

export function localDateKey(date: Date, timezone: string): string {
  let formatter = dateFormatterCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dateFormatterCache.set(timezone, formatter);
  }

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new Error(`Failed to calculate local date for timezone ${timezone}`);
  }
  return `${year}-${month}-${day}`;
}

export function dateKeyToUtcDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const date = dateKeyToUtcDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function startOfIsoWeekDateKey(dateKey: string): string {
  const date = dateKeyToUtcDate(dateKey);
  const dayOfWeek = date.getUTCDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return addDaysToDateKey(dateKey, -daysFromMonday);
}

export function calendarDayDifference(laterDateKey: string, earlierDateKey: string): number {
  const later = dateKeyToUtcDate(laterDateKey).getTime();
  const earlier = dateKeyToUtcDate(earlierDateKey).getTime();
  return Math.floor((later - earlier) / 86_400_000);
}

export function currentGoalStreakFromDates(activityDates: Date[], todayKey: string): number {
  if (activityDates.length === 0) return 0;

  let expectedKey = todayKey;
  const firstKey = activityDates[0].toISOString().slice(0, 10);
  if (firstKey !== todayKey) {
    const yesterdayKey = addDaysToDateKey(todayKey, -1);
    if (firstKey !== yesterdayKey) return 0;
    expectedKey = yesterdayKey;
  }

  let streak = 0;
  for (const activityDate of activityDates) {
    const dateKey = activityDate.toISOString().slice(0, 10);
    if (dateKey !== expectedKey) break;
    streak += 1;
    expectedKey = addDaysToDateKey(expectedKey, -1);
  }
  return streak;
}
