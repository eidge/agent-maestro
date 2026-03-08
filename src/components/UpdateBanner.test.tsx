import { describe, test, expect, afterEach } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { act, type ReactNode } from "react";
import { UpdateBanner } from "./UpdateBanner";
import { serializeFrameStyled, serializeFrameText } from "../lib/test/serialize-frame";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TestSetup = Awaited<ReturnType<typeof testRender>>;

async function mount(jsx: ReactNode, opts = { width: 60, height: 3 }): Promise<TestSetup> {
  const ts = await testRender(jsx, opts);
  await ts.renderOnce();
  return ts;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("UpdateBanner", () => {
  let testSetup: TestSetup;

  afterEach(() => {
    if (testSetup) act(() => testSetup.renderer.destroy());
  });

  describe("snapshots", () => {
    test("layout: shows version and update command", async () => {
      testSetup = await mount(<UpdateBanner latestVersion="2.5.0" />);

      expect(serializeFrameText(testSetup.captureSpans())).toMatchSnapshot();
    });

    test("visual: accent colors on update command", async () => {
      testSetup = await mount(<UpdateBanner latestVersion="2.5.0" />);

      expect(serializeFrameStyled(testSetup.captureSpans())).toMatchSnapshot();
    });
  });
});
