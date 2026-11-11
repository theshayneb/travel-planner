// Screenshots of the planner in Chromium: node test/harness/run.mjs <out-dir>
import esbuild from "esbuild";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// Playwright is preinstalled globally in CI images and cloud sessions; install it locally otherwise.
const { chromium } = createRequire(import.meta.url)("playwright");

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const out = resolve(process.argv[2] ?? join(root, "screenshots"));
mkdirSync(out, { recursive: true });

const iconDir = join(root, "node_modules/lucide-static/icons");
const icons = Object.fromEntries(readdirSync(iconDir).filter(f => f.endsWith(".svg")).map(f => [f.slice(0, -4), readFileSync(join(iconDir, f), "utf8")]));
const bundle = await esbuild.build({
	entryPoints: [join(here, "entry.ts")], bundle: true, write: false, format: "iife", platform: "browser", target: "es2022",
	alias: { obsidian: join(here, "obsidian.ts") }, logLevel: "warning",
});
const used = new Set([...readFileSync(join(root, "src/planner.ts"), "utf8").matchAll(/"([a-z0-9-]+)"/g), ...readFileSync(join(root, "src/model.ts"), "utf8").matchAll(/icon: "([a-z0-9-]+)"/g), ...readFileSync(join(root, "src/weather.ts"), "utf8").matchAll(/"([a-z0-9-]+)"/g), ...["arrow-up", "arrow-down", "droplet"].map(n => [null, n])].map(m => m[1]));
const iconMap = Object.fromEntries([...used].filter(n => icons[n]).map(n => [n, icons[n]]));
const html = `<!doctype html><meta charset="utf-8"><style>${readFileSync(join(here, "theme.css"), "utf8")}\n${readFileSync(join(root, "styles.css"), "utf8")}</style>
<body><div id="root"></div><script>window.ICONS=${JSON.stringify(iconMap)}</script><script>${bundle.outputFiles[0].text}</script>`;
const page = join(out, "harness.html");
writeFileSync(page, html);

const browser = await chromium.launch();
const shots = [
	["phone-confirmed", 412, "tab=confirmed", false],
	["phone-ideas", 412, "tab=ideas", false],
	["phone-past-dark", 412, "tab=past", true],
	["phone-outfits", 412, "tab=outfits", false],
	["phone-add-modal", 412, "tab=confirmed&modal=1", false],
	["phone-add-modal-search", 412, "tab=confirmed&modal=1&type=sam", false],
	["phone-add-modal-lookup", 412, "tab=confirmed&modal=1&type=Lotus%20of%20Siam&lookup=1", false],
	["phone-add-modal-picked-dark", 412, "tab=confirmed&modal=1&type=sam&pick=1", true],
	["column-confirmed-in-callout", 560, "tab=confirmed&tabs=confirmed&callout=1", false],
	["embedded-full-in-note", 640, "tab=confirmed&embedfull=1&callout=1", true],
	["desktop-full-confirmed", 1000, "tab=confirmed&full=1", false],
	["desktop-full-confirmed-dark", 1000, "tab=confirmed&full=1", true],
];
const errors = [];
for (const [name, width, query, dark] of shots) {
	const p = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
	p.on("pageerror", e => errors.push(`${name}: ${e.message}`));
	p.on("console", m => { if (m.type() === "error") errors.push(`${name}: ${m.text()}`); });
	await p.goto(`file://${page}?${query}`);
	if (dark) await p.evaluate(() => document.body.classList.add("theme-dark"));
	await p.waitForSelector("body[data-ready]");
	const missing = await p.$$eval('b[title^="missing icon"]', els => els.map(e => e.title));
	if (missing.length) errors.push(`${name}: ${[...new Set(missing)].join(", ")}`);
	await p.screenshot({ path: join(out, `${name}.png`), fullPage: true });
	await p.close();
}
await browser.close();
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`Saved ${shots.length} screenshots to ${out}`);
