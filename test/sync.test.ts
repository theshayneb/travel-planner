// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { App, TFile } from "obsidian";
import { DEFAULT_SETTINGS, mergeSettings, patchSettings } from "../src/settings-model";
import { extract, write } from "../src/storage";
import { TripVault } from "../src/vault";

describe("saving settings with Obsidian Sync", () => {
	it("changes only the edited setting on top of what is on disk", () => {
		// The desktop already synced newer values; this (stale) device only changed the maps app.
		const onDisk = { tripTag: "trip", weatherUnit: "celsius", props: { date: "When", location: "Where" } };
		expect(patchSettings(onDisk, { mapsProvider: "apple" })).toEqual({ ...onDisk, mapsProvider: "apple" });
	});

	it("changes one property name without resending the others", () => {
		const onDisk = { props: { date: "When", location: "Where" } };
		expect(patchSettings(onDisk, { props: { location: "City" } })).toEqual({ props: { date: "When", location: "City" } });
	});

	it("works with no data.json yet, and keeps keys it doesn't know", () => {
		expect(patchSettings(null, { showWeather: false })).toEqual({ showWeather: false });
		expect(patchSettings({ futureSetting: 1 }, { outfitTag: "look" })).toEqual({ futureSetting: 1, outfitTag: "look" });
		expect(mergeSettings(patchSettings(null, { showWeather: false })).tripTag).toBe(DEFAULT_SETTINGS.tripTag);
	});
});

describe("a linked note renamed, seen by several devices", () => {
	const visit = (path: string) => ({ id: "v1", source: "note" as const, kind: "place" as const, category: "food", name: "Lotus", path, date: "2026-11-22" });
	const tripNote = (path: string) => write("---\ntags: [travel]\n---\n# Trip\n", { version: 1, items: [visit(path)] });

	let disk: string;
	let cache: string;
	let writes: number;
	let attempts: number;
	let app: App;
	const trip = { path: "Trips/Vegas.md", extension: "md", basename: "Vegas" } as unknown as TFile;
	const renamed = { path: "Places/Lotus of Siam.md", extension: "md", basename: "Lotus of Siam" } as unknown as TFile;

	beforeEach(() => {
		vi.useFakeTimers();
		disk = cache = tripNote("Places/Lotus.md");
		writes = 0;
		attempts = 0;
		app = {
			vault: {
				getMarkdownFiles: () => [trip],
				getFileByPath: (p: string) => (p === renamed.path ? renamed : null),
				read: async () => disk,
				cachedRead: async () => cache,
				process: async (_f: TFile, fn: (s: string) => string) => {
					attempts++;
					const next = fn(disk);
					if (next !== disk) writes++;
					disk = next;
					return next;
				},
			},
			metadataCache: { getFileCache: () => ({ frontmatter: { tags: ["travel"] } }) },
		} as unknown as App;
	});
	afterEach(() => vi.useRealTimers());

	const rename = (vault: TripVault) => {
		const done = vault.onRename(renamed, "Places/Lotus.md");
		void vi.advanceTimersByTimeAsync(5000);
		return done;
	};

	it("updates the trip once the wait is over", async () => {
		await rename(new TripVault(app, () => DEFAULT_SETTINGS));
		expect(writes).toBe(1);
		expect(extract(disk).items[0].path).toBe("Places/Lotus of Siam.md");
	});

	it("waits before touching the trip", async () => {
		const done = new TripVault(app, () => DEFAULT_SETTINGS).onRename(renamed, "Places/Lotus.md");
		await vi.advanceTimersByTimeAsync(4000);
		expect(writes).toBe(0);
		await vi.advanceTimersByTimeAsync(1000);
		await done;
		expect(writes).toBe(1);
	});

	it("leaves the trip alone when another device's update arrives while waiting", async () => {
		const done = new TripVault(app, () => DEFAULT_SETTINGS).onRename(renamed, "Places/Lotus.md");
		disk = tripNote("Places/Lotus of Siam.md"); // synced from the desktop during the wait
		await vi.advanceTimersByTimeAsync(5000);
		await done;
		expect(attempts).toBe(0);
	});

	it("reads the trip from disk, not a stale cache", async () => {
		disk = tripNote("Places/Lotus of Siam.md");
		cache = tripNote("Places/Lotus.md");
		await rename(new TripVault(app, () => DEFAULT_SETTINGS));
		expect(attempts).toBe(0);
	});

	it("does nothing the second time, so devices don't repeat the edit", async () => {
		const vault = new TripVault(app, () => DEFAULT_SETTINGS);
		await rename(vault);
		await rename(vault);
		expect(writes).toBe(1);
		expect(attempts).toBe(1);
	});

	it("skips a note deleted while waiting", async () => {
		app.vault.getFileByPath = () => null;
		await rename(new TripVault(app, () => DEFAULT_SETTINGS));
		expect(writes).toBe(0);
	});
});
