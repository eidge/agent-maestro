import { SyntaxStyle, type ThemeTokenStyle } from "@opentui/core";
import { theme } from "../styles/default";

const syntaxTheme: ThemeTokenStyle[] = [
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
    style: { foreground: theme.syntax.keyword },
  },
  {
    scope: ["keyword.operator"],
    style: { foreground: theme.syntax.operator },
  },

  // ── Types ────────────────────────────────────────────────────────
  {
    scope: ["type", "type.builtin", "type.definition"],
    style: { foreground: theme.syntax.type },
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
    style: { foreground: theme.syntax.function },
  },

  // ── Variables & properties ───────────────────────────────────────
  {
    scope: ["variable"],
    style: { foreground: theme.syntax.variable },
  },
  {
    scope: ["variable.builtin"],
    style: { foreground: theme.syntax.variableBuiltin },
  },
  {
    scope: ["variable.parameter"],
    style: { foreground: theme.syntax.parameter },
  },
  {
    scope: ["variable.member", "property", "property.definition", "field"],
    style: { foreground: theme.syntax.property },
  },

  // ── Strings ──────────────────────────────────────────────────────
  {
    scope: ["string", "string.special"],
    style: { foreground: theme.syntax.string },
  },
  {
    scope: ["string.escape"],
    style: { foreground: theme.syntax.escape },
  },
  {
    scope: ["string.regex"],
    style: { foreground: theme.syntax.regex },
  },

  // ── Numbers & booleans ───────────────────────────────────────────
  {
    scope: ["number", "number.float", "boolean", "float"],
    style: { foreground: theme.syntax.number },
  },

  // ── Constants ────────────────────────────────────────────────────
  {
    scope: ["constant", "constant.builtin"],
    style: { foreground: theme.syntax.constant },
  },

  // ── Comments ─────────────────────────────────────────────────────
  {
    scope: ["comment"],
    style: { foreground: theme.syntax.comment, italic: true },
  },

  // ── Operators & punctuation ──────────────────────────────────────
  {
    scope: ["operator"],
    style: { foreground: theme.syntax.operator },
  },
  {
    scope: ["punctuation", "punctuation.bracket", "punctuation.delimiter"],
    style: { foreground: theme.syntax.punctuation },
  },
  {
    scope: ["punctuation.special"],
    style: { foreground: theme.syntax.operator },
  },

  // ── Tags (JSX / HTML) ───────────────────────────────────────────
  {
    scope: ["tag"],
    style: { foreground: theme.syntax.tag },
  },
  {
    scope: ["tag.attribute"],
    style: { foreground: theme.syntax.tagAttribute },
  },
  {
    scope: ["tag.delimiter"],
    style: { foreground: theme.syntax.tagDelimiter },
  },

  // ── Modules & namespaces ─────────────────────────────────────────
  {
    scope: ["module", "namespace"],
    style: { foreground: theme.syntax.module },
  },

  // ── Labels & special ─────────────────────────────────────────────
  {
    scope: ["label", "constructor"],
    style: { foreground: theme.syntax.label },
  },
  {
    scope: ["attribute"],
    style: { foreground: theme.syntax.attribute },
  },

  // ── Embedded / injection ─────────────────────────────────────────
  {
    scope: ["embedded"],
    style: { foreground: theme.syntax.embedded },
  },
];

export const syntaxStyle = SyntaxStyle.fromTheme(syntaxTheme);
