/** Everything that touches the vault. Writes only ever go through `vault.process` on the Trip's data block. */
import { App, normalizePath, TFile } from "obsidian";
import { DisplayItem, TravelData, TravelItem } from "./model";
import { Frontmatter, isTrip, itemFromNote, noteKind, splitList, firstLinkTarget } from "./notes";
import { PlannerSettings } from "./settings-model";
import { extract, renamePath, update } from "./storage";

export class TripVault {
	constructor(private readonly app: App, private readonly settings: () => PlannerSettings) {}

	frontmatter(file: TFile): Frontmatter | undefined {
		return this.app.metadataCache.getFileCache(file)?.frontmatter;
	}

	isTrip(file: TFile): boolean {
		return isTrip(this.frontmatter(file), this.settings());
	}

	trips(): TFile[] {
		return this.app.vault.getMarkdownFiles().filter(f => this.isTrip(f));
	}

	private excluded(file: TFile): boolean {
		const folders = splitList(this.settings().excludeFolders);
		const parts = file.path.toLowerCase().split("/").slice(0, -1);
		return folders.some(f => parts.includes(f));
	}

	/** Place/Event notes eligible for itineraries (tagged place or event, outside excluded folders). */
	candidateNotes(): TFile[] {
		const s = this.settings();
		return this.app.vault.getMarkdownFiles().filter(f => !this.excluded(f) && !this.isTrip(f) && noteKind(this.frontmatter(f), s) !== null);
	}

	/** Permanent details of a Place/Event note, or null if it no longer exists. */
	noteDetails(path: string): DisplayItem | null {
		const file = this.app.vault.getFileByPath(path);
		if (!file) return null;
		const fm = this.frontmatter(file) ?? {};
		const s = this.settings();
		const item = itemFromNote(file.path, file.basename, fm, noteKind(fm, s) ?? "place", s);
		item.imageSrc = this.imageSrc(fm[s.props.image], file.path);
		return item;
	}

	/**
	 * Legacy Place/Event notes linked to the Trip, the same way Embeds.base finds them (`file.hasLink(this.file)`):
	 * any resolved link from the note to the Trip, in Projects or anywhere else.
	 */
	linkedNotes(trip: TFile): DisplayItem[] {
		const out: DisplayItem[] = [];
		const resolved = this.app.metadataCache.resolvedLinks;
		const s = this.settings();
		for (const file of this.app.vault.getMarkdownFiles()) {
			if (file.path === trip.path || this.excluded(file)) continue;
			if (!resolved[file.path]?.[trip.path] && !this.frontmatterLinksTo(file, trip)) continue;
			const fm = this.frontmatter(file);
			const kind = noteKind(fm, s);
			if (!fm || !kind) continue;
			const item = itemFromNote(file.path, file.basename, fm, kind, s);
			item.imageSrc = this.imageSrc(fm[s.props.image], file.path);
			out.push(item);
		}
		return out;
	}

	private frontmatterLinksTo(file: TFile, trip: TFile): boolean {
		const links = this.app.metadataCache.getFileCache(file)?.frontmatterLinks ?? [];
		return links.some(l => this.app.metadataCache.getFirstLinkpathDest(l.link, file.path)?.path === trip.path);
	}

	private imageSrc(value: unknown, sourcePath: string): string | undefined {
		const target = firstLinkTarget(value);
		if (!target) return undefined;
		if (/^https?:\/\//i.test(target)) return target;
		const file = this.app.metadataCache.getFirstLinkpathDest(target, sourcePath);
		return file ? this.app.vault.getResourcePath(file) : undefined;
	}

	async read(trip: TFile): Promise<TravelData> {
		return extract(await this.app.vault.cachedRead(trip));
	}

	/** Atomic read-modify-write of the Trip's data block only. Throws (and writes nothing) on damaged data. */
	async change(trip: TFile, fn: (data: TravelData) => TravelData): Promise<void> {
		await this.app.vault.process(trip, source => update(source, fn));
	}

	/** Keeps visits pointing at a note after it is renamed or moved. */
	async onRename(file: TFile, oldPath: string): Promise<void> {
		if (file.extension !== "md") return;
		const needle = JSON.stringify(oldPath);
		for (const trip of this.trips()) {
			const text = await this.app.vault.cachedRead(trip);
			if (!text.includes(needle)) continue;
			await this.app.vault.process(trip, source => {
				let next: TravelData | null = null;
				const out = update(source, data => {
					next = renamePath(data, oldPath, file.path);
					return next ?? data;
				});
				return next ? out : source;
			});
		}
	}

	/**
	 * Turns an inline entry into a standalone note using the vault's property names, then replaces the inline data
	 * with a visit to that note. The note is created first: if updating the Trip fails, the inline entry is untouched.
	 */
	async convertToNote(trip: TFile, item: TravelItem): Promise<TFile> {
		const s = this.settings();
		const p = s.props;
		const folder = normalizePath(s.newNoteFolder.trim() || trip.parent?.path || "/");
		const safe = item.name.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim() || "Untitled place";
		const path = this.freePath(folder, safe);
		let body = "";
		if (s.newNoteTemplate.trim()) {
			const template = this.app.vault.getFileByPath(normalizePath(s.newNoteTemplate.trim().replace(/(\.md)?$/, ".md")));
			if (template) body = await this.app.vault.read(template);
		}
		if (folder !== "/" && !this.app.vault.getFolderByPath(folder)) await this.app.vault.createFolder(folder);
		const note = await this.app.vault.create(path, body);
		await this.app.fileManager.processFrontMatter(note, (fm: Record<string, unknown>) => {
			const tags = yamlList(fm.tags);
			for (const t of [item.kind === "event" ? s.eventTag : s.placeTag, item.category]) {
				if (t && !tags.map(x => x.toLowerCase()).includes(t.toLowerCase())) tags.push(t);
			}
			fm.tags = tags;
			const projects = yamlList(fm[p.projects]);
			const link = `[[${this.app.metadataCache.fileToLinktext(trip, note.path, true)}]]`;
			if (!projects.includes(link)) projects.push(link);
			fm[p.projects] = projects;
			if (item.date) fm[p.date] = item.time ? `${item.date}T${item.time}:00` : item.date;
			if (item.endDate || item.endTime) {
				const endDay = item.endDate ?? item.date;
				if (endDay) fm[p.endDate] = item.endTime ? `${endDay}T${item.endTime}:00` : endDay;
			}
			const copy: [string, string | undefined][] = [
				[p.address, item.address], [p.coords, item.coords], [p.website, item.website], [p.menu, item.menu],
				[p.hours, item.hours], [p.notes, item.notes],
			];
			for (const [key, value] of copy) if (value && key) fm[key] = value;
		});
		await this.change(trip, data => {
			const index = data.items.findIndex(i => i.id === item.id);
			if (index < 0) throw new Error("The entry changed before it could be converted. The new note was kept.");
			const visit: TravelItem = { id: item.id, source: "note", kind: item.kind, category: item.category, name: note.basename, path: note.path };
			for (const key of ["date", "time", "endDate", "endTime", "confirmation", "tickets", "reservation"] as const) {
				if (item[key]) visit[key] = item[key];
			}
			const items = [...data.items];
			items[index] = visit;
			return { ...data, items };
		});
		return note;
	}

	private freePath(folder: string, name: string): string {
		const base = folder === "/" ? "" : `${folder}/`;
		let path = normalizePath(`${base}${name}.md`);
		for (let n = 2; this.app.vault.getAbstractFileByPath(path); n++) path = normalizePath(`${base}${name} ${n}.md`);
		return path;
	}
}

function yamlList(value: unknown): string[] {
	if (Array.isArray(value)) return value.map(String);
	if (typeof value === "string" && value.trim()) return [value];
	return [];
}
