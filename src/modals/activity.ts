import { AbstractInputSuggest, App, ButtonComponent, Modal, moment, Notice, setIcon, Setting } from "obsidian";
import { CATEGORIES, categoryOf, ExtraField, newId, TravelItem } from "../model";
import { NoteMatch } from "../search";

export interface ActivityModalOptions {
	/** Entry being edited; omit to add a new one. */
	item?: TravelItem;
	/** Day the modal was opened from (YYYY-MM-DD). */
	defaultDate?: string;
	/** The trip's days, offered in the Day list. */
	tripDays?: string[];
	/** Searches the vault's Place/Event notes as the name is typed (adding only). */
	findNotes?: (query: string) => NoteMatch[];
	onSubmit: (item: TravelItem) => Promise<void>;
}

const FIELD_LABELS: Record<ExtraField, { name: string; placeholder?: string; type?: string; area?: boolean }> = {
	menu: { name: "Menu", placeholder: "https://…", type: "url" },
	cuisine: { name: "Cuisine", placeholder: "Thai, tapas…" },
	reservation: { name: "Reservation", placeholder: "Booked for 4, name on it…" },
	hours: { name: "Opening hours", placeholder: "Mon–Thu 6pm–10pm", area: true },
	tickets: { name: "Tickets", placeholder: "https://…", type: "url" },
	price: { name: "Price", placeholder: "$25 per person" },
	confirmation: { name: "Confirmation", placeholder: "Booking code" },
	carrier: { name: "Airline or company", placeholder: "Delta DL 1234, Marriott…" },
	endTime: { name: "End time", type: "time" },
	endDate: { name: "End or check-out date", type: "date" },
};

const VISIT_FIELDS: ExtraField[] = ["endTime", "confirmation", "tickets", "reservation"];
const NO_DATE = "";
const OTHER_DATE = "other";

type Suggestion = { type: "note"; note: NoteMatch } | { type: "new"; name: string };

/** Dropdown under the name field: existing notes that match, then "add as new". */
class NoteSuggest extends AbstractInputSuggest<Suggestion> {
	constructor(app: App, input: HTMLInputElement, private readonly find: (q: string) => NoteMatch[], private readonly pick: (s: Suggestion) => void) {
		super(app, input);
		this.limit = 9;
	}

	protected getSuggestions(query: string): Suggestion[] {
		const notes = this.find(query);
		if (!notes.length) return [];
		return [...notes.map(note => ({ type: "note" as const, note })), { type: "new", name: query.trim() }];
	}

	renderSuggestion(s: Suggestion, el: HTMLElement): void {
		el.addClass("htp-suggestion");
		const icon = el.createSpan({ cls: "htp-suggestion-icon" });
		const text = el.createDiv({ cls: "htp-suggestion-text" });
		if (s.type === "note") {
			const cat = categoryOf(s.note.category, s.note.kind);
			icon.addClass(`htp-family-${cat.family}`);
			setIcon(icon, cat.icon);
			text.createDiv({ cls: "htp-suggestion-name", text: s.note.name });
			text.createDiv({ cls: "htp-suggestion-meta", text: [cat.label, s.note.folder].filter(Boolean).join(" · ") });
		} else {
			setIcon(icon, "plus");
			text.createDiv({ cls: "htp-suggestion-name", text: `Add “${s.name}” as a new activity` });
		}
	}

	selectSuggestion(s: Suggestion): void {
		this.close();
		this.pick(s);
	}
}

/**
 * Add or edit an activity. Typing a name searches existing notes; picking one adds a visit to that note instead of a
 * new entry. A visit (to an existing note) only edits its date, time and visit details.
 */
export class ActivityModal extends Modal {
	private draft: TravelItem;
	private isVisit: boolean;
	/** The inline entry being typed before a note was picked, so "Change" can go back to it. */
	private inlineDraft: TravelItem | null = null;
	private showOtherDate = false;

	constructor(app: App, private readonly options: ActivityModalOptions) {
		super(app);
		const base = options.item;
		this.isVisit = base?.source === "note";
		this.draft = base
			? { ...base }
			: { id: newId(), source: "inline", kind: "place", category: "food", name: "", date: options.defaultDate };
		const days = options.tripDays ?? [];
		this.showOtherDate = !!this.draft.date && days.length > 0 && !days.includes(this.draft.date);
	}

	onOpen(): void {
		this.modalEl.addClass("htp-modal");
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private get adding(): boolean {
		return !this.options.item;
	}

	private render(): void {
		const el = this.contentEl;
		el.empty();
		const d = this.draft;
		const day = d.date ? ` · ${moment(d.date, "YYYY-MM-DD").format("ddd, MMM D")}` : "";
		this.setTitle(this.isVisit ? (this.adding && this.inlineDraft ? `Add ${d.name}` : `Visit: ${d.name}`) : this.adding ? `Add activity${day}` : "Edit activity");

		if (this.isVisit && this.inlineDraft) {
			const banner = el.createDiv({ cls: "htp-picked" });
			const cat = categoryOf(d.category, d.kind);
			setIcon(banner.createSpan({ cls: `htp-suggestion-icon htp-family-${cat.family}` }), cat.icon);
			const text = banner.createDiv({ cls: "htp-suggestion-text" });
			text.createDiv({ cls: "htp-suggestion-name", text: d.name });
			text.createDiv({ cls: "htp-suggestion-meta", text: "Your existing note. Its address, links and details come from the note." });
			const change = banner.createEl("button", { text: "Change" });
			change.onClickEvent(() => {
				const back = this.inlineDraft;
				if (!back) return;
				this.draft = { ...back, date: d.date, time: d.time };
				this.inlineDraft = null;
				this.isVisit = false;
				this.render();
			});
		}

		if (!this.isVisit) {
			const chips = el.createDiv({ cls: "htp-chips", attr: { role: "radiogroup", "aria-label": "Category" } });
			const current = categoryOf(d.category, d.kind);
			const list = CATEGORIES.some(c => c.id === current.id) ? CATEGORIES : [...CATEGORIES, current];
			for (const c of list) {
				const chip = chips.createEl("button", { cls: `htp-chip-btn htp-family-${c.family}`, attr: { role: "radio", "aria-checked": String(c.id === current.id) } });
				chip.toggleClass("is-active", c.id === current.id);
				setIcon(chip.createSpan({ cls: "htp-chip-icon" }), c.icon);
				chip.createSpan({ text: c.label });
				chip.onClickEvent(() => {
					d.category = c.id;
					d.kind = c.kind;
					this.render();
				});
			}

			const nameRow = new Setting(el).setName("Name");
			if (this.adding && this.options.findNotes) nameRow.setDesc("Start typing to find a note you already have.");
			nameRow.addText(t => {
				t.setPlaceholder("Restaurant, museum, tour, flight…").setValue(d.name).onChange(v => (d.name = v));
				t.inputEl.addClass("htp-name-input");
				if (this.adding && this.options.findNotes) {
					new NoteSuggest(this.app, t.inputEl, this.options.findNotes, s => this.pickSuggestion(s, t.inputEl));
				}
				window.setTimeout(() => t.inputEl.focus(), 0);
			});
		}

		this.dayRow(el);

		const fields = this.isVisit ? VISIT_FIELDS : categoryOf(d.category, d.kind).fields;
		for (const f of fields) this.extraField(el, f);

		if (!this.isVisit) {
			this.textField(el, "address", "Address", "Street, city");
			this.textField(el, "coords", "Coordinates", "36.1129, -115.0622");
			this.textField(el, "website", "Website", "https://…", "url");
		}

		new Setting(el).setName(this.isVisit ? "Visit notes" : "Notes").addTextArea(t => {
			t.setValue(d.notes ?? "").onChange(v => (d.notes = v));
			t.inputEl.rows = 3;
		});

		const buttons = new Setting(el);
		buttons.addButton(b => b.setButtonText("Save").setCta().onClick(() => void this.save(b, false)));
		if (!this.isVisit) buttons.addButton(b => b.setButtonText("Save to ideas").onClick(() => void this.save(b, true)));
		buttons.addButton(b => b.setButtonText("Cancel").onClick(() => this.close()));
	}

	private pickSuggestion(s: Suggestion, input: HTMLInputElement): void {
		if (s.type === "new") {
			this.draft.name = s.name;
			input.value = s.name;
			return;
		}
		this.inlineDraft = { ...this.draft };
		this.draft = {
			id: this.draft.id,
			source: "note",
			path: s.note.path,
			name: s.note.name,
			kind: s.note.kind,
			category: s.note.category,
			date: this.draft.date,
			time: this.draft.time,
			notes: this.draft.notes,
		};
		this.isVisit = true;
		this.render();
	}

	/** Day (trip days, no date, or another date) and time. */
	private dayRow(el: HTMLElement): void {
		const d = this.draft;
		const days = this.options.tripDays ?? [];
		const row = new Setting(el).setName("Day").setDesc(d.date ? "" : "No date keeps it in ideas.");
		if (days.length) {
			row.addDropdown(dd => {
				dd.addOption(NO_DATE, "No date (idea)");
				for (const day of days) dd.addOption(day, moment(day, "YYYY-MM-DD").format("ddd, MMM D"));
				dd.addOption(OTHER_DATE, "Another date…");
				dd.setValue(this.showOtherDate ? OTHER_DATE : d.date && days.includes(d.date) ? d.date : NO_DATE);
				dd.onChange(v => {
					this.showOtherDate = v === OTHER_DATE;
					if (v !== OTHER_DATE) d.date = v || undefined;
					this.render();
				});
			});
		}
		if (!days.length || this.showOtherDate) {
			row.addText(t => {
				t.inputEl.type = "date";
				t.setValue(d.date ?? "").onChange(v => (d.date = v || undefined));
			});
		}
		row.addText(t => {
			t.inputEl.type = "time";
			t.inputEl.setAttr("aria-label", "Time");
			t.setValue(d.time ?? "").onChange(v => (d.time = v || undefined));
		});
	}

	private extraField(el: HTMLElement, field: ExtraField): void {
		const meta = FIELD_LABELS[field];
		if (meta.area) {
			new Setting(el).setName(meta.name).addTextArea(t => {
				t.setPlaceholder(meta.placeholder ?? "").setValue(this.draft[field] ?? "").onChange(v => (this.draft[field] = v));
				t.inputEl.rows = 2;
			});
			return;
		}
		this.textField(el, field, meta.name, meta.placeholder, meta.type);
	}

	private textField(el: HTMLElement, key: keyof TravelItem & string, name: string, placeholder = "", type = "text"): void {
		new Setting(el).setName(name).addText(t => {
			t.inputEl.type = type;
			t.setPlaceholder(placeholder).setValue(typeof this.draft[key] === "string" ? this.draft[key] : "").onChange(v => {
				this.draft[key] = v;
			});
		});
	}

	private async save(button: ButtonComponent, toIdeas: boolean): Promise<void> {
		const item = { ...this.draft, name: this.draft.name.trim() };
		if (!item.name) {
			new Notice("Give the activity a name.");
			return;
		}
		if (toIdeas) {
			delete item.date;
			delete item.time;
		}
		if (item.time && !item.date) {
			new Notice("Pick a day for that time, or clear the time.");
			return;
		}
		button.setDisabled(true);
		try {
			await this.options.onSubmit(item);
			this.close();
		} catch (e) {
			new Notice(`Could not save: ${e instanceof Error ? e.message : String(e)}`, 8000);
			button.setDisabled(false);
		}
	}
}
