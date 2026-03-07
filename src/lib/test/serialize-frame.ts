import type { CapturedFrame, CapturedLine, CapturedSpan } from "@opentui/core";
import { rgbToHex, type RGBA } from "@opentui/core";

/**
 * Serialize an RGBA color to a compact hex string.
 * Returns "none" for fully transparent colors (a === 0).
 */
function colorToHex(color: RGBA): string {
  if (color.a === 0) return "none";
  return rgbToHex(color);
}

/**
 * Strip trailing spans that are purely whitespace or scrollbar fill.
 * The scrollbar thumb (`█`) and track padding are rendering artifacts
 * that add noise to snapshots.
 */
function trimTrailingSpans(spans: CapturedSpan[]): CapturedSpan[] {
  const result = [...spans];
  while (result.length > 0) {
    const last = result[result.length - 1]!;
    // Drop spans that are only whitespace or block characters (scrollbar)
    if (/^[\s█░▒▓]*$/.test(last.text)) {
      result.pop();
    } else {
      break;
    }
  }
  return result;
}

/**
 * Check whether a line is visually empty (no meaningful text content).
 */
function isEmptyLine(line: CapturedLine): boolean {
  return trimTrailingSpans(line.spans).length === 0;
}

/**
 * Drop trailing empty lines from the frame so snapshots don't include
 * viewport padding.
 */
function trimTrailingEmptyLines(lines: CapturedLine[]): CapturedLine[] {
  const result = [...lines];
  while (result.length > 0 && isEmptyLine(result[result.length - 1]!)) {
    result.pop();
  }
  return result;
}

/**
 * Serialize a CapturedFrame into a plain-text string with no color info.
 *
 * - Strips scrollbar and trailing padding spans from each line
 * - Drops trailing empty lines (viewport fill)
 * - Right-trims each line
 *
 * Output looks like the raw terminal text:
 * ```
 *  1   function greet(name: string) {
 *  2 -   return "hello " + name;
 *  2 +   return `hello ${name}`;
 *  3   }
 * ```
 */
export function serializeFrameText(frame: CapturedFrame): string {
  const lines = trimTrailingEmptyLines(frame.lines);

  return lines
    .map((line) => {
      const spans = trimTrailingSpans(line.spans);
      return spans
        .map((s) => s.text)
        .join("")
        .trimEnd();
    })
    .join("\n");
}

/**
 * Serialize a CapturedFrame with per-span color annotations.
 *
 * Each line is rendered as a sequence of annotated spans:
 * ```
 * [fg:#888888] 1  [fg:#f7768e] - [bg:#14080a] return "hello " + name;
 * [fg:#888888] 1  [fg:#9ece6a] + [bg:#0c1404] return `hello ${name}`;
 * ```
 *
 * Only non-default colors are shown (`fg:` when not "none", `bg:` when not "none").
 * Spans with no color info are rendered as plain text.
 * Scrollbar and trailing padding are stripped.
 * Trailing empty lines are dropped.
 */
export function serializeFrameStyled(frame: CapturedFrame): string {
  const lines = trimTrailingEmptyLines(frame.lines);

  return lines
    .map((line) => {
      const spans = trimTrailingSpans(line.spans);

      return spans
        .map((span) => {
          const fg = colorToHex(span.fg);
          const bg = colorToHex(span.bg);

          const parts: string[] = [];
          if (fg !== "none") parts.push(`fg:${fg}`);
          if (bg !== "none") parts.push(`bg:${bg}`);

          if (parts.length === 0) return span.text;
          return `[${parts.join(" ")}]${span.text}`;
        })
        .join("")
        .trimEnd();
    })
    .join("\n");
}
