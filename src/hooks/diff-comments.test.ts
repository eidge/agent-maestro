import { describe, test, expect } from "bun:test";
import {
  syncCommentsForFile,
  findNearestMatch,
  markOrphanedComments,
  type DiffComment,
  type LineSnapshot,
} from "./diff-comments";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeComment(overrides: Partial<DiffComment> = {}): DiffComment {
  return {
    id: "comment-1",
    filePath: "src/foo.ts",
    commitSha: "uncommitted",
    diffLineIndex: 2,
    lineContent: '  return "hello";',
    lineType: "context",
    text: "This should be refactored",
    createdAt: 1000,
    updatedAt: 1000,
    stale: false,
    ...overrides,
  };
}

function makeLines(...specs: [string, "added" | "removed" | "context"][]): LineSnapshot[] {
  return specs.map(([content, type]) => ({ content, type }));
}

// ---------------------------------------------------------------------------
// findNearestMatch
// ---------------------------------------------------------------------------

describe("findNearestMatch", () => {
  test("finds exact match at offset +1", () => {
    const lines = makeLines(
      ["line-a", "context"],
      ["line-b", "context"],
      ["line-c", "context"],
      ["target", "added"],
    );
    const result = findNearestMatch("target", "added", 1, lines);
    expect(result).toBe(3);
  });

  test("finds exact match at offset -1", () => {
    const lines = makeLines(["target", "added"], ["line-a", "context"], ["line-b", "context"]);
    const result = findNearestMatch("target", "added", 2, lines);
    expect(result).toBe(0);
  });

  test("prefers closer match (negative offset first)", () => {
    const lines = makeLines(
      ["target", "added"],
      ["line-a", "context"],
      ["line-b", "context"],
      ["target", "added"],
    );
    // Origin 2 → distance to 0 is 2, distance to 3 is 1 → picks 3
    const result = findNearestMatch("target", "added", 2, lines);
    expect(result).toBe(3);
  });

  test("returns null when no match exists", () => {
    const lines = makeLines(["line-a", "context"], ["line-b", "context"]);
    const result = findNearestMatch("target", "added", 0, lines);
    expect(result).toBeNull();
  });

  test("requires matching lineType", () => {
    const lines = makeLines(["target", "context"], ["line-a", "context"]);
    const result = findNearestMatch("target", "added", 1, lines);
    expect(result).toBeNull();
  });

  test("handles empty lines array", () => {
    const result = findNearestMatch("target", "added", 0, []);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// syncCommentsForFile
// ---------------------------------------------------------------------------

describe("syncCommentsForFile", () => {
  test("keeps comment at same position when line matches", () => {
    const comment = makeComment({ diffLineIndex: 1 });
    const newLines = makeLines(
      ["line-a", "context"],
      ['  return "hello";', "context"],
      ["line-c", "context"],
    );

    const result = syncCommentsForFile([comment], "src/foo.ts", "uncommitted", newLines);
    expect(result[0]!.diffLineIndex).toBe(1);
    expect(result[0]!.stale).toBe(false);
  });

  test("relocates comment when line shifts down", () => {
    const comment = makeComment({
      diffLineIndex: 1,
      lineContent: "target-line",
      lineType: "added",
    });
    const newLines = makeLines(
      ["line-a", "context"],
      ["new-inserted", "added"],
      ["another-new", "added"],
      ["target-line", "added"],
      ["line-c", "context"],
    );

    const result = syncCommentsForFile([comment], "src/foo.ts", "uncommitted", newLines);
    expect(result[0]!.diffLineIndex).toBe(3);
    expect(result[0]!.stale).toBe(false);
  });

  test("relocates comment when line shifts up", () => {
    const comment = makeComment({
      diffLineIndex: 3,
      lineContent: "target-line",
      lineType: "added",
    });
    const newLines = makeLines(["target-line", "added"], ["line-b", "context"]);

    const result = syncCommentsForFile([comment], "src/foo.ts", "uncommitted", newLines);
    expect(result[0]!.diffLineIndex).toBe(0);
    expect(result[0]!.stale).toBe(false);
  });

  test("marks comment stale when line content changes", () => {
    const comment = makeComment({
      diffLineIndex: 1,
      lineContent: "old-content",
      lineType: "context",
    });
    const newLines = makeLines(
      ["line-a", "context"],
      ["changed-content", "context"],
      ["line-c", "context"],
    );

    const result = syncCommentsForFile([comment], "src/foo.ts", "uncommitted", newLines);
    expect(result[0]!.stale).toBe(true);
  });

  test("marks comment stale when line is removed entirely", () => {
    const comment = makeComment({
      diffLineIndex: 1,
      lineContent: "deleted-line",
      lineType: "removed",
    });
    const newLines = makeLines(["line-a", "context"], ["line-c", "context"]);

    const result = syncCommentsForFile([comment], "src/foo.ts", "uncommitted", newLines);
    expect(result[0]!.stale).toBe(true);
  });

  test("clamps stale comment index to new line count", () => {
    const comment = makeComment({ diffLineIndex: 10, lineContent: "gone", lineType: "context" });
    const newLines = makeLines(["only-line", "context"]);

    const result = syncCommentsForFile([comment], "src/foo.ts", "uncommitted", newLines);
    expect(result[0]!.stale).toBe(true);
    expect(result[0]!.diffLineIndex).toBe(0);
  });

  test("ignores comments for other files", () => {
    const comment = makeComment({ filePath: "src/other.ts", diffLineIndex: 0 });
    const newLines = makeLines(["changed-content", "context"]);

    const result = syncCommentsForFile([comment], "src/foo.ts", "uncommitted", newLines);
    expect(result[0]).toBe(comment); // unchanged reference
  });

  test("ignores comments for other commits", () => {
    const comment = makeComment({ commitSha: "abc123", diffLineIndex: 0 });
    const newLines = makeLines(["changed-content", "context"]);

    const result = syncCommentsForFile([comment], "src/foo.ts", "uncommitted", newLines);
    expect(result[0]).toBe(comment);
  });

  test("handles duplicate line content — picks nearest", () => {
    const comment = makeComment({
      diffLineIndex: 2,
      lineContent: "duplicate",
      lineType: "context",
    });
    const newLines = makeLines(
      ["duplicate", "context"],
      ["line-a", "context"],
      ["changed", "added"],
      ["line-b", "context"],
      ["duplicate", "context"],
    );

    // Old index 2, candidates at 0 (dist 2) and 4 (dist 2) — negative delta checked first
    // but at equal distance, -r comes first so index 0 wins
    const result = syncCommentsForFile([comment], "src/foo.ts", "uncommitted", newLines);
    expect(result[0]!.diffLineIndex).toBe(0);
    expect(result[0]!.stale).toBe(false);
  });

  test("un-stales a previously stale comment if content reappears", () => {
    const comment = makeComment({
      diffLineIndex: 1,
      lineContent: "target",
      lineType: "added",
      stale: true,
    });
    const newLines = makeLines(["line-a", "context"], ["target", "added"]);

    const result = syncCommentsForFile([comment], "src/foo.ts", "uncommitted", newLines);
    expect(result[0]!.stale).toBe(false);
  });

  test("returns same array reference when nothing changed", () => {
    const comment = makeComment({ diffLineIndex: 0, lineContent: "same", lineType: "context" });
    const lines = makeLines(["same", "context"]);
    const comments = [comment];

    const result = syncCommentsForFile(comments, "src/foo.ts", "uncommitted", lines);
    expect(result).toBe(comments);
  });
});

// ---------------------------------------------------------------------------
// markOrphanedComments
// ---------------------------------------------------------------------------

describe("markOrphanedComments", () => {
  test("marks uncommitted comment stale when file is no longer uncommitted", () => {
    const comment = makeComment({ filePath: "src/removed.ts", commitSha: "uncommitted" });
    const result = markOrphanedComments([comment], []);
    expect(result[0]!.stale).toBe(true);
  });

  test("keeps uncommitted comment when file is still uncommitted", () => {
    const comment = makeComment({ filePath: "src/foo.ts", commitSha: "uncommitted" });
    const files = [
      {
        path: "src/foo.ts",
        commitSha: "uncommitted",
        insertions: 1,
        deletions: 0,
        operation: "changed" as const,
      },
    ];
    const result = markOrphanedComments([comment], files);
    expect(result[0]!.stale).toBe(false);
  });

  test("ignores committed comments", () => {
    const comment = makeComment({ commitSha: "abc123" });
    const result = markOrphanedComments([comment], []);
    expect(result[0]).toBe(comment); // unchanged reference
  });

  test("does not double-mark already stale comments", () => {
    const comment = makeComment({ filePath: "src/gone.ts", commitSha: "uncommitted", stale: true });
    const comments = [comment];
    const result = markOrphanedComments(comments, []);
    expect(result).toBe(comments); // same reference — no change
  });

  test("returns same array reference when nothing changed", () => {
    const comment = makeComment({ filePath: "src/foo.ts", commitSha: "uncommitted" });
    const files = [
      {
        path: "src/foo.ts",
        commitSha: "uncommitted",
        insertions: 1,
        deletions: 0,
        operation: "changed" as const,
      },
    ];
    const comments = [comment];
    const result = markOrphanedComments(comments, files);
    expect(result).toBe(comments);
  });
});
