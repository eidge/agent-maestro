import { describe, test, expect, afterEach, mock } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { act } from "react";
import { serializeFrameStyled, serializeFrameText } from "../lib/test/serialize-frame";
import { NotGitRepoScreen } from "./NotGitRepoScreen";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TestSetup = Awaited<ReturnType<typeof testRender>>;

async function mount(
  props: { onExit?: () => void } = {},
  opts = { width: 60, height: 15 },
): Promise<TestSetup> {
  const ts = await testRender(<NotGitRepoScreen {...props} />, opts);
  await ts.renderOnce();
  return ts;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NotGitRepoScreen", () => {
  let testSetup: TestSetup;

  afterEach(() => {
    if (testSetup) act(() => testSetup.renderer.destroy());
  });

  describe("snapshots", () => {
    test("layout", async () => {
      testSetup = await mount();

      expect(serializeFrameText(testSetup.captureSpans())).toMatchSnapshot();
    });

    test("visual", async () => {
      testSetup = await mount();

      expect(serializeFrameStyled(testSetup.captureSpans())).toMatchSnapshot();
    });
  });

  describe("keyboard", () => {
    test("pressing enter calls onExit", async () => {
      const onExit = mock(() => {});
      testSetup = await mount({ onExit });

      testSetup.mockInput.pressKey("RETURN");

      expect(onExit).toHaveBeenCalledTimes(1);
    });

    test("pressing escape calls onExit", async () => {
      const onExit = mock(() => {});
      testSetup = await mount({ onExit });

      testSetup.mockInput.pressEscape();
      // Escape key uses a timeout internally to disambiguate from escape sequences
      await new Promise((r) => setTimeout(r, 100));

      expect(onExit).toHaveBeenCalledTimes(1);
    });

    test("pressing other keys does not call onExit", async () => {
      const onExit = mock(() => {});
      testSetup = await mount({ onExit });

      testSetup.mockInput.pressKey("a");
      testSetup.mockInput.pressKey("TAB");
      testSetup.mockInput.pressKey("x");

      expect(onExit).not.toHaveBeenCalled();
    });
  });
});
