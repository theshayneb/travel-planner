/** Data model shared by storage, the vault scanner and the views. No Obsidian imports: unit-tested in Node. */

export type Kind = "place" | "event";

/** Extra form fields a category can ask for, beyond the common ones every entry has. */
export type ExtraField =
	| "menu"
	| "cuisine"
	| "reservation"
	| "hours"
	| "tickets"
	| "price"
	| "confirmation"
	| "carrier"
	| "endTime"
	| "endDate";

/** Visual family: decides the card colour and how prominent the card is in a day. */
export type Family = "food" | "sight" | "event" | "stay" | "shop" | "other";

export interface CategoryDef {
	id: string;
	label: string;
	kind: Kind;
	family: Family;
	icon: string;
	fields: ExtraField[];
}

/**
 * Categories, named after the vault's own YAML tags (food, sight, museum, activity, tour, outdoors, shopping,
 * accomodations, which covers hotels and flights). A note converted from a quick entry is tagged with the category's id.
 */
export const CATEGORIES: CategoryDef[] = [
	{ id: "food", label: "Food", kind: "place", family: "food", icon: "utensils", fields: ["menu", "cuisine", "reservation", "hours"] },
	{ id: "sight", label: "Sight", kind: "place", family: "sight", icon: "camera", fields: ["hours", "price", "tickets"] },
	{ id: "museum", label: "Museum", kind: "place", family: "sight", icon: "landmark", fields: ["hours", "price", "tickets"] },
	{ id: "outdoors", label: "Outdoors", kind: "place", family: "sight", icon: "mountain", fields: ["hours", "price"] },
	{ id: "activity", label: "Activity", kind: "place", family: "event", icon: "party-popper", fields: ["endTime", "hours", "price", "tickets", "confirmation"] },
	{ id: "tour", label: "Tour", kind: "place", family: "event", icon: "flag", fields: ["endTime", "price", "tickets", "confirmation"] },
	{ id: "shopping", label: "Shopping", kind: "place", family: "shop", icon: "shopping-bag", fields: ["hours"] },
	// Hotels and flights alike (the vault tags both "accomodations").
	{ id: "accomodations", label: "Accommodations", kind: "place", family: "stay", icon: "luggage", fields: ["endDate", "endTime", "carrier", "confirmation"] },
	{ id: "show", label: "Show", kind: "event", family: "event", icon: "ticket", fields: ["endTime", "tickets", "confirmation"] },
	{ id: "event", label: "Event", kind: "event", family: "event", icon: "calendar", fields: ["endTime", "tickets", "confirmation"] },
	{ id: "place", label: "Other place", kind: "place", family: "other", icon: "map-pin", fields: ["hours"] },
];

/** Other names for the same categories (common spellings and the categories of earlier versions). */
const ALIASES: Record<string, string> = {
	restaurant: "food", bar: "food", cafe: "food", "café": "food", dining: "food", drinks: "food",
	attraction: "activity", activities: "activity",
	park: "outdoors", hike: "outdoors", hiking: "outdoors", beach: "outdoors",
	shop: "shopping",
	hotel: "accomodations", flight: "accomodations", flights: "accomodations", transport: "accomodations", train: "accomodations", accommodations: "accomodations", accommodation: "accomodations", lodging: "accomodations", stay: "accomodations",
	tours: "tour", museums: "museum", sights: "sight",
};

const BY_ID = new Map(CATEGORIES.map(c => [c.id, c]));

/** True when a tag names one of the categories (directly or through an alias). */
export function isCategory(tag: string): boolean {
	const key = tag.trim().toLowerCase();
	return BY_ID.has(key) || key in ALIASES;
}

/** Look up a category, tolerating free-text categories from existing notes (e.g. "sight", "Museum", "broadway"). */
export function categoryOf(id: string | undefined, kind: Kind = "place"): CategoryDef {
	const key = (id ?? "").trim().toLowerCase();
	const found = BY_ID.get(ALIASES[key] ?? key);
	if (found) return found;
	const fallback = BY_ID.get(kind === "event" ? "event" : "place");
	if (!fallback) throw new Error("Category table is missing its fallbacks.");
	if (!key) return fallback;
	// Unknown free-text category: keep its own label, borrow the look of the kind's generic category.
	return { ...fallback, id: key, label: key.charAt(0).toUpperCase() + key.slice(1).replace(/[_-]/g, " ") };
}

/**
 * One itinerary record stored in a Trip note.
 * - source "inline": the entry is the place/event itself (no separate note).
 * - source "note": a scheduled visit to an existing standalone note (`path`); its permanent details come from that note.
 * Unknown keys are preserved on write so newer versions of the plugin never lose data written by older ones and vice versa.
 */
export interface TravelItem {
	id: string;
	source: "inline" | "note";
	kind: Kind;
	category: string;
	name: string;
	date?: string; // YYYY-MM-DD, local calendar date
	time?: string; // HH:mm
	endDate?: string;
	endTime?: string;
	address?: string;
	coords?: string; // "lat, lng"
	website?: string;
	menu?: string;
	cuisine?: string;
	reservation?: string;
	hours?: string;
	tickets?: string;
	price?: string;
	confirmation?: string;
	carrier?: string;
	notes?: string;
	path?: string; // vault path, for source "note"
	[extra: string]: unknown;
}

export interface TravelData {
	version: 1;
	items: TravelItem[];
}

/** An entry ready to display: an inline item, a scheduled visit to a note, or a legacy note found through its links. */
export interface DisplayItem extends TravelItem {
	/** "legacy": a Place/Event note linked to the Trip (Projects or any other link) with no itinerary record. */
	origin: "inline" | "visit" | "legacy";
	imageSrc?: string;
	rating?: string;
	/** Notes written on a visit (the linked note keeps its own `notes`). */
	visitNotes?: string;
	/** A visit whose note was deleted or cannot be resolved. */
	missing?: boolean;
}

export const STRING_FIELDS = [
	"category", "date", "time", "endDate", "endTime", "address", "coords", "website", "menu", "cuisine", "reservation",
	"hours", "tickets", "price", "confirmation", "carrier", "notes", "path",
] as const;

export function newId(now: number = Date.now(), rand: () => number = Math.random): string {
	return `item-${now.toString(36)}-${Math.floor(rand() * 36 ** 6).toString(36).padStart(6, "0")}`;
}
