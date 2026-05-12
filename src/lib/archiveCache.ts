import type { ArchiveDaily } from "../api/openMeteo";

const STORAGE_KEY = "weather-dashboard:archive-cache:v1";
const MAX_ENTRIES = 48;

/** Shorter TTL when the range ends before Dec 31 (in-progress year / partial archive). */
const TTL_PARTIAL_MS = 4 * 60 * 60 * 1000;
const TTL_FULL_YEAR_MS = 7 * 24 * 60 * 60 * 1000;

type CacheEntry = {
  storedAt: number;
  end: string;
  year: number;
  daily: ArchiveDaily;
};

type CacheBucket = Record<string, CacheEntry>;

function safeParse(raw: string | null): CacheBucket {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as unknown;
    return o && typeof o === "object" && !Array.isArray(o) ? (o as CacheBucket) : {};
  } catch {
    return {};
  }
}

function isFullCalendarYearEnd(year: number, end: string): boolean {
  return end === `${year}-12-31`;
}

function ttlForEntry(year: number, end: string): number {
  return isFullCalendarYearEnd(year, end) ? TTL_FULL_YEAR_MS : TTL_PARTIAL_MS;
}

function locSegment(lat: number, lon: number): string {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`;
}

export function archiveDataCacheKey(lat: number, lon: number, year: number, end: string): string {
  return `${locSegment(lat, lon)}|${year}|${end}`;
}

function pruneExpired(bucket: CacheBucket): CacheBucket {
  const now = Date.now();
  const next: CacheBucket = {};
  for (const [k, e] of Object.entries(bucket)) {
    if (!e || typeof e.storedAt !== "number" || !e.daily?.time) continue;
    const ttl = ttlForEntry(e.year, e.end);
    if (now - e.storedAt <= ttl) next[k] = e;
  }
  return next;
}

function trimToMax(bucket: CacheBucket): CacheBucket {
  const keys = Object.keys(bucket);
  if (keys.length <= MAX_ENTRIES) return bucket;
  const sorted = keys.sort((a, b) => bucket[a].storedAt - bucket[b].storedAt);
  const drop = sorted.slice(0, keys.length - MAX_ENTRIES);
  const next = { ...bucket };
  for (const k of drop) delete next[k];
  return next;
}

export function readArchiveCache(
  lat: number,
  lon: number,
  year: number,
  end: string
): ArchiveDaily | null {
  if (typeof localStorage === "undefined") return null;
  const key = archiveDataCacheKey(lat, lon, year, end);
  let bucket = pruneExpired(safeParse(localStorage.getItem(STORAGE_KEY)));
  const hit = bucket[key];
  if (!hit?.daily?.time?.length) return null;
  const ttl = ttlForEntry(hit.year, hit.end);
  if (Date.now() - hit.storedAt > ttl) return null;
  return hit.daily;
}

export function writeArchiveCache(
  lat: number,
  lon: number,
  year: number,
  end: string,
  daily: ArchiveDaily
): void {
  if (typeof localStorage === "undefined") return;
  const key = archiveDataCacheKey(lat, lon, year, end);
  let bucket = pruneExpired(safeParse(localStorage.getItem(STORAGE_KEY)));
  bucket[key] = {
    storedAt: Date.now(),
    end,
    year,
    daily,
  };
  bucket = trimToMax(bucket);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bucket));
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}
