import { describe, test, expect, afterEach } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import type { ReactNode } from "react";
import { Provider, createStore } from "jotai";
import { ShortcutGroup, useKeyboardShortcut } from "../hooks/keyboard";
import { HelpMenu } from "./HelpMenu";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

type TestSetup = Awaited<ReturnType<typeof testRender>>;

async function mount(jsx: ReactNode, opts = { width: 80, height: 30 }): Promise<TestSetup> {
  const ts = await testRender(jsx, opts);
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  await ts.renderOnce();
  return ts;
}

// ---------------------------------------------------------------------------
// Test components — register shortcuts so HelpMenu has data to display
// ---------------------------------------------------------------------------

function RegisterShortcut({
  shortcut,
  description,
  group,
}: {
  shortcut: string;
  description: string;
  group: ShortcutGroup;
}) {
  useKeyboardShortcut(shortcut, description, group, () => {});
  return null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HelpMenu", () => {
  let testSetup: TestSetup;

  afterEach(() => {
    if (testSetup) testSetup.renderer.destroy();
  });

  test("renders the panel title", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <RegisterShortcut shortcut="?" description="show help" group={ShortcutGroup.General} />
        <HelpMenu focused />
      </Provider>,
    );

    expect(testSetup.captureCharFrame()).toContain("Keyboard Shortcuts");
  });

  test("displays a shortcut with its description", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <RegisterShortcut
          shortcut="tab"
          description="cycle panels forward"
          group={ShortcutGroup.Navigation}
        />
        <HelpMenu focused />
      </Provider>,
    );

    const frame = testSetup.captureCharFrame();
    expect(frame).toContain("Tab");
    expect(frame).toContain("cycle panels forward");
  });

  test("displays the close hint footer", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <RegisterShortcut shortcut="?" description="show help" group={ShortcutGroup.General} />
        <HelpMenu focused />
      </Provider>,
    );

    const frame = testSetup.captureCharFrame();
    expect(frame).toContain("?");
    expect(frame).toContain("Escape");
    expect(frame).toContain("close");
  });

  describe("groups", () => {
    test("displays group headings", async () => {
      testSetup = await mount(
        <Provider store={createStore()}>
          <RegisterShortcut shortcut="?" description="show help" group={ShortcutGroup.General} />
          <RegisterShortcut
            shortcut="tab"
            description="cycle panels"
            group={ShortcutGroup.Navigation}
          />
          <HelpMenu focused />
        </Provider>,
      );

      const frame = testSetup.captureCharFrame();
      expect(frame).toContain("General");
      expect(frame).toContain("Navigation");
    });

    test("does not display groups with no shortcuts", async () => {
      testSetup = await mount(
        <Provider store={createStore()}>
          <RegisterShortcut shortcut="?" description="show help" group={ShortcutGroup.General} />
          <HelpMenu focused />
        </Provider>,
      );

      const frame = testSetup.captureCharFrame();
      expect(frame).toContain("General");
      expect(frame).not.toContain("Navigation");
      expect(frame).not.toContain("Diff");
    });

    test("displays groups in enum declaration order", async () => {
      // Register in reverse order — Navigation before General
      testSetup = await mount(
        <Provider store={createStore()}>
          <RegisterShortcut shortcut="tab" description="cycle" group={ShortcutGroup.Navigation} />
          <RegisterShortcut shortcut="?" description="help" group={ShortcutGroup.General} />
          <RegisterShortcut shortcut="g g" description="top" group={ShortcutGroup.Diff} />
          <HelpMenu focused />
        </Provider>,
      );

      const frame = testSetup.captureCharFrame();
      const generalIndex = frame.indexOf("General");
      const navigationIndex = frame.indexOf("Navigation");
      const diffIndex = frame.indexOf("Diff");

      expect(generalIndex).toBeLessThan(navigationIndex);
      expect(navigationIndex).toBeLessThan(diffIndex);
    });

    test("renders no group headings when registry is empty", async () => {
      testSetup = await mount(
        <Provider store={createStore()}>
          <HelpMenu focused />
        </Provider>,
      );

      const frame = testSetup.captureCharFrame();
      expect(frame).toContain("Keyboard Shortcuts");
      expect(frame).not.toContain("General");
      expect(frame).not.toContain("Navigation");
      expect(frame).not.toContain("Diff");
    });
  });

  describe("formatting", () => {
    test("capitalizes multi-character key names", async () => {
      testSetup = await mount(
        <Provider store={createStore()}>
          <RegisterShortcut shortcut="tab" description="cycle" group={ShortcutGroup.Navigation} />
          <HelpMenu focused />
        </Provider>,
      );

      expect(testSetup.captureCharFrame()).toContain("Tab");
    });

    test("preserves case for single-character keys", async () => {
      testSetup = await mount(
        <Provider store={createStore()}>
          <RegisterShortcut shortcut="?" description="show help" group={ShortcutGroup.General} />
          <HelpMenu focused />
        </Provider>,
      );

      expect(testSetup.captureCharFrame()).toContain("?");
    });

    test("formats modifier keys with + separator", async () => {
      testSetup = await mount(
        <Provider store={createStore()}>
          <RegisterShortcut shortcut="ctrl-s" description="save" group={ShortcutGroup.General} />
          <HelpMenu focused />
        </Provider>,
      );

      expect(testSetup.captureCharFrame()).toContain("Ctrl+s");
    });

    test("formats repeated key sequences without arrow separator", async () => {
      testSetup = await mount(
        <Provider store={createStore()}>
          <RegisterShortcut shortcut="g g" description="scroll to top" group={ShortcutGroup.Diff} />
          <HelpMenu focused />
        </Provider>,
      );

      const frame = testSetup.captureCharFrame();
      expect(frame).toContain("gg");
      expect(frame).not.toContain("→");
    });

    test("formats multi-key sequences with arrow separator", async () => {
      testSetup = await mount(
        <Provider store={createStore()}>
          <RegisterShortcut
            shortcut="ctrl-k ctrl-s"
            description="save all"
            group={ShortcutGroup.General}
          />
          <HelpMenu focused />
        </Provider>,
      );

      expect(testSetup.captureCharFrame()).toContain("Ctrl+k → Ctrl+s");
    });
  });

  describe("merging", () => {
    test("merges consecutive shortcuts with the same description", async () => {
      testSetup = await mount(
        <Provider store={createStore()}>
          <RegisterShortcut
            shortcut="shift-up"
            description="previous block"
            group={ShortcutGroup.Diff}
          />
          <RegisterShortcut
            shortcut="shift-k"
            description="previous block"
            group={ShortcutGroup.Diff}
          />
          <HelpMenu focused />
        </Provider>,
      );

      const frame = testSetup.captureCharFrame();
      expect(frame).toContain("Shift+Up / Shift+k");
      expect(frame).toContain("previous block");
    });

    test("does not merge shortcuts with different descriptions", async () => {
      testSetup = await mount(
        <Provider store={createStore()}>
          <RegisterShortcut
            shortcut="shift-up"
            description="previous block"
            group={ShortcutGroup.Diff}
          />
          <RegisterShortcut
            shortcut="shift-down"
            description="next block"
            group={ShortcutGroup.Diff}
          />
          <HelpMenu focused />
        </Provider>,
      );

      const frame = testSetup.captureCharFrame();
      expect(frame).toContain("Shift+Up");
      expect(frame).toContain("previous block");
      expect(frame).toContain("Shift+Down");
      expect(frame).toContain("next block");
      expect(frame).not.toContain("/");
    });

    test("does not merge shortcuts across different groups", async () => {
      testSetup = await mount(
        <Provider store={createStore()}>
          <RegisterShortcut shortcut="a" description="do thing" group={ShortcutGroup.General} />
          <RegisterShortcut shortcut="b" description="do thing" group={ShortcutGroup.Navigation} />
          <HelpMenu focused />
        </Provider>,
      );

      const frame = testSetup.captureCharFrame();
      expect(frame).not.toContain("/");
    });
  });
});
