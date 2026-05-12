import { archiveInclusiveEndForYear } from "../lib/dates";
import { readArchiveCache, writeArchiveCache } from "../lib/archiveCache";

const GEO = "https://geocoding-api.open-meteo.com/v1/search";
const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_CACHE_MAX = 32;
const searchCache = new Map<string, { at: number; data: GeocodeResult[] }>();

function searchCacheKey(language: string, query: string): string {
  return `${language}\n${query.toLowerCase()}`;
}

function trimSearchCache(): void {
  while (searchCache.size > SEARCH_CACHE_MAX) {
    const first = searchCache.keys().next().value;
    if (first === undefined) break;
    searchCache.delete(first);
  }
}

export type GeocodeResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
  admin2?: string;
};

export type GeocodeResponse = {
  results?: GeocodeResult[];
};

export async function searchPlaces(
  query: string,
  language: string,
  signal?: AbortSignal
): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const ck = searchCacheKey(language, q);
  const hit = searchCache.get(ck);
  if (hit && Date.now() - hit.at < SEARCH_CACHE_TTL_MS) {
    return hit.data;
  }

  const params = new URLSearchParams({
    name: q,
    count: "12",
    language,
  });

  const res = await fetch(`${GEO}?${params}`, { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = (await res.json()) as GeocodeResponse;
  const results = data.results ?? [];
  searchCache.set(ck, { at: Date.now(), data: results });
  trimSearchCache();
  return results;
}

export function formatPlaceLabel(r: GeocodeResult): string {
  const parts = [r.name, r.admin1, r.country].filter(Boolean);
  return parts.join(", ");
}

export type TempSource = "air" | "apparent";

export type ArchiveDaily = {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  apparent_temperature_max: number[];
  apparent_temperature_min: number[];
};

export type ArchivePayload = {
  daily: ArchiveDaily;
};

/** Daily lows / highs for matching and calendar, from archive daily payload. */
export function dailyMinMaxSeries(
  daily: ArchiveDaily,
  source: TempSource
): { mins: number[]; maxs: number[] } {
  if (source === "apparent") {
    return {
      mins: daily.apparent_temperature_min,
      maxs: daily.apparent_temperature_max,
    };
  }
  return {
    mins: daily.temperature_2m_min,
    maxs: daily.temperature_2m_max,
  };
}

export async function fetchYearDailyTemps(
  lat: number,
  lon: number,
  year: number,
  signal?: AbortSignal
): Promise<ArchiveDaily> {
  const start = `${year}-01-01`;
  const end = archiveInclusiveEndForYear(year);

  const cached = readArchiveCache(lat, lon, year, end);
  if (cached) return cached;

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: start,
    end_date: end,
    daily: "temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min",
    timezone: "auto",
  });

  const res = await fetch(`${ARCHIVE}?${params}`, { signal });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Archive request failed (${res.status}) ${err}`.trim());
  }
  const data = (await res.json()) as ArchivePayload;
  if (!data.daily?.time?.length) {
    throw new Error("No daily data returned for this place and year.");
  }
  writeArchiveCache(lat, lon, year, end, data.daily);
  return data.daily;
}
