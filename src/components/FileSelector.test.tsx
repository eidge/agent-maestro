import { describe, test, expect, afterEach, mock } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { act, useState, type ReactNode } from "react";
import { FileSelector, type FileSelectorProps } from "./FileSelector";
import type { ChangedFile } from "../lib/git";
import { serializeFrameStyled, serializeFrameText } from "../lib/test/serialize-frame";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TestSetup = Awaited<ReturnType<typeof testRender>>;

async function mount(jsx: ReactNode, opts = { width: 60, height: 20 }): Promise<TestSetup> {
  const ts = await testRender(jsx, opts);
  await ts.renderOnce();
  return ts;
}

async function pressKeyAndRender(
  setup: TestSetup,
  key: string,
  modifiers?: { shift?: boolean; ctrl?: boolean; meta?: boolean },
) {
  await act(async () => {
    setup.mockInput.pressKey(key, modifiers);
    await setup.renderOnce();
  });
}

function makeFile(
  path: string,
  operation: ChangedFile["operation"] = "changed",
  insertions = 5,
  deletions = 2,
): ChangedFile {
  return { path, commitSha: "abc123", insertions, deletions, operation };
}

/** Wraps children in a box with explicit dimensions so the select can render. */
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <box width={60} height={20}>
      {children}
    </box>
  );
}

/** Stateful wrapper for testing the controlled FileSelector with navigation. */
function ControlledFileSelector({
  initialSelection = null,
  onSelectSpy,
  ...props
}: Omit<FileSelectorProps, "selectedFile" | "onSelect"> & {
  initialSelection?: ChangedFile | null;
  onSelectSpy?: (f: ChangedFile) => void;
}) {
  const [selected, setSelected] = useState<ChangedFile | null>(initialSelection);
  return (
    <FileSelector
      {...props}
      selectedFile={selected}
      onSelect={(f) => {
        setSelected(f);
        onSelectSpy?.(f);
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FileSelector", () => {
  let testSetup: TestSetup;

  afterEach(() => {
    if (testSetup) act(() => testSetup.renderer.destroy());
  });

  test("shows 'no changed files' when there are no files", async () => {
    const onSelect = mock<(f: ChangedFile) => void>(() => {});

    testSetup = await mount(
      <Wrapper>
        <FileSelector files={[]} selectedFile={null} onSelect={onSelect} />
      </Wrapper>,
    );

    expect(testSetup.captureCharFrame()).toContain("no changed files");
    expect(onSelect).not.toHaveBeenCalled();
  });

  test("shows file paths in the list", async () => {
    const onSelect = mock<(f: ChangedFile) => void>(() => {});
    const files = [makeFile("src/index.ts"), makeFile("README.md")];

    testSetup = await mount(
      <Wrapper>
        <FileSelector files={files} selectedFile={files[0]!} onSelect={onSelect} focused />
      </Wrapper>,
    );

    const frame = testSetup.captureCharFrame();
    expect(frame).toContain("src/index.ts");
    expect(frame).toContain("README.md");
  });

  test("shows + prefix for created files", async () => {
    const onSelect = mock<(f: ChangedFile) => void>(() => {});
    const files = [makeFile("new-file.ts", "created")];

    testSetup = await mount(
      <Wrapper>
        <FileSelector files={files} selectedFile={files[0]!} onSelect={onSelect} focused />
      </Wrapper>,
    );

    expect(testSetup.captureCharFrame()).toContain("+ new-file.ts");
  });

  test("shows - prefix for removed files", async () => {
    const onSelect = mock<(f: ChangedFile) => void>(() => {});
    const files = [makeFile("old-file.ts", "removed")];

    testSetup = await mount(
      <Wrapper>
        <FileSelector files={files} selectedFile={files[0]!} onSelect={onSelect} focused />
      </Wrapper>,
    );

    expect(testSetup.captureCharFrame()).toContain("- old-file.ts");
  });

  test("shows ~ prefix for changed files", async () => {
    const onSelect = mock<(f: ChangedFile) => void>(() => {});
    const files = [makeFile("modified.ts", "changed")];

    testSetup = await mount(
      <Wrapper>
        <FileSelector files={files} selectedFile={files[0]!} onSelect={onSelect} focused />
      </Wrapper>,
    );

    expect(testSetup.captureCharFrame()).toContain("~ modified.ts");
  });

  test("shows insertions and deletions as description", async () => {
    const onSelect = mock<(f: ChangedFile) => void>(() => {});
    const files = [makeFile("file.ts", "changed", 10, 3)];

    testSetup = await mount(
      <Wrapper>
        <FileSelector files={files} selectedFile={files[0]!} onSelect={onSelect} focused />
      </Wrapper>,
    );

    const frame = testSetup.captureCharFrame();
    expect(frame).toContain("+10");
    expect(frame).toContain("-3");
  });

  test("does not call onSelect on mount (parent controls selection)", async () => {
    const onSelect = mock<(f: ChangedFile) => void>(() => {});
    const files = [makeFile("first.ts"), makeFile("second.ts")];

    testSetup = await mount(
      <Wrapper>
        <FileSelector files={files} selectedFile={files[0]!} onSelect={onSelect} focused />
      </Wrapper>,
    );

    expect(onSelect).not.toHaveBeenCalled();
  });

  test("calls onSelect with correct file when navigating down", async () => {
    const onSelectSpy = mock<(f: ChangedFile) => void>(() => {});
    const files = [makeFile("first.ts"), makeFile("second.ts"), makeFile("third.ts")];

    testSetup = await mount(
      <Wrapper>
        <ControlledFileSelector
          files={files}
          initialSelection={files[0]!}
          onSelectSpy={onSelectSpy}
          focused
        />
      </Wrapper>,
    );

    expect(onSelectSpy).not.toHaveBeenCalled();

    // Navigate down to second file
    await pressKeyAndRender(testSetup, "j");

    expect(onSelectSpy).toHaveBeenCalledTimes(1);
    const selected: ChangedFile = onSelectSpy.mock.calls[0]![0] as ChangedFile;
    expect(selected.path).toBe("second.ts");
  });

  test("calls onSelect with third file when navigating down twice", async () => {
    const onSelectSpy = mock<(f: ChangedFile) => void>(() => {});
    const files = [makeFile("first.ts"), makeFile("second.ts"), makeFile("third.ts")];

    testSetup = await mount(
      <Wrapper>
        <ControlledFileSelector
          files={files}
          initialSelection={files[0]!}
          onSelectSpy={onSelectSpy}
          focused
        />
      </Wrapper>,
    );

    await pressKeyAndRender(testSetup, "j");
    await pressKeyAndRender(testSetup, "j");

    expect(onSelectSpy).toHaveBeenCalledTimes(2);
    const selected: ChangedFile = onSelectSpy.mock.calls[1]![0] as ChangedFile;
    expect(selected.path).toBe("third.ts");
  });

  describe("snapshots", () => {
    test("layout: no files", async () => {
      testSetup = await mount(
        <Wrapper>
          <FileSelector files={[]} selectedFile={null} onSelect={() => {}} />
        </Wrapper>,
      );

      expect(serializeFrameText(testSetup.captureSpans())).toMatchSnapshot();
    });

    test("layout: mixed operations", async () => {
      const files = [
        makeFile("src/new.ts", "created", 20, 0),
        makeFile("src/changed.ts", "changed", 5, 3),
        makeFile("src/gone.ts", "removed", 0, 12),
      ];

      testSetup = await mount(
        <Wrapper>
          <FileSelector files={files} selectedFile={files[0]!} onSelect={() => {}} focused />
        </Wrapper>,
      );

      expect(serializeFrameText(testSetup.captureSpans())).toMatchSnapshot();
    });

    test("visual: mixed operations", async () => {
      const files = [
        makeFile("src/new.ts", "created", 20, 0),
        makeFile("src/changed.ts", "changed", 5, 3),
        makeFile("src/gone.ts", "removed", 0, 12),
      ];

      testSetup = await mount(
        <Wrapper>
          <FileSelector files={files} selectedFile={files[0]!} onSelect={() => {}} focused />
        </Wrapper>,
      );

      expect(serializeFrameStyled(testSetup.captureSpans())).toMatchSnapshot();
    });

    test("visual: second file focused", async () => {
      const files = [
        makeFile("src/new.ts", "created", 20, 0),
        makeFile("src/changed.ts", "changed", 5, 3),
      ];

      testSetup = await mount(
        <Wrapper>
          <FileSelector files={files} selectedFile={files[1]!} onSelect={() => {}} focused />
        </Wrapper>,
      );

      expect(serializeFrameStyled(testSetup.captureSpans())).toMatchSnapshot();
    });
  });
});
