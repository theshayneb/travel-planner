/**
 * Swaps the Trip note's three itinerary base embeds for planner blocks, keeping each line's callout prefix.
 * The Outfits embed and every other line are left alone. Pure.
 */
import { TabId } from "./tabs";

export const EMBED_TABS: Record<string, TabId> = {
	TripEvents: "confirmed",
	TripIdeas: "ideas",
	TripEventsPast: "past",
};

const EMBED_LINE = /^((?:[ \t]*>)*[ \t]*)!\[\[Embeds\.base#(TripEvents|TripIdeas|TripEventsPast)(?:\|[^\]]*)?\]\][ \t]*$/;

export interface LineChange {
	line: number;
	text: string;
}

/** One change per embed line: the replacement text (three lines) for that line number. */
export function plannerBlockChanges(source: string, blockLang: string): LineChange[] {
	const changes: LineChange[] = [];
	source.split(/\r?\n/).forEach((text, line) => {
		const m = EMBED_LINE.exec(text);
		if (!m) return;
		const prefix = m[1].replace(/[ \t]*$/, m[1].trim() ? " " : "");
		const eol = source.includes("\r\n") ? "\r\n" : "\n";
		changes.push({ line, text: [`${prefix}\`\`\`${blockLang}`, `${prefix}${EMBED_TABS[m[2]]}`, `${prefix}\`\`\``].join(eol) });
	});
	return changes;
}

export function applyLineChanges(source: string, changes: LineChange[]): string {
	const eol = source.includes("\r\n") ? "\r\n" : "\n";
	const lines = source.split(/\r?\n/);
	for (const c of changes) lines[c.line] = c.text;
	return lines.join(eol);
}
