import { describe, test, expect, afterEach } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import type { ReactNode } from "react";
import { Provider, createStore } from "jotai";
import { CommentModal, type CommentModalProps } from "./CommentModal";
import { serializeFrameText } from "../lib/test/serialize-frame";
import type { DiffComment } from "../hooks/diff-comments";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TestSetup = Awaited<ReturnType<typeof testRender>>;

const noop = () => {};

function makeComment(overrides: Partial<DiffComment> = {}): DiffComment {
  return {
    id: "comment-1",
    filePath: "src/foo.ts",
    commitSha: "uncommitted",
    diffLineIndex: 2,
    lineContent: '  return "hello";',
    lineType: "context",
    text: "Existing comment text",
    createdAt: 1000,
    updatedAt: 1000,
    stale: false,
    ...overrides,
  };
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <Provider store={createStore()}>
      <box width={80} height={24} position="relative">
        {children}
      </box>
    </Provider>
  );
}

async function mount(
  props: Partial<CommentModalProps> = {},
  opts = { width: 80, height: 24 },
): Promise<TestSetup> {
  const merged: CommentModalProps = {
    focused: true,
    onSave: noop,
    ...props,
  };
  const ts = await testRender(
    <Wrapper>
      <CommentModal {...merged} />
    </Wrapper>,
    opts,
  );
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  await ts.renderOnce();
  return ts;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CommentModal", () => {
  let testSetup: TestSetup;

  afterEach(() => {
    if (testSetup) testSetup.renderer.destroy();
  });

  describe("rendering", () => {
    test("renders Add Comment title for new comment", async () => {
      testSetup = await mount();
      const frame = testSetup.captureCharFrame();
      expect(frame).toContain("Add Comment");
    });

    test("renders Edit Comment title for existing comment", async () => {
      testSetup = await mount({ existingComment: makeComment() });
      const frame = testSetup.captureCharFrame();
      expect(frame).toContain("Edit Comment");
    });

    test("shows footer hints", async () => {
      testSetup = await mount();
      const frame = testSetup.captureCharFrame();
      expect(frame).toContain("Enter");
      expect(frame).toContain("save");
      expect(frame).toContain("Shift+Enter");
      expect(frame).toContain("new line");
      expect(frame).toContain("Escape");
      expect(frame).toContain("cancel");
    });

    test("shows delete hint when editing", async () => {
      testSetup = await mount({ existingComment: makeComment() });
      const frame = testSetup.captureCharFrame();
      expect(frame).toContain("Ctrl+D");
      expect(frame).toContain("delete");
    });

    test("does not show delete hint for new comment", async () => {
      testSetup = await mount();
      const frame = testSetup.captureCharFrame();
      expect(frame).not.toContain("Ctrl+D");
      expect(frame).not.toContain("delete");
    });

    test("shows stale warning for stale comment", async () => {
      testSetup = await mount({ existingComment: makeComment({ stale: true }) });
      const frame = testSetup.captureCharFrame();
      expect(frame).toContain("stale");
    });

    test("does not show stale warning for fresh comment", async () => {
      testSetup = await mount({ existingComment: makeComment({ stale: false }) });
      const frame = testSetup.captureCharFrame();
      expect(frame).not.toContain("stale");
    });

    test("shows existing comment text in textarea", async () => {
      testSetup = await mount({ existingComment: makeComment({ text: "Review this" }) });
      const frame = testSetup.captureCharFrame();
      expect(frame).toContain("Review this");
    });
  });

  describe("snapshots", () => {
    test("layout: new comment", async () => {
      testSetup = await mount();
      expect(serializeFrameText(testSetup.captureSpans())).toMatchSnapshot();
    });

    test("layout: edit existing comment", async () => {
      testSetup = await mount({ existingComment: makeComment() });
      expect(serializeFrameText(testSetup.captureSpans())).toMatchSnapshot();
    });

    test("layout: stale comment", async () => {
      testSetup = await mount({ existingComment: makeComment({ stale: true }) });
      expect(serializeFrameText(testSetup.captureSpans())).toMatchSnapshot();
    });
  });
});
