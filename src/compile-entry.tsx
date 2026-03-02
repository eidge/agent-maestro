/**
 * Build entrypoint for `bun build --compile`.
 *
 * Bun's compiler can only auto-embed Worker files when it sees the exact
 * pattern `new Worker(new URL("…", import.meta.url))`. The @opentui/core
 * library resolves the worker path through a variable, so the bundler misses
 * it. We fix that here by explicitly importing the worker file (which embeds
 * it into the binary via the `{ type: "file" }` import attribute) and
 * exposing the path through the global that the library checks at runtime.
 *
 * The worker is pre-bundled by `scripts/bundle-worker.ts` which:
 *  1. Inlines the `web-tree-sitter` JS code (so the worker doesn't need
 *     `node_modules` at runtime).
 *  2. Embeds the `tree-sitter.wasm` binary as base64 (so it doesn't need to
 *     resolve a filesystem path for the WASM — which fails inside `/$bunfs`).
 */

// Mark this process as running from a compiled binary.
(globalThis as Record<string, unknown>).__AGENT_MAESTRO_COMPILED__ = true;

// Embed the pre-bundled tree-sitter parser worker into the compiled binary.
// @ts-expect-error — Bun-specific import attribute; TS has no declaration for this file.
import workerPath from "../dist/worker/parser.worker.bundled.js" with { type: "file" };
(globalThis as Record<string, unknown>).OTUI_TREE_SITTER_WORKER_PATH = workerPath;

// ── CLI subcommands (handled before launching the TUI) ───────────────
// In a compiled Bun binary, argv is ["bun", "/$bunfs/root/…", ...userArgs].
const args = process.argv.slice(2);

if (args[0] === "update") {
  const { performUpdate } = await import("./lib/updater.ts");
  await performUpdate();
  process.exit(0);
}

if (args[0] === "--version" || args[0] === "-v") {
  const { VERSION } = await import("./lib/version.ts");
  console.log(`agent-maestro v${VERSION}`);
  process.exit(0);
}

// Now load the real application.
await import("./index.tsx");
