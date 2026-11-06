// Draws the planner with a sample trip (dates relative to today) for screenshots. See run.mjs.
import { TFile } from "obsidian";
import { localDate } from "../../src/itinerary";
import { DisplayItem, TravelData } from "../../src/model";
import { Planner, PlannerHost } from "../../src/planner";
import { DEFAULT_SETTINGS } from "../../src/settings-model";
import { TabId } from "../../src/tabs";
import { TripVault } from "../../src/vault";

const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return localDate(d); };
const photo = (a: string, b: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><defs><linearGradient id="g"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="80" height="80" fill="url(#g)"/></svg>`)}`;

const trip = new TFile("Travel/No Doubt in Las Vegas.md");
let data: TravelData = { version: 1, items: [
	{ id: "i1", source: "inline", kind: "event", category: "accomodations", name: "Sam's Town Hotel", date: day(0), endDate: day(3), address: "5111 Boulder Hwy, Las Vegas, NV", confirmation: "STH-48213" },
	{ id: "i2", source: "inline", kind: "place", category: "food", name: "Lotus of Siam", date: day(0), time: "18:00", address: "620 E Flamingo Rd, Las Vegas, NV", cuisine: "Northern Thai", reservation: "Table for 4 under Shayne", menu: "https://example.com/menu", website: "https://example.com" },
	{ id: "i3", source: "inline", kind: "event", category: "activity", name: "No Doubt at Sphere", date: day(0), time: "20:30", endTime: "23:00", address: "255 Sands Ave, Las Vegas, NV", tickets: "https://example.com/tickets", confirmation: "Sec 207 · Row K" },
	{ id: "i4", source: "inline", kind: "place", category: "museum", name: "The Neon Museum", date: day(1), time: "10:00", hours: "Daily 4pm–midnight", price: "$30 per person", address: "770 Las Vegas Blvd N" },
	{ id: "i5", source: "inline", kind: "place", category: "food", name: "Coffee somewhere near the hotel", date: day(1) },
	{ id: "i6", source: "inline", kind: "place", category: "food", name: "Pizza Rock", menu: "https://example.com/menu", address: "201 N 3rd St, Las Vegas" },
	{ id: "i7", source: "inline", kind: "place", category: "outdoors", name: "Seven Magic Mountains", coords: "35.8386, -115.2722", notes: "Go near sunset; 30 min drive south." },
	{ id: "i8", source: "inline", kind: "place", category: "tour", name: "Neon & Vintage Vegas walking tour", price: "$45", confirmation: "VT-2210" },
] };

const legacy: DisplayItem[] = [
	{ id: "legacy:a", origin: "legacy", source: "note", path: "Events/TPA to LAS.md", kind: "event", category: "accomodations", name: "TPA to LAS", date: day(-1), time: "08:30", endTime: "10:45", address: "Tampa International Airport", imageSrc: photo("#7aa7d9", "#c9dcf2") },
	{ id: "legacy:b", origin: "legacy", source: "note", path: "Places/Sam's Town Mystic Falls Park.md", kind: "event", category: "sight", name: "Sam's Town Mystic Falls Park", date: day(1), time: "20:00", coords: "36.112942652519465, -115.06228204571323", notes: "📅Monday - Thursday: 6pm, 8pm, 10pm\n📅Friday - Sunday: 4pm, 6pm, 8pm, 10pm", rating: "🩷", website: "https://samstownlv.boydgaming.com", imageSrc: photo("#2f8f6b", "#a6e3c9") },
	{ id: "legacy:c", origin: "legacy", source: "note", path: "Places/Downtown Container Park.md", kind: "place", category: "shopping", name: "Downtown Container Park", address: "707 E Fremont St" },
];

const vault = {
	read: async () => data,
	change: async (_t: TFile, fn: (d: TravelData) => TravelData) => { data = fn(data); },
	linkedNotes: () => legacy,
	noteDetails: (p: string) => legacy.find(l => l.path === p) ?? null,
	frontmatter: () => ({ Date: day(-1), End_Date: day(3), tags: ["travel"] }),
	candidateNotes: () => [],
	noteMatches: () => [
		{ path: "Places/Sam's Town Mystic Falls Park.md", name: "Sam's Town Mystic Falls Park", kind: "place", category: "sight", folder: "Places" },
		{ path: "Places/Sam's Town Hotel.md", name: "Sam's Town Hotel", kind: "place", category: "accomodations", folder: "Places" },
		{ path: "Places/Samurai Sushi.md", name: "Samurai Sushi", kind: "place", category: "food", folder: "Places/Las Vegas" },
	],
} as unknown as TripVault;

const host: PlannerHost = {
	app: { workspace: { getLeaf: () => ({ openFile: async () => {} }) } } as unknown as PlannerHost["app"],
	vault,
	getSettings: () => DEFAULT_SETTINGS,
	tabMemory: new Map(),
};

const params = new URLSearchParams(location.search);
const tab = (params.get("tab") ?? "confirmed") as TabId;
const root = document.getElementById("root") as HTMLElement;
const full = params.get("full") === "1";
const tabs = (params.get("tabs")?.split(",") ?? ["confirmed", "ideas", "outfits", "past"]) as TabId[];
host.tabMemory.set(`${trip.path}|${tabs.join(",")}`, tab);
const planner = new Planner(host, root.createDiv({ cls: params.get("callout") ? "harness-callout" : "" }), trip, { tabs, header: full });
planner.load();
void planner.render().then(async () => {
	if (params.get("modal")) planner.add(day(1));
	const typed = params.get("type");
	if (typed) {
		const input = document.querySelector<HTMLInputElement>(".htp-name-input");
		if (input) { input.value = typed; input.dispatchEvent(new Event("input")); }
		if (params.get("pick")) document.querySelector<HTMLElement>(".suggestion-item")?.click();
		if (params.get("lookup")) {
			document.querySelector(".suggestion-container")?.remove();
			[...document.querySelectorAll<HTMLButtonElement>(".modal button")].find(b => b.textContent === "Look up")?.click();
			await new Promise(r => setTimeout(r, 50));
		}
	}
	document.body.setAttribute("data-ready", "1");
});
