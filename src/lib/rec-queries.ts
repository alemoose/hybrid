import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { recSamples } from "./db/schema";
import {
  anyBuildingOpen,
  countLinks,
  findFeedKey,
  groupByFacility,
  parseCounts,
  recClock,
  type RecArea,
  type Sample,
} from "./rec";
import { getSetting, setSetting } from "./settings";

// Connect2Concepts' public JSON feed: the same data the rec center's own
// "Live Facility Counts" widget shows.
const FEED = process.env.REC_FEED_BASE ?? "https://goboardapi.azurewebsites.net";
/** Where UREC embeds the widget. The key is found there once, then saved. */
export const DEFAULT_REC_PAGE = "https://urec.sl.ua.edu/about/hours-of-operation/";
const RETRY_AFTER = 6 * 3_600_000;

/** Our own errors read fine; network ones ("fetch failed", timeouts) get a plain fallback. */
function friendly(e: unknown, fallback: string): string {
  return e instanceof Error && /answered|empty/.test(e.message) ? e.message : fallback;
}

type RecSource = { key: string | null; page: string; checkedAt: number };

export const getRecSource = () => getSetting<RecSource | null>("recSource", null);

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (Hybrid personal gym log)" },
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
  return res.text();
}

/** Looks for the widget key on a page, then on up to three same-site pages it links to about counts. */
export async function discoverKey(page: string): Promise<string | null> {
  const direct = findFeedKey(page);
  if (direct) return direct;
  const html = await fetchText(page);
  const key = findFeedKey(html);
  if (key) return key;
  for (const link of countLinks(html, page).slice(0, 3)) {
    const found = findFeedKey(await fetchText(link).catch(() => ""));
    if (found) return found;
  }
  return null;
}

export async function saveRecSource(input: string): Promise<RecSource> {
  const page = input.trim() || DEFAULT_REC_PAGE;
  const key = await discoverKey(page);
  const source = { key, page, checkedAt: Date.now() };
  await setSetting("recSource", source);
  return source;
}

export type RecNow =
  | { status: "ok"; groups: { facility: string; areas: RecArea[] }[] }
  | { status: "no-key"; page: string }
  | { status: "error"; message: string };

/**
 * Live counts, finding the feed key on first use. Every update seen is saved for usual-times.
 * `fresh` skips the two-minute fetch cache, for the scheduled sampler.
 */
export async function getRecNow({ fresh = false } = {}): Promise<RecNow> {
  let source = await getRecSource();
  if (!source?.key && (!source || Date.now() - source.checkedAt > RETRY_AFTER)) {
    try {
      source = await saveRecSource(source?.page ?? DEFAULT_REC_PAGE);
    } catch (e) {
      const page = source?.page ?? DEFAULT_REC_PAGE;
      await setSetting("recSource", { key: null, page, checkedAt: Date.now() } satisfies RecSource);
      return { status: "error", message: friendly(e, "Couldn't reach the rec center's site.") };
    }
  }
  if (!source?.key) return { status: "no-key", page: source?.page ?? DEFAULT_REC_PAGE };

  let areas: RecArea[];
  try {
    const res = await fetch(`${FEED}/api/FacilityCount/GetCountsByAccount?AccountAPIKey=${source.key}`, {
      signal: AbortSignal.timeout(8000),
      ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: 120 } }),
    });
    if (!res.ok) throw new Error(`The counts feed answered ${res.status}.`);
    areas = parseCounts(await res.json());
  } catch (e) {
    return { status: "error", message: friendly(e, "Couldn't load the counts.") };
  }
  if (areas.length === 0) return { status: "error", message: "The counts feed came back empty." };

  const counted = areas.filter((a) => a.updated && a.capacity > 0);
  if (counted.length) {
    await db
      .insert(recSamples)
      .values(counted.map((a) => ({ locationId: a.id, location: a.name, count: a.count, capacity: a.capacity, updated: a.updated })))
      .onConflictDoNothing();
  }
  return { status: "ok", groups: groupByFacility(areas) };
}

/** Every count seen for one area, newest first. */
export async function samplesFor(locationId: number): Promise<Sample[]> {
  return db
    .select({ updated: recSamples.updated, count: recSamples.count, capacity: recSamples.capacity })
    .from(recSamples)
    .where(eq(recSamples.locationId, locationId))
    .orderBy(desc(recSamples.updated))
    .limit(5000);
}

const MIN_POLL_GAP = 10 * 60_000;

/**
 * The scheduled sampler: saves the latest counts so usual-times fill in without opening
 * the app. Runs at most every 10 minutes however often it's called, and only while a
 * building is open.
 */
export async function pollRecCounts(now = Date.now()): Promise<{ status: string; areas?: number }> {
  const last = await getLastPoll();
  if (now - last < MIN_POLL_GAP) return { status: "skipped: polled recently" };
  // Record the run even while closed, so "last ran" shows the scheduler is alive.
  await setSetting("recLastPoll", now);
  if (!anyBuildingOpen(recClock(now))) {
    return { status: "skipped: closed" };
  }
  const result = await getRecNow({ fresh: true });
  return result.status === "ok"
    ? { status: "ok", areas: result.groups.reduce((n, g) => n + g.areas.length, 0) }
    : { status: result.status === "error" ? `error: ${result.message}` : "no feed key" };
}

/** When the scheduled sampler last ran, open or closed (0 if never). */
export const getLastPoll = () => getSetting<number>("recLastPoll", 0);
