import { describe, test, expect, afterEach } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import type { ReactNode } from "react";
import { DiffViewer } from "./DiffViewer";
import type { FileDiff } from "../lib/git";
import { serializeFrameStyled, serializeFrameText } from "../lib/test/serialize-frame";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TestSetup = Awaited<ReturnType<typeof testRender>>;

async function mount(jsx: ReactNode, opts = { width: 80, height: 24 }): Promise<TestSetup> {
  const ts = await testRender(jsx, opts);
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  await ts.renderOnce();
  return ts;
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
    if (testSetup) testSetup.renderer.destroy();
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
});
