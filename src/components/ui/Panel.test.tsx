import { describe, test, expect, afterEach } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import type { ReactNode } from "react";
import { Panel } from "./Panel";
import { serializeFrameStyled, serializeFrameText } from "../../lib/test/serialize-frame";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TestSetup = Awaited<ReturnType<typeof testRender>>;

async function mount(jsx: ReactNode, opts = { width: 40, height: 10 }): Promise<TestSetup> {
  const ts = await testRender(jsx, opts);
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  await ts.renderOnce();
  return ts;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Panel", () => {
  let testSetup: TestSetup;

  afterEach(() => {
    if (testSetup) testSetup.renderer.destroy();
  });

  describe("snapshots", () => {
    test("layout: empty panel with title", async () => {
      testSetup = await mount(
        <Panel title="My Panel" width={30} height={5}>
          <text>hello world</text>
        </Panel>,
      );

      expect(serializeFrameText(testSetup.captureSpans())).toMatchSnapshot();
    });

    test("layout: panel without title", async () => {
      testSetup = await mount(
        <Panel width={30} height={5}>
          <text>content here</text>
        </Panel>,
      );

      expect(serializeFrameText(testSetup.captureSpans())).toMatchSnapshot();
    });

    test("layout: panel with focused child", async () => {
      testSetup = await mount(
        <Panel title="Focused" width={30} height={5}>
          <box focused>
            <text>focused content</text>
          </box>
        </Panel>,
      );

      expect(serializeFrameText(testSetup.captureSpans())).toMatchSnapshot();
    });

    test("visual: unfocused border color", async () => {
      testSetup = await mount(
        <Panel title="Unfocused" width={30} height={5}>
          <text>content</text>
        </Panel>,
      );

      expect(serializeFrameStyled(testSetup.captureSpans())).toMatchSnapshot();
    });

    test("visual: focused border color", async () => {
      testSetup = await mount(
        <Panel title="Focused" width={30} height={5}>
          <box focused>
            <text>content</text>
          </box>
        </Panel>,
      );

      expect(serializeFrameStyled(testSetup.captureSpans())).toMatchSnapshot();
    });
  });
});
