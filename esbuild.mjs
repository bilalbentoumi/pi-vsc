import * as esbuild from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFile } from "node:fs/promises";
import * as sass from "sass";

const __dirname = dirname(fileURLToPath(import.meta.url));
const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const common = {
	bundle: true,
	sourcemap: !production,
	minify: production,
	logLevel: "info",
	define: {
		"process.env.NODE_ENV": production ? '"production"' : '"development"',
	},
};

// Extension host: CommonJS, Node platform, `vscode` is provided by the runtime.
const hostConfig = {
	...common,
	entryPoints: [join(__dirname, "src/extension.ts")],
	outfile: join(__dirname, "dist/extension.js"),
	platform: "node",
	format: "cjs",
	target: "node20",
	external: ["vscode"],
};

// Sass plugin for esbuild – processes .scss files through sass.
const stylePlugin = {
	name: "style",
	setup(build) {
		build.onLoad({ filter: /\.(css|scss)$/ }, async (args) => {
			let source;
			if (args.path.endsWith(".scss")) {
				const result = await sass.compileAsync(args.path, {
					loadPaths: [join(__dirname, "webview/src")],
				});
				source = result.css;
			} else {
				source = await readFile(args.path, "utf8");
			}
			return { contents: source, loader: "css" };
		});
	},
};

// Webview: browser IIFE bundle (React). No Node built-ins.
const webviewConfig = {
	...common,
	entryPoints: [join(__dirname, "webview/src/main.tsx")],
	outfile: join(__dirname, "dist/webview.js"),
	platform: "browser",
	format: "iife",
	target: "es2020",
	loader: { ".css": "css", ".scss": "css", ".svg": "text" },
	plugins: [stylePlugin],
};

async function run() {
	if (watch) {
		const hostCtx = await esbuild.context(hostConfig);
		const webCtx = await esbuild.context(webviewConfig);
		await Promise.all([hostCtx.watch(), webCtx.watch()]);
		console.log("[esbuild] watching…");
	} else {
		await Promise.all([esbuild.build(hostConfig), esbuild.build(webviewConfig)]);
		console.log("[esbuild] build complete");
	}
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
