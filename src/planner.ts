/** The planner UI. Used by the `travel-planner` block inside Trip notes and by the full-screen view. */
import { App, Component, MarkdownRenderer, moment, Notice, requestUrl, setIcon, TFile } from "obsidian";
import { bucketOf, groupByDay, groupIdeas, localDate, mergeItems, tripDays } from "./itinerary";
import { LookupResult, lookupUrl, parseResults } from "./lookup";
import { mapsUrl } from "./maps";
import { categoryOf, DisplayItem, newId, TravelData, TravelItem } from "./model";
import { ActivityModal } from "./modals/activity";
import { confirm } from "./modals/confirm";
import { splitDateTime } from "./notes";
import { PlannerSettings } from "./settings-model";
import { addItem, removeItem, replaceItem } from "./storage";
import { matchNotes, NoteMatch } from "./search";
import { TabId } from "./tabs";
import { TripVault } from "./vault";

const TAB_LABELS: Record<TabId, string> = { confirmed: "Confirmed", ideas: "Ideas", outfits: "Outfits", past: "Past" };
const TAB_ICONS: Record<TabId, string> = { confirmed: "calendar-check", ideas: "lightbulb", outfits: "shirt", past: "history" };

export interface PlannerHost {
	app: App;
	vault: TripVault;
	getSettings: () => PlannerSettings;
	/** Remembers the open tab per Trip while Obsidian runs, so re-renders keep it. */
	tabMemory: Map<string, TabId>;
	openFullView: (trip: TFile) => void;
}

export interface PlannerOptions {
	tabs: TabId[];
	/** Full-screen view: show the Trip title, dates and the main actions. */
	header: boolean;
}

export class Planner extends Component {
	/** Notes currently on screen; a change to any of them re-renders the planner. */
	readonly shown = new Set<string>();
	private renderTimer: number | null = null;
	private rendering = false;
	private pending = false;
	/** The trip's days, for the add form. */
	private days: string[] = [];
	private listening = false;

	constructor(
		private readonly host: PlannerHost,
		readonly el: HTMLElement,
		public trip: TFile,
		private readonly options: PlannerOptions,
	) {
		super();
	}

	onunload(): void {
		if (this.renderTimer !== null) window.clearTimeout(this.renderTimer);
		this.el.empty();
	}

	/** Debounced re-render: Sync can deliver several changes in quick succession. */
	refreshSoon(): void {
		if (this.renderTimer !== null) window.clearTimeout(this.renderTimer);
		this.renderTimer = window.setTimeout(() => {
			this.renderTimer = null;
			void this.render();
		}, 250);
	}

	async render(): Promise<void> {
		if (this.rendering) {
			this.pending = true;
			return;
		}
		this.rendering = true;
		try {
			await this.draw();
		} finally {
			this.rendering = false;
			if (this.pending) {
				this.pending = false;
				void this.render();
			}
		}
	}

	private get app(): App {
		return this.host.app;
	}

	private async draw(): Promise<void> {
		const { vault } = this.host;
		const s = this.host.getSettings();
		const trip = this.trip;
		let data: TravelData = { version: 1, items: [] };
		let error: string | null = null;
		try {
			data = await vault.read(trip);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
		const items = mergeItems(data.items, vault.linkedNotes(trip), p => vault.noteDetails(p));
		const today = localDate(new Date());
		const fm = vault.frontmatter(trip) ?? {};
		const tripStart = splitDateTime(fm[s.props.date]).date;
		const tripEnd = splitDateTime(fm[s.props.endDate]).date;
		this.days = tripDays(tripStart, tripEnd);

		this.shown.clear();
		this.shown.add(trip.path);
		for (const i of items) if (i.path) this.shown.add(i.path);

		const el = this.el;
		el.empty();
		el.addClass("htp-planner");
		if (!this.listening) {
			// Inside a callout in Live Preview, a mousedown would otherwise put the editor's cursor into the callout and
			// show its source instead of letting the button work.
			this.registerDomEvent(el, "mousedown", e => e.stopPropagation());
			this.listening = true;
		}
		el.toggleClass("htp-planner--full", this.options.header);

		if (this.options.header) this.drawHeader(el, tripStart, tripEnd);
		if (error) {
			const box = el.createDiv({ cls: "htp-error" });
			setIcon(box.createSpan({ cls: "htp-error-icon" }), "triangle-alert");
			box.createSpan({ text: `${error} Fix or remove the travel-planner-data block in the trip note; the planner will not write until it is valid.` });
		}

		const tabs = this.options.tabs.filter(t => t !== "outfits" || s.showOutfitsTab);
		let active = this.host.tabMemory.get(trip.path);
		if (!active || !tabs.includes(active)) active = tabs[0];

		const bar = tabs.length > 1 ? el.createDiv({ cls: "htp-tabs", attr: { role: "tablist" } }) : null;
		const toolbar = el.createDiv({ cls: "htp-toolbar" });
		const body = el.createDiv({ cls: "htp-body" });

		const counts: Record<TabId, number> = { confirmed: 0, ideas: 0, outfits: 0, past: 0 };
		for (const i of items) counts[bucketOf(i.date, today)]++;

		const show = (tab: TabId) => {
			this.host.tabMemory.set(trip.path, tab);
			bar?.querySelectorAll(".htp-tab").forEach(b => b.toggleClass("is-active", b.getAttr("data-tab") === tab));
			body.empty();
			toolbar.empty();
			if (tab !== "outfits" && !error) {
				const add = toolbar.createEl("button", { cls: "htp-add mod-cta" });
				setIcon(add.createSpan(), "plus");
				add.createSpan({ text: "Add activity" });
				add.onClickEvent(() => this.add(undefined));
			}
			if (!this.options.header) {
				const full = toolbar.createEl("button", { cls: "clickable-icon htp-expand", attr: { "aria-label": "Open full-screen planner" } });
				setIcon(full, "maximize-2");
				full.onClickEvent(() => this.host.openFullView(trip));
			}
			if (tab === "confirmed") this.drawDays(body, items.filter(i => bucketOf(i.date, today) === "confirmed"), "Nothing scheduled from today on. Add an activity, or give an idea a date.");
			if (tab === "past") this.drawDays(body, items.filter(i => bucketOf(i.date, today) === "past"), "Nothing in the past yet.");
			if (tab === "ideas") this.drawIdeas(body, items.filter(i => !i.date));
			if (tab === "outfits") this.drawOutfits(body);
		};

		if (bar) {
			for (const tab of tabs) {
				const b = bar.createEl("button", { cls: "htp-tab", attr: { "data-tab": tab, role: "tab" } });
				setIcon(b.createSpan({ cls: "htp-tab-icon" }), TAB_ICONS[tab]);
				b.createSpan({ text: TAB_LABELS[tab] });
				if (tab !== "outfits" && counts[tab]) b.createSpan({ cls: "htp-count", text: String(counts[tab]) });
				b.onClickEvent(() => show(tab));
			}
		}
		show(active);
	}

	private drawHeader(el: HTMLElement, start?: string, end?: string): void {
		const head = el.createDiv({ cls: "htp-header" });
		const title = head.createDiv({ cls: "htp-title" });
		title.createEl("h2", { text: this.trip.basename });
		if (start) {
			const a = moment(start, "YYYY-MM-DD");
			const b = end ? moment(end, "YYYY-MM-DD") : null;
			const range = b && !b.isSame(a, "day")
				? `${a.format(a.isSame(b, "year") ? "ddd, MMM D" : "ddd, MMM D, YYYY")} – ${b.format("ddd, MMM D, YYYY")}`
				: a.format("ddd, MMM D, YYYY");
			title.createDiv({ cls: "htp-dates", text: range });
		}
		const open = head.createEl("button", { text: "Open trip note" });
		open.onClickEvent(() => void this.app.workspace.getLeaf(false).openFile(this.trip));
	}

	private drawDays(body: HTMLElement, items: DisplayItem[], emptyText: string): void {
		const groups = groupByDay(items);
		if (!groups.length) {
			body.createDiv({ cls: "htp-empty", text: emptyText });
			return;
		}
		const today = localDate(new Date());
		for (const g of groups) {
			const day = body.createDiv({ cls: "htp-day" });
			const head = day.createDiv({ cls: "htp-day-head" });
			const m = moment(g.date, "YYYY-MM-DD");
			head.createSpan({ cls: "htp-day-name", text: m.format("dddd") });
			head.createSpan({ cls: "htp-day-date", text: m.format("MMM D, YYYY") });
			if (g.date === today) head.createSpan({ cls: "htp-today", text: "Today" });
			const add = head.createEl("button", { cls: "clickable-icon htp-day-add", attr: { "aria-label": `Add to ${m.format("ddd, MMM D")}` } });
			setIcon(add, "plus");
			add.onClickEvent(() => this.add(g.date));
			for (const item of g.timed) this.drawCard(day, item);
			if (g.untimed.length) {
				if (g.timed.length) day.createDiv({ cls: "htp-anytime", text: "Any time" });
				for (const item of g.untimed) this.drawCard(day, item);
			}
		}
	}

	private drawIdeas(body: HTMLElement, items: DisplayItem[]): void {
		const groups = groupIdeas(items);
		if (!groups.length) {
			body.createDiv({ cls: "htp-empty", text: "No ideas yet. Add one without a date to keep it here." });
			return;
		}
		for (const g of groups) {
			const group = body.createDiv({ cls: "htp-idea-group" });
			group.createDiv({ cls: "htp-group-head", text: g.label });
			for (const item of g.items) this.drawCard(group, item);
		}
	}

	private drawOutfits(body: HTMLElement): void {
		const s = this.host.getSettings();
		const wrap = body.createDiv({ cls: "htp-outfits" });
		// The existing Base embed, rendered as if it sat in the Trip note, so `this` still means the Trip.
		void MarkdownRenderer.render(this.app, s.outfitsEmbed, wrap, this.trip.path, this);
		const open = body.createDiv({ cls: "htp-outfits-fallback" });
		const b = open.createEl("button", { text: "Open outfits in the trip note" });
		b.onClickEvent(() => void this.app.workspace.getLeaf(false).openFile(this.trip));
	}

	private drawCard(parent: HTMLElement, item: DisplayItem): void {
		const cat = categoryOf(item.category, item.kind);
		const card = parent.createDiv({ cls: `htp-card htp-family-${cat.family}` });
		if (["event", "stay"].includes(cat.family)) card.addClass("htp-card--booking");

		const when = card.createDiv({ cls: "htp-when" });
		if (item.time) {
			when.createDiv({ cls: "htp-time", text: formatTime(item.time) });
			if (item.endTime) when.createDiv({ cls: "htp-end", text: formatTime(item.endTime) });
		} else {
			card.addClass("htp-card--untimed");
			setIcon(when.createDiv({ cls: "htp-when-icon" }), cat.icon);
		}

		const main = card.createDiv({ cls: "htp-main" });
		const title = main.createDiv({ cls: "htp-card-title" });
		if (item.time) setIcon(title.createSpan({ cls: "htp-icon" }), cat.icon);
		title.createSpan({ cls: "htp-name", text: item.name });
		title.createSpan({ cls: "htp-chip", text: cat.label });
		if (item.rating) title.createSpan({ cls: "htp-rating", text: item.rating });

		if (item.missing) main.createDiv({ cls: "htp-warning", text: `The note ${item.path ?? ""} was not found. It may have been renamed outside Obsidian or deleted.` });
		const details: [string, string | undefined][] = [
			["map-pin", item.address],
			["clock", item.hours],
			["chef-hat", item.cuisine],
			["badge-dollar-sign", item.price],
			["plane", item.carrier],
			["bookmark-check", item.reservation],
			["hash", item.confirmation],
			["calendar-range", item.endDate ? `Until ${moment(item.endDate, "YYYY-MM-DD").format("ddd, MMM D")}` : undefined],
		];
		for (const [icon, value] of details) {
			if (!value) continue;
			const row = main.createDiv({ cls: "htp-detail" });
			setIcon(row.createSpan({ cls: "htp-detail-icon" }), icon);
			row.createSpan({ text: value });
		}
		if (item.notes) main.createDiv({ cls: "htp-notes", text: item.notes });
		if (item.visitNotes) main.createDiv({ cls: "htp-notes htp-visit-notes", text: item.visitNotes });

		// Links row only when there are links, so cards without any don't get an empty strip.
		const actions = createDiv({ cls: "htp-actions" });
		const map = mapsUrl(item, this.host.getSettings().mapsProvider);
		if (map && (item.address || item.coords)) this.link(actions, "map", "Map", map);
		if (item.menu) this.link(actions, "book-open", "Menu", item.menu);
		if (item.website) this.link(actions, "globe", "Website", item.website);
		if (item.phone) this.link(actions, "phone", "Call", `tel:${item.phone.replace(/[^\d+]/g, "")}`);
		if (item.tickets && /^https?:/i.test(item.tickets)) this.link(actions, "ticket", "Tickets", item.tickets);

		if (actions.childElementCount) main.appendChild(actions);

		// Open note / schedule / edit / delete sit in the card's top-right corner.
		const tools = card.createDiv({ cls: "htp-tools" });
		if (item.path && !item.missing) this.tool(tools, "file-text", "Open note", () => this.openNote(item.path ?? ""));
		if (item.origin === "legacy") {
			this.tool(tools, "calendar-plus", item.date ? "Schedule another visit" : "Schedule", () => this.scheduleNote(item));
		} else {
			this.tool(tools, "pencil", "Edit", () => void this.edit(item.id));
			if (item.origin === "inline") this.tool(tools, "file-plus", "Convert to note", () => void this.convert(item.id));
			this.tool(tools, "trash-2", item.origin === "visit" ? "Remove from trip" : "Delete", () => void this.remove(item));
		}

		if (item.imageSrc) {
			card.addClass("has-image");
			card.createEl("img", { cls: "htp-thumb", attr: { src: item.imageSrc, alt: "", loading: "lazy" } });
		}
	}

	private link(parent: HTMLElement, icon: string, text: string, href: string): void {
		const a = parent.createEl("a", { cls: "htp-link external-link", href, attr: { target: "_blank", rel: "noopener" } });
		setIcon(a.createSpan({ cls: "htp-link-icon" }), icon);
		a.createSpan({ text });
	}

	private tool(parent: HTMLElement, icon: string, label: string, run: () => void): void {
		const b = parent.createEl("button", { cls: "clickable-icon htp-tool", attr: { "aria-label": label } });
		setIcon(b, icon);
		b.onClickEvent(e => {
			e.stopPropagation();
			run();
		});
	}

	private openNote(path: string): void {
		const file = this.app.vault.getFileByPath(path);
		if (file) void this.app.workspace.getLeaf(false).openFile(file);
	}

	// ---- Actions. Every write goes through TripVault.change (atomic, data block only) and then re-renders. ----

	private async write(fn: (d: TravelData) => TravelData): Promise<void> {
		await this.host.vault.change(this.trip, fn);
		this.refreshSoon();
	}

	add(defaultDate: string | undefined): void {
		let notes: NoteMatch[] | null = null;
		new ActivityModal(this.app, {
			defaultDate,
			tripDays: this.days,
			lookup: this.lookup(),
			findNotes: q => matchNotes(q, (notes ??= this.host.vault.noteMatches())),
			onSubmit: item => this.write(d => {
				if (item.source === "note" && d.items.some(i => i.source === "note" && i.path === item.path && (i.date ?? "") === (item.date ?? ""))) {
					throw new Error(`${item.name} is already on the trip${item.date ? " that day" : ""}.`);
				}
				return addItem(d, item);
			}),
		}).open();
	}

	/** Gives a linked legacy note an itinerary record on this Trip (the note itself is not changed). */
	private scheduleNote(item: DisplayItem): void {
		const visit: TravelItem = {
			id: newId(), source: "note", path: item.path, name: item.name, kind: item.kind, category: item.category,
			date: item.date, time: item.time,
		};
		new ActivityModal(this.app, { item: visit, tripDays: this.days, onSubmit: v => this.write(d => addItem(d, v)) }).open();
	}

	/** OpenStreetMap search for the add form, unless turned off in settings. One request per tap. */
	private lookup(): ((name: string, address: string) => Promise<LookupResult[]>) | undefined {
		if (!this.host.getSettings().lookupEnabled) return undefined;
		return async (name, address) => {
			const response = await requestUrl({
				url: lookupUrl(name, address),
				headers: {
					"User-Agent": "Obsidian-Travel-Planner/1.0 (https://github.com/theshayneb/travel-planner)",
					"Accept-Language": moment.locale() || "en",
				},
			});
			return parseResults(response.json);
		};
	}

	private async stored(id: string): Promise<TravelItem | undefined> {
		return (await this.host.vault.read(this.trip)).items.find(i => i.id === id);
	}

	private async edit(id: string): Promise<void> {
		const item = await this.stored(id);
		if (!item) return void new Notice("That entry changed on another device. The planner has been refreshed.");
		new ActivityModal(this.app, {
			item,
			tripDays: this.days,
			lookup: item.source === "inline" ? this.lookup() : undefined,
			onSubmit: next => this.write(d => replaceItem(d, id, next)),
		}).open();
	}

	private async remove(item: DisplayItem): Promise<void> {
		const visit = item.origin === "visit";
		const ok = await confirm(
			this.app,
			visit ? "Remove from trip?" : "Delete activity?",
			visit ? `${item.name} will be removed from this trip's itinerary. The note itself is not changed.` : `${item.name} will be deleted from this trip.`,
			visit ? "Remove" : "Delete",
		);
		if (!ok) return;
		try {
			await this.write(d => removeItem(d, item.id));
		} catch (e) {
			new Notice(e instanceof Error ? e.message : String(e));
		}
	}

	private async convert(id: string): Promise<void> {
		const item = await this.stored(id);
		if (!item) return;
		const ok = await confirm(this.app, "Convert to note?", `A new note will be created for ${item.name}, linked to this trip, and the activity will keep its place in the itinerary.`, "Convert");
		if (!ok) return;
		try {
			const note = await this.host.vault.convertToNote(this.trip, item);
			this.refreshSoon();
			new Notice(`Created ${note.path}`);
		} catch (e) {
			new Notice(`Could not convert: ${e instanceof Error ? e.message : String(e)}`, 8000);
		}
	}
}

function formatTime(hhmm: string): string {
	return moment(hhmm, "HH:mm").format("h:mm A");
}
