import { describe, expect, it } from "vitest";
import { collectOutfits, datesOf, DEFAULT_EXTRAS, isOutfitNote, NoteInfo, parseExtras } from "../src/outfits";
import { forecastUrl, geocodeUrl, parseForecast, parseLocation, pickPlace, weatherIcon } from "../src/weather";

const cfg = { outfitTag: "outfit", datesProp: "Dates", typeProp: "Sub_Type", extras: parseExtras(DEFAULT_EXTRAS) };
const note = (name: string, fm: Record<string, unknown>): NoteInfo => ({ path: `Wardrobe/${name}.md`, name, fm });
const days = new Set(["2026-11-22", "2026-11-26", "2026-11-28"]);

describe("outfits under each day", () => {
	it("reads the configured extras", () => {
		expect(parseExtras("make-up | lipstick | 💄\nlocket | 💎\n\nbad line")).toEqual([
			{ tag: "make-up", type: "lipstick", icon: "💄" },
			{ tag: "locket", icon: "💎" },
		]);
	});

	it("finds dates in links to daily notes, plain dates and lists", () => {
		expect(datesOf(["[[2026-11-22]]", "[[Journal/2026-11-26|Thu]]", "2026-11-28", "[[Not a day]]"])).toEqual(["2026-11-22", "2026-11-26", "2026-11-28"]);
		expect(datesOf(undefined)).toEqual([]);
	});

	it("puts outfits and their extras on the days their Dates link to", () => {
		const notes = [
			note("Travel day", { tags: ["outfit"], Dates: ["[[2026-11-22]]"] }),
			note("Thanksgiving", { tags: ["outfit"], Dates: ["[[2026-11-26]]"] }),
			note("Evening", { tags: ["outfit"], Dates: ["[[2026-11-26]]"] }),
			note("Red lip", { tags: ["make-up"], Sub_Type: ["lipstick"], Dates: ["[[2026-11-26]]"] }),
			note("Gold shadow", { tags: ["make-up"], Sub_Type: "eyeshadow", Dates: ["[[2026-11-26]]"] }),
			note("Heart locket", { tags: ["locket"], Dates: ["[[2026-11-26]]", "[[2026-11-22]]"] }),
			note("Old outfit", { tags: ["outfit"], Dates: ["[[2025-01-01]]"] }),
			note("Cardigan", { tags: ["w_item"], Sub_Type: "top", Dates: ["[[2026-11-26]]"] }),
		];
		const byDay = collectOutfits(notes, days, cfg);
		expect(byDay.get("2026-11-26")?.outfits.map(o => o.name)).toEqual(["Evening", "Thanksgiving"]);
		expect(byDay.get("2026-11-26")?.extras.map(o => o.icon)).toEqual(["🖌️", "💄", "💎"]);
		expect(byDay.get("2026-11-22")?.outfits.map(o => o.name)).toEqual(["Travel day"]);
		expect(byDay.get("2026-11-22")?.extras.map(o => o.name)).toEqual(["Heart locket"]);
		expect(byDay.has("2026-11-28")).toBe(false);
	});

	it("only looks at outfit and accessory notes", () => {
		expect(isOutfitNote({ tags: ["make-up"] }, cfg)).toBe(true);
		expect(isOutfitNote({ tags: ["place", "food"] }, cfg)).toBe(false);
	});
});

describe("weather for the trip's Location", () => {
	it("reads coordinates or a place with qualifiers", () => {
		expect(parseLocation("39.5296, -119.8138")).toEqual({ coords: [39.5296, -119.8138] });
		expect(parseLocation("Reno, NV")).toEqual({ name: "Reno", hints: ["NV"] });
		expect(parseLocation(["[[Las Vegas]]"])).toEqual({ name: "Las Vegas", hints: [] });
		expect(parseLocation("")).toBeNull();
		expect(parseLocation(undefined)).toBeNull();
	});

	it("picks the place matching the state or country", () => {
		const json = { results: [
			{ name: "Reno", latitude: 33.67, longitude: -95.53, admin1: "Texas", country: "United States", country_code: "US" },
			{ name: "Reno", latitude: 39.53, longitude: -119.81, admin1: "Nevada", country: "United States", country_code: "US" },
			{ name: "Reno", latitude: 45.86, longitude: 8.83, admin1: "Lombardy", country: "Italy", country_code: "IT" },
		] };
		expect(pickPlace(json, ["NV"])).toEqual([39.53, -119.81]);
		expect(pickPlace(json, ["Italy"])).toEqual([45.86, 8.83]);
		expect(pickPlace(json, [])).toEqual([33.67, -95.53]);
		expect(pickPlace({}, [])).toBeNull();
	});

	it("asks for daily highs, lows and rain in the chosen unit, local to the place", () => {
		const url = forecastUrl(39.53, -119.81, "fahrenheit");
		expect(url).toContain("temperature_unit=fahrenheit");
		expect(url).toContain("timezone=auto");
		expect(url).toContain("precipitation_probability_max");
		expect(geocodeUrl("Reno")).toContain("name=Reno");
	});

	it("parses the forecast by local date, skipping days without data", () => {
		const days = parseForecast({ daily: {
			time: ["2026-11-22", "2026-11-23", "2026-11-24"],
			weather_code: [0, 61, 3],
			temperature_2m_max: [48.4, 44.6, null],
			temperature_2m_min: [26.6, 30.1, null],
			precipitation_probability_max: [0, 70, null],
		} });
		expect(days).toEqual({
			"2026-11-22": { code: 0, hi: 48, lo: 27, rain: 0 },
			"2026-11-23": { code: 61, hi: 45, lo: 30, rain: 70 },
		});
		expect(parseForecast(null)).toEqual({});
	});

	it("maps weather codes to icons", () => {
		expect(weatherIcon(0).icon).toBe("sun");
		expect(weatherIcon(63)).toEqual({ icon: "cloud-rain", label: "Rain" });
		expect(weatherIcon(1234).icon).toBe("thermometer");
	});
});
