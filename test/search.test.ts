import { describe, expect, it } from "vitest";
import { tripDays } from "../src/itinerary";
import { matchNotes, NoteMatch } from "../src/search";

const note = (name: string, folder = "Places"): NoteMatch => ({ path: `${folder}/${name}.md`, name, kind: "place", category: "sight", folder });
const notes = [
	note("Sam's Town Mystic Falls Park"),
	note("Tsukiji Outer Market"),
	note("Market Street Café"),
	note("Supermarket"),
	note("Café de Flore", "Paris"),
	note("JFK to RNO", "Events"),
];
const names = (q: string) => matchNotes(q, notes).map(n => n.name);

describe("finding existing notes while typing a name", () => {
	it("waits for two characters", () => {
		expect(names("t")).toEqual([]);
		expect(names("ts")).toEqual(["Tsukiji Outer Market"]);
	});

	it("ranks name starts, then word starts, then anywhere", () => {
		expect(names("market")).toEqual(["Market Street Café", "Tsukiji Outer Market", "Supermarket"]);
	});

	it("matches every word in any order, ignoring case, accents and punctuation", () => {
		expect(names("falls sams")).toEqual(["Sam's Town Mystic Falls Park"]);
		expect(names("cafe flore")).toEqual(["Café de Flore"]);
		expect(names("JFK RNO")).toEqual(["JFK to RNO"]);
	});

	it("finds nothing for unrelated text", () => {
		expect(names("pizza")).toEqual([]);
	});

	it("limits the list", () => {
		const many = Array.from({ length: 20 }, (_, i) => note(`Museum ${i}`));
		expect(matchNotes("museum", many)).toHaveLength(8);
	});
});

describe("trip days for the day list", () => {
	it("lists every day of the trip, across month ends", () => {
		expect(tripDays("2026-05-30", "2026-06-02")).toEqual(["2026-05-30", "2026-05-31", "2026-06-01", "2026-06-02"]);
	});

	it("handles one-day, missing and reversed dates, and caps long ranges", () => {
		expect(tripDays("2026-05-12", undefined)).toEqual(["2026-05-12"]);
		expect(tripDays(undefined, "2026-05-12")).toEqual([]);
		expect(tripDays("2026-05-12", "2026-05-01")).toEqual(["2026-05-12"]);
		expect(tripDays("2026-01-01", "2027-01-01")).toHaveLength(60);
	});
});
