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
	},
	mapsProvider: "google",
	newNoteFolder: "",
	newNoteTemplate: "",
	outfitsEmbed: "![[Embeds.base#TripOutfits|no-toolbar]]",
	showOutfitsTab: true,
	lookupEnabled: true,
};

/** Merges saved settings over the defaults, keeping nested property names complete after upgrades. */
export function mergeSettings(saved: unknown): PlannerSettings {
	const s = (typeof saved === "object" && saved !== null ? saved : {}) as Partial<PlannerSettings>;
	return { ...DEFAULT_SETTINGS, ...s, props: { ...DEFAULT_SETTINGS.props, ...(s.props ?? {}) } };
}
