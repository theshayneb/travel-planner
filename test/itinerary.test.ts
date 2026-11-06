import { describe, expect, it } from "vitest";
import { bucketOf, daysBetween, groupByDay, groupIdeas, localDate, mergeItems, upcomingTripDays } from "../src/itinerary";
import { DisplayItem, TravelItem } from "../src/model";

const inline = (over: Partial<TravelItem>): TravelItem => ({ id: over.name ?? "x", source: "inline", kind: "place", category: "restaurant", name: "x", ...over });
const legacy = (over: Partial<DisplayItem>): DisplayItem => ({ id: `legacy:${over.path}`, origin: "legacy", source: "note", kind: "place", category: "sight", name: "n", ...over });

describe("buckets", () => {
	it("keeps today's activities in Confirmed all day and moves earlier ones to Past", () => {
		expect(bucketOf("2026-05-16", "2026-05-16")).toBe("confirmed");
		expect(bucketOf("2026-05-17", "2026-05-16")).toBe("confirmed");
		expect(bucketOf("2026-05-15", "2026-05-16")).toBe("past");
		expect(bucketOf(undefined, "2026-05-16")).toBe("ideas");
	});

	it("uses the local calendar date, not UTC", () => {
		expect(localDate(new Date(2026, 4, 16, 23, 30))).toBe("2026-05-16");
	});
});

describe("merging", () => {
	const sams = legacy({ path: "Places/Sam's Town.md", name: "Sam's Town", date: "2026-05-16", time: "20:00", address: "5111 Boulder Hwy" });

	it("shows inline entries and linked notes together", () => {
		const out = mergeItems([inline({ name: "Lotus" })], [sams], () => null);
		expect(out.map(i => [i.name, i.origin])).toEqual([["Lotus", "inline"], ["Sam's Town", "legacy"]]);
	});

	it("does not show a linked note twice once it has a visit", () => {
		const visit = inline({ id: "v1", source: "note", path: sams.path, date: "2026-05-17", time: "18:00" });
		const out = mergeItems([visit], [sams], () => sams);
		expect(out).toHaveLength(1);
		expect(out[0]).toMatchObject({ id: "v1", origin: "visit", date: "2026-05-17", time: "18:00", address: "5111 Boulder Hwy" });
	});

	it("allows several visits to the same note", () => {
		const v = (id: string, date: string) => inline({ id, source: "note", path: sams.path, date });
		expect(mergeItems([v("a", "2026-05-16"), v("b", "2026-05-18")], [sams], () => sams)).toHaveLength(2);
	});

	it("takes the date from the visit, never from the note", () => {
		const out = mergeItems([inline({ id: "v", source: "note", path: sams.path })], [], () => sams);
		expect(out[0].date).toBeUndefined();
	});

	it("flags visits whose note is gone", () => {
		const out = mergeItems([inline({ id: "v", source: "note", path: "Gone.md", name: "Gone" })], [], () => null);
		expect(out[0]).toMatchObject({ name: "Gone", missing: true });
	});
});

describe("grouping", () => {
	it("orders days, timed entries by time, untimed ones as saved", () => {
		const items = mergeItems([
			inline({ name: "Late", date: "2026-05-16", time: "20:00" }),
			inline({ name: "Untimed B", date: "2026-05-16" }),
			inline({ name: "Early", date: "2026-05-16", time: "08:30" }),
			inline({ name: "Untimed A", date: "2026-05-16" }),
			inline({ name: "Day one", date: "2026-05-12" }),
		], [], () => null);
		const days = groupByDay(items);
		expect(days.map(d => d.date)).toEqual(["2026-05-12", "2026-05-16"]);
		expect(days[1].timed.map(i => i.name)).toEqual(["Early", "Late"]);
		expect(days[1].untimed.map(i => i.name)).toEqual(["Untimed B", "Untimed A"]);
	});

	it("lists empty upcoming trip days so they can be planned", () => {
		expect(upcomingTripDays("2026-05-12", "2026-05-15", "2026-05-14")).toEqual(["2026-05-14", "2026-05-15"]);
		expect(groupByDay([], ["2026-05-14"])).toEqual([{ date: "2026-05-14", timed: [], untimed: [] }]);
	});

	it("crosses month ends and caps long ranges", () => {
		expect(daysBetween("2026-05-30", "2026-06-02")).toEqual(["2026-05-30", "2026-05-31", "2026-06-01", "2026-06-02"]);
		expect(daysBetween("2026-01-01", "2027-01-01")).toHaveLength(60);
		expect(daysBetween(undefined, "2026-01-01")).toEqual([]);
	});

	it("groups ideas by category", () => {
		const groups = groupIdeas(mergeItems([inline({ name: "Zed" }), inline({ name: "Art", category: "museum" }), inline({ name: "Abe" })], [], () => null));
		expect(groups.map(g => [g.label, g.items.map(i => i.name)])).toEqual([["Museum", ["Art"]], ["Restaurant", ["Abe", "Zed"]]]);
	});
});
