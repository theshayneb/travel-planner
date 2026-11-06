/** Reads existing Trip / Place / Event notes from their frontmatter. Pure: no Obsidian imports. */
import { DisplayItem, isCategory, Kind } from "./model";
import { PlannerSettings } from "./settings-model";

export type Frontmatter = Record<string, unknown>;

/** YAML `tags` as plain lowercase names: accepts a list, a comma/space separated string, and leading "#". */
export function yamlTags(fm: Frontmatter | undefined): string[] {
	const raw = fm?.tags ?? fm?.tag;
	const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[\s,]+/) : [];
	return list.map(t => String(t).trim().replace(/^#/, "").toLowerCase()).filter(Boolean);
}

export function isTrip(fm: Frontmatter | undefined, s: PlannerSettings): boolean {
	const tags = yamlTags(fm);
	return tags.includes(s.tripTag.toLowerCase()) && !splitList(s.tripExcludeTags).some(t => tags.includes(t));
}

/** "place" / "event" for notes the planner shows, or null. Tags decide the kind, never the date. */
export function noteKind(fm: Frontmatter | undefined, s: PlannerSettings): Kind | null {
	const tags = yamlTags(fm);
	if (splitList(s.excludeTags).some(t => tags.includes(t))) return null;
	if (tags.includes(s.placeTag.toLowerCase())) return "place";
	if (tags.includes(s.eventTag.toLowerCase())) return "event";
	return null;
}

export function splitList(value: string): string[] {
	return value.split(/[\s,]+/).map(v => v.trim().replace(/^#/, "").toLowerCase()).filter(Boolean);
}

/** Splits "2026-05-16T20:00:00", "2026-05-16 20:00" or "2026-05-16" into a calendar date and an optional HH:mm. */
export function splitDateTime(value: unknown): { date?: string; time?: string } {
	if (typeof value !== "string" && !(value instanceof Date)) return {};
	const text = value instanceof Date ? localIso(value) : value.trim();
	const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{1,2}):(\d{2}))?/.exec(text);
	if (!m) return {};
	const time = m[2] !== undefined ? `${m[2].padStart(2, "0")}:${m[3]}` : undefined;
	return { date: m[1], time };
}

function localIso(d: Date): string {
	const p = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function text(value: unknown): string | undefined {
	if (value === undefined || value === null) return undefined;
	if (Array.isArray(value)) {
		const parts = value.map(v => text(v)).filter((v): v is string => !!v);
		return parts.length ? parts.join(", ") : undefined;
	}
	if (typeof value === "string") return value.replace(/\r\n?/g, "\n").trim() || undefined;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return undefined;
}

/** First `[[link]]` target (or plain path) in a property such as `Image: ["[[photo.png]]"]`. */
export function firstLinkTarget(value: unknown): string | undefined {
	const first: unknown = Array.isArray(value) ? value[0] : value;
	if (typeof first !== "string") return undefined;
	const m = /^\s*!?\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]\s*$/.exec(first);
	const target = (m ? m[1] : first).trim();
	return target || undefined;
}

/** "36.11, -115.06" → [36.11, -115.06]; anything else → null. */
export function parseCoords(value: string | undefined): [number, number] | null {
	if (!value) return null;
	const m = /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(value);
	if (!m) return null;
	const lat = Number(m[1]);
	const lng = Number(m[2]);
	if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
	return [lat, lng];
}

/** Tags that describe what the note is (e.g. "sight", "broadway"), without the structural ones. */
export function descriptiveTags(fm: Frontmatter | undefined, s: PlannerSettings): string[] {
	const structural = new Set([s.placeTag, s.eventTag, s.tripTag, "link", "travel"].map(t => t.toLowerCase()));
	return yamlTags(fm).filter(t => !structural.has(t));
}

const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const DATE_IN_PARENS = [
	/^\d{4}-\d{1,2}-\d{1,2}(?:[ T]\d{1,2}:\d{2})?$/, // 2026-05-12
	/^\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?$/, // 5/12/26, 05-12-2026, 5/12
	new RegExp(`^${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?$`, "i"), // May 12, 2026
	new RegExp(`^\\d{1,2}\\s+${MONTH}(?:,?\\s+\\d{4})?$`, "i"), // 12 May 2026
	/^\d{4}$/, // 2026
];

/**
 * Drops a trailing date in parentheses from a note name: "TPA to LGA (2026-05-12)" → "TPA to LGA".
 * The card already shows the date. Anything else in parentheses, e.g. "Route (66)", is kept.
 */
export function displayName(basename: string): string {
	const m = /^(.*\S)\s*\(([^()]*)\)\s*$/.exec(basename);
	if (!m) return basename;
	const inner = m[2].trim();
	return DATE_IN_PARENS.some(re => re.test(inner)) ? m[1] : basename;
}

/** Builds the card for an existing note. Its date/time come from the note's own `Date` unless a visit overrides them. */
export function itemFromNote(path: string, basename: string, fm: Frontmatter, kind: Kind, s: PlannerSettings): DisplayItem {
	const p = s.props;
	const start = splitDateTime(fm[p.date]);
	const end = splitDateTime(fm[p.endDate]);
	const tags = descriptiveTags(fm, s);
	const coords = text(fm[p.coords]);
	return {
		id: `legacy:${path}`,
		origin: "legacy",
		source: "note",
		path,
		kind,
		// The first tag that names a category (e.g. food among friends_family, food), else the first descriptive tag.
		category: tags.find(isCategory) ?? tags[0] ?? kind,
		name: displayName(basename),
		date: start.date,
		time: start.time,
		endDate: end.date && end.date !== start.date ? end.date : undefined,
		endTime: end.time,
		address: text(fm[p.address]),
		coords: parseCoords(coords) ? coords : undefined,
		website: text(fm[p.website]),
		phone: text(fm[p.phone]),
		menu: text(fm[p.menu]),
		hours: text(fm[p.hours]),
		notes: text(fm[p.notes]),
		rating: text(fm[p.rating]),
	};
}
