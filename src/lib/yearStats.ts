import type { ArchiveDaily } from "../api/openMeteo";
import { daysInYear } from "./dates";
import { buildMatchSet, type TempRanges } from "./tempMatch";

export function fiveYearRange(endYear: number): number[] {
  const start = Math.max(1990, endYear - 4);
  const years: number[] = [];
  for (let y = start; y <= endYear; y++) years.push(y);
  return years;
}

export type YearMatchStats = {
  match: number;
  yearDays: number;
  pctOfYear: number;
  dataDays: number;
  pctOfData: number | null;
};

export function computeYearMatchStats(
  daily: ArchiveDaily,
  ranges: TempRanges,
  calendarYear: number
): YearMatchStats {
  const yd = daysInYear(calendarYear);
  const matchSet = buildMatchSet(
    daily.time,
    daily.temperature_2m_min,
    daily.temperature_2m_max,
    ranges
  );
  const dataDays = daily.time.length;
  const match = matchSet.size;
  return {
    match,
    yearDays: yd,
    pctOfYear: (match / yd) * 100,
    dataDays,
    pctOfData: dataDays > 0 ? (match / dataDays) * 100 : null,
  };
}

export function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
