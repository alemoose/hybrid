// Rec center live counts from its Connect2Concepts feed: parsing, busy levels,
// finding the feed key on a web page, and "usually quiet" hours.
// No network, no database. Tested in rec.test.ts.

export type RecArea = {
  id: number;
  facility: string;
  name: string;
  count: number;
  capacity: number;
  /** Share of capacity, 0–100, or null when the feed has no capacity. */
  pct: number | null;
  closed: boolean;
  /** The feed's own timestamp, in the rec center's local time (no zone). */
  updated: string;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

/** The GetCountsByAccount response: one row per area. Anything unexpected is skipped. */
export function parseCounts(json: unknown): RecArea[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((row): RecArea[] => {
    if (!row || typeof row !== "object") return [];
    const r = row as Record<string, unknown>;
    const name = str(r.LocationName);
    if (!name) return [];
    const count = Math.max(0, num(r.LastCount) ?? 0);
    const capacity = Math.max(0, num(r.TotalCapacity) ?? 0);
    return [
      {
        id: num(r.LocationId) ?? 0,
        facility: str(r.FacilityName),
        name,
        count,
        capacity,
        pct: capacity > 0 ? Math.min(100, Math.round((count / capacity) * 100)) : null,
        closed: r.IsClosed === true,
        updated: str(r.LastUpdatedDateAndTime),
      },
    ];
  });
}

/** Weight room first, then the resistance room and cardio; everything else after. */
export function areaRank(name: string): number {
  if (/weight/i.test(name)) return 0;
  if (/resistance|\brtr\b/i.test(name)) return 1;
  if (/cardio/i.test(name)) return 2;
  return 9;
}

/** Areas grouped by facility, the main gym first, each sorted by areaRank. */
export function groupByFacility(areas: RecArea[]): { facility: string; areas: RecArea[] }[] {
  const groups = new Map<string, RecArea[]>();
  for (const a of areas) groups.set(a.facility, [...(groups.get(a.facility) ?? []), a]);
  const best = (list: RecArea[]) => Math.min(...list.map((a) => areaRank(a.name)));
  return [...groups.entries()]
    .map(([facility, list]) => ({ facility, areas: [...list].sort((a, b) => areaRank(a.name) - areaRank(b.name)) }))
    .sort((a, b) => best(a.areas) - best(b.areas) || b.areas.length - a.areas.length);
}

export type Busy = "quiet" | "moderate" | "busy";

export function busyLevel(pct: number | null): Busy | null {
  if (pct == null) return null;
  if (pct < 25) return "quiet";
  if (pct < 50) return "moderate";
  return "busy";
}

/** "2026-10-27T10:52:44.4" or "10/27/2026 10:52 AM" → local wall-clock parts. */
export function parseFeedTime(s: string): { key: string; hour: number; minute: number; weekday: number } | null {
  let y: number, mo: number, d: number, h: number, mi: number;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?/i);
  if (iso) {
    [y, mo, d, h, mi] = iso.slice(1, 6).map(Number);
  } else if (us) {
    [mo, d, y, h, mi] = us.slice(1, 6).map(Number);
    const ampm = us[6]?.toUpperCase();
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
  } else {
    return null;
  }
  const key = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { key, hour: h, minute: mi, weekday: new Date(Date.UTC(y, mo - 1, d)).getUTCDay() };
}

export function formatHour(hour: number, minute?: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? "AM" : "PM";
  return minute == null ? `${h} ${suffix}` : `${h}:${String(minute).padStart(2, "0")} ${suffix}`;
}

const GUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** The feed key from a pasted key, a widget link, or a page's HTML that embeds the widget. */
export function findFeedKey(text: string): string | null {
  const widget = text.match(new RegExp(`connect2mycloud\\.com[^"'\\s<>]*?[?&](?:amp;)?key=(${GUID})`, "i"));
  if (widget) return widget[1].toLowerCase();
  const param = text.match(new RegExp(`(?:AccountAPIKey|[?&](?:amp;)?key)=(${GUID})`, "i"));
  if (param) return param[1].toLowerCase();
  const bare = text.trim().match(new RegExp(`^${GUID}$`, "i"));
  return bare ? bare[0].toLowerCase() : null;
}

/** Same-site links on a page that look like they lead to the live counts. */
export function countLinks(html: string, pageUrl: string): string[] {
  const base = new URL(pageUrl);
  const out = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const [, href, label] = m;
    if (!/count|occupancy|capacity/i.test(`${href} ${label}`)) continue;
    try {
      const url = new URL(href, base);
      if (url.hostname === base.hostname && url.href !== base.href) out.add(url.href);
    } catch {
      // not a usable link
    }
  }
  return [...out];
}

export type Sample = { updated: string; count: number; capacity: number };

/**
 * Average busyness by hour for weekdays (Mon–Fri) or weekends, from the counts
 * seen so far. Hours with no samples are null.
 */
export function hourlyPattern(samples: Sample[], weekend: boolean): (number | null)[] {
  const sums = Array.from({ length: 24 }, () => ({ total: 0, n: 0 }));
  for (const s of samples) {
    const t = parseFeedTime(s.updated);
    if (!t || s.capacity <= 0) continue;
    if ((t.weekday === 0 || t.weekday === 6) !== weekend) continue;
    sums[t.hour].total += Math.min(100, (s.count / s.capacity) * 100);
    sums[t.hour].n += 1;
  }
  return sums.map(({ total, n }) => (n ? Math.round(total / n) : null));
}

/** The quietest stretch of up to `span` hours that has data, e.g. 6–8 AM. */
export function quietestHours(pattern: (number | null)[], span = 2): { from: number; to: number; pct: number } | null {
  let best: { from: number; to: number; pct: number } | null = null;
  for (let start = 0; start < 24; start++) {
    const window = pattern.slice(start, start + span);
    if (window.length < span || window.some((v) => v == null)) continue;
    const avg = (window as number[]).reduce((a, b) => a + b, 0) / span;
    if (!best || avg < best.pct) best = { from: start, to: start + span, pct: Math.round(avg) };
  }
  return best;
}

// ---------- Hours ----------

/** Minutes after midnight, [open, close], Sunday first. From UREC's hours page (regular semester hours). */
type Week = [number, number][];
const h = (hour: number, minute = 0) => hour * 60 + minute;

export const BUILDINGS: { key: "src" | "witt"; name: string; match: RegExp; week: Week }[] = [
  {
    key: "src",
    name: "SRC",
    match: /recreation|\bsrc\b/i,
    week: [
      [h(10), h(22)],
      [h(5, 30), h(23)],
      [h(5, 30), h(23)],
      [h(5, 30), h(23)],
      [h(5, 30), h(23)],
      [h(5, 30), h(20)],
      [h(9), h(19)],
    ],
  },
  {
    key: "witt",
    name: "Witt",
    match: /witt/i,
    week: [
      [h(10), h(22)],
      [h(7), h(23)],
      [h(7), h(23)],
      [h(7), h(23)],
      [h(7), h(23)],
      [h(7), h(20)],
      [h(11), h(17)],
    ],
  },
];

export const REC_TIME_ZONE = "America/Chicago";
export const SCHEDULE_CHANGES_URL = "https://urec.sl.ua.edu/posts/category/schedule-changes/";

/** Weekday (0 = Sunday) and minutes after midnight at the rec center. */
export function recClock(now: number): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: REC_TIME_ZONE, weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { weekday, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

const clockText = (m: number) => formatHour(Math.floor(m / 60) % 24, m % 60 === 0 ? undefined : m % 60);

export type BuildingHours = { name: string; today: string; status: string; open: boolean };

/** Today's hours and whether it's open now, e.g. "Open until 11 PM" or "Opens at 9 AM". */
export function buildingHours(facility: string, clock: { weekday: number; minutes: number }): BuildingHours | null {
  const b = BUILDINGS.find((x) => x.match.test(facility));
  if (!b) return null;
  const [open, close] = b.week[clock.weekday];
  const today = `${clockText(open)} – ${clockText(close)}`;
  if (clock.minutes < open) return { name: b.name, today, status: `Opens at ${clockText(open)}`, open: false };
  if (clock.minutes >= close) {
    const [nextOpen] = b.week[(clock.weekday + 1) % 7];
    return { name: b.name, today, status: `Closed · opens ${clockText(nextOpen)} tomorrow`, open: false };
  }
  return { name: b.name, today, status: close - clock.minutes <= 60 ? `Closes soon · ${clockText(close)}` : `Open until ${clockText(close)}`, open: true };
}
