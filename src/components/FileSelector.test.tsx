import { describe, test, expect, afterEach, mock } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { act, type ReactNode } from "react"
import { FileSelector } from "./FileSelector"
import type { ChangedFile } from "../lib/git"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TestSetup = Awaited<ReturnType<typeof testRender>>

async function mount(
  jsx: ReactNode,
  opts = { width: 60, height: 20 },
): Promise<TestSetup> {
  const ts = await testRender(jsx, opts)
  globalThis.IS_REACT_ACT_ENVIRONMENT = false
  await ts.renderOnce()
  return ts
}

async function pressKeyAndRender(
  setup: TestSetup,
  key: string,
  modifiers?: { shift?: boolean; ctrl?: boolean; meta?: boolean },
) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  await act(async () => {
    setup.mockInput.pressKey(key, modifiers)
    await setup.renderOnce()
  })
  globalThis.IS_REACT_ACT_ENVIRONMENT = false
}

function makeFile(
  path: string,
  operation: ChangedFile["operation"] = "changed",
  insertions = 5,
  deletions = 2,
): ChangedFile {
  return { path, commitSha: "abc123", insertions, deletions, operation }
}

/** Wraps children in a box with explicit dimensions so the select can render. */
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <box width={60} height={20}>
      {children}
    </box>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FileSelector", () => {
  let testSetup: TestSetup

  afterEach(() => {
    if (testSetup) testSetup.renderer.destroy()
  })

  test("shows 'no changed files' when there are no files", async () => {
    const onSelect = mock((_f: ChangedFile) => {})

    testSetup = await mount(
      <Wrapper>
        <FileSelector files={[]} onSelect={onSelect} />
      </Wrapper>,
    )

    expect(testSetup.captureCharFrame()).toContain("no changed files")
    expect(onSelect).not.toHaveBeenCalled()
  })

  test("shows file paths in the list", async () => {
    const onSelect = mock((_f: ChangedFile) => {})
    const files = [
      makeFile("src/index.ts"),
      makeFile("README.md"),
    ]

    testSetup = await mount(
      <Wrapper>
        <FileSelector files={files} onSelect={onSelect} focused />
      </Wrapper>,
    )

    const frame = testSetup.captureCharFrame()
    expect(frame).toContain("src/index.ts")
    expect(frame).toContain("README.md")
  })

  test("shows + prefix for created files", async () => {
    const onSelect = mock((_f: ChangedFile) => {})
    const files = [makeFile("new-file.ts", "created")]

    testSetup = await mount(
      <Wrapper>
        <FileSelector files={files} onSelect={onSelect} focused />
      </Wrapper>,
    )

    expect(testSetup.captureCharFrame()).toContain("+ new-file.ts")
  })

  test("shows - prefix for removed files", async () => {
    const onSelect = mock((_f: ChangedFile) => {})
    const files = [makeFile("old-file.ts", "removed")]

    testSetup = await mount(
      <Wrapper>
        <FileSelector files={files} onSelect={onSelect} focused />
      </Wrapper>,
    )

    expect(testSetup.captureCharFrame()).toContain("- old-file.ts")
  })

  test("shows ~ prefix for changed files", async () => {
    const onSelect = mock((_f: ChangedFile) => {})
    const files = [makeFile("modified.ts", "changed")]

    testSetup = await mount(
      <Wrapper>
        <FileSelector files={files} onSelect={onSelect} focused />
      </Wrapper>,
    )

    expect(testSetup.captureCharFrame()).toContain("~ modified.ts")
  })

  test("shows insertions and deletions as description", async () => {
    const onSelect = mock((_f: ChangedFile) => {})
    const files = [makeFile("file.ts", "changed", 10, 3)]

    testSetup = await mount(
      <Wrapper>
        <FileSelector files={files} onSelect={onSelect} focused />
      </Wrapper>,
    )

    const frame = testSetup.captureCharFrame()
    expect(frame).toContain("+10")
    expect(frame).toContain("-3")
  })

  test("auto-selects first file on mount", async () => {
    const onSelect = mock((_f: ChangedFile) => {})
    const files = [
      makeFile("first.ts"),
      makeFile("second.ts"),
    ]

    testSetup = await mount(
      <Wrapper>
        <FileSelector files={files} onSelect={onSelect} focused />
      </Wrapper>,
    )

    expect(onSelect).toHaveBeenCalledTimes(1)
    const selected: ChangedFile = onSelect.mock.calls[0]![0] as ChangedFile
    expect(selected.path).toBe("first.ts")
  })

  test("calls onSelect with correct file when navigating down", async () => {
    const onSelect = mock((_f: ChangedFile) => {})
    const files = [
      makeFile("first.ts"),
      makeFile("second.ts"),
      makeFile("third.ts"),
    ]

    testSetup = await mount(
      <Wrapper>
        <FileSelector files={files} onSelect={onSelect} focused />
      </Wrapper>,
    )

    // Auto-select fires first (first.ts)
    expect(onSelect).toHaveBeenCalledTimes(1)

    // Navigate down to second file
    await pressKeyAndRender(testSetup, "j")

    expect(onSelect).toHaveBeenCalledTimes(2)
    const selected: ChangedFile = onSelect.mock.calls[1]![0] as ChangedFile
    expect(selected.path).toBe("second.ts")
  })

  test("calls onSelect with third file when navigating down twice", async () => {
    const onSelect = mock((_f: ChangedFile) => {})
    const files = [
      makeFile("first.ts"),
      makeFile("second.ts"),
      makeFile("third.ts"),
    ]

    testSetup = await mount(
      <Wrapper>
        <FileSelector files={files} onSelect={onSelect} focused />
      </Wrapper>,
    )

    await pressKeyAndRender(testSetup, "j")
    await pressKeyAndRender(testSetup, "j")

    expect(onSelect).toHaveBeenCalledTimes(3)
    const selected: ChangedFile = onSelect.mock.calls[2]![0] as ChangedFile
    expect(selected.path).toBe("third.ts")
  })
})
