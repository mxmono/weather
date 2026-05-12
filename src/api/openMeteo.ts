const GEO = "https://geocoding-api.open-meteo.com/v1/search";
const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";

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

  const params = new URLSearchParams({
    name: q,
    count: "12",
    language,
  });

  const res = await fetch(`${GEO}?${params}`, { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = (await res.json()) as GeocodeResponse;
  return data.results ?? [];
}

export function formatPlaceLabel(r: GeocodeResult): string {
  const parts = [r.name, r.admin1, r.country].filter(Boolean);
  return parts.join(", ");
}

export type ArchiveDaily = {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
};

export type ArchivePayload = {
  daily: ArchiveDaily;
};

export async function fetchYearDailyTemps(
  lat: number,
  lon: number,
  year: number,
  signal?: AbortSignal
): Promise<ArchiveDaily> {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: start,
    end_date: end,
    daily: "temperature_2m_max,temperature_2m_min",
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
  return data.daily;
}
