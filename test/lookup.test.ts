import { describe, expect, it } from "vitest";
import { applyPlan, fillPlan, formatHours, lookupUrl, parseResults } from "../src/lookup";
import { categoryOf, TravelItem } from "../src/model";

// Shape of Nominatim's format=jsonv2 with addressdetails, extratags and namedetails.
const SAMPLE = [
	{
		place_id: 1, lat: "36.1149291", lon: "-115.1406212", category: "amenity", type: "restaurant",
		name: "Lotus of Siam", display_name: "Lotus of Siam, 620, East Flamingo Road, Paradise, Clark County, Nevada, 89119, United States",
		address: { house_number: "620", road: "East Flamingo Road", town: "Paradise", state: "Nevada", postcode: "89119", country: "United States" },
		extratags: { cuisine: "thai;asian", opening_hours: "Mo-Th 11:00-22:00; Fr,Sa 11:00-23:00; Su off", website: "https://www.lotusofsiamlv.com", phone: "+1 702-735-3033" },
		namedetails: { name: "Lotus of Siam" },
	},
	{
		place_id: 2, lat: "40.7", lon: "-74.0", category: "amenity", type: "restaurant", name: "",
		display_name: "Lotus of Siam, New York, United States", address: {}, extratags: null, namedetails: {},
	},
];

const draft = (over: Partial<TravelItem> = {}): TravelItem => ({ id: "a", source: "inline", kind: "place", category: "food", name: "Lotus of Siam", ...over });

describe("looking up a place", () => {
	it("asks for the name plus any typed address, with the details needed", () => {
		const url = lookupUrl("Lotus of Siam", "Las Vegas");
		expect(url).toContain("q=Lotus+of+Siam%2C+Las+Vegas");
		expect(url).toMatch(/extratags=1/);
		expect(url).toMatch(/limit=5/);
	});

	it("reads name, type, address, coordinates, website, phone, hours and cuisine", () => {
		const [r] = parseResults(SAMPLE);
		expect(r).toEqual({
			name: "Lotus of Siam",
			type: "restaurant",
			address: "620 East Flamingo Road, Paradise, Nevada 89119, United States",
			coords: "36.114929, -115.140621",
			website: "https://www.lotusofsiamlv.com",
			phone: "+1 702-735-3033",
			hours: "Mon–Thu 11:00–22:00\nFri,Sat 11:00–23:00\nSun closed",
			cuisine: "thai, asian",
		});
	});

	it("copes with sparse results and unexpected responses", () => {
		const r = parseResults(SAMPLE)[1];
		expect(r.name).toBe("Lotus of Siam");
		expect(r.address).toBe("Lotus of Siam, New York, United States");
		expect(r.website).toBeUndefined();
		expect(parseResults({ error: "nope" })).toEqual([]);
		expect(parseResults(null)).toEqual([]);
	});

	it("formats opening hours", () => {
		expect(formatHours("24/7")).toBe("Open 24 hours");
		expect(formatHours("Mo-Fr 09:00-17:00; PH off")).toBe("Mon–Fri 09:00–17:00\nHolidays closed");
	});
});

describe("confirming a result", () => {
	const [result] = parseResults(SAMPLE);

	it("fills only empty fields, never what was typed", () => {
		const plan = fillPlan(draft({ website: "https://my-own-link" }), result, categoryOf("food").fields);
		expect(plan.map(l => l.key)).toEqual(["address", "coords", "phone", "hours", "cuisine"]);
		const filled = applyPlan(draft({ website: "https://my-own-link" }), plan);
		expect(filled.website).toBe("https://my-own-link");
		expect(filled.phone).toBe("+1 702-735-3033");
	});

	it("only fills fields the category's form has", () => {
		const plan = fillPlan(draft({ category: "accomodations" }), result, categoryOf("accomodations").fields);
		expect(plan.map(l => l.key)).toEqual(["address", "coords", "website", "phone"]);
	});

	it("has nothing to fill when every field is already set", () => {
		const full = draft({ address: "a", coords: "1, 2", website: "w", phone: "p", hours: "h", cuisine: "c" });
		expect(fillPlan(full, result, categoryOf("food").fields)).toEqual([]);
	});
});
