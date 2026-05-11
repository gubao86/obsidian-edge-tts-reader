const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: ["main.ts"],
    bundle: true,
    platform: "node",
    target: "ES2020",
    outfile: "main.js",
    external: ["obsidian", "electron"],
    format: "cjs",
    logLevel: "info",
  })
  .catch(() => process.exit(1));
