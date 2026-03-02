import { describe, test, expect } from "bun:test";
import type { FileDiff } from "./index.ts";
import { parseUnifiedDiff } from "./diff-parser.ts";

function makeDiff(bodyLines: string[]): FileDiff {
  const header = [
    "abc123",
    "diff --git a/file.txt b/file.txt",
    "index aaa..bbb 100644",
    "--- a/file.txt",
    "+++ b/file.txt",
    "@@ -1,5 +1,5 @@",
  ];
  return {
    path: "file.txt",
    unifiedDiff: [...header, ...bodyLines].join("\n"),
  };
}

describe("parseUnifiedDiff", () => {
  test("returns full body as contents without git metadata", () => {
    const diff = makeDiff([" line 1", " line 2", "+line 3"]);
    const result = parseUnifiedDiff(diff);

    expect(result.contents).toBe(" line 1\n line 2\n+line 3");
  });

  test("identifies a single changed line as one chunk", () => {
    const diff = makeDiff([" line 1", "+added", " line 3"]);
    const result = parseUnifiedDiff(diff);

    expect(result.chunks).toEqual([{ start: 1, end: 1, contents: "+added" }]);
  });

  test("identifies a single removed line as one chunk", () => {
    const diff = makeDiff([" line 1", "-removed", " line 3"]);
    const result = parseUnifiedDiff(diff);

    expect(result.chunks).toEqual([{ start: 1, end: 1, contents: "-removed" }]);
  });

  test("groups contiguous added and removed lines into one chunk", () => {
    const diff = makeDiff([" line 1", "-old", "+new", " line 3"]);
    const result = parseUnifiedDiff(diff);

    expect(result.chunks).toEqual([{ start: 1, end: 2, contents: "-old\n+new" }]);
  });

  test("returns multiple chunks for non-contiguous changes", () => {
    const diff = makeDiff([
      " line 1",
      " line 2",
      "-line 3",
      "+line changed",
      " line 4",
      " line 5",
      "-line 6",
      " line 7",
      " line 8",
      "+new line",
      " line 9",
      " line 10",
    ]);
    const result = parseUnifiedDiff(diff);

    expect(result.contents).toBe(
      [
        " line 1",
        " line 2",
        "-line 3",
        "+line changed",
        " line 4",
        " line 5",
        "-line 6",
        " line 7",
        " line 8",
        "+new line",
        " line 9",
        " line 10",
      ].join("\n"),
    );

    expect(result.chunks).toEqual([
      { start: 2, end: 3, contents: "-line 3\n+line changed" },
      { start: 6, end: 6, contents: "-line 6" },
      { start: 9, end: 9, contents: "+new line" },
    ]);
  });

  test("returns empty chunks for a diff with no changes", () => {
    const diff = makeDiff([" line 1", " line 2", " line 3"]);
    const result = parseUnifiedDiff(diff);

    expect(result.chunks).toEqual([]);
  });

  test("handles a chunk at the very start", () => {
    const diff = makeDiff(["+added first", " line 2", " line 3"]);
    const result = parseUnifiedDiff(diff);

    expect(result.chunks).toEqual([{ start: 0, end: 0, contents: "+added first" }]);
  });

  test("handles a chunk at the very end", () => {
    const diff = makeDiff([" line 1", " line 2", "+added last"]);
    const result = parseUnifiedDiff(diff);

    expect(result.chunks).toEqual([{ start: 2, end: 2, contents: "+added last" }]);
  });

  test("handles multiple contiguous deletions and additions as one chunk", () => {
    const diff = makeDiff([" ctx", "-old 1", "-old 2", "+new 1", "+new 2", "+new 3", " ctx"]);
    const result = parseUnifiedDiff(diff);

    expect(result.chunks).toEqual([
      { start: 1, end: 5, contents: "-old 1\n-old 2\n+new 1\n+new 2\n+new 3" },
    ]);
  });

  test("handles entirely changed file as a single chunk", () => {
    const diff = makeDiff(["-old 1", "-old 2", "+new 1", "+new 2"]);
    const result = parseUnifiedDiff(diff);

    expect(result.chunks).toEqual([
      { start: 0, end: 3, contents: "-old 1\n-old 2\n+new 1\n+new 2" },
    ]);
  });

  test("handles a created file (all additions)", () => {
    const diff: FileDiff = {
      path: "new.txt",
      unifiedDiff: [
        "abc123",
        "diff --git a/new.txt b/new.txt",
        "new file mode 100644",
        "index 0000000..abc1234",
        "--- /dev/null",
        "+++ b/new.txt",
        "@@ -0,0 +1,3 @@",
        "+line 1",
        "+line 2",
        "+line 3",
      ].join("\n"),
    };
    const result = parseUnifiedDiff(diff);

    expect(result.contents).toBe("+line 1\n+line 2\n+line 3");
    expect(result.chunks).toEqual([{ start: 0, end: 2, contents: "+line 1\n+line 2\n+line 3" }]);
  });

  test("strips no-newline marker and keeps chunk contiguous", () => {
    const diff = makeDiff([
      " line 1",
      "-line 2",
      "\\ No newline at end of file",
      "+line changed",
      "\\ No newline at end of file",
    ]);
    const result = parseUnifiedDiff(diff);

    expect(result.contents).toBe(" line 1\n-line 2\n+line changed");
    expect(result.chunks).toEqual([{ start: 1, end: 2, contents: "-line 2\n+line changed" }]);
  });

  test("strips no-newline marker when adding a trailing newline", () => {
    const diff = makeDiff([
      "-no newline at end",
      "\\ No newline at end of file",
      "+no newline at end",
    ]);
    const result = parseUnifiedDiff(diff);

    expect(result.contents).toBe("-no newline at end\n+no newline at end");
    expect(result.chunks).toEqual([
      { start: 0, end: 1, contents: "-no newline at end\n+no newline at end" },
    ]);
  });

  test("strips no-newline marker when removing a trailing newline", () => {
    const diff = makeDiff(["-has newline", "+has newline", "\\ No newline at end of file"]);
    const result = parseUnifiedDiff(diff);

    expect(result.contents).toBe("-has newline\n+has newline");
    expect(result.chunks).toEqual([{ start: 0, end: 1, contents: "-has newline\n+has newline" }]);
  });

  test("handles a removed file (all deletions)", () => {
    const diff: FileDiff = {
      path: "old.txt",
      unifiedDiff: [
        "abc123",
        "diff --git a/old.txt b/old.txt",
        "deleted file mode 100644",
        "index abc1234..0000000",
        "--- a/old.txt",
        "+++ /dev/null",
        "@@ -1,2 +0,0 @@",
        "-line 1",
        "-line 2",
      ].join("\n"),
    };
    const result = parseUnifiedDiff(diff);

    expect(result.contents).toBe("-line 1\n-line 2");
    expect(result.chunks).toEqual([{ start: 0, end: 1, contents: "-line 1\n-line 2" }]);
  });
});
