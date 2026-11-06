/** Finds existing Place/Event notes while a name is typed in the add form. Pure. */
import { Kind } from "./model";

export interface NoteMatch {
	path: string;
	/** Display name (trailing date already removed). */
	name: string;
	kind: Kind;
	category: string;
	/** Folder, shown under the name to tell same-named notes apart. */
	folder: string;
}

function normalize(text: string): string {
	return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’`]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/**
 * Notes whose name contains every word typed, best first: name starts with the query, then a word starts with it,
 * then anywhere. "tsuki" finds "Tsukiji Outer Market"; "falls sam" finds "Sam's Town Mystic Falls Park".
 */
export function matchNotes(query: string, notes: NoteMatch[], limit = 8): NoteMatch[] {
	const q = normalize(query);
	if (q.length < 2) return [];
	const words = q.split(" ");
	const scored: { note: NoteMatch; score: number }[] = [];
	for (const note of notes) {
		const name = normalize(note.name);
		if (!words.every(w => name.includes(w))) continue;
		const score = name === q ? 0 : name.startsWith(q) ? 1 : ` ${name}`.includes(` ${words[0]}`) ? 2 : 3;
		scored.push({ note, score });
	}
	return scored
		.sort((a, b) => a.score - b.score || a.note.name.length - b.note.name.length || a.note.name.localeCompare(b.note.name))
		.slice(0, limit)
		.map(s => s.note);
}
