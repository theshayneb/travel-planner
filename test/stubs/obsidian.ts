// The few runtime values of the "obsidian" module that unit-tested code imports. Types come from the real package.
export function normalizePath(path: string): string {
	return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
}
export class TFile {}
export async function requestUrl(): Promise<never> {
	throw new Error("No network in unit tests.");
}
