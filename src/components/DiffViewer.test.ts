import { describe, test, expect } from "bun:test";
import { getChangeBlockStarts } from "./DiffViewer";

describe("getChangeBlockStarts", () => {
  test("returns empty array for diff with no changes", () => {
    const diff = [
      "diff --git a/file.ts b/file.ts",
      "index abc..def 100644",
      "--- a/file.ts",
      "+++ b/file.ts",
      "@@ -1,3 +1,3 @@",
      " line1",
      " line2",
      " line3",
    ].join("\n");

    expect(getChangeBlockStarts(diff)).toEqual([]);
  });

  test("finds a single change block", () => {
    const diff = [
      "diff --git a/file.ts b/file.ts",
      "index abc..def 100644",
      "--- a/file.ts",
      "+++ b/file.ts",
      "@@ -1,4 +1,5 @@",
      " line1",
      " line2",
      "+added",
      " line3",
    ].join("\n");

    // Rendered lines: @@ (0), " line1" (1), " line2" (2), "+added" (3), " line3" (4)
    expect(getChangeBlockStarts(diff)).toEqual([3]);
  });

  test("finds multiple change blocks", () => {
    const diff = [
      "diff --git a/file.ts b/file.ts",
      "index abc..def 100644",
      "--- a/file.ts",
      "+++ b/file.ts",
      "@@ -1,7 +1,8 @@",
      " context",
      "+added1",
      "+added2",
      " context",
      " context",
      "-removed",
      "+replaced",
      " context",
    ].join("\n");

    // Rendered lines start at the @@ line (index 0):
    // @@ (0), context (1), +added1 (2), +added2 (3), context (4), context (5), -removed (6), +replaced (7), context (8)
    expect(getChangeBlockStarts(diff)).toEqual([2, 6]);
  });

  test("handles change block at the very start after hunk header", () => {
    const diff = [
      "diff --git a/file.ts b/file.ts",
      "--- a/file.ts",
      "+++ b/file.ts",
      "@@ -1,3 +1,4 @@",
      "+new first line",
      " line1",
      " line2",
    ].join("\n");

    // @@ (0), +new first line (1), line1 (2), line2 (3)
    expect(getChangeBlockStarts(diff)).toEqual([1]);
  });

  test("handles consecutive change blocks separated by single context line", () => {
    const diff = [
      "diff --git a/file.ts b/file.ts",
      "--- a/file.ts",
      "+++ b/file.ts",
      "@@ -1,5 +1,5 @@",
      "-old1",
      " context",
      "+new2",
    ].join("\n");

    // @@ (0), -old1 (1), context (2), +new2 (3)
    expect(getChangeBlockStarts(diff)).toEqual([1, 3]);
  });

  test("handles multiple hunk headers", () => {
    const diff = [
      "diff --git a/file.ts b/file.ts",
      "--- a/file.ts",
      "+++ b/file.ts",
      "@@ -1,3 +1,4 @@",
      " context",
      "+added",
      " context",
      "@@ -10,3 +11,4 @@",
      " context",
      "-removed",
      " context",
    ].join("\n");

    // @@ (0), context (1), +added (2), context (3), @@ (4), context (5), -removed (6), context (7)
    expect(getChangeBlockStarts(diff)).toEqual([2, 6]);
  });

  test("returns empty array for empty diff string", () => {
    expect(getChangeBlockStarts("")).toEqual([]);
  });

  test("handles diff with no file header (just hunk content)", () => {
    const diff = [
      "@@ -1,3 +1,4 @@",
      " line1",
      "+added",
      " line3",
    ].join("\n");

    expect(getChangeBlockStarts(diff)).toEqual([2]);
  });
});
