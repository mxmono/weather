export function daysInYear(year: number): number {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return isLeap ? 366 : 365;
}

/**
 * Inclusive end date (YYYY-MM-DD) for Open-Meteo archive requests for a calendar year.
 * The archive rejects ranges extending past available data; for the current year this caps at "today" (local).
 */
export function archiveInclusiveEndForYear(year: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const jan1 = `${year}-01-01`;
  const dec31 = `${year}-12-31`;
  if (jan1 > today) return jan1;
  return dec31 < today ? dec31 : today;
}

/** YYYY-MM-DD from local year/month/day (calendar display uses local intent). */
export function isoDateUTC(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export function parseISODate(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m: m - 1, d };
}
