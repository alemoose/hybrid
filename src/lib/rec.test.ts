import { describe, expect, it } from "vitest";
import { buildingHours, busyLevel, countLinks, findFeedKey, groupByFacility, hourlyPattern, parseCounts, parseFeedTime, quietestHours, recClock } from "./rec";

const KEY = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

const feed = [
  { LocationId: 1, FacilityName: "Student Recreation Center", LocationName: "SRC Cardio", LastCount: 17, TotalCapacity: 80, IsClosed: false, LastUpdatedDateAndTime: "2026-10-27T10:52:44.413" },
  { LocationId: 2, FacilityName: "Student Recreation Center", LocationName: "SRC Weight Room", LastCount: 47, TotalCapacity: 134, IsClosed: false, LastUpdatedDateAndTime: "2026-10-27T10:52:44.413" },
  { LocationId: 3, FacilityName: "Aquatic Center", LocationName: "Lap Pool", LastCount: 3, TotalCapacity: 0, IsClosed: true, LastUpdatedDateAndTime: "2026-10-27T10:52:44.413" },
  { LocationName: "" },
  null,
];

describe("parseCounts", () => {
  it("reads areas and works out percentages", () => {
    const areas = parseCounts(feed);
    expect(areas).toHaveLength(3);
    expect(areas[1]).toMatchObject({ name: "SRC Weight Room", count: 47, pct: 35, closed: false });
    expect(areas[2]).toMatchObject({ pct: null, closed: true });
    expect(parseCounts({ error: "nope" })).toEqual([]);
  });

  it("puts the weight room and main gym first", () => {
    const groups = groupByFacility(parseCounts(feed));
    expect(groups.map((g) => g.facility)).toEqual(["Student Recreation Center", "Aquatic Center"]);
    expect(groups[0].areas[0].name).toBe("SRC Weight Room");
  });

  it("labels busyness", () => {
    expect([busyLevel(10), busyLevel(35), busyLevel(60), busyLevel(null)]).toEqual(["quiet", "moderate", "busy", null]);
  });
});

describe("parseFeedTime", () => {
  it("handles ISO and US formats", () => {
    expect(parseFeedTime("2026-10-27T10:52:44.413")).toEqual({ key: "2026-10-27", hour: 10, minute: 52, weekday: 2 });
    expect(parseFeedTime("10/26/2026 10:27 PM")).toEqual({ key: "2026-10-26", hour: 22, minute: 27, weekday: 1 });
    expect(parseFeedTime("10/26/2026 12:05 AM")?.hour).toBe(0);
    expect(parseFeedTime("whenever")).toBeNull();
  });
});

describe("findFeedKey", () => {
  it("finds the key in a widget iframe, a link, or on its own", () => {
    expect(findFeedKey(`<iframe src="https://www.connect2mycloud.com/Widgets/Data/locationCount?type=bar&amp;key=${KEY.toUpperCase()}&facility=1">`)).toBe(KEY);
    expect(findFeedKey(`https://goboardapi.azurewebsites.net/api/FacilityCount/GetCountsByAccount?AccountAPIKey=${KEY}`)).toBe(KEY);
    expect(findFeedKey(` ${KEY} `)).toBe(KEY);
    expect(findFeedKey("https://urec.sl.ua.edu/about/hours-of-operation/")).toBeNull();
  });

  it("follows same-site links about counts", () => {
    const html = `<a href="/live-counts/">Live Facility Counts</a> <a href="/about/">About</a> <a href="https://elsewhere.com/count">x</a>`;
    expect(countLinks(html, "https://urec.sl.ua.edu/about/hours-of-operation/")).toEqual(["https://urec.sl.ua.edu/live-counts/"]);
  });
});

describe("usual busyness", () => {
  const sample = (updated: string, count: number) => ({ updated, count, capacity: 100 });
  // 2026-10-26 is a Monday, 2026-10-25 a Sunday.
  const samples = [
    sample("2026-10-26T06:10:00", 10),
    sample("2026-10-26T07:10:00", 14),
    sample("2026-10-27T06:40:00", 20),
    sample("2026-10-26T17:00:00", 80),
    sample("2026-10-25T17:00:00", 30),
  ];

  it("averages by hour, keeping weekends separate", () => {
    const weekday = hourlyPattern(samples, false);
    expect(weekday[6]).toBe(15);
    expect(weekday[17]).toBe(80);
    expect(weekday[12]).toBeNull();
    expect(hourlyPattern(samples, true)[17]).toBe(30);
  });

  it("finds the quietest stretch with data", () => {
    expect(quietestHours(hourlyPattern(samples, false))).toEqual({ from: 6, to: 8, pct: 15 });
    expect(quietestHours(Array(24).fill(null))).toBeNull();
  });
});

describe("building hours", () => {
  it("knows the SRC and Witt schedules", () => {
    // Monday 3:19 PM
    expect(buildingHours("Student Recreation Center", { weekday: 1, minutes: 15 * 60 + 19 })).toEqual({
      name: "SRC",
      today: "5:30 AM – 11 PM",
      status: "Open until 11 PM",
      open: true,
    });
    // Saturday 4:30 PM: Witt closes at 5
    expect(buildingHours("Witt Student Activity Center", { weekday: 6, minutes: 16 * 60 + 30 })?.status).toBe("Closes soon · 5 PM");
    // Saturday 8 AM: SRC opens at 9
    expect(buildingHours("Student Recreation Center", { weekday: 6, minutes: 8 * 60 })).toMatchObject({ status: "Opens at 9 AM", open: false });
    // Friday 9 PM: SRC closed, opens Saturday at 9
    expect(buildingHours("Student Recreation Center", { weekday: 5, minutes: 21 * 60 })?.status).toBe("Closed · opens 9 AM tomorrow");
    expect(buildingHours("Aquatic Center", { weekday: 1, minutes: 600 })).toBeNull();
  });

  it("reads the clock in Tuscaloosa time", () => {
    // 2026-10-27 21:19 UTC is 4:19 PM CDT on a Tuesday.
    expect(recClock(Date.UTC(2026, 9, 27, 21, 19))).toEqual({ weekday: 2, minutes: 16 * 60 + 19 });
  });
});
