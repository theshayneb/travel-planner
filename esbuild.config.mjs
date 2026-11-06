// Bundles src/main.ts into main.js. `node esbuild.config.mjs` watches; `... production` builds once.
import esbuild from "esbuild";

const prod = process.argv[2] === "production";
const ctx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*"],
  outfile: "main.js",
  legalComments: "none",
  sourcemap: prod ? false : "inline",
  logLevel: "info",
});
if (prod) { await ctx.rebuild(); await ctx.dispose(); }
else await ctx.watch();
