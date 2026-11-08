/**
 * Daily weather for a trip's `Location` from Open-Meteo (free, no key). Pure: URLs and parsing only; the requests and
 * the cache live in weather-service.ts.
 */
import { parseCoords } from "./notes";

export type TempUnit = "fahrenheit" | "celsius";

export interface DayWeather {
	code: number;
	hi: number;
	lo: number;
	/** Highest chance of rain that day, in %, when known. */
	rain: number | null;
}

/** A `Location` value: coordinates ("39.53, -119.81") or a place name with optional qualifiers ("Reno, NV"). */
export type Place = { coords: [number, number] } | { name: string; hints: string[] };

export function parseLocation(value: unknown): Place | null {
	const text: unknown = Array.isArray(value) ? value[0] : value;
	if (typeof text !== "string" || !text.trim()) return null;
	const clean = text.replace(/^\[\[|\]\]$/g, "").split("|")[0].trim();
	const coords = parseCoords(clean);
	if (coords) return { coords };
	const [name, ...hints] = clean.split(",").map(p => p.trim()).filter(Boolean);
	return name ? { name, hints } : null;
}

export function geocodeUrl(name: string): string {
	return `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name, count: "10", language: "en", format: "json" }).toString()}`;
}

/** US state abbreviations, so "Reno, NV" picks Reno, Nevada rather than another Reno. */
const STATES: Record<string, string> = {
	AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
	DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
	IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
	MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
	NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
	NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
	RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
	VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

/** The best geocoding match: the first whose region or country matches every qualifier, else the first. */
export function pickPlace(json: unknown, hints: string[]): [number, number] | null {
	const results = (json as { results?: unknown } | null)?.results;
	if (!Array.isArray(results)) return null;
	const places = results.filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null && Number.isFinite(Number((r as Record<string, unknown>).latitude)));
	if (!places.length) return null;
	const wanted = hints.map(h => (STATES[h.toUpperCase()] ?? h).toLowerCase());
	const fits = (r: Record<string, unknown>) => {
		const fields = [r.admin1, r.admin2, r.country, r.country_code].map(v => (typeof v === "string" ? v.toLowerCase() : ""));
		return wanted.every(w => fields.some(f => f === w || (w.length > 3 && f.includes(w))));
	};
	const best = places.find(fits) ?? places[0];
	return [Number(best.latitude), Number(best.longitude)];
}

export function forecastUrl(lat: number, lon: number, unit: TempUnit): string {
	const params = new URLSearchParams({
		latitude: lat.toFixed(4),
		longitude: lon.toFixed(4),
		daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
		temperature_unit: unit,
		timezone: "auto",
		past_days: "92",
		forecast_days: "16",
	});
	return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

/** Open-Meteo daily arrays → weather by local date (YYYY-MM-DD). */
export function parseForecast(json: unknown): Record<string, DayWeather> {
	const daily = (json as { daily?: Record<string, unknown> } | null)?.daily;
	const out: Record<string, DayWeather> = {};
	if (!daily || !Array.isArray(daily.time)) return out;
	const col = (k: string): unknown[] => (Array.isArray(daily[k]) ? (daily[k] as unknown[]) : []);
	const codes = col("weather_code");
	const his = col("temperature_2m_max");
	const los = col("temperature_2m_min");
	const rains = col("precipitation_probability_max");
	(daily.time as unknown[]).forEach((t, i) => {
		const hi = Number(his[i]);
		const lo = Number(los[i]);
		if (typeof t !== "string" || his[i] === null || los[i] === null || !Number.isFinite(hi) || !Number.isFinite(lo)) return;
		const rain = rains[i] === null || rains[i] === undefined ? null : Number(rains[i]);
		out[t] = { code: Number(codes[i] ?? -1), hi: Math.round(hi), lo: Math.round(lo), rain: Number.isFinite(rain) ? rain : null };
	});
	return out;
}

const CODES: [number[], string, string][] = [
	[[0], "sun", "Clear"],
	[[1], "sun", "Mostly clear"],
	[[2], "cloud-sun", "Partly cloudy"],
	[[3], "cloud", "Cloudy"],
	[[45, 48], "cloud-fog", "Fog"],
	[[51, 53, 55, 56, 57], "cloud-drizzle", "Drizzle"],
	[[61, 63, 65, 66, 67, 80, 81, 82], "cloud-rain", "Rain"],
	[[71, 73, 75, 77, 85, 86], "cloud-snow", "Snow"],
	[[95, 96, 99], "cloud-lightning", "Thunderstorms"],
];

/** Lucide icon name and a description for a WMO weather code. */
export function weatherIcon(code: number): { icon: string; label: string } {
	const found = CODES.find(([codes]) => codes.includes(code));
	return found ? { icon: found[1], label: found[2] } : { icon: "thermometer", label: "Weather" };
}
