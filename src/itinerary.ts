/** Turns stored entries and linked notes into what the tabs show. Pure: no Obsidian imports. */
import { categoryOf, DisplayItem, TravelItem } from "./model";

export type Bucket = "confirmed" | "ideas" | "past";

/** Local calendar date (YYYY-MM-DD). Never UTC: an evening in Las Vegas is still "today". */
export function localDate(now: Date): string {
	const p = (n: number) => String(n).padStart(2, "0");
	return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Undated → Ideas; before today → Past; today (all day) and later → Confirmed. */
export function bucketOf(date: string | undefined, today: string): Bucket {
	if (!date) return "ideas";
	return date.slice(0, 10) < today ? "past" : "confirmed";
}

/**
 * One list for the Trip:
 * - inline entries as they are;
 * - visits to notes, with the note's permanent details and the visit's own date/time;
 * - linked legacy notes, unless a visit already refers to the same file (no duplicate cards).
 */
export function mergeItems(stored: TravelItem[], legacy: DisplayItem[], noteDetails: (path: string) => DisplayItem | null): DisplayItem[] {
	const out: DisplayItem[] = [];
	const visited = new Set<string>();
	for (const item of stored) {
		if (item.source === "note" && item.path) {
			visited.add(item.path);
			const note = noteDetails(item.path);
			const visit: DisplayItem = {
				...(note ?? {}),
				...pickVisit(item),
				name: note?.name ?? item.name,
				kind: note?.kind ?? item.kind,
				category: note?.category ?? item.category,
				// The visit decides when; the note only supplies permanent details.
				date: item.date,
				time: item.time,
				endDate: item.endDate,
				endTime: item.endTime ?? (note && item.date === note.date ? note.endTime : undefined),
				origin: "visit",
				missing: note ? undefined : true,
			};
			out.push(visit);
		} else {
			out.push({ ...item, origin: "inline" });
		}
	}
	for (const note of legacy) if (!note.path || !visited.has(note.path)) out.push(note);
	return out;
}

function pickVisit(item: TravelItem): TravelItem {
	const visit: TravelItem = { id: item.id, source: "note", kind: item.kind, category: item.category, name: item.name, path: item.path };
	for (const key of ["date", "time", "endDate", "endTime", "confirmation", "tickets", "reservation"] as const) {
		if (item[key]) visit[key] = item[key];
	}
	// Visit notes are added to the note's own notes rather than replacing them.
	if (item.notes) visit.visitNotes = item.notes;
	return visit;
}

export interface DayGroup {
	date: string;
	timed: DisplayItem[];
	untimed: DisplayItem[];
}

/** Groups dated entries by day, earliest first; timed entries by time, untimed ones in their saved order. */
export function groupByDay(items: DisplayItem[]): DayGroup[] {
	const days = new Map<string, DayGroup>();
	for (const item of items) {
		if (!item.date) continue;
		const day = days.get(item.date) ?? { date: item.date, timed: [], untimed: [] };
		days.set(item.date, day);
		(item.time ? day.timed : day.untimed).push(item);
	}
	const groups = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
	for (const g of groups) g.timed.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
	return groups;
}

export interface IdeaGroup {
	label: string;
	items: DisplayItem[];
}

/** Ideas grouped by category label, alphabetically, entries by name. */
export function groupIdeas(items: DisplayItem[]): IdeaGroup[] {
	const groups = new Map<string, DisplayItem[]>();
	for (const item of items) {
		const label = categoryOf(item.category, item.kind).label;
		groups.set(label, [...(groups.get(label) ?? []), item]);
	}
	return [...groups.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([label, list]) => ({ label, items: list.sort((a, b) => a.name.localeCompare(b.name)) }));
}

/** Every calendar day of the trip (YYYY-MM-DD), for the add form's day list. At most `limit` days. */
export function tripDays(start: string | undefined, end: string | undefined, limit = 60): string[] {
	const iso = /^\d{4}-\d{2}-\d{2}$/;
	if (!start || !iso.test(start)) return [];
	const last = end && iso.test(end) && end >= start ? end : start;
	const [y, m, d] = start.split("-").map(Number);
	const cursor = new Date(y, m - 1, d);
	const out: string[] = [];
	while (out.length < limit) {
		const day = localDate(cursor);
		if (day > last) break;
		out.push(day);
		cursor.setDate(cursor.getDate() + 1);
	}
	return out;
}

export interface TripDates {
	path: string;
	start?: string;
	end?: string;
}

/**
 * The trip happening now (earliest start among those under way), else the next one to start; null when every trip is
 * over or undated.
 */
export function nextTrip(trips: TripDates[], today: string): string | null {
	const dated = trips.filter((t): t is TripDates & { start: string } => !!t.start);
	const current = dated.filter(t => t.start <= today && (t.end ?? t.start) >= today);
	const upcoming = dated.filter(t => t.start > today);
	const pick = (list: (TripDates & { start: string })[]) => list.sort((a, b) => a.start.localeCompare(b.start))[0]?.path ?? null;
	return pick(current) ?? pick(upcoming);
}
