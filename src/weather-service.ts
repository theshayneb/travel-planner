/**
 * Fetches and caches trip weather. Cached per location for a few hours on this device (Obsidian's per-vault local
 * storage), so opening a trip doesn't hit the network every time. Weather is never written into notes.
 */
import { App, requestUrl } from "obsidian";
import { DayWeather, forecastUrl, geocodeUrl, parseForecast, parseLocation, pickPlace, TempUnit } from "./weather";

const TTL = 3 * 60 * 60 * 1000;
const RETRY_AFTER_FAILURE = 10 * 60 * 1000;
const STORE_PREFIX = "htp-weather:";

interface Entry {
	at: number;
	days: Record<string, DayWeather> | null;
}

function isEntry(v: unknown): v is Entry {
	return typeof v === "object" && v !== null && typeof (v as Entry).at === "number";
}

export class WeatherService {
	private readonly memory = new Map<string, Entry>();
	private readonly loading = new Map<string, Promise<Record<string, DayWeather> | null>>();

	constructor(private readonly app: App) {}

	private key(location: string, unit: TempUnit): string {
		return `${location.trim().toLowerCase()}|${unit}`;
	}

	private fresh(entry: Entry | undefined): entry is Entry {
		if (!entry) return false;
		return Date.now() - entry.at < (entry.days ? TTL : RETRY_AFTER_FAILURE);
	}

	/** Cached weather for the location, or undefined when it still needs fetching (null: known to be unavailable). */
	cached(location: string, unit: TempUnit): Record<string, DayWeather> | null | undefined {
		const key = this.key(location, unit);
		let entry = this.memory.get(key);
		if (!entry) {
			const stored: unknown = this.app.loadLocalStorage(STORE_PREFIX + key);
			if (isEntry(stored)) this.memory.set(key, (entry = stored));
		}
		return this.fresh(entry) ? entry.days : undefined;
	}

	/** Fetches once per location at a time; resolves to null when the place or forecast can't be found. */
	load(location: string, unit: TempUnit): Promise<Record<string, DayWeather> | null> {
		const key = this.key(location, unit);
		const running = this.loading.get(key);
		if (running) return running;
		const job = this.fetch(location, unit)
			.catch(() => null)
			.then(days => {
				const entry: Entry = { at: Date.now(), days };
				this.memory.set(key, entry);
				this.app.saveLocalStorage(STORE_PREFIX + key, entry);
				this.loading.delete(key);
				return days;
			});
		this.loading.set(key, job);
		return job;
	}

	private async fetch(location: string, unit: TempUnit): Promise<Record<string, DayWeather> | null> {
		const place = parseLocation(location);
		if (!place) return null;
		let coords: [number, number] | null;
		if ("coords" in place) coords = place.coords;
		else coords = pickPlace((await requestUrl({ url: geocodeUrl(place.name) })).json, place.hints);
		if (!coords) return null;
		const days = parseForecast((await requestUrl({ url: forecastUrl(coords[0], coords[1], unit) })).json);
		return Object.keys(days).length ? days : null;
	}
}
