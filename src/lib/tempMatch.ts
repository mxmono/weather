export type TempRanges = {
  /** Daily minimum temperature must be in [minLow, maxLow] °C inclusive. */
  minLow: number;
  maxLow: number;
  /** Daily maximum temperature must be in [minHigh, maxHigh] °C inclusive. */
  minHigh: number;
  maxHigh: number;
};

export function dayMatchesRange(
  dailyMin: number,
  dailyMax: number,
  r: TempRanges
): boolean {
  return (
    dailyMin >= r.minLow &&
    dailyMin <= r.maxLow &&
    dailyMax >= r.minHigh &&
    dailyMax <= r.maxHigh
  );
}

export function buildMatchSet(
  dates: string[],
  mins: number[],
  maxs: number[],
  r: TempRanges
): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < dates.length; i++) {
    const tMin = mins[i];
    const tMax = maxs[i];
    if (tMin == null || tMax == null || Number.isNaN(tMin) || Number.isNaN(tMax)) continue;
    if (dayMatchesRange(tMin, tMax, r)) out.add(dates[i]);
  }
  return out;
}

/** How a calendar day relates to the chosen min/max bands (for multi-color view). */
export type CalendarDayTone = "match" | "bothExtreme" | "lowCold" | "highHot" | "other";

/**
 * Classify a day using daily min vs [minLow,maxLow] and daily max vs [minHigh,maxHigh].
 * Priority: in-range → both extremes → low too cold → high too hot → other mismatches.
 */
export function calendarDayTone(
  dailyMin: number,
  dailyMax: number,
  r: TempRanges
): CalendarDayTone {
  if (dayMatchesRange(dailyMin, dailyMax, r)) return "match";
  if (dailyMin < r.minLow && dailyMax > r.maxHigh) return "bothExtreme";
  if (dailyMin < r.minLow) return "lowCold";
  if (dailyMax > r.maxHigh) return "highHot";
  return "other";
}
