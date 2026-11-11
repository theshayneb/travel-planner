/** Planner tabs, in the order of the Trip note's existing Meta Bind tabs. Pure. */
export type TabId = "confirmed" | "ideas" | "outfits" | "past";
export const ALL_TABS: TabId[] = ["confirmed", "ideas", "outfits", "past"];

/** `travel-planner` block contents: the tabs to show, e.g. "confirmed" or "confirmed, ideas, outfits, past". */
export function parseTabs(source: string): TabId[] {
	const words = source.toLowerCase().replace(/^\s*(view|tabs?)\s*:/m, "").split(/[\s,]+/).filter(Boolean);
	const tabs = words.filter((w): w is TabId => (ALL_TABS as string[]).includes(w));
	return tabs.length ? [...new Set(tabs)] : [...ALL_TABS];
}

export interface BlockOptions {
	tabs: TabId[];
	/** Which trip: a link or name (`[[No Doubt in Las Vegas]]`), `next`, or undefined for the note the block is in. */
	trip?: string;
	/** The full-screen layout: trip title, dates and an "Open trip note" button above the tabs. */
	full: boolean;
}

/**
 * `travel-planner` block contents, one setting per line:
 *
 *     trip: [[No Doubt in Las Vegas]]   (or "trip: next"; leave out for the note the block is in)
 *     full                              (show the trip's title and dates, like the full-screen view)
 *     confirmed, ideas, past            (the tabs; leave out for all of them)
 */
export function parseBlock(source: string): BlockOptions {
	let trip: string | undefined;
	let full = false;
	const rest: string[] = [];
	for (const raw of source.split(/\r?\n/)) {
		const line = raw.trim();
		const m = /^trip\s*:\s*(.+)$/i.exec(line);
		if (m) {
			trip = m[1].trim() || undefined;
			continue;
		}
		const words = line.toLowerCase().replace(/^(view|tabs?)\s*:/, "").split(/[\s,]+/).filter(Boolean);
		if (words.includes("full")) full = true;
		rest.push(words.filter(w => w !== "full").join(" "));
	}
	return { tabs: parseTabs(rest.join("\n")), trip, full };
}

/** "[[Trip|alias]]", "[[Trip]]" or "Trip" → "Trip" (the link path to resolve). */
export function linkPath(text: string): string {
	return text.trim().replace(/^!?\[\[/, "").replace(/\]\]$/, "").split("|")[0].split("#")[0].trim();
}
