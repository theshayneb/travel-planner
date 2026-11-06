import { describe, expect, it } from "vitest";
import { categoryOf } from "../src/model";
import { firstLinkTarget, isTrip, itemFromNote, noteKind, parseCoords, splitDateTime, yamlTags } from "../src/notes";
import { mapsUrl } from "../src/maps";
import { DEFAULT_SETTINGS, mergeSettings } from "../src/settings-model";
import { parseTabs } from "../src/tabs";

const s = DEFAULT_SETTINGS;

describe("recognising notes", () => {
	it("finds trips by YAML tag, but not travel events such as flights", () => {
		expect(isTrip({ tags: ["travel", "vacation"] }, s)).toBe(true);
		expect(isTrip({ tags: ["event", "travel"] }, s)).toBe(false);
		expect(isTrip({ tags: "#travel, domestic" }, s)).toBe(true);
		expect(isTrip({}, s)).toBe(false);
	});

	it("classifies by tags, not by date", () => {
		expect(noteKind({ tags: ["place", "sight"], Date: "2026-05-16T20:00:00" }, s)).toBe("place");
		expect(noteKind({ tags: ["event", "travel"] }, s)).toBe("event");
		expect(noteKind({ tags: ["event", "journal_entry"] }, s)).toBeNull();
		expect(noteKind({ tags: ["outfit"] }, s)).toBeNull();
	});

	it("normalises tags", () => {
		expect(yamlTags({ tags: ["#Travel", " Place "] })).toEqual(["travel", "place"]);
	});
});

describe("reading an existing Place note", () => {
	const fm = {
		Date: "2026-05-16T20:00:00",
		Link: "https://samstownlv.boydgaming.com/things-to-do/mystic-falls-park",
		Image: ["[[Sam's Town Mystic Falls Park.png]]"],
		tags: ["event", "sight"],
		Projects: ["[[No Doubt in Las Vegas]]"],
		Notes: "📅Monday - Thursday: 6pm, 8pm, 10pm\r\n📅Friday - Sunday: 4pm, 6pm, 8pm, 10pm",
		Geolink: "36.112942652519465, -115.06228204571323",
		Rating: "🩷",
	};

	it("maps the vault's own property names", () => {
		const item = itemFromNote("Places/Sam's Town.md", "Sam's Town", fm, "event", s);
		expect(item).toMatchObject({
			origin: "legacy", name: "Sam's Town", kind: "event", category: "sight", date: "2026-05-16", time: "20:00",
			website: fm.Link, coords: fm.Geolink, rating: "🩷",
		});
		expect(item.notes).toBe("📅Monday - Thursday: 6pm, 8pm, 10pm\n📅Friday - Sunday: 4pm, 6pm, 8pm, 10pm");
	});

	it("picks the tag that names a category, whatever its position", () => {
		expect(itemFromNote("a.md", "A", { tags: ["place", "friends_family", "food"] }, "place", s).category).toBe("food");
		expect(itemFromNote("f.md", "F", { tags: ["event", "travel", "accomodations"] }, "event", s).category).toBe("accomodations");
		expect(itemFromNote("b.md", "B", { tags: ["event", "broadway"] }, "event", s).category).toBe("broadway");
	});

	it("reads the flight's end time from End_Date", () => {
		const item = itemFromNote("f.md", "TPA to LGA", { Date: "2026-05-12T08:30:00", End_Date: "2026-05-12T10:45:00", tags: ["event", "travel"] }, "event", s);
		expect(item).toMatchObject({ date: "2026-05-12", time: "08:30", endTime: "10:45", endDate: undefined, category: "event" });
	});

	it("follows renamed properties from settings", () => {
		const custom = mergeSettings({ props: { date: "When" } });
		expect(custom.props.endDate).toBe("End_Date");
		expect(itemFromNote("p.md", "P", { When: "2026-01-02" }, "place", custom).date).toBe("2026-01-02");
	});
});

describe("helpers", () => {
	it("splits dates and times", () => {
		expect(splitDateTime("2026-05-16")).toEqual({ date: "2026-05-16", time: undefined });
		expect(splitDateTime("2026-05-16 9:05")).toEqual({ date: "2026-05-16", time: "09:05" });
		expect(splitDateTime("someday")).toEqual({});
	});

	it("reads link targets and coordinates", () => {
		expect(firstLinkTarget(["[[photo.png|300]]"])).toBe("photo.png");
		expect(firstLinkTarget("![[a b.jpg]]")).toBe("a b.jpg");
		expect(parseCoords("36.1, -115.0")).toEqual([36.1, -115]);
		expect(parseCoords("not here")).toBeNull();
		expect(parseCoords("200, 10")).toBeNull();
	});

	it("builds map links for each provider", () => {
		const place = { name: "Sam's Town", address: "5111 Boulder Hwy", coords: "36.11, -115.06" };
		expect(mapsUrl(place, "google")).toBe("https://www.google.com/maps/search/?api=1&query=36.11,-115.06");
		expect(mapsUrl({ ...place, coords: undefined }, "google")).toContain("query=5111%20Boulder%20Hwy");
		expect(mapsUrl(place, "apple")).toContain("ll=36.11,-115.06");
		expect(mapsUrl(place, "geo")).toMatch(/^geo:36.11,-115.06/);
	});

	it("uses the vault's own travel tags as categories", () => {
		for (const tag of ["food", "sight", "museum", "outdoors", "activity", "tour", "shopping", "accomodations"]) {
			expect(categoryOf(tag).id).toBe(tag);
		}
		expect(categoryOf("Museum")).toMatchObject({ id: "museum", family: "sight" });
		expect(categoryOf("activity").family).toBe("event");
	});

	it("files flights and hotels under accomodations, and old names under the vault's tags", () => {
		for (const name of ["flight", "hotel", "accommodations", "transport"]) expect(categoryOf(name).id).toBe("accomodations");
		expect(categoryOf("restaurant").id).toBe("food");
		expect(categoryOf("shop").id).toBe("shopping");
	});

	it("keeps free-text categories from existing notes", () => {
		expect(categoryOf("broadway", "event")).toMatchObject({ label: "Broadway", family: "event" });
	});

	it("parses planner block contents", () => {
		expect(parseTabs("")).toEqual(["confirmed", "ideas", "outfits", "past"]);
		expect(parseTabs("confirmed")).toEqual(["confirmed"]);
		expect(parseTabs("view: past")).toEqual(["past"]);
		expect(parseTabs("confirmed, ideas, outfits, past")).toHaveLength(4);
	});
});
