import { useEffect, useMemo, useState } from "react";
import {
  fetchYearDailyTemps,
  formatPlaceLabel,
  searchPlaces,
  type ArchiveDaily,
  type GeocodeResult,
} from "./api/openMeteo";
import { YearCalendar, type CalendarCellInfo } from "./components/YearCalendar";
import { daysInYear } from "./lib/dates";
import { buildMatchSet, calendarDayTone, type TempRanges } from "./lib/tempMatch";
import {
  avg,
  computeYearMatchStats,
  fiveYearRange,
} from "./lib/yearStats";
import "./styles.css";

const MAX_PLACES = 5;

type SummaryRow = {
  place: SelectedPlace;
  match: number;
  dataDays: number;
  yearDays: number;
  pctOfYear: number | null;
  pctOfData: number | null;
  error: string | null;
};

type SummarySortKey = "location" | "match" | "pctOfYear" | "dataDays" | "pctOfData";

type FiveYearSummaryRow = {
  place: SelectedPlace;
  yearsAttempted: number;
  yearsWithData: number;
  avgMatch: number | null;
  minMatch: number | null;
  maxMatch: number | null;
  avgPctOfYear: number | null;
  minPctOfYear: number | null;
  maxPctOfYear: number | null;
  avgDataDays: number | null;
  minDataDays: number | null;
  maxDataDays: number | null;
  avgPctOfData: number | null;
  minPctOfData: number | null;
  maxPctOfData: number | null;
  error: string | null;
};

type FiveYearSortKey =
  | "location"
  | "years"
  | "avgMatch"
  | "minMatch"
  | "maxMatch"
  | "avgPctOfYear"
  | "minPctOfYear"
  | "maxPctOfYear"
  | "avgDataDays"
  | "minDataDays"
  | "maxDataDays"
  | "avgPctOfData"
  | "minPctOfData"
  | "maxPctOfData";

function fiveYearWindowLabel(endYear: number): string {
  const ys = fiveYearRange(endYear);
  if (ys.length === 0) return String(endYear);
  return `${ys[0]}–${ys[ys.length - 1]}`;
}

function compareFiveYearRows(a: FiveYearSummaryRow, b: FiveYearSummaryRow, key: FiveYearSortKey, dir: 1 | -1): number {
  const tie = a.place.label.localeCompare(b.place.label);
  const errLast = (): number | null => {
    const ea = !!a.error;
    const eb = !!b.error;
    if (ea && !eb) return 1;
    if (!ea && eb) return -1;
    return null;
  };
  const num = (
    va: number | null,
    vb: number | null,
    el: number | null
  ): number => {
    if (el != null) return el;
    if (va == null && vb == null) return tie;
    if (va == null) return 1;
    if (vb == null) return -1;
    const c = (va - vb) * dir;
    return c !== 0 ? c : tie;
  };

  switch (key) {
    case "location":
      return a.place.label.localeCompare(b.place.label) * dir;
    case "years":
      return num(a.yearsWithData, b.yearsWithData, errLast());
    case "avgMatch":
      return num(a.avgMatch, b.avgMatch, errLast());
    case "minMatch":
      return num(a.minMatch, b.minMatch, errLast());
    case "maxMatch":
      return num(a.maxMatch, b.maxMatch, errLast());
    case "avgPctOfYear":
      return num(a.avgPctOfYear, b.avgPctOfYear, errLast());
    case "minPctOfYear":
      return num(a.minPctOfYear, b.minPctOfYear, errLast());
    case "maxPctOfYear":
      return num(a.maxPctOfYear, b.maxPctOfYear, errLast());
    case "avgDataDays":
      return num(a.avgDataDays, b.avgDataDays, errLast());
    case "minDataDays":
      return num(a.minDataDays, b.minDataDays, errLast());
    case "maxDataDays":
      return num(a.maxDataDays, b.maxDataDays, errLast());
    case "avgPctOfData":
      return num(a.avgPctOfData, b.avgPctOfData, errLast());
    case "minPctOfData":
      return num(a.minPctOfData, b.minPctOfData, errLast());
    case "maxPctOfData":
      return num(a.maxPctOfData, b.maxPctOfData, errLast());
    default:
      return 0;
  }
}

function compareSummaryRows(a: SummaryRow, b: SummaryRow, key: SummarySortKey, dir: 1 | -1): number {
  const tie = a.place.label.localeCompare(b.place.label);

  const errLast = (): number | null => {
    const ea = !!a.error;
    const eb = !!b.error;
    if (ea && !eb) return 1;
    if (!ea && eb) return -1;
    return null;
  };

  switch (key) {
    case "location":
      return a.place.label.localeCompare(b.place.label) * dir;
    case "match": {
      const el = errLast();
      if (el != null) return el;
      const c = (a.match - b.match) * dir;
      return c !== 0 ? c : tie;
    }
    case "pctOfYear": {
      const el = errLast();
      if (el != null) return el;
      const va = a.pctOfYear;
      const vb = b.pctOfYear;
      if (va == null && vb == null) return tie;
      if (va == null) return 1;
      if (vb == null) return -1;
      const c = (va - vb) * dir;
      return c !== 0 ? c : tie;
    }
    case "dataDays": {
      const el = errLast();
      if (el != null) return el;
      const c = (a.dataDays - b.dataDays) * dir;
      return c !== 0 ? c : tie;
    }
    case "pctOfData": {
      const el = errLast();
      if (el != null) return el;
      const va = a.pctOfData;
      const vb = b.pctOfData;
      if (va == null && vb == null) return tie;
      if (va == null) return 1;
      if (vb == null) return -1;
      const c = (va - vb) * dir;
      return c !== 0 ? c : tie;
    }
    default:
      return 0;
  }
}

export type SelectedPlace = {
  key: string;
  label: string;
  lat: number;
  lon: number;
};

function placeFromGeocode(r: GeocodeResult): SelectedPlace {
  return {
    key: String(r.id),
    label: formatPlaceLabel(r),
    lat: r.latitude,
    lon: r.longitude,
  };
}

/** Initial map pins (coordinates align with Open-Meteo archive grid). */
const DEFAULT_PLACES: SelectedPlace[] = [
  {
    key: "preset-weston-ma",
    label: "Weston, Massachusetts, United States",
    lat: 42.3668,
    lon: -71.3031,
  },
  {
    key: "preset-mountain-view-ca",
    label: "Mountain View, California, United States",
    lat: 37.3861,
    lon: -122.0839,
  },
  {
    key: "preset-shanghai-cn",
    label: "Shanghai, Shanghai, China",
    lat: 31.2304,
    lon: 121.4737,
  },
  {
    key: "preset-london-gb",
    label: "London, England, United Kingdom",
    lat: 51.5074,
    lon: -0.1278,
  },
];

function defaultYear(): number {
  const y = new Date().getFullYear();
  return Math.max(1990, y - 1);
}

function yearOptions(): number[] {
  const end = new Date().getFullYear();
  const start = 1990;
  const out: number[] = [];
  for (let y = end; y >= start; y--) out.push(y);
  return out;
}

export default function App() {
  const [places, setPlaces] = useState<SelectedPlace[]>(() => [...DEFAULT_PLACES]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [year, setYear] = useState(defaultYear);

  const [ranges, setRanges] = useState<TempRanges>({
    minLow: 12,
    maxLow: 18,
    minHigh: 20,
    maxHigh: 25,
  });

  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchHits, setSearchHits] = useState<GeocodeResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [geoLang, setGeoLang] = useState("");

  const [archiveByPlaceYear, setArchiveByPlaceYear] = useState<
    Record<string, Partial<Record<number, ArchiveDaily | null>>>
  >({});
  const [archiveErrorsByYear, setArchiveErrorsByYear] = useState<
    Record<string, Partial<Record<number, string>>>
  >({});
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [summaryMode, setSummaryMode] = useState<"single" | "fiveYear">("single");

  const [summarySort, setSummarySort] = useState<{ key: SummarySortKey; dir: "asc" | "desc" }>({
    key: "location",
    dir: "asc",
  });

  const [fiveYearSort, setFiveYearSort] = useState<{ key: FiveYearSortKey; dir: "asc" | "desc" }>({
    key: "location",
    dir: "asc",
  });

  const [calendarDetailColors, setCalendarDetailColors] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(rawQuery.trim()), 350);
    return () => window.clearTimeout(t);
  }, [rawQuery]);

  const resolvedLang = geoLang || (typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "en");

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSearchHits([]);
      setSearchError(null);
      return;
    }
    const ac = new AbortController();
    setSearchLoading(true);
    setSearchError(null);
    searchPlaces(debouncedQuery, resolvedLang, ac.signal)
      .then(setSearchHits)
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setSearchError(e.message);
        setSearchHits([]);
      })
      .finally(() => setSearchLoading(false));
    return () => ac.abort();
  }, [debouncedQuery, resolvedLang]);

  useEffect(() => {
    if (places.length === 0) {
      setArchiveByPlaceYear({});
      setArchiveErrorsByYear({});
      setArchiveLoading(false);
      return;
    }
    const years = summaryMode === "fiveYear" ? fiveYearRange(year) : [year];
    const ac = new AbortController();
    setArchiveLoading(true);
    setArchiveErrorsByYear({});
    setArchiveByPlaceYear({});

    const run = async () => {
      const data: Record<string, Partial<Record<number, ArchiveDaily | null>>> = {};
      const errs: Record<string, Partial<Record<number, string>>> = {};

      await Promise.all(
        places.flatMap((p) =>
          years.map(async (y) => {
            try {
              const daily = await fetchYearDailyTemps(p.lat, p.lon, y, ac.signal);
              if (!data[p.key]) data[p.key] = {};
              data[p.key][y] = daily;
            } catch (e: unknown) {
              if ((e as Error).name === "AbortError") return;
              if (!data[p.key]) data[p.key] = {};
              if (!errs[p.key]) errs[p.key] = {};
              data[p.key][y] = null;
              errs[p.key][y] = (e as Error).message || "Failed to load";
            }
          })
        )
      );

      if (ac.signal.aborted) return;
      setArchiveByPlaceYear(data);
      setArchiveErrorsByYear(errs);
      setArchiveLoading(false);
    };

    void run();
    return () => ac.abort();
  }, [places, year, summaryMode]);

  const windowYearsForUi = useMemo(() => fiveYearRange(year), [year]);

  const rangeInvalid =
    ranges.minLow > ranges.maxLow ||
    ranges.minHigh > ranges.maxHigh ||
    Number.isNaN(ranges.minLow) ||
    Number.isNaN(ranges.maxLow) ||
    Number.isNaN(ranges.minHigh) ||
    Number.isNaN(ranges.maxHigh);

  const summaries = useMemo((): SummaryRow[] => {
    const yd = daysInYear(year);
    return places.map((p) => {
      const daily = archiveByPlaceYear[p.key]?.[year];
      const err = archiveErrorsByYear[p.key]?.[year];
      if (err || !daily) {
        return {
          place: p,
          match: 0,
          dataDays: 0,
          yearDays: yd,
          pctOfYear: null as number | null,
          pctOfData: null as number | null,
          error: err ?? (!daily ? "No data" : null),
        };
      }
      const matchSet = buildMatchSet(
        daily.time,
        daily.temperature_2m_min,
        daily.temperature_2m_max,
        ranges
      );
      const dataDays = daily.time.length;
      const match = matchSet.size;
      const pctOfYear = (match / yd) * 100;
      const pctOfData = dataDays > 0 ? (match / dataDays) * 100 : null;
      return {
        place: p,
        match,
        dataDays,
        yearDays: yd,
        pctOfYear,
        pctOfData,
        error: null as string | null,
      };
    });
  }, [places, archiveByPlaceYear, archiveErrorsByYear, ranges, year]);

  const fiveYearSummaries = useMemo((): FiveYearSummaryRow[] => {
    const windowYears = fiveYearRange(year);
    const nWin = windowYears.length;
    const emptyRow = (p: SelectedPlace, err: string): FiveYearSummaryRow => ({
      place: p,
      yearsAttempted: nWin,
      yearsWithData: 0,
      avgMatch: null,
      minMatch: null,
      maxMatch: null,
      avgPctOfYear: null,
      minPctOfYear: null,
      maxPctOfYear: null,
      avgDataDays: null,
      minDataDays: null,
      maxDataDays: null,
      avgPctOfData: null,
      minPctOfData: null,
      maxPctOfData: null,
      error: err,
    });

    if (rangeInvalid) {
      return places.map((p) => emptyRow(p, "Invalid temperature ranges"));
    }

    return places.map((p) => {
      const perYear: ReturnType<typeof computeYearMatchStats>[] = [];
      for (const y of windowYears) {
        const daily = archiveByPlaceYear[p.key]?.[y];
        const err = archiveErrorsByYear[p.key]?.[y];
        if (!daily || err) continue;
        perYear.push(computeYearMatchStats(daily, ranges, y));
      }
      if (perYear.length === 0) {
        return emptyRow(p, "No archive data in this window");
      }
      const matches = perYear.map((s) => s.match);
      const pctY = perYear.map((s) => s.pctOfYear);
      const dataD = perYear.map((s) => s.dataDays);
      const pctD = perYear.map((s) => s.pctOfData).filter((x): x is number => x != null);
      return {
        place: p,
        yearsAttempted: nWin,
        yearsWithData: perYear.length,
        avgMatch: avg(matches),
        minMatch: Math.min(...matches),
        maxMatch: Math.max(...matches),
        avgPctOfYear: avg(pctY),
        minPctOfYear: Math.min(...pctY),
        maxPctOfYear: Math.max(...pctY),
        avgDataDays: avg(dataD),
        minDataDays: Math.min(...dataD),
        maxDataDays: Math.max(...dataD),
        avgPctOfData: pctD.length > 0 ? avg(pctD) : null,
        minPctOfData: pctD.length > 0 ? Math.min(...pctD) : null,
        maxPctOfData: pctD.length > 0 ? Math.max(...pctD) : null,
        error: null,
      };
    });
  }, [places, year, ranges, rangeInvalid, archiveByPlaceYear, archiveErrorsByYear]);

  const sortedFiveYearSummaries = useMemo(() => {
    const dir: 1 | -1 = fiveYearSort.dir === "asc" ? 1 : -1;
    const key = fiveYearSort.key;
    return [...fiveYearSummaries].sort((a, b) => compareFiveYearRows(a, b, key, dir));
  }, [fiveYearSummaries, fiveYearSort]);

  const sortedSummaries = useMemo(() => {
    const dir: 1 | -1 = summarySort.dir === "asc" ? 1 : -1;
    const key = summarySort.key;
    return [...summaries].sort((a, b) => compareSummaryRows(a, b, key, dir));
  }, [summaries, summarySort]);

  function toggleSummarySort(key: SummarySortKey) {
    setSummarySort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    );
  }

  function sortMark(key: SummarySortKey): string {
    if (summarySort.key !== key) return "";
    return summarySort.dir === "asc" ? "↑" : "↓";
  }

  function thAriaSort(key: SummarySortKey): "ascending" | "descending" | "none" {
    if (summarySort.key !== key) return "none";
    return summarySort.dir === "asc" ? "ascending" : "descending";
  }

  function toggleFiveYearSort(key: FiveYearSortKey) {
    setFiveYearSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    );
  }

  function sortMarkFive(key: FiveYearSortKey): string {
    if (fiveYearSort.key !== key) return "";
    return fiveYearSort.dir === "asc" ? "↑" : "↓";
  }

  function thAriaSortFive(key: FiveYearSortKey): "ascending" | "descending" | "none" {
    if (fiveYearSort.key !== key) return "none";
    return fiveYearSort.dir === "asc" ? "ascending" : "descending";
  }

  const activePlace = places[activeIdx] ?? places[0];
  const activeDaily = activePlace ? archiveByPlaceYear[activePlace.key]?.[year] : undefined;

  const activeMatchSet = useMemo(() => {
    if (!activeDaily || rangeInvalid) return new Set<string>();
    return buildMatchSet(
      activeDaily.time,
      activeDaily.temperature_2m_min,
      activeDaily.temperature_2m_max,
      ranges
    );
  }, [activeDaily, ranges, rangeInvalid]);

  const activeDataSet = useMemo(() => {
    if (!activeDaily) return new Set<string>();
    return new Set(activeDaily.time);
  }, [activeDaily]);

  const calendarCellInfo = useMemo((): Map<string, CalendarCellInfo> => {
    const m = new Map<string, CalendarCellInfo>();
    if (!activeDaily || rangeInvalid) return m;
    for (let i = 0; i < activeDaily.time.length; i++) {
      const date = activeDaily.time[i];
      const tMin = activeDaily.temperature_2m_min[i];
      const tMax = activeDaily.temperature_2m_max[i];
      if (tMin == null || tMax == null || Number.isNaN(tMin) || Number.isNaN(tMax)) continue;
      m.set(date, {
        tone: calendarDayTone(tMin, tMax, ranges),
        tMin,
        tMax,
      });
    }
    return m;
  }, [activeDaily, ranges, rangeInvalid]);

  function addPlace(r: GeocodeResult) {
    const next = placeFromGeocode(r);
    setPlaces((prev) => {
      if (prev.some((p) => p.key === next.key)) return prev;
      if (prev.length >= MAX_PLACES) return prev;
      return [...prev, next];
    });
    setSearchHits([]);
    setRawQuery("");
  }

  function removePlace(key: string) {
    setPlaces((prev) => {
      const i = prev.findIndex((p) => p.key === key);
      const next = prev.filter((p) => p.key !== key);
      setActiveIdx((idx) => {
        if (next.length === 0) return 0;
        if (i < 0) return idx;
        if (i < idx) return idx - 1;
        if (i === idx) return Math.min(idx, next.length - 1);
        return idx;
      });
      return next;
    });
  }

  return (
    <>
      <header>
        <h1>Temperature calendar</h1>
        <p className="subtitle">
          Open-Meteo archive (ERA5): search places, pick a year, set daily min/max °C bands, and see which
          calendar days fall in range.
        </p>
      </header>

      <section className="card stack">
        <h2>Locations (up to {MAX_PLACES})</h2>
        <div className="row gap wrap">
          <label className="small-label" htmlFor="search">
            Search
          </label>
          <input
            id="search"
            className="text-input grow"
            placeholder="e.g. Weston Massachusetts, Mountain View CA"
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            autoComplete="off"
          />
          <label className="small-label" htmlFor="geolang">
            Result language
          </label>
          <select
            id="geolang"
            className="select-narrow"
            value={geoLang}
            onChange={(e) => setGeoLang(e.target.value)}
            title="Geocoding API language for place names"
          >
            <option value="">Browser default</option>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="de">Deutsch</option>
            <option value="fr">Français</option>
            <option value="ja">日本語</option>
            <option value="zh">中文</option>
          </select>
        </div>
        {searchLoading && <p className="muted small">Searching…</p>}
        {searchError && <p className="error-inline">{searchError}</p>}
        {searchHits.length > 0 && (
          <ul className="hit-list">
            {searchHits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className="hit-btn"
                  disabled={places.length >= MAX_PLACES || places.some((p) => p.key === String(h.id))}
                  onClick={() => addPlace(h)}
                >
                  {formatPlaceLabel(h)}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="chips">
          {places.length === 0 && <span className="muted small">No places selected yet.</span>}
          {places.map((p) => (
            <span key={p.key} className="chip">
              <span className="chip-label">{p.label}</span>
              <button type="button" className="chip-x" aria-label={`Remove ${p.label}`} onClick={() => removePlace(p.key)}>
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      <section className="card stack">
        <h2>Year & temperature bands (°C)</h2>
        <div className="row gap wrap align-end">
          <div className="field">
            <label htmlFor="year">Calendar year</label>
            <select id="year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {yearOptions().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Daily low between</label>
            <div className="inline-pair">
              <input
                type="number"
                step="0.5"
                value={ranges.minLow}
                onChange={(e) => setRanges((r) => ({ ...r, minLow: Number(e.target.value) }))}
              />
              <span className="muted">and</span>
              <input
                type="number"
                step="0.5"
                value={ranges.maxLow}
                onChange={(e) => setRanges((r) => ({ ...r, maxLow: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="field">
            <label>Daily high between</label>
            <div className="inline-pair">
              <input
                type="number"
                step="0.5"
                value={ranges.minHigh}
                onChange={(e) => setRanges((r) => ({ ...r, minHigh: Number(e.target.value) }))}
              />
              <span className="muted">and</span>
              <input
                type="number"
                step="0.5"
                value={ranges.maxHigh}
                onChange={(e) => setRanges((r) => ({ ...r, maxHigh: Number(e.target.value) }))}
              />
            </div>
          </div>
        </div>
        {rangeInvalid && (
          <p className="error-inline">Fix ranges so each &quot;between&quot; pair has min ≤ max.</p>
        )}
        <p className="muted small">
          A day counts when <strong>daily minimum</strong> is inside the low band and <strong>daily maximum</strong> is
          inside the high band (archive uses Open-Meteo&apos;s local day for each coordinate).
        </p>
      </section>

      {archiveLoading && places.length > 0 && (
        <p className="loading">
          Loading archive
          {summaryMode === "fiveYear" ? ` (${fiveYearWindowLabel(year)})…` : ` for ${year}…`}
        </p>
      )}

      {places.length > 0 &&
        !archiveLoading &&
        places.every((p) => !archiveByPlaceYear[p.key]?.[year]) && (
        <div className="error-banner">Could not load archive data for any location. Try another year or place.</div>
      )}

      {summaries.length > 0 && !archiveLoading && (
        <section className="card stack">
          <h2>Summary</h2>
          <div className="summary-mode" role="group" aria-label="Summary time span">
            <button
              type="button"
              className={"seg" + (summaryMode === "single" ? " seg--on" : "")}
              onClick={() => setSummaryMode("single")}
            >
              {year} only
            </button>
            <button
              type="button"
              className={"seg" + (summaryMode === "fiveYear" ? " seg--on" : "")}
              onClick={() => setSummaryMode("fiveYear")}
            >
              5-year window ({fiveYearWindowLabel(year)})
            </button>
          </div>

          {summaryMode === "single" ? (
            <>
              <div className="table-wrap">
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th aria-sort={thAriaSort("location")}>
                        <button type="button" className="th-sort" onClick={() => toggleSummarySort("location")}>
                          Location <span className="sort-ind">{sortMark("location")}</span>
                        </button>
                      </th>
                      <th aria-sort={thAriaSort("match")}>
                        <button type="button" className="th-sort" onClick={() => toggleSummarySort("match")}>
                          Days in range <span className="sort-ind">{sortMark("match")}</span>
                        </button>
                      </th>
                      <th aria-sort={thAriaSort("pctOfYear")}>
                        <button type="button" className="th-sort" onClick={() => toggleSummarySort("pctOfYear")}>
                          % of year <span className="sort-ind">{sortMark("pctOfYear")}</span>
                        </button>
                      </th>
                      <th aria-sort={thAriaSort("dataDays")}>
                        <button type="button" className="th-sort" onClick={() => toggleSummarySort("dataDays")}>
                          Archive days <span className="sort-ind">{sortMark("dataDays")}</span>
                        </button>
                      </th>
                      <th aria-sort={thAriaSort("pctOfData")}>
                        <button type="button" className="th-sort" onClick={() => toggleSummarySort("pctOfData")}>
                          % of archive days <span className="sort-ind">{sortMark("pctOfData")}</span>
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSummaries.map((s) => (
                      <tr key={s.place.key}>
                        <td>{s.place.label}</td>
                        <td>
                          {s.error ? (
                            <span className="error-inline">{s.error}</span>
                          ) : (
                            <>
                              <strong>{s.match}</strong> of {s.yearDays}
                            </>
                          )}
                        </td>
                        <td className="mono">
                          {s.pctOfYear == null ? "—" : `${s.pctOfYear.toFixed(1)}%`}
                        </td>
                        <td className="mono">{s.dataDays}</td>
                        <td className="mono">{s.pctOfData == null ? "—" : `${s.pctOfData.toFixed(1)}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted small">
                &quot;% of year&quot; uses {daysInYear(year)} calendar days. If the archive returns fewer days (rare
                near the present), &quot;% of archive days&quot; uses only days with values.
              </p>
            </>
          ) : (
            <>
              <p className="muted small">
                Ending on <strong>{year}</strong>: each row aggregates <strong>{windowYearsForUi.length}</strong>{" "}
                calendar years (from {windowYearsForUi[0] ?? year} through {year}). Averages are simple means across
                years that returned daily data; min/max columns are the worst and best single year in that set.
              </p>
              <div className="table-wrap">
                <table className="summary-table summary-table--wide">
                  <thead>
                    <tr>
                      <th aria-sort={thAriaSortFive("location")}>
                        <button type="button" className="th-sort" onClick={() => toggleFiveYearSort("location")}>
                          Location <span className="sort-ind">{sortMarkFive("location")}</span>
                        </button>
                      </th>
                      <th aria-sort={thAriaSortFive("years")}>
                        <button type="button" className="th-sort" onClick={() => toggleFiveYearSort("years")}>
                          Years with data <span className="sort-ind">{sortMarkFive("years")}</span>
                        </button>
                      </th>
                      <th aria-sort={thAriaSortFive("avgMatch")}>
                        <button type="button" className="th-sort" onClick={() => toggleFiveYearSort("avgMatch")}>
                          Avg days <span className="sort-ind">{sortMarkFive("avgMatch")}</span>
                        </button>
                      </th>
                      <th aria-sort={thAriaSortFive("minMatch")}>
                        <button type="button" className="th-sort" onClick={() => toggleFiveYearSort("minMatch")}>
                          Min days <span className="sort-ind">{sortMarkFive("minMatch")}</span>
                        </button>
                      </th>
                      <th aria-sort={thAriaSortFive("maxMatch")}>
                        <button type="button" className="th-sort" onClick={() => toggleFiveYearSort("maxMatch")}>
                          Max days <span className="sort-ind">{sortMarkFive("maxMatch")}</span>
                        </button>
                      </th>
                      <th aria-sort={thAriaSortFive("avgPctOfYear")}>
                        <button type="button" className="th-sort" onClick={() => toggleFiveYearSort("avgPctOfYear")}>
                          Avg % yr <span className="sort-ind">{sortMarkFive("avgPctOfYear")}</span>
                        </button>
                      </th>
                      <th aria-sort={thAriaSortFive("minPctOfYear")}>
                        <button type="button" className="th-sort" onClick={() => toggleFiveYearSort("minPctOfYear")}>
                          Min % yr <span className="sort-ind">{sortMarkFive("minPctOfYear")}</span>
                        </button>
                      </th>
                      <th aria-sort={thAriaSortFive("maxPctOfYear")}>
                        <button type="button" className="th-sort" onClick={() => toggleFiveYearSort("maxPctOfYear")}>
                          Max % yr <span className="sort-ind">{sortMarkFive("maxPctOfYear")}</span>
                        </button>
                      </th>
                      <th aria-sort={thAriaSortFive("avgDataDays")}>
                        <button type="button" className="th-sort" onClick={() => toggleFiveYearSort("avgDataDays")}>
                          Avg arch. days <span className="sort-ind">{sortMarkFive("avgDataDays")}</span>
                        </button>
                      </th>
                      <th aria-sort={thAriaSortFive("minDataDays")}>
                        <button type="button" className="th-sort" onClick={() => toggleFiveYearSort("minDataDays")}>
                          Min arch. <span className="sort-ind">{sortMarkFive("minDataDays")}</span>
                        </button>
                      </th>
                      <th aria-sort={thAriaSortFive("maxDataDays")}>
                        <button type="button" className="th-sort" onClick={() => toggleFiveYearSort("maxDataDays")}>
                          Max arch. <span className="sort-ind">{sortMarkFive("maxDataDays")}</span>
                        </button>
                      </th>
                      <th aria-sort={thAriaSortFive("avgPctOfData")}>
                        <button type="button" className="th-sort" onClick={() => toggleFiveYearSort("avgPctOfData")}>
                          Avg % arch. <span className="sort-ind">{sortMarkFive("avgPctOfData")}</span>
                        </button>
                      </th>
                      <th aria-sort={thAriaSortFive("minPctOfData")}>
                        <button type="button" className="th-sort" onClick={() => toggleFiveYearSort("minPctOfData")}>
                          Min % arch. <span className="sort-ind">{sortMarkFive("minPctOfData")}</span>
                        </button>
                      </th>
                      <th aria-sort={thAriaSortFive("maxPctOfData")}>
                        <button type="button" className="th-sort" onClick={() => toggleFiveYearSort("maxPctOfData")}>
                          Max % arch. <span className="sort-ind">{sortMarkFive("maxPctOfData")}</span>
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFiveYearSummaries.map((s) => (
                      <tr key={s.place.key}>
                        <td>{s.place.label}</td>
                        <td className="mono">
                          {s.error ? (
                            <span className="error-inline">{s.error}</span>
                          ) : (
                            <>
                              {s.yearsWithData} / {s.yearsAttempted}
                            </>
                          )}
                        </td>
                        <td className="mono">{s.avgMatch == null ? "—" : s.avgMatch.toFixed(1)}</td>
                        <td className="mono">{s.minMatch ?? "—"}</td>
                        <td className="mono">{s.maxMatch ?? "—"}</td>
                        <td className="mono">
                          {s.avgPctOfYear == null ? "—" : `${s.avgPctOfYear.toFixed(1)}%`}
                        </td>
                        <td className="mono">
                          {s.minPctOfYear == null ? "—" : `${s.minPctOfYear.toFixed(1)}%`}
                        </td>
                        <td className="mono">
                          {s.maxPctOfYear == null ? "—" : `${s.maxPctOfYear.toFixed(1)}%`}
                        </td>
                        <td className="mono">{s.avgDataDays == null ? "—" : s.avgDataDays.toFixed(1)}</td>
                        <td className="mono">{s.minDataDays ?? "—"}</td>
                        <td className="mono">{s.maxDataDays ?? "—"}</td>
                        <td className="mono">
                          {s.avgPctOfData == null ? "—" : `${s.avgPctOfData.toFixed(1)}%`}
                        </td>
                        <td className="mono">
                          {s.minPctOfData == null ? "—" : `${s.minPctOfData.toFixed(1)}%`}
                        </td>
                        <td className="mono">
                          {s.maxPctOfData == null ? "—" : `${s.maxPctOfData.toFixed(1)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {places.length > 0 && activePlace && (
        <section className="card stack">
          <h2>Year calendar · highlights</h2>
          <div className="tabs">
            {places.map((p, i) => (
              <button
                key={p.key}
                type="button"
                className={"tab" + (i === activeIdx ? " tab--on" : "")}
                onClick={() => setActiveIdx(i)}
              >
                {p.label.split(",")[0]}
              </button>
            ))}
          </div>
          <div className="cal-toolbar row gap wrap align-end">
            <p className="muted small cal-meta grow">
              Active: <strong>{activePlace.label}</strong>.
              {calendarDetailColors
                ? " Colors show how each day's low/high relates to your bands (legend below)."
                : " Teal = both daily min and max fall in your bands."}
            </p>
            <label className="cal-toggle">
              <input
                type="checkbox"
                checked={calendarDetailColors}
                onChange={(e) => setCalendarDetailColors(e.target.checked)}
              />
              <span>Band coloring</span>
            </label>
          </div>
          {calendarDetailColors && (
            <div className="cal-legend muted small" aria-label="Calendar color legend">
              <span className="cal-legend-item">
                <span className="cal-swatch cal-swatch--match" aria-hidden /> In range
              </span>
              <span className="cal-legend-item">
                <span className="cal-swatch cal-swatch--low" aria-hidden /> Low below band
              </span>
              <span className="cal-legend-item">
                <span className="cal-swatch cal-swatch--high" aria-hidden /> High above band
              </span>
              <span className="cal-legend-item">
                <span className="cal-swatch cal-swatch--both" aria-hidden /> Low below &amp; high above
              </span>
              <span className="cal-legend-item">
                <span className="cal-swatch cal-swatch--other" aria-hidden /> Other mismatch
              </span>
            </div>
          )}
          {archiveErrorsByYear[activePlace.key]?.[year] && (
            <p className="error-inline">{archiveErrorsByYear[activePlace.key]?.[year]}</p>
          )}
          {!archiveErrorsByYear[activePlace.key]?.[year] && activeDaily && !rangeInvalid && (
            <YearCalendar
              year={year}
              matchDates={activeMatchSet}
              dataDates={activeDataSet}
              detailColors={calendarDetailColors}
              cellInfo={calendarCellInfo}
            />
          )}
        </section>
      )}

      <p className="footer-note">
        Geocoding and historical fields from{" "}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Open-Meteo
        </a>
        . Very recent dates can lag a few days in the archive.
      </p>
    </>
  );
}
