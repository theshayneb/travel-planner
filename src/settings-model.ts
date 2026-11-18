import { DEFAULT_EXTRAS } from "./outfits";
import { TempUnit } from "./weather";

/** Plugin settings (stored by Obsidian in the plugin's data.json, which Obsidian Sync carries with vault configuration). */

export type MapsProvider = "google" | "apple" | "geo";

export interface PropertyNames {
	date: string;
	endDate: string;
	projects: string;
	address: string;
	coords: string;
	website: string;
	phone: string;
	notes: string;
	image: string;
	rating: string;
	menu: string;
	hours: string;
	/** Trip: where it is, for the weather (a city or "lat, lng"). */
	location: string;
	/** Outfits and extras: the daily notes they are for. */
	dates: string;
	/** Make-up notes: eyeshadow, eyeliner, lipstick… */
	subType: string;
}

export interface PlannerSettings {
	tripTag: string;
	tripExcludeTags: string;
	placeTag: string;
	eventTag: string;
	excludeTags: string;
	excludeFolders: string;
	props: PropertyNames;
	mapsProvider: MapsProvider;
	newNoteFolder: string;
	newNoteTemplate: string;
	outfitsEmbed: string;
	showOutfitsTab: boolean;
	/** Show the "Look up" button (OpenStreetMap) in the add form. */
	lookupEnabled: boolean;
	/** Outfit card under each day of the itinerary. */
	outfitsUnderDays: boolean;
	outfitTag: string;
	/** "tag | type | icon" lines for the small icons under an outfit. */
	outfitExtras: string;
	showWeather: boolean;
	weatherUnit: TempUnit;
}

export const DEFAULT_SETTINGS: PlannerSettings = {
	tripTag: "travel",
	tripExcludeTags: "event",
	placeTag: "place",
	eventTag: "event",
	excludeTags: "journal_entry",
	excludeFolders: "Templates",
	props: {
		date: "Date",
		endDate: "End_Date",
		projects: "Projects",
		address: "Address",
		coords: "Geolink",
		website: "Link",
		phone: "Phone",
		notes: "Notes",
		image: "Image",
		rating: "Rating",
		menu: "Menu",
		hours: "Hours",
		location: "Location",
		dates: "Dates",
		subType: "Sub_Type",
	},
	mapsProvider: "google",
	newNoteFolder: "",
	newNoteTemplate: "",
	outfitsEmbed: "![[Embeds.base#TripOutfits|no-toolbar]]",
	showOutfitsTab: true,
	lookupEnabled: true,
	outfitsUnderDays: true,
	outfitTag: "outfit",
	outfitExtras: DEFAULT_EXTRAS,
	showWeather: true,
	weatherUnit: "fahrenheit",
};

/** Merges saved settings over the defaults, keeping nested property names complete after upgrades. */
export function mergeSettings(saved: unknown): PlannerSettings {
	const s = (typeof saved === "object" && saved !== null ? saved : {}) as Partial<PlannerSettings>;
	return { ...DEFAULT_SETTINGS, ...s, props: { ...DEFAULT_SETTINGS.props, ...(s.props ?? {}) } };
}

/** A change to some settings; property names can be changed one at a time. */
export type SettingsPatch = Partial<Omit<PlannerSettings, "props">> & { props?: Partial<PropertyNames> };

/**
 * The data.json to save after a change: the copy on disk now (which Obsidian Sync may have updated from another
 * device) with only the changed settings replaced. Settings this device didn't change are never written from memory,
 * so a phone or tablet with an old copy doesn't send stale values back.
 */
export function patchSettings(onDisk: unknown, patch: SettingsPatch): Record<string, unknown> {
	const disk = typeof onDisk === "object" && onDisk !== null && !Array.isArray(onDisk) ? (onDisk as Record<string, unknown>) : {};
	const { props, ...rest } = patch;
	const next: Record<string, unknown> = { ...disk, ...rest };
	if (props) {
		const diskProps = typeof disk.props === "object" && disk.props !== null ? (disk.props as Record<string, unknown>) : {};
		next.props = { ...diskProps, ...props };
	}
	return next;
}
