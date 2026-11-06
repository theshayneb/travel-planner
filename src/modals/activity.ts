import { App, ButtonComponent, Modal, Notice, Setting } from "obsidian";
import { CATEGORIES, categoryOf, ExtraField, newId, TravelItem } from "../model";

export interface ActivityModalOptions {
	/** Entry being edited; omit to add a new one. */
	item?: TravelItem;
	/** Day the modal was opened from (YYYY-MM-DD). */
	defaultDate?: string;
	onSubmit: (item: TravelItem) => Promise<void>;
	/** Offered when adding: pick an existing Place/Event note instead of typing one in. */
	onUseExisting?: (draft: { date?: string; time?: string }) => void;
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

/** Add or edit an inline entry. A visit to an existing note only edits its date, time and visit details. */
export class ActivityModal extends Modal {
	private draft: TravelItem;
	private readonly isVisit: boolean;

	constructor(app: App, private readonly options: ActivityModalOptions) {
		super(app);
		const base = options.item;
		this.isVisit = base?.source === "note";
		this.draft = base
			? { ...base }
			: { id: newId(), source: "inline", kind: "place", category: "food", name: "", date: options.defaultDate };
	}

	onOpen(): void {
		this.modalEl.addClass("htp-modal");
		this.setTitle(this.options.item ? (this.isVisit ? `Visit: ${this.draft.name}` : "Edit activity") : "Add activity");
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		const el = this.contentEl;
		el.empty();
		const d = this.draft;

		if (!this.options.item && this.options.onUseExisting) {
			const use = this.options.onUseExisting;
			new Setting(el)
				.setName("Already have a note for it?")
				.setDesc("Add an existing place or event note to this trip instead.")
				.addButton(b => b.setButtonText("Use an existing note").onClick(() => {
					this.close();
					use({ date: d.date, time: d.time });
				}));
		}

		if (!this.isVisit) {
			new Setting(el).setName("Name").addText(t => {
				t.setPlaceholder("Restaurant, museum, tour, flight…").setValue(d.name).onChange(v => (d.name = v));
				window.setTimeout(() => t.inputEl.focus(), 0);
			});
			new Setting(el).setName("Category").addDropdown(dd => {
				for (const c of CATEGORIES) dd.addOption(c.id, c.label);
				const current = categoryOf(d.category, d.kind);
				if (!CATEGORIES.some(c => c.id === current.id)) dd.addOption(current.id, current.label);
				dd.setValue(current.id).onChange(v => {
					d.category = v;
					d.kind = categoryOf(v, d.kind).kind;
					this.render();
				});
			});
		}

		const dateRow = new Setting(el).setName("Date").setDesc("Leave empty to keep it in ideas.");
		dateRow.addText(t => {
			t.inputEl.type = "date";
			t.setValue(d.date ?? "").onChange(v => (d.date = v || undefined));
		});
		dateRow.addText(t => {
			t.inputEl.type = "time";
			t.inputEl.setAttr("aria-label", "Time");
			t.setValue(d.time ?? "").onChange(v => (d.time = v || undefined));
		});

		const fields = this.isVisit ? (["endTime", "confirmation", "tickets", "reservation"] as ExtraField[]) : categoryOf(d.category, d.kind).fields;
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
			new Notice("Pick a date for that time, or clear the time.");
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
