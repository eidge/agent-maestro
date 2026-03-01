import type { FiletypeParserOptions } from "@opentui/core";

/**
 * GitHub release URL for a tree-sitter WASM grammar.
 */
function ghRelease(org: string, repo: string, version: string, wasmName: string): string {
  return `https://github.com/${org}/${repo}/releases/download/${version}/${wasmName}`;
}

/**
 * Raw GitHub URL for a highlight query .scm file.
 */
function ghRaw(org: string, repo: string, ref: string, path: string): string {
  return `https://raw.githubusercontent.com/${org}/${repo}/${ref}/${path}`;
}

// Shorthand for tree-sitter org repos
function tsRelease(lang: string, version: string, wasmName?: string): string {
  return ghRelease(
    "tree-sitter",
    `tree-sitter-${lang}`,
    version,
    wasmName ?? `tree-sitter-${lang}.wasm`,
  );
}

function tsHighlights(lang: string, branch = "master"): string {
  return ghRaw("tree-sitter", `tree-sitter-${lang}`, branch, "queries/highlights.scm");
}

/**
 * Additional tree-sitter parsers beyond the bundled set (javascript, typescript,
 * markdown, markdown_inline, zig). WASM grammars and highlight queries are
 * fetched from GitHub on first use and cached locally by the TreeSitterClient.
 */
export const additionalParsers: FiletypeParserOptions[] = [
  // ── tree-sitter org ──────────────────────────────────────────────
  {
    filetype: "python",
    wasm: tsRelease("python", "v0.25.0"),
    queries: { highlights: [tsHighlights("python")] },
  },
  {
    filetype: "c",
    wasm: tsRelease("c", "v0.24.1"),
    queries: { highlights: [tsHighlights("c")] },
  },
  {
    filetype: "cpp",
    wasm: tsRelease("cpp", "v0.23.4"),
    queries: { highlights: [tsHighlights("cpp")] },
  },
  {
    filetype: "java",
    wasm: tsRelease("java", "v0.23.5"),
    queries: { highlights: [tsHighlights("java")] },
  },
  {
    filetype: "go",
    wasm: tsRelease("go", "v0.25.0"),
    queries: { highlights: [tsHighlights("go")] },
  },
  {
    filetype: "rust",
    wasm: tsRelease("rust", "v0.24.0"),
    queries: { highlights: [tsHighlights("rust")] },
  },
  {
    filetype: "ruby",
    wasm: tsRelease("ruby", "v0.23.1"),
    queries: { highlights: [tsHighlights("ruby")] },
  },
  {
    filetype: "shell",
    wasm: tsRelease("bash", "v0.25.1", "tree-sitter-bash.wasm"),
    queries: { highlights: [tsHighlights("bash")] },
  },
  {
    filetype: "json",
    wasm: tsRelease("json", "v0.24.8"),
    queries: { highlights: [tsHighlights("json")] },
  },
  {
    filetype: "html",
    wasm: tsRelease("html", "v0.23.2"),
    queries: { highlights: [tsHighlights("html")] },
  },
  {
    filetype: "css",
    wasm: tsRelease("css", "v0.25.0"),
    queries: { highlights: [tsHighlights("css")] },
  },
  {
    filetype: "php",
    wasm: tsRelease("php", "v0.24.2"),
    queries: { highlights: [tsHighlights("php")] },
  },

  // ── tree-sitter-grammars org ─────────────────────────────────────
  {
    filetype: "lua",
    wasm: ghRelease("tree-sitter-grammars", "tree-sitter-lua", "v0.5.0", "tree-sitter-lua.wasm"),
    queries: {
      highlights: [
        ghRaw("tree-sitter-grammars", "tree-sitter-lua", "main", "queries/highlights.scm"),
      ],
    },
  },
  {
    filetype: "toml",
    wasm: ghRelease("tree-sitter-grammars", "tree-sitter-toml", "v0.7.0", "tree-sitter-toml.wasm"),
    queries: {
      highlights: [
        ghRaw("tree-sitter-grammars", "tree-sitter-toml", "master", "queries/highlights.scm"),
      ],
    },
  },
  {
    filetype: "yaml",
    wasm: ghRelease("tree-sitter-grammars", "tree-sitter-yaml", "v0.7.2", "tree-sitter-yaml.wasm"),
    queries: {
      highlights: [
        ghRaw("tree-sitter-grammars", "tree-sitter-yaml", "master", "queries/highlights.scm"),
      ],
    },
  },

  // ── third-party ──────────────────────────────────────────────────
  {
    filetype: "kotlin",
    wasm: ghRelease("fwcd", "tree-sitter-kotlin", "0.3.8", "tree-sitter-kotlin.wasm"),
    queries: {
      highlights: [ghRaw("fwcd", "tree-sitter-kotlin", "main", "queries/highlights.scm")],
    },
  },

  // ── JSX / TSX (use standard tree-sitter queries, NOT nvim-treesitter
  //    which relies on Neovim-specific predicates like #lua-match?) ───
  {
    filetype: "typescriptreact",
    wasm: ghRelease("tree-sitter", "tree-sitter-typescript", "v0.23.2", "tree-sitter-tsx.wasm"),
    queries: {
      highlights: [
        tsHighlights("javascript"),
        ghRaw("tree-sitter", "tree-sitter-javascript", "v0.25.0", "queries/highlights-jsx.scm"),
        ghRaw("tree-sitter", "tree-sitter-typescript", "v0.23.2", "queries/highlights.scm"),
      ],
    },
  },
  {
    filetype: "javascriptreact",
    wasm: tsRelease("javascript", "v0.25.0", "tree-sitter-javascript.wasm"),
    queries: {
      highlights: [
        tsHighlights("javascript"),
        ghRaw("tree-sitter", "tree-sitter-javascript", "v0.25.0", "queries/highlights-jsx.scm"),
      ],
    },
  },
];

/**
 * Maps a filetype string returned by `pathToFiletype()` to one that has a
 * registered parser. Returns the input unchanged when no remapping is needed.
 */
const FILETYPE_ALIASES: Record<string, string> = {
  // csharp, swift, perl, etc. have no parser registered — these will render
  // without highlighting rather than mapping to a wrong grammar.
};

export function resolveFiletype(filetype: string | undefined): string | undefined {
  if (!filetype) return undefined;
  return FILETYPE_ALIASES[filetype] ?? filetype;
}
