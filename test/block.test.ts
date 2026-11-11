import { describe, expect, it } from "vitest";
import { nextTrip } from "../src/itinerary";
import { linkPath, parseBlock } from "../src/tabs";

describe("travel-planner block options", () => {
	it("keeps working for blocks inside the trip note", () => {
		expect(parseBlock("confirmed")).toEqual({ tabs: ["confirmed"], trip: undefined, full: false });
		expect(parseBlock("")).toEqual({ tabs: ["confirmed", "ideas", "outfits", "past"], trip: undefined, full: false });
	});

	it("reads another trip, the full layout and tabs, one per line", () => {
		expect(parseBlock("trip: [[No Doubt in Las Vegas]]\nfull")).toEqual({
			tabs: ["confirmed", "ideas", "outfits", "past"],
			trip: "[[No Doubt in Las Vegas]]",
			full: true,
		});
		expect(parseBlock("trip: next\nfull\nconfirmed, past")).toEqual({ tabs: ["confirmed", "past"], trip: "next", full: true });
		expect(parseBlock("Trip: Japan 2027\nview: full")).toMatchObject({ trip: "Japan 2027", full: true });
	});

	it("does not read tab names out of a trip's name", () => {
		expect(parseBlock("trip: [[Past and Future]]").tabs).toHaveLength(4);
	});

	it("turns links into paths", () => {
		expect(linkPath("[[No Doubt in Las Vegas|Vegas]]")).toBe("No Doubt in Las Vegas");
		expect(linkPath("Travel/Japan 2027")).toBe("Travel/Japan 2027");
	});
});

describe("the next trip", () => {
	const trips = [
		{ path: "past.md", start: "2026-05-12", end: "2026-05-18" },
		{ path: "later.md", start: "2027-04-10", end: "2027-04-17" },
		{ path: "soon.md", start: "2026-11-22", end: "2026-12-05" },
		{ path: "undated.md" },
	];

	it("picks the one under way, including its last day", () => {
		expect(nextTrip(trips, "2026-11-30")).toBe("soon.md");
		expect(nextTrip(trips, "2026-12-05")).toBe("soon.md");
	});

	it("otherwise the next to start", () => {
		expect(nextTrip(trips, "2026-11-11")).toBe("soon.md");
		expect(nextTrip(trips, "2026-12-06")).toBe("later.md");
	});

	it("finds nothing once every trip is over", () => {
		expect(nextTrip(trips, "2027-05-01")).toBeNull();
	});
});
