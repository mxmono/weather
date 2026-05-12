import type { TempSource } from "../api/openMeteo";
import type { TempRanges } from "./tempMatch";

const STORAGE_KEY = "weather-dashboard:settings:v1";

export type PersistedPlace = {
  key: string;
  label: string;
  lat: number;
  lon: number;
};

export type SummarySortPersisted = { key: string; dir: "asc" | "desc" };
export type FiveYearSortPersisted = { key: string; dir: "asc" | "desc" };

export type DashboardSettingsV1 = {
  v: 1;
  places: PersistedPlace[];
  activeIdx: number;
  year: number;
  ranges: TempRanges;
  tempSource: TempSource;
  geoLang: string;
  summaryMode: "single" | "fiveYear";
  summarySort: SummarySortPersisted;
  fiveYearSort: FiveYearSortPersisted;
  calendarDetailColors: boolean;
};

const SUMMARY_KEYS = new Set([
  "location",
  "match",
  "pctOfYear",
  "dataDays",
  "pctOfData",
]);

const FIVE_KEYS = new Set([
  "location",
  "years",
  "avgMatch",
  "minMatch",
  "maxMatch",
  "avgPctOfYear",
  "minPctOfYear",
  "maxPctOfYear",
  "avgDataDays",
  "minDataDays",
  "maxDataDays",
  "avgPctOfData",
  "minPctOfData",
  "maxPctOfData",
]);

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function isTempSource(x: unknown): x is TempSource {
  return x === "air" || x === "apparent";
}

function isRanges(x: unknown): x is TempRanges {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.minLow === "number" &&
    typeof o.maxLow === "number" &&
    typeof o.minHigh === "number" &&
    typeof o.maxHigh === "number"
  );
}

function parsePlaces(x: unknown): PersistedPlace[] {
  if (!Array.isArray(x)) return [];
  const out: PersistedPlace[] = [];
  for (const p of x) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    if (
      typeof o.key === "string" &&
      typeof o.label === "string" &&
      typeof o.lat === "number" &&
      typeof o.lon === "number" &&
      Number.isFinite(o.lat) &&
      Number.isFinite(o.lon)
    ) {
      out.push({ key: o.key, label: o.label, lat: o.lat, lon: o.lon });
    }
    if (out.length >= 40) break;
  }
  return out;
}

export function loadDashboardSettings(): DashboardSettingsV1 | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;
    const o = data as Record<string, unknown>;
    if (o.v !== 1) return null;
    const places = parsePlaces(o.places);
    const ranges = isRanges(o.ranges) ? o.ranges : null;
    if (!ranges) return null;
    const year =
      typeof o.year === "number" && Number.isFinite(o.year)
        ? clamp(Math.floor(o.year), 1990, maxSelectableYear())
        : null;
    if (year === null) return null;
    const tempSource = isTempSource(o.tempSource) ? o.tempSource : "air";
    const geoLang = typeof o.geoLang === "string" ? o.geoLang : "";
    const summaryMode = o.summaryMode === "fiveYear" || o.summaryMode === "single" ? o.summaryMode : "single";
    const calendarDetailColors = o.calendarDetailColors === true;

    const ss = o.summarySort;
    const summarySort =
      ss &&
      typeof ss === "object" &&
      typeof (ss as { key: unknown }).key === "string" &&
      SUMMARY_KEYS.has((ss as { key: string }).key) &&
      ((ss as { dir: unknown }).dir === "asc" || (ss as { dir: unknown }).dir === "desc")
        ? { key: (ss as { key: string }).key, dir: (ss as { dir: "asc" | "desc" }).dir }
        : { key: "location", dir: "asc" as const };

    const fs = o.fiveYearSort;
    const fiveYearSort =
      fs &&
      typeof fs === "object" &&
      typeof (fs as { key: unknown }).key === "string" &&
      FIVE_KEYS.has((fs as { key: string }).key) &&
      ((fs as { dir: unknown }).dir === "asc" || (fs as { dir: unknown }).dir === "desc")
        ? { key: (fs as { key: string }).key, dir: (fs as { dir: "asc" | "desc" }).dir }
        : { key: "location", dir: "asc" as const };

    const activeIdx =
      typeof o.activeIdx === "number"
        ? clamp(Math.floor(o.activeIdx), 0, Math.max(0, places.length - 1))
        : 0;

    return {
      v: 1,
      places,
      activeIdx,
      year,
      ranges,
      tempSource,
      geoLang,
      summaryMode,
      summarySort,
      fiveYearSort,
      calendarDetailColors,
    };
  } catch {
    return null;
  }
}

export function saveDashboardSettings(s: DashboardSettingsV1): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function maxSelectableYear(): number {
  return new Date().getFullYear();
}
