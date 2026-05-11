const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: ["main.ts"],
    bundle: true,
    platform: "browser",
    target: "ES2020",
    outfile: "main.js",
    external: ["obsidian"],
    format: "cjs",
  })
  .catch(() => process.exit(1));
