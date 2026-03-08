import { describe, test, expect, afterEach, mock } from "bun:test";
import { act } from "react";
import { testRender } from "@opentui/react/test-utils";
import type { ReactNode } from "react";
import { rgbToHex } from "@opentui/core";
import { DiffViewer } from "./DiffViewer";
import type { FileDiff } from "../lib/git";
import { serializeFrameStyled, serializeFrameText } from "../lib/test/serialize-frame";
import { theme } from "../lib/themes/default";
import type { DiffComment } from "../hooks/diff-comments";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TestSetup = Awaited<ReturnType<typeof testRender>>;

async function mount(jsx: ReactNode, opts = { width: 80, height: 24 }): Promise<TestSetup> {
  const ts = await testRender(jsx, opts);
  await ts.renderOnce();
  return ts;
}

async function pressKeyAndRender(setup: TestSetup, key: string) {
  await act(async () => {
    setup.mockInput.pressKey(key);
    await setup.renderOnce();
  });
  // Extra render to flush effects (setLineColor etc.)
  await act(async () => {
    await setup.renderOnce();
  });
}

/**
 * Returns the 0-indexed line numbers (from rendered frame) whose spans
 * contain the highlight background color.
 */
function getHighlightedLines(setup: TestSetup): number[] {
  const frame = setup.captureSpans();
  const highlightHex = theme.diffHighlightLine.toLowerCase();
  const result: number[] = [];

  for (let i = 0; i < frame.lines.length; i++) {
    const line = frame.lines[i]!;
    const hasHighlight = line.spans.some((span) => {
      const bg = span.bg;
      if (bg.a === 0) return false;
      return (rgbToHex(bg) as string).toLowerCase() === highlightHex;
    });
    if (hasHighlight) result.push(i);
  }
  return result;
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <box width={80} height={24}>
      {children}
    </box>
  );
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SIMPLE_DIFF: FileDiff = {
  path: "src/utils.ts",
  unifiedDiff: [
    "diff --git a/src/utils.ts b/src/utils.ts",
    "index abc1234..def5678 100644",
    "--- a/src/utils.ts",
    "+++ b/src/utils.ts",
    "@@ -1,5 +1,5 @@",
    " function greet(name: string) {",
    '-  return "hello " + name;',
    "+  return `hello ${name}`;",
    " }",
    " ",
    " export { greet };",
  ].join("\n"),
};

const ADDITION_ONLY_DIFF: FileDiff = {
  path: "src/new-file.ts",
  unifiedDiff: [
    "diff --git a/src/new-file.ts b/src/new-file.ts",
    "new file mode 100644",
    "index 0000000..abc1234",
    "--- /dev/null",
    "+++ b/src/new-file.ts",
    "@@ -0,0 +1,4 @@",
    "+export function add(a: number, b: number) {",
    "+  return a + b;",
    "+}",
    "+",
  ].join("\n"),
};

const DELETION_ONLY_DIFF: FileDiff = {
  path: "src/old-file.ts",
  unifiedDiff: [
    "diff --git a/src/old-file.ts b/src/old-file.ts",
    "deleted file mode 100644",
    "index abc1234..0000000",
    "--- a/src/old-file.ts",
    "+++ /dev/null",
    "@@ -1,3 +0,0 @@",
    "-export function old() {",
    '-  return "deprecated";',
    "-}",
  ].join("\n"),
};

const MULTI_CHUNK_DIFF: FileDiff = {
  path: "src/app.ts",
  unifiedDiff: [
    "diff --git a/src/app.ts b/src/app.ts",
    "index abc1234..def5678 100644",
    "--- a/src/app.ts",
    "+++ b/src/app.ts",
    "@@ -1,9 +1,9 @@",
    " import { foo } from './foo';",
    "-import { bar } from './bar';",
    "+import { baz } from './baz';",
    " ",
    " function main() {",
    "   foo();",
    "-  bar();",
    "+  baz();",
    " }",
    " ",
    " export { main };",
  ].join("\n"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DiffViewer", () => {
  let testSetup: TestSetup;

  afterEach(() => {
    if (testSetup) act(() => testSetup.renderer.destroy());
  });

  describe("layout snapshots", () => {
    test("simple change (added + removed lines)", async () => {
      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={SIMPLE_DIFF} focused />
        </Wrapper>,
      );

      expect(serializeFrameText(testSetup.captureSpans())).toMatchSnapshot();
    });

    test("addition-only diff", async () => {
      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={ADDITION_ONLY_DIFF} focused />
        </Wrapper>,
      );

      expect(serializeFrameText(testSetup.captureSpans())).toMatchSnapshot();
    });

    test("deletion-only diff", async () => {
      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={DELETION_ONLY_DIFF} focused />
        </Wrapper>,
      );

      expect(serializeFrameText(testSetup.captureSpans())).toMatchSnapshot();
    });

    test("multi-chunk diff", async () => {
      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={MULTI_CHUNK_DIFF} focused />
        </Wrapper>,
      );

      expect(serializeFrameText(testSetup.captureSpans())).toMatchSnapshot();
    });
  });

  describe("visual snapshots (with color)", () => {
    test("simple change has correct colors for added/removed lines", async () => {
      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={SIMPLE_DIFF} focused />
        </Wrapper>,
      );

      expect(serializeFrameStyled(testSetup.captureSpans())).toMatchSnapshot();
    });

    test("addition-only diff uses added colors throughout", async () => {
      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={ADDITION_ONLY_DIFF} focused />
        </Wrapper>,
      );

      expect(serializeFrameStyled(testSetup.captureSpans())).toMatchSnapshot();
    });

    test("deletion-only diff uses removed colors throughout", async () => {
      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={DELETION_ONLY_DIFF} focused />
        </Wrapper>,
      );

      expect(serializeFrameStyled(testSetup.captureSpans())).toMatchSnapshot();
    });

    test("multi-chunk diff preserves colors across chunks", async () => {
      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={MULTI_CHUNK_DIFF} focused />
        </Wrapper>,
      );

      expect(serializeFrameStyled(testSetup.captureSpans())).toMatchSnapshot();
    });
  });

  describe("content assertions", () => {
    test("renders line numbers", async () => {
      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={SIMPLE_DIFF} focused />
        </Wrapper>,
      );

      const charFrame = testSetup.captureCharFrame();
      // The diff has 5 unique output lines (removed+added share a number),
      // so line numbers 1–5 should appear.
      expect(charFrame).toContain(" 1 ");
      expect(charFrame).toContain(" 5 ");
    });

    test("renders + and - signs for changed lines", async () => {
      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={SIMPLE_DIFF} focused />
        </Wrapper>,
      );

      const charFrame = testSetup.captureCharFrame();
      expect(charFrame).toContain("+");
      expect(charFrame).toContain("-");
    });

    test("renders the actual code content", async () => {
      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={SIMPLE_DIFF} focused />
        </Wrapper>,
      );

      const charFrame = testSetup.captureCharFrame();
      expect(charFrame).toContain("function greet");
      expect(charFrame).toContain("export { greet }");
    });

    test("added lines have spans in the captured frame", async () => {
      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={ADDITION_ONLY_DIFF} focused />
        </Wrapper>,
      );

      const frame = testSetup.captureSpans();
      const addedSpans = frame.lines.flatMap((line) =>
        line.spans.filter((s) => s.text.includes("export function add")),
      );
      expect(addedSpans.length).toBeGreaterThan(0);
    });

    test("removed lines have spans in the captured frame", async () => {
      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={DELETION_ONLY_DIFF} focused />
        </Wrapper>,
      );

      const frame = testSetup.captureSpans();
      const removedSpans = frame.lines.flatMap((line) =>
        line.spans.filter((s) => s.text.includes("export function old")),
      );
      expect(removedSpans.length).toBeGreaterThan(0);
    });
  });

  describe("line navigation", () => {
    test("first line is highlighted on mount", async () => {
      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={SIMPLE_DIFF} focused />
        </Wrapper>,
      );

      const highlighted = getHighlightedLines(testSetup);
      expect(highlighted).toEqual([0]);
    });

    test("pressing down moves highlight to next line", async () => {
      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={SIMPLE_DIFF} focused />
        </Wrapper>,
      );

      await pressKeyAndRender(testSetup, "ARROW_DOWN");

      const highlighted = getHighlightedLines(testSetup);
      expect(highlighted).toEqual([1]);
    });

    test("pressing j moves highlight to next line", async () => {
      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={SIMPLE_DIFF} focused />
        </Wrapper>,
      );

      await pressKeyAndRender(testSetup, "j");

      const highlighted = getHighlightedLines(testSetup);
      expect(highlighted).toEqual([1]);
    });

    test("pressing up from second line moves highlight back to first", async () => {
      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={SIMPLE_DIFF} focused />
        </Wrapper>,
      );

      await pressKeyAndRender(testSetup, "ARROW_DOWN");
      await pressKeyAndRender(testSetup, "ARROW_UP");

      const highlighted = getHighlightedLines(testSetup);
      expect(highlighted).toEqual([0]);
    });

    test("pressing k from second line moves highlight back to first", async () => {
      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={SIMPLE_DIFF} focused />
        </Wrapper>,
      );

      await pressKeyAndRender(testSetup, "j");
      await pressKeyAndRender(testSetup, "k");

      const highlighted = getHighlightedLines(testSetup);
      expect(highlighted).toEqual([0]);
    });

    test("pressing up at first line stays on first line", async () => {
      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={SIMPLE_DIFF} focused />
        </Wrapper>,
      );

      await pressKeyAndRender(testSetup, "ARROW_UP");

      const highlighted = getHighlightedLines(testSetup);
      expect(highlighted).toEqual([0]);
    });

    test("navigating down multiple times advances through lines", async () => {
      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={SIMPLE_DIFF} focused />
        </Wrapper>,
      );

      await pressKeyAndRender(testSetup, "j");
      await pressKeyAndRender(testSetup, "j");
      await pressKeyAndRender(testSetup, "j");

      const highlighted = getHighlightedLines(testSetup);
      expect(highlighted).toEqual([3]);
    });

    test("does not navigate when not focused", async () => {
      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={SIMPLE_DIFF} focused={false} />
        </Wrapper>,
      );

      await pressKeyAndRender(testSetup, "j");
      await pressKeyAndRender(testSetup, "j");

      // Should still be on line 0 since the component is not focused
      const highlighted = getHighlightedLines(testSetup);
      expect(highlighted).toEqual([0]);
    });

    test("visual: highlight moves after down press", async () => {
      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={SIMPLE_DIFF} focused />
        </Wrapper>,
      );

      await pressKeyAndRender(testSetup, "j");

      expect(serializeFrameStyled(testSetup.captureSpans())).toMatchSnapshot();
    });
  });

  describe("comments", () => {
    function makeComment(overrides: Partial<DiffComment> = {}): DiffComment {
      return {
        id: "comment-1",
        filePath: "src/utils.ts",
        commitSha: "uncommitted",
        diffLineIndex: 3,
        lineContent: " }",
        lineType: "context",
        text: "Needs review",
        createdAt: 1000,
        updatedAt: 1000,
        stale: false,
        ...overrides,
      };
    }

    test("comment indicator shows on non-highlighted line", async () => {
      const commentedLines = new Map([[3, makeComment()]]);

      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={SIMPLE_DIFF} focused commentedLines={commentedLines} />
        </Wrapper>,
      );

      // Line 0 is highlighted (current), line 3 should have comment gutter
      const frame = testSetup.captureSpans();
      const commentGutterHex = theme.commentGutter.toLowerCase();

      const line3Spans = frame.lines[3]?.spans ?? [];
      const hasCommentGutter = line3Spans.some((span) => {
        if (span.bg.a === 0) return false;
        return (rgbToHex(span.bg) as string).toLowerCase() === commentGutterHex;
      });
      expect(hasCommentGutter).toBe(true);
    });

    test("stale comment shows stale gutter color", async () => {
      const commentedLines = new Map([[3, makeComment({ stale: true })]]);

      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={SIMPLE_DIFF} focused commentedLines={commentedLines} />
        </Wrapper>,
      );

      const frame = testSetup.captureSpans();
      const staleGutterHex = theme.commentStaleGutter.toLowerCase();

      const line3Spans = frame.lines[3]?.spans ?? [];
      const hasStaleGutter = line3Spans.some((span) => {
        if (span.bg.a === 0) return false;
        return (rgbToHex(span.bg) as string).toLowerCase() === staleGutterHex;
      });
      expect(hasStaleGutter).toBe(true);
    });

    test("highlight overrides comment gutter when on same line", async () => {
      // Comment on line 0 (which is the initially highlighted line)
      const commentedLines = new Map([[0, makeComment({ diffLineIndex: 0 })]]);

      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={SIMPLE_DIFF} focused commentedLines={commentedLines} />
        </Wrapper>,
      );

      // Line 0 should have highlight color, not comment color
      const highlighted = getHighlightedLines(testSetup);
      expect(highlighted).toEqual([0]);
    });

    test("comment gutter restored after highlight moves away", async () => {
      const commentedLines = new Map([[0, makeComment({ diffLineIndex: 0 })]]);

      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={SIMPLE_DIFF} focused commentedLines={commentedLines} />
        </Wrapper>,
      );

      // Move highlight to line 1
      await pressKeyAndRender(testSetup, "j");

      // Line 0 should now show comment gutter, not highlight
      const frame = testSetup.captureSpans();
      const commentGutterHex = theme.commentGutter.toLowerCase();
      const line0Spans = frame.lines[0]?.spans ?? [];
      const hasCommentGutter = line0Spans.some((span) => {
        if (span.bg.a === 0) return false;
        return (rgbToHex(span.bg) as string).toLowerCase() === commentGutterHex;
      });
      expect(hasCommentGutter).toBe(true);
    });

    test("onLineSelected called with initial line on mount", async () => {
      const onLineSelected = mock(() => {});

      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={SIMPLE_DIFF} focused onLineSelected={onLineSelected} />
        </Wrapper>,
      );

      expect(onLineSelected).toHaveBeenCalledWith(0);
    });

    test("onLineSelected called with new index after navigation", async () => {
      const onLineSelected = mock(() => {});

      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={SIMPLE_DIFF} focused onLineSelected={onLineSelected} />
        </Wrapper>,
      );

      await pressKeyAndRender(testSetup, "j");
      await pressKeyAndRender(testSetup, "j");

      expect(onLineSelected).toHaveBeenLastCalledWith(2);
    });

    test("visual: comment indicator snapshot", async () => {
      const commentedLines = new Map([
        [2, makeComment({ diffLineIndex: 2 })],
        [4, makeComment({ diffLineIndex: 4, stale: true })],
      ]);

      testSetup = await mount(
        <Wrapper>
          <DiffViewer diff={SIMPLE_DIFF} focused commentedLines={commentedLines} />
        </Wrapper>,
      );

      expect(serializeFrameStyled(testSetup.captureSpans())).toMatchSnapshot();
    });
  });
});
