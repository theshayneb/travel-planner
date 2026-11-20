// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { TFile } from "obsidian";
import { localDate } from "../src/itinerary";
import { Planner, PlannerHost } from "../src/planner";
import { DEFAULT_SETTINGS } from "../src/settings-model";
import { TravelData } from "../src/model";
import { TripVault } from "../src/vault";

const today = localDate(new Date());

/** A planner showing one trip day with an activity, two outfits and a lipstick, like a real Trip note. */
async function renderPlanner(opened: string[]) {
	const trip = new TFile("Trips/Vegas.md");
	const data: TravelData = { version: 1, items: [{ id: "a", source: "inline", kind: "place", category: "food", name: "Lotus of Siam", date: today, time: "18:00" }] };
	const files = new Map<string, TFile>();
	const vault = {
		read: async () => data,
		linkedNotes: () => [],
		noteDetails: () => null,
		frontmatter: () => ({ Date: today, End_Date: today, tags: ["travel"] }),
		outfitNotes: () => [
			{ path: "Wardrobe/Concert night (2026-11-22).md", name: "Concert night (2026-11-22)", fm: { tags: ["outfit"], Dates: [`[[${today}]]`] }, image: "app://photo.png" },
			{ path: "Wardrobe/Pool day.md", name: "Pool day", fm: { tags: ["outfit"], Dates: [`[[${today}]]`] } },
			{ path: "Wardrobe/Red lip.md", name: "Red lip", fm: { tags: ["make-up"], Sub_Type: "lipstick", Dates: [`[[${today}]]`] } },
		],
	} as unknown as TripVault;
	const host: PlannerHost = {
		app: {
			vault: { getFileByPath: (p: string) => files.get(p) ?? (files.set(p, new TFile(p)), files.get(p)) },
			workspace: { getLeaf: () => ({ openFile: async (f: TFile) => void opened.push(f.path) }) },
		} as unknown as PlannerHost["app"],
		vault,
		getSettings: () => ({ ...DEFAULT_SETTINGS, showWeather: false }),
		weather: {} as PlannerHost["weather"],
		tabMemory: new Map(),
	};
	const el = document.body.createDiv();
	const planner = new Planner(host, el, trip, { tabs: ["confirmed"], header: false });
	planner.load();
	await planner.render();
	return el;
}

describe("the outfit in the itinerary opens the outfit's note", () => {
	afterEach(() => document.body.empty());

	it("from the photo, without the click reaching image viewers", async () => {
		const opened: string[] = [];
		const el = await renderPlanner(opened);
		let imageViewer = 0;
		document.addEventListener("click", e => {
			if ((e.target as HTMLElement).closest("img")) imageViewer++;
		});
		const img = el.querySelector<HTMLImageElement>(".htp-outfit-photo img");
		expect(img).not.toBeNull();
		img?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(opened).toEqual(["Wardrobe/Concert night (2026-11-22).md"]);
		expect(imageViewer).toBe(0);
	});

	it("from the outfit's name under the photo, shown without the trailing date", async () => {
		const opened: string[] = [];
		const el = await renderPlanner(opened);
		const title = el.querySelector<HTMLButtonElement>(".htp-outfit-title");
		expect(title?.textContent).toBe("Concert night");
		title?.click();
		expect(opened).toEqual(["Wardrobe/Concert night (2026-11-22).md"]);
	});

	it("from the other outfits and the accessory icons", async () => {
		const opened: string[] = [];
		const el = await renderPlanner(opened);
		el.querySelector<HTMLButtonElement>(".htp-outfit-more")?.click();
		el.querySelector<HTMLButtonElement>(".htp-outfit-extra")?.click();
		expect(opened).toEqual(["Wardrobe/Pool day.md", "Wardrobe/Red lip.md"]);
	});
});
