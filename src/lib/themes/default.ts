import { colord } from "colord";

// ── Tokyo Night palette ──────────────────────────────────────
const palette = {
  red: "#f7768e",
  orange: "#ff9e64",
  yellow: "#e0af68",
  green: "#9ece6a",
  teal: "#73daca",
  cyan: "#7dcfff",
  blue: "#7aa2f7",
  magenta: "#bb9af7",
  pink: "#c0caf5",
  text: "#c0caf5",
  subtext1: "#a9b1d6",
  subtext0: "#9aa5ce",
  overlay2: "#787c99",
  overlay1: "#565f89",
  overlay0: "#414868",
  surface2: "#3b4261",
  surface1: "#292e42",
  surface0: "#24283b",
  base: "#1a1b26",
  mantle: "#16161e",
  crust: "#13131a",
} as const;

// ── Semantic theme tokens ────────────────────────────────────
export const theme = {
  // Text
  text: palette.text,
  textMuted: palette.overlay1,
  textSubtle: palette.subtext0,

  // Surfaces
  bg: palette.base,
  bgAlt: palette.mantle,
  bgDim: palette.crust,
  surface: palette.surface0,

  // Borders
  border: palette.surface2,
  borderFocused: palette.blue,

  // Accent
  accent: palette.blue,
  accentAlt: palette.magenta,

  // Status
  added: palette.green,
  removed: palette.red,
  modified: palette.yellow,

  // Selection (select component)
  selectBg: palette.surface0,
  selectText: palette.text,
  selectDescriptionColor: palette.overlay1,
  selectFocusedBg: palette.base,
  selectFocusedText: palette.text,
  selectSelectedDescriptionColor: palette.overlay2,

  // Diff sign colors
  diffAddedBg: colord(palette.green).saturate(100).alpha(0.08).toHex(),
  diffRemovedBg: colord(palette.red).saturate(100).alpha(0.08).toHex(),
  diffAddedSign: palette.green,
  diffRemovedSign: palette.red,

  // Scrollbar
  scrollTrack: palette.surface0,
  scrollThumb: palette.surface2,

  // Syntax (used by syntax/style.ts)
  syntax: {
    keyword: palette.magenta,
    operator: palette.cyan,
    type: palette.yellow,
    function: palette.blue,
    variable: palette.text,
    variableBuiltin: palette.red,
    parameter: palette.orange,
    property: palette.teal,
    string: palette.green,
    escape: palette.pink,
    regex: palette.orange,
    number: palette.orange,
    constant: palette.orange,
    comment: palette.overlay1,
    punctuation: palette.overlay2,
    tag: palette.magenta,
    tagAttribute: palette.yellow,
    tagDelimiter: palette.overlay1,
    module: palette.yellow,
    label: palette.cyan,
    attribute: palette.yellow,
    embedded: palette.text,
  },
} as const;
