import { SyntaxStyle, type ThemeTokenStyle } from "@opentui/core";

/**
 * Tokyo Night–inspired syntax theme for tree-sitter highlight scopes.
 */
const tokyoNight: ThemeTokenStyle[] = [
  // ── Keywords & control flow ──────────────────────────────────────
  {
    scope: [
      "keyword",
      "keyword.function",
      "keyword.return",
      "keyword.import",
      "keyword.conditional",
      "keyword.repeat",
      "keyword.exception",
    ],
    style: { foreground: "#9d7cd8" },
  },
  {
    scope: ["keyword.operator"],
    style: { foreground: "#89ddff" },
  },

  // ── Types ────────────────────────────────────────────────────────
  {
    scope: ["type", "type.builtin", "type.definition"],
    style: { foreground: "#2ac3de" },
  },

  // ── Functions & methods ──────────────────────────────────────────
  {
    scope: [
      "function",
      "function.call",
      "function.builtin",
      "function.method",
      "function.method.call",
      "method",
      "method.call",
    ],
    style: { foreground: "#7aa2f7" },
  },

  // ── Variables & properties ───────────────────────────────────────
  {
    scope: ["variable"],
    style: { foreground: "#c0caf5" },
  },
  {
    scope: ["variable.builtin"],
    style: { foreground: "#f7768e" },
  },
  {
    scope: ["variable.parameter"],
    style: { foreground: "#e0af68" },
  },
  {
    scope: ["variable.member", "property", "property.definition", "field"],
    style: { foreground: "#73daca" },
  },

  // ── Strings ──────────────────────────────────────────────────────
  {
    scope: ["string", "string.special"],
    style: { foreground: "#9ece6a" },
  },
  {
    scope: ["string.escape"],
    style: { foreground: "#89ddff" },
  },
  {
    scope: ["string.regex"],
    style: { foreground: "#e0af68" },
  },

  // ── Numbers & booleans ───────────────────────────────────────────
  {
    scope: ["number", "number.float", "boolean", "float"],
    style: { foreground: "#ff9e64" },
  },

  // ── Constants ────────────────────────────────────────────────────
  {
    scope: ["constant", "constant.builtin"],
    style: { foreground: "#ff9e64" },
  },

  // ── Comments ─────────────────────────────────────────────────────
  {
    scope: ["comment"],
    style: { foreground: "#565f89", italic: true },
  },

  // ── Operators & punctuation ──────────────────────────────────────
  {
    scope: ["operator"],
    style: { foreground: "#89ddff" },
  },
  {
    scope: ["punctuation", "punctuation.bracket", "punctuation.delimiter"],
    style: { foreground: "#a9b1d6" },
  },
  {
    scope: ["punctuation.special"],
    style: { foreground: "#89ddff" },
  },

  // ── Tags (JSX / HTML) ───────────────────────────────────────────
  {
    scope: ["tag"],
    style: { foreground: "#f7768e" },
  },
  {
    scope: ["tag.attribute"],
    style: { foreground: "#7aa2f7" },
  },
  {
    scope: ["tag.delimiter"],
    style: { foreground: "#565f89" },
  },

  // ── Modules & namespaces ─────────────────────────────────────────
  {
    scope: ["module", "namespace"],
    style: { foreground: "#2ac3de" },
  },

  // ── Labels & special ─────────────────────────────────────────────
  {
    scope: ["label", "constructor"],
    style: { foreground: "#2ac3de" },
  },
  {
    scope: ["attribute"],
    style: { foreground: "#e0af68" },
  },

  // ── Embedded / injection ─────────────────────────────────────────
  {
    scope: ["embedded"],
    style: { foreground: "#c0caf5" },
  },
];

export const syntaxStyle = SyntaxStyle.fromTheme(tokyoNight);
