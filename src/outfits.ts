/**
 * Outfits for each trip day, found the way the vault's outfit strip finds them: outfit notes (and make-up, lockets,
 * watch bands, manicures) whose `Dates` property links to that day's daily note. Pure.
 */
import { yamlTags } from "./notes";

export interface OutfitExtra {
	tag: string;
	/** Only notes whose type property (e.g. Sub_Type) includes this. */
	type?: string;
	icon: string;
}

export interface OutfitConfig {
	outfitTag: string;
	datesProp: string;
	typeProp: string;
	extras: OutfitExtra[];
}

/** One line per extra: "tag | type | icon" or "tag | icon". Blank and malformed lines are skipped. */
export function parseExtras(text: string): OutfitExtra[] {
	const out: OutfitExtra[] = [];
	for (const line of text.split(/\r?\n/)) {
		const parts = line.split("|").map(p => p.trim());
		if (parts.length === 2 && parts[0] && parts[1]) out.push({ tag: parts[0].replace(/^#/, "").toLowerCase(), icon: parts[1] });
		else if (parts.length === 3 && parts[0] && parts[2]) {
			out.push({ tag: parts[0].replace(/^#/, "").toLowerCase(), type: parts[1].toLowerCase() || undefined, icon: parts[2] });
		}
	}
	return out;
}

export const DEFAULT_EXTRAS = [
	"make-up | eyeshadow | 🖌️",
	"make-up | eyeliner | 🖌️",
	"make-up | lipstick | 💄",
	"make-up | 🎨",
	"locket | 💎",
	"w_item | watch band | ⌚",
	"manicure | 💅",
].join("\n");

/** Every date a property points at (links to daily notes, plain dates or lists of either), as YYYY-MM-DD. */
export function datesOf(value: unknown): string[] {
	if (value === undefined || value === null || value === "") return [];
	if (Array.isArray(value)) return value.flatMap(datesOf);
	if (typeof value !== "string") return [];
	const target = value.replace(/^\s*!?\[\[|\]\]\s*$/g, "").split("|")[0].split("#")[0];
	const base = target.split("/").pop() ?? target;
	const m = /(\d{4}-\d{2}-\d{2})/.exec(base);
	return m ? [m[1]] : [];
}

export interface NoteInfo {
	path: string;
	name: string;
	fm: Record<string, unknown>;
	image?: string;
}

export interface OutfitRef {
	path: string;
	name: string;
	image?: string;
	icon?: string;
}

export interface DayOutfits {
	outfits: OutfitRef[];
	extras: OutfitRef[];
}

/** Notes worth looking at: tagged as an outfit or one of the extras. */
export function isOutfitNote(fm: Record<string, unknown> | undefined, cfg: OutfitConfig): boolean {
	const tags = yamlTags(fm);
	return tags.includes(cfg.outfitTag.toLowerCase()) || cfg.extras.some(e => tags.includes(e.tag));
}

/** Outfits and extras per day, limited to `days`. Extras keep the configured order. */
export function collectOutfits(notes: NoteInfo[], days: Set<string>, cfg: OutfitConfig): Map<string, DayOutfits> {
	const byDay = new Map<string, DayOutfits>();
	const order = new Map<OutfitRef, number>();
	const slot = (d: string) => {
		let s = byDay.get(d);
		if (!s) byDay.set(d, (s = { outfits: [], extras: [] }));
		return s;
	};
	for (const note of notes) {
		const on = datesOf(note.fm[cfg.datesProp]).filter(d => days.has(d));
		if (!on.length) continue;
		const tags = yamlTags(note.fm);
		const ref: OutfitRef = { path: note.path, name: note.name, image: note.image };
		if (tags.includes(cfg.outfitTag.toLowerCase())) {
			for (const d of new Set(on)) slot(d).outfits.push(ref);
			continue;
		}
		const raw = note.fm[cfg.typeProp];
		const types = (Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw]).map(t => String(t).toLowerCase().trim());
		const index = cfg.extras.findIndex(e => tags.includes(e.tag) && (!e.type || types.includes(e.type)));
		if (index < 0) continue;
		const extra = { ...ref, icon: cfg.extras[index].icon };
		order.set(extra, index);
		for (const d of new Set(on)) slot(d).extras.push(extra);
	}
	for (const s of byDay.values()) {
		s.outfits.sort((a, b) => a.name.localeCompare(b.name));
		s.extras.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
	}
	return byDay;
}
