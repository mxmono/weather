import { isoDateUTC } from "../lib/dates";
import type { CalendarDayTone } from "../lib/tempMatch";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type CalendarCellInfo = {
  tone: CalendarDayTone;
  tMin: number;
  tMax: number;
};

type Props = {
  year: number;
  /** Dates (YYYY-MM-DD) that satisfy the temperature filter. */
  matchDates: Set<string>;
  /** Dates we have archive data for (subset of year is ok). */
  dataDates: Set<string>;
  /** When true, color by temperature vs bands (see cellInfo). When false, only "in range" is highlighted. */
  detailColors: boolean;
  /** Per-date min/max and tone; used when detailColors is true. */
  cellInfo: Map<string, CalendarCellInfo>;
};

function toneClass(tone: CalendarDayTone): string {
  switch (tone) {
    case "match":
      return "day-cell--match";
    case "lowCold":
      return "day-cell--tone-low-cold";
    case "highHot":
      return "day-cell--tone-high-hot";
    case "bothExtreme":
      return "day-cell--tone-both-extreme";
    case "other":
      return "day-cell--tone-other";
    default:
      return "";
  }
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function toneLabel(tone: CalendarDayTone): string {
  switch (tone) {
    case "match":
      return "in range";
    case "lowCold":
      return "daily low below band";
    case "highHot":
      return "daily high above band";
    case "bothExtreme":
      return "low below band & high above band";
    case "other":
      return "other mismatch";
    default:
      return "";
  }
}

function fmtTemps(tMin: number, tMax: number): string {
  return `Min ${tMin.toFixed(1)}°C, Max ${tMax.toFixed(1)}°C`;
}

function cellTitle(
  key: string,
  has: boolean,
  match: boolean,
  detailColors: boolean,
  info: CalendarCellInfo | undefined
): string {
  if (!has) {
    return `${key} — no archive data`;
  }
  if (!info) {
    return match
      ? `${key} — in range (temperatures unavailable)`
      : `${key} — not in range (temperatures unavailable)`;
  }
  const temps = fmtTemps(info.tMin, info.tMax);
  if (detailColors) {
    return `${key} — ${toneLabel(info.tone)} — ${temps}`;
  }
  return match ? `${key} — in range — ${temps}` : `${key} — not in range — ${temps}`;
}

function MonthBlock({
  year,
  monthIndex,
  matchDates,
  dataDates,
  detailColors,
  cellInfo,
}: {
  year: number;
  monthIndex: number;
  matchDates: Set<string>;
  dataDates: Set<string>;
  detailColors: boolean;
  cellInfo: Map<string, CalendarCellInfo>;
}) {
  const firstDow = new Date(year, monthIndex, 1).getDay();
  const dim = daysInMonth(year, monthIndex);
  const label = new Date(year, monthIndex, 1).toLocaleString(undefined, {
    month: "long",
  });

  const cells: { day: number | null }[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null });
  for (let d = 1; d <= dim; d++) cells.push({ day: d });
  while (cells.length % 7 !== 0) cells.push({ day: null });
  while (cells.length < 42) cells.push({ day: null });

  return (
    <div className="month-block">
      <div className="month-title">{label}</div>
      <div className="month-weekdays">
        {WEEKDAYS.map((w) => (
          <span key={w} className="weekday">
            {w}
          </span>
        ))}
      </div>
      <div className="month-grid">
        {cells.map((c, i) => {
          if (c.day == null) {
            return <div key={`e-${i}`} className="day-cell day-cell--empty" />;
          }
          const key = isoDateUTC(year, monthIndex, c.day);
          const has = dataDates.has(key);
          const match = matchDates.has(key);
          const info = cellInfo.get(key);

          let cls = "day-cell";
          const title = cellTitle(key, has, match, detailColors, info);

          if (!has) {
            cls += " day-cell--nodata";
          } else if (detailColors && info) {
            cls += " " + toneClass(info.tone);
          } else if (detailColors) {
            cls += " day-cell--tone-other";
          } else if (match) {
            cls += " day-cell--match";
          }

          return (
            <div key={key} className={cls} title={title}>
              {c.day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function YearCalendar({ year, matchDates, dataDates, detailColors, cellInfo }: Props) {
  return (
    <div className="year-calendar">
      {Array.from({ length: 12 }, (_, m) => (
        <MonthBlock
          key={m}
          year={year}
          monthIndex={m}
          matchDates={matchDates}
          dataDates={dataDates}
          detailColors={detailColors}
          cellInfo={cellInfo}
        />
      ))}
    </div>
  );
}
