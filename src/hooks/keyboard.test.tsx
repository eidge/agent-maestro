import { describe, test, expect, afterEach, spyOn } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { Provider, createStore } from "jotai";
import { act, Component, useState, type ReactNode } from "react";
import { useKeyboard } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import {
  ShortcutGroup,
  useKeyboardShortcut,
  useKeyboardShortcutRegistry,
  parseShortcut,
  parseShortcutSequence,
} from "./keyboard";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TestSetup = Awaited<ReturnType<typeof testRender>>;

async function mount(
  jsx: ReactNode,
  opts: { width: number; height: number; kittyKeyboard?: boolean },
): Promise<TestSetup> {
  const ts = await testRender(jsx, opts);
  await ts.renderOnce();
  return ts;
}

async function pressKeyAndRender(
  setup: TestSetup,
  key: string,
  modifiers?: { shift?: boolean; ctrl?: boolean; meta?: boolean; super?: boolean; hyper?: boolean },
) {
  await act(async () => {
    setup.mockInput.pressKey(key, modifiers);
    await setup.renderOnce();
  });
  // Extra render cycle needed in kitty keyboard mode to flush state updates
  // triggered by keyboard event callbacks.
  await setup.renderOnce();
}

// ---------------------------------------------------------------------------
// Test components
// ---------------------------------------------------------------------------

/** Renders `<shortcut>-count:<N>` where N increments on each matching keypress. */
function ShortcutCounter({ shortcut, description }: { shortcut: string; description: string }) {
  const [count, setCount] = useState(0);
  useKeyboardShortcut(shortcut, description, ShortcutGroup.General, () => setCount((c) => c + 1));
  return (
    <text>
      {shortcut}-count:{count}
    </text>
  );
}

/** Renders `registry:[key=desc|key=desc]` sorted alphabetically. */
function RegistryDisplay() {
  const registry = useKeyboardShortcutRegistry();
  const entries = Object.entries(registry)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v.description}`)
    .join("|");
  return <text>registry:[{entries}]</text>;
}

/** Registers a shortcut with a no-op callback; renders nothing visible. */
function ShortcutNoop({ shortcut, description }: { shortcut: string; description: string }) {
  useKeyboardShortcut(shortcut, description, ShortcutGroup.General, () => {});
  return <text />;
}

/** Captures the last KeyEvent received for inspection. */
function EventCapture({ shortcut, description }: { shortcut: string; description: string }) {
  const [event, setEvent] = useState<KeyEvent | null>(null);
  useKeyboardShortcut(shortcut, description, ShortcutGroup.General, (e) => setEvent(e));
  if (!event) return <text>event:none</text>;
  return (
    <text>
      event:{event.name},ctrl:{String(event.ctrl)},shift:{String(event.shift)},meta:
      {String(event.meta)},type:{event.eventType}
    </text>
  );
}

/**
 * Conditionally mounts a shortcut child. Pressing "t" unmounts / remounts
 * the child so we can test cleanup behaviour.
 */
function ToggleableShortcut({ shortcut, description }: { shortcut: string; description: string }) {
  const [active, setActive] = useState(true);
  useKeyboard((e) => {
    if (e.name === "t") setActive((a) => !a);
  });
  return (
    <box>
      {active && <ShortcutNoop shortcut={shortcut} description={description} />}
      <RegistryDisplay />
    </box>
  );
}

/**
 * React error boundary — catches errors thrown during rendering / effects.
 *
 * Cast to `ComponentType` because OpenTUI's JSX `ElementClass` type extends
 * `ComponentClass` (constructor) instead of `Component` (instance), making
 * class components impossible to satisfy directly. The class works at runtime.
 */
/**
 * OpenTUI's JSX `ElementClass` extends `ComponentClass` (constructor) instead
 * of `Component` (instance), so class components can't satisfy its type check.
 * The `unknown` → function-type cast keeps the class working at runtime.
 */
const ErrorBoundary = class extends Component<{ children: ReactNode }, { error: string | null }> {
  override state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  override render(): ReactNode {
    if (this.state.error) return <text>error:{this.state.error}</text>;
    return this.props.children as ReactNode;
  }
} as unknown as { (props: { children: ReactNode }): React.ReactElement | null };

// ---------------------------------------------------------------------------
// useKeyboardShortcut
// ---------------------------------------------------------------------------

describe("useKeyboardShortcut", () => {
  let testSetup: TestSetup;

  afterEach(() => {
    if (testSetup) act(() => testSetup.renderer.destroy());
  });

  test("calls callback when matching key is pressed", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <ShortcutCounter shortcut="x" description="do x" />
      </Provider>,
      { width: 40, height: 10 },
    );

    expect(testSetup.captureCharFrame()).toContain("x-count:0");

    await pressKeyAndRender(testSetup, "x");
    expect(testSetup.captureCharFrame()).toContain("x-count:1");
  });

  test("increments on every matching keypress", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <ShortcutCounter shortcut="x" description="do x" />
      </Provider>,
      { width: 40, height: 10 },
    );

    await act(async () => {
      testSetup.mockInput.pressKey("x");
      testSetup.mockInput.pressKey("x");
      testSetup.mockInput.pressKey("x");
      await testSetup.renderOnce();
    });

    expect(testSetup.captureCharFrame()).toContain("x-count:3");
  });

  test("does not call callback for non-matching keys", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <ShortcutCounter shortcut="x" description="do x" />
      </Provider>,
      { width: 40, height: 10 },
    );

    await pressKeyAndRender(testSetup, "y");
    await pressKeyAndRender(testSetup, "z");
    await pressKeyAndRender(testSetup, "a");

    expect(testSetup.captureCharFrame()).toContain("x-count:0");
  });

  test("registers shortcut in the registry on mount", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <box>
          <ShortcutNoop shortcut="q" description="quit app" />
          <RegistryDisplay />
        </box>
      </Provider>,
      { width: 80, height: 10 },
    );

    expect(testSetup.captureCharFrame()).toContain("registry:[q=quit app]");
  });

  test("unregisters shortcut from registry on unmount", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <ToggleableShortcut shortcut="x" description="do x" />
      </Provider>,
      { width: 80, height: 10 },
    );

    expect(testSetup.captureCharFrame()).toContain("registry:[x=do x]");

    // Press "t" to unmount the shortcut child
    await pressKeyAndRender(testSetup, "t");
    expect(testSetup.captureCharFrame()).toContain("registry:[]");
  });

  test("throws when registering a duplicate shortcut", async () => {
    const spy = spyOn(console, "error").mockImplementation(() => {});
    testSetup = await mount(
      <Provider store={createStore()}>
        <ErrorBoundary>
          <box>
            <ShortcutNoop shortcut="x" description="first" />
            <ShortcutNoop shortcut="x" description="second" />
          </box>
        </ErrorBoundary>
      </Provider>,
      { width: 80, height: 10 },
    );

    expect(testSetup.captureCharFrame()).toContain(
      "error:Keyboard shortcut (x) already registered.",
    );
    spy.mockRestore();
  });

  test("supports multiple non-conflicting shortcuts simultaneously", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <box>
          <ShortcutCounter shortcut="a" description="do a" />
          <ShortcutCounter shortcut="b" description="do b" />
          <RegistryDisplay />
        </box>
      </Provider>,
      { width: 80, height: 10 },
    );

    const initial = testSetup.captureCharFrame();
    expect(initial).toContain("registry:[a=do a|b=do b]");
    expect(initial).toContain("a-count:0");
    expect(initial).toContain("b-count:0");

    // Only "a" should increment
    await pressKeyAndRender(testSetup, "a");
    const afterA = testSetup.captureCharFrame();
    expect(afterA).toContain("a-count:1");
    expect(afterA).toContain("b-count:0");

    // Only "b" should increment
    await pressKeyAndRender(testSetup, "b");
    await testSetup.renderOnce();
    const afterB = testSetup.captureCharFrame();
    expect(afterB).toContain("a-count:1");
    expect(afterB).toContain("b-count:1");
  });

  test("passes the full KeyEvent to the callback", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <EventCapture shortcut="ctrl-s" description="save" />
      </Provider>,
      { width: 80, height: 10, kittyKeyboard: true },
    );

    expect(testSetup.captureCharFrame()).toContain("event:none");

    await pressKeyAndRender(testSetup, "s", { ctrl: true });
    const frame = testSetup.captureCharFrame();
    expect(frame).toContain("event:s");
    expect(frame).toContain("ctrl:true");
    expect(frame).toContain("type:press");
  });
});

// ---------------------------------------------------------------------------
// useKeyboardShortcutRegistry
// ---------------------------------------------------------------------------

describe("useKeyboardShortcutRegistry", () => {
  let testSetup: TestSetup;

  afterEach(() => {
    if (testSetup) act(() => testSetup.renderer.destroy());
  });

  test("returns empty registry when no shortcuts are registered", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <RegistryDisplay />
      </Provider>,
      { width: 40, height: 10 },
    );

    expect(testSetup.captureCharFrame()).toContain("registry:[]");
  });

  test("reflects all currently mounted shortcuts", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <box>
          <ShortcutNoop shortcut="a" description="action a" />
          <ShortcutNoop shortcut="b" description="action b" />
          <ShortcutNoop shortcut="c" description="action c" />
          <RegistryDisplay />
        </box>
      </Provider>,
      { width: 80, height: 10 },
    );

    expect(testSetup.captureCharFrame()).toContain("registry:[a=action a|b=action b|c=action c]");
  });
});

// ---------------------------------------------------------------------------
// parseShortcut
// ---------------------------------------------------------------------------

describe("parseShortcut", () => {
  test("parses a plain key", () => {
    expect(parseShortcut("x")).toEqual({ key: "x", ctrl: false, shift: false, alt: false });
  });

  test("parses ctrl modifier", () => {
    expect(parseShortcut("ctrl-s")).toEqual({ key: "s", ctrl: true, shift: false, alt: false });
  });

  test("parses shift modifier", () => {
    expect(parseShortcut("shift-a")).toEqual({ key: "a", ctrl: false, shift: true, alt: false });
  });

  test("parses alt modifier", () => {
    expect(parseShortcut("alt-tab")).toEqual({ key: "tab", ctrl: false, shift: false, alt: true });
  });

  test("parses meta modifier as alt", () => {
    expect(parseShortcut("meta-k")).toEqual({ key: "k", ctrl: false, shift: false, alt: true });
  });

  test("parses multiple modifiers", () => {
    expect(parseShortcut("ctrl-shift-x")).toEqual({
      key: "x",
      ctrl: true,
      shift: true,
      alt: false,
    });
  });

  test("parses all modifiers together", () => {
    expect(parseShortcut("ctrl-shift-alt-z")).toEqual({
      key: "z",
      ctrl: true,
      shift: true,
      alt: true,
    });
  });

  test("is case-insensitive", () => {
    expect(parseShortcut("Ctrl-S")).toEqual({ key: "s", ctrl: true, shift: false, alt: false });
  });

  test("throws when no key name is provided", () => {
    expect(() => parseShortcut("ctrl-shift")).toThrow("expected exactly one key name, got none");
  });

  test("throws when multiple key names are provided", () => {
    expect(() => parseShortcut("a-b")).toThrow('expected exactly one key name, got "a-b"');
  });
});

// ---------------------------------------------------------------------------
// Composite key shortcuts (integration)
// ---------------------------------------------------------------------------

describe("useKeyboardShortcut with composite keys", () => {
  let testSetup: TestSetup;

  afterEach(() => {
    if (testSetup) act(() => testSetup.renderer.destroy());
  });

  test("ctrl-s fires only when ctrl is held", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <ShortcutCounter shortcut="ctrl-s" description="save" />
      </Provider>,
      { width: 40, height: 10, kittyKeyboard: true },
    );

    // Plain "s" without ctrl should NOT match
    await pressKeyAndRender(testSetup, "s");
    expect(testSetup.captureCharFrame()).toContain("ctrl-s-count:0");

    // "s" with ctrl SHOULD match
    await pressKeyAndRender(testSetup, "s", { ctrl: true });
    expect(testSetup.captureCharFrame()).toContain("ctrl-s-count:1");
  });

  test("alt-tab fires only when meta/alt is held", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <ShortcutCounter shortcut="alt-tab" description="reverse cycle" />
      </Provider>,
      { width: 40, height: 10, kittyKeyboard: true },
    );

    // Plain "tab" without alt should NOT match
    await pressKeyAndRender(testSetup, "TAB");
    expect(testSetup.captureCharFrame()).toContain("alt-tab-count:0");

    // "tab" with meta (alt) SHOULD match
    await pressKeyAndRender(testSetup, "TAB", { meta: true });
    expect(testSetup.captureCharFrame()).toContain("alt-tab-count:1");
  });

  test("plain key does not fire when modifier is held", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <ShortcutCounter shortcut="x" description="do x" />
      </Provider>,
      { width: 40, height: 10, kittyKeyboard: true },
    );

    // "x" with ctrl held should NOT match a plain "x" shortcut
    await pressKeyAndRender(testSetup, "x", { ctrl: true });
    expect(testSetup.captureCharFrame()).toContain("x-count:0");

    // Plain "x" SHOULD match
    await pressKeyAndRender(testSetup, "x");
    expect(testSetup.captureCharFrame()).toContain("x-count:1");
  });

  test("same key with different modifiers can coexist", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <box>
          <ShortcutCounter shortcut="tab" description="forward" />
          <ShortcutCounter shortcut="alt-tab" description="backward" />
        </box>
      </Provider>,
      { width: 80, height: 10, kittyKeyboard: true },
    );

    await pressKeyAndRender(testSetup, "TAB");
    let frame = testSetup.captureCharFrame();
    expect(frame).toContain("tab-count:1");
    expect(frame).toContain("alt-tab-count:0");

    await pressKeyAndRender(testSetup, "TAB", { meta: true });
    frame = testSetup.captureCharFrame();
    expect(frame).toContain("tab-count:1");
    expect(frame).toContain("alt-tab-count:1");
  });
});

// ---------------------------------------------------------------------------
// parseShortcutSequence
// ---------------------------------------------------------------------------

describe("parseShortcutSequence", () => {
  test("parses a single key as a one-element sequence", () => {
    expect(parseShortcutSequence("x")).toEqual([
      { key: "x", ctrl: false, shift: false, alt: false },
    ]);
  });

  test("parses two keys separated by a space", () => {
    expect(parseShortcutSequence("g g")).toEqual([
      { key: "g", ctrl: false, shift: false, alt: false },
      { key: "g", ctrl: false, shift: false, alt: false },
    ]);
  });

  test("parses a sequence with modifiers on each key", () => {
    expect(parseShortcutSequence("ctrl-k ctrl-s")).toEqual([
      { key: "k", ctrl: true, shift: false, alt: false },
      { key: "s", ctrl: true, shift: false, alt: false },
    ]);
  });

  test("parses a mixed sequence of plain and modified keys", () => {
    expect(parseShortcutSequence("g shift-g")).toEqual([
      { key: "g", ctrl: false, shift: false, alt: false },
      { key: "g", ctrl: false, shift: true, alt: false },
    ]);
  });

  test("handles extra whitespace", () => {
    expect(parseShortcutSequence("  a   b  ")).toEqual([
      { key: "a", ctrl: false, shift: false, alt: false },
      { key: "b", ctrl: false, shift: false, alt: false },
    ]);
  });

  test("parses a three-key sequence", () => {
    expect(parseShortcutSequence("a b c")).toEqual([
      { key: "a", ctrl: false, shift: false, alt: false },
      { key: "b", ctrl: false, shift: false, alt: false },
      { key: "c", ctrl: false, shift: false, alt: false },
    ]);
  });
});

// ---------------------------------------------------------------------------
// useKeyboardShortcut with key sequences
// ---------------------------------------------------------------------------

describe("useKeyboardShortcut with key sequences", () => {
  let testSetup: TestSetup;

  afterEach(() => {
    if (testSetup) act(() => testSetup.renderer.destroy());
  });

  test("fires callback after the full sequence is pressed", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <ShortcutCounter shortcut="g g" description="go top" />
      </Provider>,
      { width: 40, height: 10 },
    );

    expect(testSetup.captureCharFrame()).toContain("g g-count:0");

    await pressKeyAndRender(testSetup, "g");
    expect(testSetup.captureCharFrame()).toContain("g g-count:0");

    await pressKeyAndRender(testSetup, "g");
    expect(testSetup.captureCharFrame()).toContain("g g-count:1");
  });

  test("does not fire if the sequence is interrupted by a different key", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <ShortcutCounter shortcut="g g" description="go top" />
      </Provider>,
      { width: 40, height: 10 },
    );

    await pressKeyAndRender(testSetup, "g");
    await pressKeyAndRender(testSetup, "x");
    await pressKeyAndRender(testSetup, "g");

    // The interrupting "x" should have reset the sequence, so the final "g"
    // only starts a new sequence — callback should NOT have fired.
    expect(testSetup.captureCharFrame()).toContain("g g-count:0");
  });

  test("restarts the sequence when the first key is pressed after interruption", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <ShortcutCounter shortcut="g g" description="go top" />
      </Provider>,
      { width: 40, height: 10 },
    );

    // g, x (interrupts), g (restarts), g (completes)
    await pressKeyAndRender(testSetup, "g");
    await pressKeyAndRender(testSetup, "x");
    await pressKeyAndRender(testSetup, "g");
    await pressKeyAndRender(testSetup, "g");

    expect(testSetup.captureCharFrame()).toContain("g g-count:1");
  });

  test("can fire the sequence multiple times", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <ShortcutCounter shortcut="g g" description="go top" />
      </Provider>,
      { width: 40, height: 10 },
    );

    await pressKeyAndRender(testSetup, "g");
    await pressKeyAndRender(testSetup, "g");
    await pressKeyAndRender(testSetup, "g");
    await pressKeyAndRender(testSetup, "g");

    expect(testSetup.captureCharFrame()).toContain("g g-count:2");
  });

  test("three-key sequence fires only after all three keys", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <ShortcutCounter shortcut="a b c" description="do abc" />
      </Provider>,
      { width: 40, height: 10 },
    );

    await pressKeyAndRender(testSetup, "a");
    expect(testSetup.captureCharFrame()).toContain("a b c-count:0");

    await pressKeyAndRender(testSetup, "b");
    expect(testSetup.captureCharFrame()).toContain("a b c-count:0");

    await pressKeyAndRender(testSetup, "c");
    expect(testSetup.captureCharFrame()).toContain("a b c-count:1");
  });

  test("sequence with modifiers works correctly", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <ShortcutCounter shortcut="ctrl-k ctrl-s" description="save" />
      </Provider>,
      { width: 40, height: 10, kittyKeyboard: true },
    );

    await pressKeyAndRender(testSetup, "k", { ctrl: true });
    expect(testSetup.captureCharFrame()).toContain("ctrl-k ctrl-s-count:0");

    await pressKeyAndRender(testSetup, "s", { ctrl: true });
    expect(testSetup.captureCharFrame()).toContain("ctrl-k ctrl-s-count:1");
  });

  test("sequence does not fire if modifier is missing on one key", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <ShortcutCounter shortcut="ctrl-k ctrl-s" description="save" />
      </Provider>,
      { width: 40, height: 10, kittyKeyboard: true },
    );

    await pressKeyAndRender(testSetup, "k", { ctrl: true });
    // Plain "s" without ctrl should NOT complete the sequence
    await pressKeyAndRender(testSetup, "s");

    expect(testSetup.captureCharFrame()).toContain("ctrl-k ctrl-s-count:0");
  });

  test("registers sequence shortcut in the registry", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <box>
          <ShortcutNoop shortcut="g g" description="go top" />
          <RegistryDisplay />
        </box>
      </Provider>,
      { width: 80, height: 10 },
    );

    expect(testSetup.captureCharFrame()).toContain("registry:[g g=go top]");
  });

  test("single-key shortcuts still work with sequence logic", async () => {
    testSetup = await mount(
      <Provider store={createStore()}>
        <ShortcutCounter shortcut="x" description="do x" />
      </Provider>,
      { width: 40, height: 10 },
    );

    await pressKeyAndRender(testSetup, "x");
    expect(testSetup.captureCharFrame()).toContain("x-count:1");
  });

  test("handles g g g as two sequence fires with overlap", async () => {
    // Pressing g three times: first two complete the sequence, third starts a new one
    testSetup = await mount(
      <Provider store={createStore()}>
        <ShortcutCounter shortcut="g g" description="go top" />
      </Provider>,
      { width: 40, height: 10 },
    );

    await pressKeyAndRender(testSetup, "g");
    await pressKeyAndRender(testSetup, "g");
    // Sequence fired once, position reset to 0
    await pressKeyAndRender(testSetup, "g");
    // Third "g" only starts a new sequence, does not complete it

    expect(testSetup.captureCharFrame()).toContain("g g-count:1");
  });
});
