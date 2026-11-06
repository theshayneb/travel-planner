/** Planner tabs, in the order of the Trip note's existing Meta Bind tabs. Pure. */
export type TabId = "confirmed" | "ideas" | "outfits" | "past";
export const ALL_TABS: TabId[] = ["confirmed", "ideas", "outfits", "past"];

/** `travel-planner` block contents: the tabs to show, e.g. "confirmed" or "confirmed, ideas, outfits, past". */
export function parseTabs(source: string): TabId[] {
	const words = source.toLowerCase().replace(/^\s*(view|tabs?)\s*:/m, "").split(/[\s,]+/).filter(Boolean);
	const tabs = words.filter((w): w is TabId => (ALL_TABS as string[]).includes(w));
	return tabs.length ? [...new Set(tabs)] : [...ALL_TABS];
}
