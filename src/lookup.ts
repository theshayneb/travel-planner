/**
 * Optional place look-up in OpenStreetMap (Nominatim). Only runs when the person taps "Look up", and nothing is written
 * until they confirm one result. Pure: the network request itself lives in the planner (Obsidian's requestUrl).
 */
import { ExtraField, TravelItem } from "./model";

export const NOMINATIM = "https://nominatim.openstreetmap.org/search";

export interface LookupResult {
	name: string;
	/** What the place is in OpenStreetMap, e.g. "restaurant", "museum". */
	type: string;
	address?: string;
	coords?: string;
	website?: string;
	phone?: string;
	hours?: string;
	cuisine?: string;
}

/** Fields a confirmed result may fill: the common ones plus whichever the category's form shows. */
export type FillKey = "address" | "coords" | "website" | "phone" | "hours" | "cuisine";
export const FILL_LABELS: Record<FillKey, string> = {
	address: "Address",
	coords: "Coordinates",
	website: "Website",
	phone: "Phone",
	hours: "Opening hours",
	cuisine: "Cuisine",
};

export function lookupUrl(name: string, address = "", limit = 5): string {
	const q = [name.trim(), address.trim()].filter(Boolean).join(", ");
	const params = new URLSearchParams({ format: "jsonv2", limit: String(limit), addressdetails: "1", extratags: "1", namedetails: "1", q });
	return `${NOMINATIM}?${params.toString()}`;
}

type Json = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

function formatAddress(a: Json | undefined, fallback: string | undefined): string | undefined {
	if (!a) return fallback;
	const street = [str(a.house_number), str(a.road) ?? str(a.pedestrian) ?? str(a.footway)].filter(Boolean).join(" ");
	const city = str(a.city) ?? str(a.town) ?? str(a.village) ?? str(a.hamlet) ?? str(a.suburb);
	const region = [str(a.state), str(a.postcode)].filter(Boolean).join(" ");
	const parts = [street, city, region, str(a.country)].filter((p): p is string => !!p);
	return parts.length >= 2 ? parts.join(", ") : fallback;
}

/** Turns Nominatim's JSON into results. Unknown shapes give an empty list rather than an error. */
export function parseResults(json: unknown): LookupResult[] {
	if (!Array.isArray(json)) return [];
	const out: LookupResult[] = [];
	for (const raw of json as unknown[]) {
		if (typeof raw !== "object" || raw === null) continue;
		const r = raw as Json;
		const extra = (typeof r.extratags === "object" && r.extratags ? r.extratags : {}) as Json;
		const names = (typeof r.namedetails === "object" && r.namedetails ? r.namedetails : {}) as Json;
		const display = str(r.display_name);
		const lat = Number(r.lat);
		const lon = Number(r.lon);
		const hours = str(extra.opening_hours);
		out.push({
			name: str(r.name) ?? str(names.name) ?? display?.split(",")[0] ?? "Unnamed place",
			type: (str(r.type) ?? str(r.category) ?? "place").replace(/_/g, " "),
			address: formatAddress(r.address as Json | undefined, display),
			coords: Number.isFinite(lat) && Number.isFinite(lon) ? `${lat.toFixed(6)}, ${lon.toFixed(6)}` : undefined,
			website: str(extra.website) ?? str(extra["contact:website"]) ?? str(extra.url),
			phone: str(extra.phone) ?? str(extra["contact:phone"]),
			hours: hours ? formatHours(hours) : undefined,
			cuisine: str(extra.cuisine)?.split(";").map(c => c.trim().replace(/_/g, " ")).join(", "),
		});
	}
	return out;
}

const DAYS: Record<string, string> = { Mo: "Mon", Tu: "Tue", We: "Wed", Th: "Thu", Fr: "Fri", Sa: "Sat", Su: "Sun", PH: "Holidays" };

/** OpenStreetMap opening_hours made readable: "Mo-Th 17:00-24:00; Fr off" → "Mon–Thu 17:00–24:00\nFri closed". */
export function formatHours(osm: string): string {
	return osm
		.split(";")
		.map(rule => rule.trim())
		.filter(Boolean)
		.map(rule => rule
			.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, d => DAYS[d] ?? d)
			.replace(/(\w)-(\w)/g, "$1–$2")
			.replace(/\boff\b/gi, "closed")
			.replace(/^24\/7$/, "Open 24 hours"))
		.join("\n");
}

export interface FillLine {
	key: FillKey;
	label: string;
	value: string;
}

/**
 * What confirming `result` would fill in: only fields the form shows for this category, and only those still empty.
 * Never overwrites what was typed.
 */
export function fillPlan(draft: TravelItem, result: LookupResult, categoryFields: ExtraField[]): FillLine[] {
	const allowed: FillKey[] = ["address", "coords", "website", "phone"];
	if (categoryFields.includes("hours")) allowed.push("hours");
	if (categoryFields.includes("cuisine")) allowed.push("cuisine");
	const lines: FillLine[] = [];
	for (const key of allowed) {
		const value = result[key];
		const current = draft[key];
		if (!value || (typeof current === "string" && current.trim())) continue;
		lines.push({ key, label: FILL_LABELS[key], value });
	}
	return lines;
}

export function applyPlan(draft: TravelItem, lines: FillLine[]): TravelItem {
	const next: TravelItem = { ...draft };
	for (const line of lines) next[line.key] = line.value;
	return next;
}
