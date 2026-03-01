import { colord } from "colord";

// ── Catppuccin Mocha palette ─────────────────────────────────
const palette = {
  rosewater: "#f5e0dc",
  flamingo: "#f2cdcd",
  pink: "#f5c2e7",
  mauve: "#cba6f7",
  red: "#f38ba8",
  maroon: "#eba0ac",
  peach: "#fab387",
  yellow: "#f9e2af",
  green: "#a6e3a1",
  teal: "#94e2d5",
  sky: "#89dceb",
  sapphire: "#74c7ec",
  blue: "#89b4fa",
  lavender: "#b4befe",
  text: "#cdd6f4",
  subtext1: "#bac2de",
  subtext0: "#a6adc8",
  overlay2: "#9399b2",
  overlay1: "#7f849c",
  overlay0: "#6c7086",
  surface2: "#585b70",
  surface1: "#45475a",
  surface0: "#313244",
  base: "#1e1e2e",
  mantle: "#181825",
  crust: "#11111b",
} as const;

// ── Semantic theme tokens ────────────────────────────────────
export const theme = {
  // Text
  text: palette.text,
  textMuted: palette.overlay0,
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
  accentAlt: palette.lavender,

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
    keyword: palette.mauve,
    operator: palette.sky,
    type: palette.yellow,
    function: palette.blue,
    variable: palette.text,
    variableBuiltin: palette.red,
    parameter: palette.maroon,
    property: palette.teal,
    string: palette.green,
    escape: palette.pink,
    regex: palette.peach,
    number: palette.peach,
    constant: palette.peach,
    comment: palette.overlay0,
    punctuation: palette.overlay2,
    tag: palette.mauve,
    tagAttribute: palette.yellow,
    tagDelimiter: palette.overlay0,
    module: palette.yellow,
    label: palette.sapphire,
    attribute: palette.yellow,
    embedded: palette.text,
  },
} as const;
