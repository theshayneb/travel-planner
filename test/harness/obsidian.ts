// A stand-in for the parts of Obsidian the planner uses, so it can be drawn in Chromium (test/harness/run.mjs).
import realMoment from "moment";

declare global {
	interface HTMLElement {
		createEl<K extends keyof HTMLElementTagNameMap>(tag: K, o?: DomOpts): HTMLElementTagNameMap[K];
	}
}
interface DomOpts { cls?: string | string[]; text?: string; href?: string; attr?: Record<string, string | number | boolean | null> }
const P = HTMLElement.prototype as unknown as Record<string, unknown>;
function opts(el: HTMLElement, o?: DomOpts | string): HTMLElement {
	if (!o) return el;
	if (typeof o === "string") { el.className = o; return el; }
	if (o.cls) el.className = Array.isArray(o.cls) ? o.cls.join(" ") : o.cls;
	if (o.text != null) el.textContent = o.text;
	if (o.href) el.setAttribute("href", o.href);
	if (o.attr) for (const [k, v] of Object.entries(o.attr)) if (v != null) el.setAttribute(k, String(v));
	return el;
}
const w = window as unknown as Record<string, unknown>;
w.createEl = (tag: string, o?: DomOpts) => opts(document.createElement(tag), o);
w.createDiv = (o?: DomOpts) => opts(document.createElement("div"), o);
P.createEl = function (this: HTMLElement, tag: string, o?: DomOpts) { const el = opts(document.createElement(tag), o); this.appendChild(el); return el; };
P.createDiv = function (this: HTMLElement, o?: DomOpts) { return (this as unknown as { createEl: (t: string, o?: DomOpts) => HTMLElement }).createEl("div", o); };
P.createSpan = function (this: HTMLElement, o?: DomOpts) { return (this as unknown as { createEl: (t: string, o?: DomOpts) => HTMLElement }).createEl("span", o); };
P.empty = function (this: HTMLElement) { while (this.firstChild) this.removeChild(this.firstChild); };
P.setText = function (this: HTMLElement, t: string) { this.textContent = t; };
P.addClass = function (this: HTMLElement, ...c: string[]) { this.classList.add(...c); };
P.removeClass = function (this: HTMLElement, ...c: string[]) { this.classList.remove(...c); };
P.toggleClass = function (this: HTMLElement, c: string, on: boolean) { this.classList.toggle(c, !!on); };
P.getAttr = function (this: HTMLElement, k: string) { return this.getAttribute(k); };
P.setAttr = function (this: HTMLElement, k: string, v: string) { this.setAttribute(k, v); };
P.onClickEvent = function (this: HTMLElement, fn: (e: MouseEvent) => void) { this.addEventListener("click", fn); };

export const moment = realMoment;
export class TFile { constructor(public path: string, public basename = path.replace(/^.*\//, "").replace(/\.md$/, "")) {} }
export class Notice { constructor(msg: string) { console.log("Notice:", msg); } }
export class Component {
	private children: Component[] = [];
	load(): void { this.onload(); }
	onload(): void {}
	unload(): void { for (const c of this.children) c.unload(); this.onunload(); }
	onunload(): void {}
	addChild<T extends Component>(c: T): T { this.children.push(c); c.load(); return c; }
	removeChild<T extends Component>(c: T): T { c.unload(); return c; }
	register(): void {}
	registerDomEvent(el: HTMLElement, type: string, fn: (e: Event) => void): void { el.addEventListener(type, fn); }
}
export class MarkdownRenderChild extends Component { constructor(public containerEl: HTMLElement) { super(); } }
export const MarkdownRenderer = {
	render: async (_app: unknown, md: string, el: HTMLElement) => {
		const box = el.createDiv({ cls: "harness-embed" });
		box.createDiv({ text: `Your existing view renders here: ${md}` });
		const grid = box.createDiv({ cls: "harness-outfits" });
		for (const name of ["Day 1 · Concert", "Day 2 · Pool", "Day 3 · Dinner"]) grid.createDiv({ cls: "harness-outfit", text: name });
	},
};
export function setIcon(el: HTMLElement, name: string): void {
	const svg = (window as unknown as { ICONS: Record<string, string> }).ICONS[name];
	el.innerHTML = svg ?? `<b title="missing icon ${name}">?</b>`;
}
export async function requestUrl(_o: { url: string }): Promise<{ json: unknown }> {
	return { json: [
		{ lat: "36.1149291", lon: "-115.1406212", category: "amenity", type: "restaurant", name: "Lotus of Siam",
			address: { house_number: "620", road: "East Flamingo Road", town: "Paradise", state: "Nevada", postcode: "89119", country: "United States" },
			extratags: { cuisine: "thai", opening_hours: "Mo-Th 11:00-22:00; Fr,Sa 11:00-23:00; Su off", website: "https://www.lotusofsiamlv.com", phone: "+1 702-735-3033" } },
		{ lat: "40.75", lon: "-73.98", category: "amenity", type: "restaurant", name: "Lotus of Siam",
			address: { house_number: "71", road: "Bleecker Street", city: "New York", state: "New York", country: "United States" }, extratags: {} },
	] };
}
export function normalizePath(p: string): string { return p.replace(/\/+/g, "/").replace(/^\/|\/$/g, ""); }

// ---- Modal & settings, enough to draw the Add activity form ----
export class Modal {
	modalEl: HTMLElement; contentEl: HTMLElement; titleEl: HTMLElement;
	constructor(public app: unknown) {
		const bg = document.body.createDiv({ cls: "modal-container" });
		this.modalEl = bg.createDiv({ cls: "modal" });
		this.titleEl = this.modalEl.createDiv({ cls: "modal-title" });
		this.contentEl = this.modalEl.createDiv({ cls: "modal-content" });
	}
	setTitle(t: string): this { this.titleEl.textContent = t; return this; }
	open(): void { this.onOpen(); }
	close(): void { this.onClose(); this.modalEl.parentElement?.remove(); }
	onOpen(): void {}
	onClose(): void {}
}
export abstract class AbstractInputSuggest<T> {
	limit = 100;
	private box: HTMLElement | null = null;
	constructor(public app: unknown, private readonly input: HTMLInputElement) {
		input.addEventListener("input", () => void this.show());
	}
	protected abstract getSuggestions(query: string): T[];
	abstract renderSuggestion(value: T, el: HTMLElement): void;
	selectSuggestion(_value: T): void {}
	close(): void { this.box?.remove(); this.box = null; }
	private show(): void {
		this.close();
		const items = this.getSuggestions(this.input.value);
		if (!items.length) return;
		const r = this.input.getBoundingClientRect();
		this.box = document.body.createDiv({ cls: "suggestion-container" });
		this.box.style.cssText = `position:fixed;left:${r.left}px;top:${r.bottom + 4}px;width:${Math.max(r.width, 280)}px`;
		for (const item of items) {
			const row = this.box.createDiv({ cls: "suggestion-item" });
			this.renderSuggestion(item, row);
			row.addEventListener("click", () => this.selectSuggestion(item));
		}
	}
}
export class FuzzySuggestModal<T> extends Modal { setPlaceholder(): void {} getItems(): T[] { return []; } }
export class ButtonComponent {
	buttonEl: HTMLButtonElement;
	constructor(parent: HTMLElement) { this.buttonEl = parent.createEl("button"); }
	setButtonText(t: string): this { this.buttonEl.textContent = t; return this; }
	setCta(): this { this.buttonEl.classList.add("mod-cta"); return this; }
	setClass(c: string): this { this.buttonEl.classList.add(c); return this; }
	setDisabled(d: boolean): this { this.buttonEl.disabled = d; return this; }
	onClick(fn: () => void): this { this.buttonEl.addEventListener("click", fn); return this; }
}
class InputComp<E extends HTMLInputElement | HTMLTextAreaElement> {
	constructor(public inputEl: E) {}
	setPlaceholder(p: string): this { this.inputEl.placeholder = p; return this; }
	setValue(v: string): this { this.inputEl.value = v; return this; }
	onChange(fn: (v: string) => void): this { this.inputEl.addEventListener("input", () => fn(this.inputEl.value)); return this; }
}
class DropdownComp {
	constructor(public selectEl: HTMLSelectElement) {}
	addOption(v: string, t: string): this { const o = this.selectEl.createEl("option", { text: t }); o.value = v; return this; }
	setValue(v: string): this { this.selectEl.value = v; return this; }
	onChange(fn: (v: string) => void): this { this.selectEl.addEventListener("change", () => fn(this.selectEl.value)); return this; }
}
export class Setting {
	private info: HTMLElement; private control: HTMLElement; private name: HTMLElement; private desc: HTMLElement;
	constructor(parent: HTMLElement) {
		const item = parent.createDiv({ cls: "setting-item" });
		this.info = item.createDiv({ cls: "setting-item-info" });
		this.name = this.info.createDiv({ cls: "setting-item-name" });
		this.desc = this.info.createDiv({ cls: "setting-item-description" });
		this.control = item.createDiv({ cls: "setting-item-control" });
	}
	setName(n: string): this { this.name.textContent = n; return this; }
	setDesc(d: string): this { this.desc.textContent = d; return this; }
	setHeading(): this { return this; }
	addText(cb: (t: InputComp<HTMLInputElement>) => void): this { cb(new InputComp(this.control.createEl("input", { attr: { type: "text" } }))); return this; }
	addTextArea(cb: (t: InputComp<HTMLTextAreaElement>) => void): this { cb(new InputComp(this.control.createEl("textarea"))); return this; }
	addDropdown(cb: (d: DropdownComp) => void): this { cb(new DropdownComp(this.control.createEl("select", { cls: "dropdown" }))); return this; }
	addButton(cb: (b: ButtonComponent) => void): this { cb(new ButtonComponent(this.control)); return this; }
	addDropdownPlaceholder(): this { return this; }
}
