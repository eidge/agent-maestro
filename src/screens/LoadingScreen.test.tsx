import { describe, test, expect, afterEach } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { serializeFrameStyled, serializeFrameText } from "../lib/test/serialize-frame";
import { LoadingScreen } from "./LoadingScreen";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TestSetup = Awaited<ReturnType<typeof testRender>>;

async function mount(opts = { width: 60, height: 15 }): Promise<TestSetup> {
  const ts = await testRender(<LoadingScreen />, opts);
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  await ts.renderOnce();
  return ts;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LoadingScreen", () => {
  let testSetup: TestSetup;

  afterEach(() => {
    if (testSetup) testSetup.renderer.destroy();
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
});
