import { describe, expect, it } from "vitest";
import { addItem, extract, removeItem, renamePath, replaceItem, serialize, TravelDataError, update, write } from "../src/storage";
import { TravelData, TravelItem } from "../src/model";

const TRIP = `---
Date: 2026-05-12
End_Date: 2026-05-18
tags:
  - travel
---

> [!div-m|span-6]
> > ~~~meta-bind
> > INPUT[select(option(1, Confirmed), class(tabbed))]
> > ~~~
> ![[Embeds.base#TripOutfits|no-toolbar]]

\`\`\`dataviewjs
const currentFileName = dv.current().file.name;
\`\`\`
`;

const item = (over: Partial<TravelItem> = {}): TravelItem => ({ id: "a", source: "inline", kind: "place", category: "restaurant", name: "Lotus", ...over });
const data = (...items: TravelItem[]): TravelData => ({ version: 1, items });

describe("reading", () => {
	it("treats a note without a data block as empty and does not need to change it", () => {
		expect(extract(TRIP)).toEqual({ version: 1, items: [] });
	});

	it("round-trips entries", () => {
		const text = write(TRIP, data(item({ date: "2026-05-16", time: "18:00" })));
		expect(extract(text).items).toEqual([item({ date: "2026-05-16", time: "18:00" })]);
	});

	it("reads Windows line endings", () => {
		const text = write(TRIP.replace(/\n/g, "\r\n"), data(item()));
		expect(text).not.toMatch(/[^\r]\n/);
		expect(extract(text).items).toHaveLength(1);
	});

	it.each([
		["invalid JSON", "```travel-planner-data\n{ nope\n```"],
		["a wrong version", "```travel-planner-data\n{\"version\":2,\"items\":[]}\n```"],
		["an entry without an ID", "```travel-planner-data\n{\"version\":1,\"items\":[{\"name\":\"x\",\"kind\":\"place\"}]}\n```"],
		["an unknown kind", "```travel-planner-data\n{\"version\":1,\"items\":[{\"id\":\"a\",\"name\":\"x\",\"kind\":\"meal\"}]}\n```"],
		["a non-string field", "```travel-planner-data\n{\"version\":1,\"items\":[{\"id\":\"a\",\"name\":\"x\",\"kind\":\"place\",\"date\":5}]}\n```"],
		["a note visit without a path", "```travel-planner-data\n{\"version\":1,\"items\":[{\"id\":\"a\",\"name\":\"x\",\"kind\":\"place\",\"source\":\"note\"}]}\n```"],
		["duplicate IDs (sync conflict)", "```travel-planner-data\n{\"version\":1,\"items\":[{\"id\":\"a\",\"name\":\"x\",\"kind\":\"place\"},{\"id\":\"a\",\"name\":\"y\",\"kind\":\"place\"}]}\n```"],
		["two blocks (sync conflict)", `${serialize(data(item()))}\n\n${serialize(data(item({ id: "b" })))}`],
		["an unclosed block", "```travel-planner-data\n{\"version\":1,\"items\":[]}\n"],
	])("refuses %s", (_label, block) => {
		const text = `${TRIP}\n${block}\n`;
		expect(() => extract(text)).toThrow(TravelDataError);
		expect(() => write(text, data(item()))).toThrow(/No changes were made/);
	});
});

describe("writing", () => {
	it("appends the block and leaves everything before it byte-for-byte unchanged", () => {
		const text = write(TRIP, data(item()));
		expect(text.startsWith(TRIP)).toBe(true);
		expect(text.endsWith("```\n")).toBe(true);
	});

	it("replaces only the block when one exists, keeping text after it", () => {
		const first = write(TRIP, data(item())) + "\nAfter the block\n";
		const second = write(first, data(item({ name: "Lotus of Siam" })));
		expect(second.startsWith(TRIP)).toBe(true);
		expect(second.endsWith("\nAfter the block\n")).toBe(true);
		expect(extract(second).items[0].name).toBe("Lotus of Siam");
	});

	it("keeps unknown fields written by other versions", () => {
		const text = `${TRIP}\n\`\`\`travel-planner-data\n{"version":1,"order":[1],"items":[{"id":"a","name":"x","kind":"place","future":{"k":1}}]}\n\`\`\`\n`;
		const next = update(text, d => d);
		expect(next).toContain('"future"');
		expect(next).toContain('"order"');
	});

	it("drops empty optional fields", () => {
		expect(serialize(data(item({ address: "", notes: "  " })))).not.toMatch(/address|notes/);
	});
});

describe("entry operations", () => {
	it("adds, replaces and removes by ID", () => {
		let d = addItem(data(), item());
		expect(() => addItem(d, item())).toThrow(TravelDataError);
		d = replaceItem(d, "a", item({ name: "B" }));
		expect(d.items[0].name).toBe("B");
		d = removeItem(d, "a");
		expect(d.items).toEqual([]);
	});

	it("refuses to edit or delete an entry that another device already removed", () => {
		expect(() => replaceItem(data(), "a", item())).toThrow(/another device/);
		expect(() => removeItem(data(), "a")).toThrow(/another device/);
	});

	it("follows a renamed note", () => {
		const d = data(item({ id: "v", source: "note", path: "Places/Old.md" }), item());
		expect(renamePath(d, "Places/Old.md", "Places/New.md")?.items[0].path).toBe("Places/New.md");
		expect(renamePath(d, "Places/Other.md", "x.md")).toBeNull();
	});
});
