import type { FileDiff } from "./index.ts";

export interface DiffChunk {
  start: number;
  end: number;
  contents: string;
}

export type DiffLineType = "added" | "removed" | "context";

export interface ParsedDiff {
  contents: string;
  chunks: DiffChunk[];
  lineCount: number;
  lineTypes: DiffLineType[];
}

export function parseUnifiedDiff(diff: FileDiff): ParsedDiff {
  const lines = diff.unifiedDiff.split("\n");
  const hhIndex = lines.findIndex((l) => l.startsWith("@@"));
  const bodyLines = lines
    .slice(hhIndex + 1)
    .filter((l) => !l.startsWith("\\ No newline at end of file"));

  // Drop trailing empty line produced by the split
  if (bodyLines.length > 0 && bodyLines[bodyLines.length - 1] === "") {
    bodyLines.pop();
  }

  const contents = bodyLines.join("\n");

  const chunks: DiffChunk[] = [];
  let chunkStart = -1;

  for (let i = 0; i < bodyLines.length; i++) {
    const isChanged = bodyLines[i]!.startsWith("+") || bodyLines[i]!.startsWith("-");

    if (isChanged) {
      if (chunkStart === -1) {
        chunkStart = i;
      }
    } else {
      if (chunkStart !== -1) {
        chunks.push({
          start: chunkStart,
          end: i - 1,
          contents: bodyLines.slice(chunkStart, i).join("\n"),
        });
        chunkStart = -1;
      }
    }
  }

  // Flush a chunk that extends to the last line
  if (chunkStart !== -1) {
    chunks.push({
      start: chunkStart,
      end: bodyLines.length - 1,
      contents: bodyLines.slice(chunkStart).join("\n"),
    });
  }

  const lineTypes: DiffLineType[] = bodyLines.map((line) => {
    if (line.startsWith("+")) return "added";
    if (line.startsWith("-")) return "removed";
    return "context";
  });

  return { contents, chunks, lineCount: bodyLines.length, lineTypes };
}
