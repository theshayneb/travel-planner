/** "Open in Maps" links. Pure. */
import { DisplayItem } from "./model";
import { parseCoords } from "./notes";
import { MapsProvider } from "./settings-model";

export function mapsUrl(item: Pick<DisplayItem, "name" | "address" | "coords">, provider: MapsProvider): string | null {
	const coords = parseCoords(item.coords);
	const query = item.address?.trim() || item.name.trim();
	if (!coords && !query) return null;
	const q = encodeURIComponent(query);
	if (provider === "apple") {
		return coords ? `https://maps.apple.com/?ll=${coords[0]},${coords[1]}&q=${encodeURIComponent(item.name)}` : `https://maps.apple.com/?q=${q}`;
	}
	if (provider === "geo") {
		// Android hands geo: links to the default maps app.
		return coords ? `geo:${coords[0]},${coords[1]}?q=${coords[0]},${coords[1]}(${encodeURIComponent(item.name)})` : `geo:0,0?q=${q}`;
	}
	return `https://www.google.com/maps/search/?api=1&query=${coords ? `${coords[0]},${coords[1]}` : q}`;
}
