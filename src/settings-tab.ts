import { App, PluginSettingTab, Setting } from "obsidian";
import type TravelPlannerPlugin from "./main";
import { MapsProvider, PropertyNames } from "./settings-model";

const PROPERTY_LABELS: [keyof PropertyNames, string, string][] = [
	["date", "Start date and time", "Trip start date, and when a place or event is scheduled."],
	["endDate", "End date and time", "Trip end date, and when an event ends."],
	["projects", "Trip link", "Property that links places and events to their trip. New notes get the trip added here."],
	["address", "Address", ""],
	["coords", "Coordinates", "Latitude and longitude, used for the map link."],
	["website", "Website", ""],
	["phone", "Phone", ""],
	["notes", "Notes", ""],
	["image", "Image", "Shown as the card thumbnail."],
	["rating", "Rating", ""],
	["menu", "Menu", "Written when an inline restaurant is converted to a note."],
	["location", "Trip location", "On the trip note: a city (e.g. Reno, NV) or coordinates, for the weather."],
	["dates", "Outfit dates", "On outfit, make-up and accessory notes: links to the daily notes they're for."],
	["subType", "Make-up type", "On make-up notes: eyeshadow, eyeliner, lipstick and so on."],
	["hours", "Opening hours", "Written when an inline place is converted to a note."],
];

export class PlannerSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: TravelPlannerPlugin) {
		super(app, plugin);
	}

	display(): void {
		const el = this.containerEl;
		el.empty();
		const s = this.plugin.config;
		const save = () => void this.plugin.saveSettings();
		const text = (name: string, desc: string, get: () => string, set: (v: string) => void, placeholder = "") =>
			new Setting(el).setName(name).setDesc(desc).addText(t => t.setPlaceholder(placeholder).setValue(get()).onChange(v => {
				set(v.trim());
				save();
			}));

		new Setting(el).setName("Recognising notes").setHeading();
		text("Trip tag", "Notes with this tag in their properties are trips.", () => s.tripTag, v => (s.tripTag = v || "travel"));
		text("Not a trip if tagged", "Comma-separated. A flight tagged both travel and event is an event, not a trip.", () => s.tripExcludeTags, v => (s.tripExcludeTags = v));
		text("Place tag", "", () => s.placeTag, v => (s.placeTag = v || "place"));
		text("Event tag", "", () => s.eventTag, v => (s.eventTag = v || "event"));
		text("Ignore notes tagged", "Comma-separated.", () => s.excludeTags, v => (s.excludeTags = v));
		text("Ignore folders", "Comma-separated folder names, e.g. templates.", () => s.excludeFolders, v => (s.excludeFolders = v));

		new Setting(el).setName("Property names").setHeading();
		for (const [key, name, desc] of PROPERTY_LABELS) {
			text(name, desc, () => s.props[key], v => (s.props[key] = v));
		}

		new Setting(el).setName("Planner").setHeading();
		new Setting(el).setName("Maps").setDesc("Where the map link opens.").addDropdown(d => d
			.addOption("google", "Google")
			.addOption("apple", "Apple")
			.addOption("geo", "Device maps app (Android)")
			.setValue(s.mapsProvider)
			.onChange(v => {
				s.mapsProvider = v as MapsProvider;
				save();
			}));
		new Setting(el)
			.setName("Look up places online")
			.setDesc("Show a look up button in the add form. It searches an online map only when you tap it, and fills nothing until you confirm the right place.")
			.addToggle(t => t.setValue(s.lookupEnabled).onChange(v => {
				s.lookupEnabled = v;
				save();
			}));
		new Setting(el).setName("Outfits tab").setDesc("Show the outfits tab, powered by your existing base.").addToggle(t => t.setValue(s.showOutfitsTab).onChange(v => {
			s.showOutfitsTab = v;
			save();
		}));
		text("Outfits embed", "Rendered as if it sat in the trip note. Leave the default to keep your existing view.", () => s.outfitsEmbed, v => (s.outfitsEmbed = v));

		new Setting(el).setName("Outfits and weather").setHeading();
		new Setting(el).setName("Outfit under each day").setDesc("Show each day's outfit card under its plans, and leave out the separate outfits tab.").addToggle(t => t.setValue(s.outfitsUnderDays).onChange(v => {
			s.outfitsUnderDays = v;
			save();
		}));
		text("Outfit tag", "", () => s.outfitTag, v => (s.outfitTag = v || "outfit"));
		new Setting(el)
			.setName("Outfit icons")
			.setDesc("Small icons under the outfit, one per line: tag | type | icon, or tag | icon. The first line that matches a note is used.")
			.addTextArea(t => {
				t.setValue(s.outfitExtras).onChange(v => {
					s.outfitExtras = v;
					save();
				});
				t.inputEl.rows = 7;
			});
		new Setting(el).setName("Weather").setDesc("Show each day's forecast beside its first time. Uses the trip's location and a free online forecast; nothing is written to notes.").addToggle(t => t.setValue(s.showWeather).onChange(v => {
			s.showWeather = v;
			save();
		}));
		new Setting(el).setName("Temperature").addDropdown(d => d
			.addOption("fahrenheit", "Fahrenheit")
			.addOption("celsius", "Celsius")
			.setValue(s.weatherUnit)
			.onChange(v => {
				s.weatherUnit = v === "celsius" ? "celsius" : "fahrenheit";
				save();
			}));

		new Setting(el).setName("Converting to notes").setHeading();
		text("Folder for new notes", "Leave empty to create them next to the trip note.", () => s.newNoteFolder, v => (s.newNoteFolder = v), "Travel/Places");
		text("Template", "Optional note whose contents start each new note. Its properties are kept and filled in.", () => s.newNoteTemplate, v => (s.newNoteTemplate = v), "Templates/Place.md");
	}
}
