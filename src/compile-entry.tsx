/**
 * Build entrypoint for `bun build --compile`.
 *
 * Bun's compiler can only auto-embed Worker files when it sees the exact
 * pattern `new Worker(new URL("…", import.meta.url))`. The @opentui/core
 * library resolves the worker path through a variable, so the bundler misses
 * it. We fix that here by explicitly importing the worker file (which embeds
 * it into the binary via the `{ type: "file" }` import attribute) and
 * exposing the path through the global that the library checks at runtime.
 */

// Embed the tree-sitter parser worker into the compiled binary.
// Use a direct path — the package exports map points to a non-existent location.
import workerPath from "../node_modules/@opentui/core/parser.worker.js" with { type: "file" };
(globalThis as Record<string, unknown>).OTUI_TREE_SITTER_WORKER_PATH = workerPath;

// Now load the real application.
await import("./index.tsx");
