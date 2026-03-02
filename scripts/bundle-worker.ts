/**
 * Pre-bundle the @opentui/core parser worker so that `web-tree-sitter` JS
 * code is inlined. This makes the worker self-contained when embedded inside
 * a `bun build --compile` binary (where `node_modules` is not available).
 *
 * The tree-sitter WASM binary (~205 KB) is base64-encoded and embedded
 * directly in the bundled worker. At runtime the worker decodes it and passes
 * it to `Parser.init({ wasmBinary })`, completely avoiding filesystem-based
 * WASM resolution which breaks inside Bun's `/$bunfs` virtual filesystem.
 */

import { mkdirSync } from "fs";

const WORKER_SRC = "node_modules/@opentui/core/parser.worker.js";
const WASM_SRC = "node_modules/web-tree-sitter/tree-sitter.wasm";
const OUT_DIR = "dist/worker";
const OUT_FILE = `${OUT_DIR}/parser.worker.bundled.js`;

mkdirSync(OUT_DIR, { recursive: true });

// Bundle the worker with all JS dependencies inlined (including web-tree-sitter).
const result = await Bun.build({
  entrypoints: [WORKER_SRC],
  outdir: OUT_DIR,
  target: "bun",
  naming: {
    asset: "[name].[ext]",
  },
});

if (!result.success) {
  console.error("Worker bundling failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

// Rename the output to our expected filename.
const jsOutput = result.outputs.find((o) => o.path.endsWith(".js"));
if (jsOutput && !jsOutput.path.endsWith("parser.worker.bundled.js")) {
  const { rename } = await import("fs/promises");
  await rename(jsOutput.path, OUT_FILE);
}

// Read the WASM binary and encode it as base64.
const wasmBytes = await Bun.file(WASM_SRC).arrayBuffer();
const wasmBase64 = Buffer.from(wasmBytes).toString("base64");

let code = await Bun.file(OUT_FILE).text();

// 1) Replace the WASM path module with an embedded base64 constant.
//    The bundler outputs a __commonJS wrapper that returns "./tree-sitter.wasm";
//    we replace that entire wrapper with a decoded Buffer.
code = code.replace(
  /\/\/ node_modules\/web-tree-sitter\/tree-sitter\.wasm\nvar require_tree_sitter = __commonJS\(\(exports, module2\) => \{\n {2}module2\.exports = [^\n]+\n\}\);/,
  `var __embedded_tree_sitter_wasm = Buffer.from("${wasmBase64}", "base64");`,
);

// 2) Replace the Parser.init section to pass wasmBinary directly instead of
//    using locateFile (which needs a valid filesystem path).
code = code.replace(
  [
    `        let { default: treeWasm } = await Promise.resolve().then(() => __toESM(require_tree_sitter(), 1));`,
    `        if (isBunfsPath(treeWasm)) {`,
    `          treeWasm = normalizeBunfsPath(path2.parse(treeWasm).base);`,
    `        }`,
    `        await Parser.init({`,
    `          locateFile() {`,
    `            return treeWasm;`,
    `          }`,
    `        });`,
  ].join("\n"),
  `        await Parser.init({ wasmBinary: __embedded_tree_sitter_wasm });`,
);

await Bun.write(OUT_FILE, code);

// Clean up the separate WASM asset that the bundler emitted (no longer needed).
const { unlink } = await import("fs/promises");
await unlink(`${OUT_DIR}/tree-sitter.wasm`).catch(() => {});

console.log(`Bundled worker → ${OUT_FILE} (${(code.length / 1024).toFixed(0)} KB, WASM embedded)`);
