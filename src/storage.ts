/**
 * The plugin-owned section of a Trip note: exactly one fenced block
 *
 *     ```travel-planner-data
 *     { "version": 1, "items": [ ... ] }
 *     ```
 *
 * Everything outside that block is never touched. Damaged, duplicated or unrecognised data is refused, never overwritten.
 * Pure functions, no Obsidian imports.
 */
import { STRING_FIELDS, TravelData, TravelItem } from "./model";

export const DATA_LANG = "travel-planner-data";
const OPEN_RE = new RegExp("^```" + DATA_LANG + "[ \\t]*$", "gm");
const BLOCK_RE = new RegExp("^```" + DATA_LANG + "[ \\t]*\\r?\\n([\\s\\S]*?)\\r?\\n```[ \\t]*$", "gm");

export class TravelDataError extends Error {
	constructor(message: string) {
		super(`${message} No changes were made.`);
		this.name = "TravelDataError";
	}
}

interface Located {
	data: TravelData;
	start: number;
	end: number;
}

function locate(source: string): Located | null {
	const opens = source.match(OPEN_RE)?.length ?? 0;
	if (opens === 0) return null;
	const blocks = [...source.matchAll(BLOCK_RE)];
	if (blocks.length !== opens) throw new TravelDataError("The travel planner data block is not closed.");
	if (blocks.length > 1) throw new TravelDataError("The note has more than one travel planner data block (often a sync conflict).");
	const m = blocks[0];
	return { data: parse(m[1]), start: m.index, end: m.index + m[0].length };
}

export function parse(json: string): TravelData {
	let raw: unknown;
	try {
		raw = JSON.parse(json);
	} catch {
		throw new TravelDataError("The travel planner data is not valid JSON.");
	}
	if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.items)) {
		throw new TravelDataError("Unsupported travel planner data version.");
	}
	const items: TravelItem[] = [];
	for (const value of raw.items as unknown[]) items.push(validateItem(value));
	const ids = new Set(items.map(i => i.id));
	if (ids.size !== items.length) throw new TravelDataError("Duplicate travel planner entry IDs (often a sync conflict).");
	return { ...(raw as object), version: 1, items };
}

function validateItem(value: unknown): TravelItem {
	if (!isRecord(value)) throw new TravelDataError("A travel planner entry is not an object.");
	const { id, name, kind } = value;
	const source = value.source ?? "inline";
	if (typeof id !== "string" || !id) throw new TravelDataError("A travel planner entry has no ID.");
	if (typeof name !== "string") throw new TravelDataError(`Entry ${id} has no name.`);
	if (kind !== "place" && kind !== "event") throw new TravelDataError(`Entry ${id} has an unknown kind.`);
	if (source !== "inline" && source !== "note") throw new TravelDataError(`Entry ${id} has an unknown source.`);
	for (const key of STRING_FIELDS) {
		if (value[key] !== undefined && typeof value[key] !== "string") throw new TravelDataError(`Entry ${id} has a malformed ${key}.`);
	}
	if (source === "note" && !value.path) throw new TravelDataError(`Entry ${id} refers to a note without a path.`);
	const item: TravelItem = { ...value, id, name, kind, source, category: typeof value.category === "string" ? value.category : "" };
	return item;
}

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Reads the Trip's data. A note without a block has no entries (and is not modified just by being read). */
export function extract(source: string): TravelData {
	return locate(source)?.data ?? { version: 1, items: [] };
}

export function serialize(data: TravelData, eol = "\n"): string {
	const items = data.items.map(clean);
	const json = JSON.stringify({ ...data, version: 1, items }, null, 2);
	return ["```" + DATA_LANG, ...json.split("\n"), "```"].join(eol);
}

/** Drops empty optional strings so the stored JSON stays short and readable. */
function clean(item: TravelItem): TravelItem {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(item)) {
		if (v === undefined || v === null) continue;
		if (typeof v === "string" && v.trim() === "" && k !== "name" && k !== "category") continue;
		out[k] = v;
	}
	return out as TravelItem;
}

/**
 * Returns `source` with the data block replaced (or appended at the end of the note).
 * Validates the existing block first: a damaged block throws instead of being overwritten.
 */
export function write(source: string, data: TravelData): string {
	const found = locate(source);
	const eol = source.includes("\r\n") ? "\r\n" : "\n";
	const block = serialize(data, eol);
	if (!found) {
		const sep = source.length === 0 ? "" : source.endsWith(eol + eol) ? "" : source.endsWith(eol) ? eol : eol + eol;
		return source + sep + block + eol;
	}
	return source.slice(0, found.start) + block + source.slice(found.end);
}

/** Applies `change` to the Trip's data and returns the new note text. `change` may throw to abort. */
export function update(source: string, change: (data: TravelData) => TravelData): string {
	const current = extract(source);
	const next = change({ version: 1, items: current.items.map(i => ({ ...i })) });
	return write(source, { ...current, ...next, version: 1 });
}

// ---- Pure item operations (all throw TravelDataError instead of silently doing nothing) ----

export function addItem(data: TravelData, item: TravelItem): TravelData {
	if (data.items.some(i => i.id === item.id)) throw new TravelDataError(`Entry ${item.id} already exists.`);
	return { ...data, items: [...data.items, item] };
}

export function replaceItem(data: TravelData, id: string, item: TravelItem): TravelData {
	const index = data.items.findIndex(i => i.id === id);
	if (index < 0) throw new TravelDataError("That entry no longer exists in the Trip note (it may have been changed on another device).");
	const items = [...data.items];
	items[index] = { ...item, id };
	return { ...data, items };
}

export function removeItem(data: TravelData, id: string): TravelData {
	if (!data.items.some(i => i.id === id)) {
		throw new TravelDataError("That entry no longer exists in the Trip note (it may have been changed on another device).");
	}
	return { ...data, items: data.items.filter(i => i.id !== id) };
}

/** Points scheduled visits at a renamed note. Returns null when nothing referred to `oldPath`. */
export function renamePath(data: TravelData, oldPath: string, newPath: string): TravelData | null {
	let changed = false;
	const items = data.items.map(i => {
		if (i.source !== "note" || i.path !== oldPath) return i;
		changed = true;
		return { ...i, path: newPath };
	});
	return changed ? { ...data, items } : null;
}
