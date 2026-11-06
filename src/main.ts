import { Editor, ItemView, MarkdownRenderChild, MarkdownView, Notice, Plugin, TFile, ViewStateResult, WorkspaceLeaf } from "obsidian";
import { Planner, PlannerHost } from "./planner";
import { mergeSettings, PlannerSettings } from "./settings-model";
import { PlannerSettingTab } from "./settings-tab";
import { DATA_LANG, extract } from "./storage";
import { ALL_TABS, parseTabs, TabId } from "./tabs";
import { plannerBlockChanges } from "./template";
import { TripVault } from "./vault";

export const VIEW_TYPE = "hybrid-travel-planner-view";
export const BLOCK_LANG = "travel-planner";

export default class TravelPlannerPlugin extends Plugin implements PlannerHost {
	config!: PlannerSettings;
	vault!: TripVault;
	readonly tabMemory = new Map<string, TabId>();
	private readonly planners = new Set<Planner>();

	async onload(): Promise<void> {
		this.config = mergeSettings(await this.loadData());
		this.vault = new TripVault(this.app, () => this.config);

		this.registerView(VIEW_TYPE, leaf => new PlannerView(leaf, this));
		this.addSettingTab(new PlannerSettingTab(this.app, this));

		this.registerMarkdownCodeBlockProcessor(BLOCK_LANG, (source, el, ctx) => {
			const trip = this.app.vault.getFileByPath(ctx.sourcePath);
			if (!trip) return;
			ctx.addChild(new EmbeddedPlanner(el, this, trip, parseTabs(source)));
		});

		// The data block itself shows as a one-line summary instead of raw JSON.
		this.registerMarkdownCodeBlockProcessor(DATA_LANG, (source, el) => {
			const chip = el.createDiv({ cls: "htp-data-chip" });
			try {
				const n = extract("```" + DATA_LANG + "\n" + source.replace(/\n$/, "") + "\n```").items.length;
				chip.setText(`Travel planner data: ${n} ${n === 1 ? "entry" : "entries"}. Edit it from the planner.`);
			} catch (e) {
				chip.addClass("htp-data-chip--error");
				chip.setText(e instanceof Error ? e.message : String(e));
			}
		});

		this.addCommand({
			id: "open-planner",
			name: "Open full-screen planner for this trip",
			checkCallback: checking => {
				const file = this.activeTrip();
				if (!file) return false;
				if (!checking) void this.openFullView(file);
				return true;
			},
		});
		this.addCommand({
			id: "add-activity",
			name: "Add activity to this trip",
			checkCallback: checking => {
				const file = this.activeTrip();
				if (!file) return false;
				if (!checking) this.addActivity(file);
				return true;
			},
		});
		this.addCommand({
			id: "insert-planner",
			name: "Insert planner block",
			editorCallback: (editor: Editor) => {
				editor.replaceSelection("```" + BLOCK_LANG + "\nconfirmed, ideas, outfits, past\n```\n");
			},
		});

		this.addCommand({
			id: "use-planner-in-note",
			name: "Use the planner in this note's plans tabs",
			editorCheckCallback: (checking, editor: Editor) => {
				const changes = plannerBlockChanges(editor.getValue(), BLOCK_LANG);
				if (!changes.length) return false;
				if (checking) return true;
				// One undoable edit; only the TripEvents / TripIdeas / TripEventsPast embed lines change.
				editor.transaction({
					changes: changes.map(c => ({ from: { line: c.line, ch: 0 }, to: { line: c.line, ch: editor.getLine(c.line).length }, text: c.text })),
				});
				new Notice(`Replaced ${changes.length} base ${changes.length === 1 ? "embed" : "embeds"} with the planner. Outfits is unchanged; undo to go back.`);
				return true;
			},
		});

		const refresh = (file: TFile) => {
			for (const p of this.planners) {
				if (p.trip.path === file.path || p.shown.has(file.path) || this.linksTo(file, p.trip)) p.refreshSoon();
			}
		};
		this.registerEvent(this.app.metadataCache.on("changed", file => refresh(file)));
		this.registerEvent(this.app.vault.on("delete", file => {
			if (file instanceof TFile) for (const p of this.planners) if (p.shown.has(file.path)) p.refreshSoon();
		}));
		this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
			if (!(file instanceof TFile)) return;
			for (const p of this.planners) if (p.shown.has(oldPath)) p.refreshSoon();
			for (const [key, tab] of [...this.tabMemory]) {
				if (key.startsWith(`${oldPath}|`)) this.tabMemory.set(`${file.path}${key.slice(oldPath.length)}`, tab);
			}
			this.vault.onRename(file, oldPath).catch((e: unknown) => {
				new Notice(`Travel planner could not update a renamed note in a trip: ${e instanceof Error ? e.message : String(e)}`, 8000);
			});
		}));
		// Today's activities move to Past at midnight without reopening the note.
		this.registerInterval(window.setInterval(() => this.refreshAllIfNewDay(), 60_000));
	}

	private lastDay = new Date().toDateString();
	private refreshAllIfNewDay(): void {
		const day = new Date().toDateString();
		if (day === this.lastDay) return;
		this.lastDay = day;
		for (const p of this.planners) p.refreshSoon();
	}

	private linksTo(file: TFile, trip: TFile): boolean {
		const cache = this.app.metadataCache.getFileCache(file);
		const links = [...(cache?.links ?? []), ...(cache?.frontmatterLinks ?? [])];
		return links.some(l => this.app.metadataCache.getFirstLinkpathDest(l.link, file.path)?.path === trip.path);
	}

	registerPlanner(p: Planner): void {
		this.planners.add(p);
	}

	unregisterPlanner(p: Planner): void {
		this.planners.delete(p);
	}

	getSettings(): PlannerSettings {
		return this.config;
	}

	refreshAll(): void {
		for (const p of this.planners) p.refreshSoon();
	}

	private activeTrip(): TFile | null {
		const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file ?? this.app.workspace.getActiveViewOfType(PlannerView)?.trip ?? null;
		return file && this.vault.isTrip(file) ? file : null;
	}

	private addActivity(trip: TFile): void {
		const planner = [...this.planners].find(p => p.trip.path === trip.path);
		if (planner) {
			planner.add(undefined);
			return;
		}
		const holder = new Planner(this, createDiv(), trip, { tabs: ["confirmed"], header: false });
		holder.add(undefined);
	}

	openFullView(trip: TFile): void {
		void (async () => {
			const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE).find(l => l.view instanceof PlannerView && l.view.trip?.path === trip.path);
			const leaf = existing ?? this.app.workspace.getLeaf("tab");
			if (!existing) await leaf.setViewState({ type: VIEW_TYPE, active: true, state: { file: trip.path } });
			await this.app.workspace.revealLeaf(leaf);
		})();
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.config);
		this.refreshAll();
	}
}

class EmbeddedPlanner extends MarkdownRenderChild {
	private planner: Planner;

	constructor(el: HTMLElement, private readonly plugin: TravelPlannerPlugin, trip: TFile, tabs: TabId[]) {
		super(el);
		this.planner = new Planner(plugin, el.createDiv(), trip, { tabs, header: false });
	}

	onload(): void {
		this.addChild(this.planner);
		this.plugin.registerPlanner(this.planner);
		void this.planner.render();
	}

	onunload(): void {
		this.plugin.unregisterPlanner(this.planner);
	}
}

class PlannerView extends ItemView {
	trip: TFile | null = null;
	private planner: Planner | null = null;

	constructor(leaf: WorkspaceLeaf, private readonly plugin: TravelPlannerPlugin) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.trip ? `Plan: ${this.trip.basename}` : "Travel planner";
	}

	getIcon(): string {
		return "plane";
	}

	getState(): Record<string, unknown> {
		return { ...super.getState(), file: this.trip?.path };
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const path = (state as { file?: unknown } | null)?.file;
		const file = typeof path === "string" ? this.app.vault.getFileByPath(path) : null;
		this.trip = file;
		this.mount();
		await super.setState(state, result);
	}

	async onOpen(): Promise<void> {
		this.mount();
	}

	async onClose(): Promise<void> {
		this.unmount();
	}

	private unmount(): void {
		if (!this.planner) return;
		this.plugin.unregisterPlanner(this.planner);
		this.removeChild(this.planner);
		this.planner = null;
	}

	private mount(): void {
		this.unmount();
		const el = this.contentEl;
		el.empty();
		if (!this.trip) {
			el.createDiv({ cls: "htp-empty", text: "Open a trip note and run “Open full-screen planner for this trip”." });
			return;
		}
		this.planner = new Planner(this.plugin, el.createDiv(), this.trip, { tabs: ALL_TABS, header: true });
		this.addChild(this.planner);
		this.plugin.registerPlanner(this.planner);
		void this.planner.render();
	}
}
