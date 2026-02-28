import { describe, test, expect, afterEach, mock } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { act, useState, type ReactNode } from "react"
import { CommitSelector, type CommitSelectorProps, type SelectedCommit } from "./CommitSelector"
import type { CommitInfo } from "../lib/git"

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

function makeCommit(title: string, sha: string): CommitInfo {
  return { title, body: null, sha }
}

/** Wraps children in a box with explicit dimensions so the select can render. */
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <box width={60} height={20}>
      {children}
    </box>
  )
}

/** Stateful wrapper for testing the controlled CommitSelector with navigation. */
function ControlledCommitSelector({
  initialSelection = null,
  onSelectSpy,
  ...props
}: Omit<CommitSelectorProps, "selectedCommit" | "onSelect"> & {
  initialSelection?: SelectedCommit | null
  onSelectSpy?: (s: SelectedCommit) => void
}) {
  const [selected, setSelected] = useState<SelectedCommit | null>(initialSelection)
  return (
    <CommitSelector
      {...props}
      selectedCommit={selected}
      onSelect={(s) => {
        setSelected(s)
        onSelectSpy?.(s)
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CommitSelector", () => {
  let testSetup: TestSetup

  afterEach(() => {
    if (testSetup) testSetup.renderer.destroy()
  })

  test("shows 'no commits' when there are no commits and no uncommitted files", async () => {
    const onSelect = mock<(s: SelectedCommit) => void>(() => {})

    testSetup = await mount(
      <Wrapper>
        <CommitSelector
          commits={[]}
          uncommitedFileCount={0}
          selectedCommit={null}
          onSelect={onSelect}
        />
      </Wrapper>,
    )

    expect(testSetup.captureCharFrame()).toContain("no commits")
    expect(onSelect).not.toHaveBeenCalled()
  })

  test("shows uncommitted changes option when uncommitedFileCount > 0", async () => {
    const onSelect = mock<(s: SelectedCommit) => void>(() => {})

    testSetup = await mount(
      <Wrapper>
        <CommitSelector
          commits={[]}
          uncommitedFileCount={3}
          selectedCommit={{ kind: "uncommitted" }}
          onSelect={onSelect}
          focused
        />
      </Wrapper>,
    )

    const frame = testSetup.captureCharFrame()
    expect(frame).toContain("uncommitted changes")
    expect(frame).toContain("3 files")
  })

  test("shows commit titles in the list", async () => {
    const onSelect = mock<(s: SelectedCommit) => void>(() => {})
    const commits = [
      makeCommit("feat: add login", "abc123def456"),
      makeCommit("fix: typo in readme", "789012fed345"),
    ]

    testSetup = await mount(
      <Wrapper>
        <CommitSelector
          commits={commits}
          uncommitedFileCount={0}
          selectedCommit={{ kind: "commit", commit: commits[0]! }}
          onSelect={onSelect}
          focused
        />
      </Wrapper>,
    )

    const frame = testSetup.captureCharFrame()
    expect(frame).toContain("feat: add login")
    expect(frame).toContain("fix: typo in readme")
  })

  test("shows commit short sha as description", async () => {
    const onSelect = mock<(s: SelectedCommit) => void>(() => {})
    const commits = [makeCommit("some change", "abcdef123456")]

    testSetup = await mount(
      <Wrapper>
        <CommitSelector
          commits={commits}
          uncommitedFileCount={0}
          selectedCommit={{ kind: "commit", commit: commits[0]! }}
          onSelect={onSelect}
          focused
        />
      </Wrapper>,
    )

    expect(testSetup.captureCharFrame()).toContain("#abcdef")
  })

  test("does not call onSelect on mount (parent controls selection)", async () => {
    const onSelect = mock<(s: SelectedCommit) => void>(() => {})

    testSetup = await mount(
      <Wrapper>
        <CommitSelector
          commits={[makeCommit("a commit", "aaa111bbb222")]}
          uncommitedFileCount={2}
          selectedCommit={{ kind: "uncommitted" }}
          onSelect={onSelect}
          focused
        />
      </Wrapper>,
    )

    expect(onSelect).not.toHaveBeenCalled()
  })

  test("calls onSelect with correct commit when navigating down", async () => {
    const onSelectSpy = mock<(s: SelectedCommit) => void>(() => {})
    const commits = [
      makeCommit("first commit", "aaa111bbb222"),
      makeCommit("second commit", "ccc333ddd444"),
    ]

    testSetup = await mount(
      <Wrapper>
        <ControlledCommitSelector
          commits={commits}
          uncommitedFileCount={2}
          initialSelection={{ kind: "uncommitted" }}
          onSelectSpy={onSelectSpy}
          focused
        />
      </Wrapper>,
    )

    expect(onSelectSpy).not.toHaveBeenCalled()

    // Navigate down to first commit
    await pressKeyAndRender(testSetup, "j")

    expect(onSelectSpy).toHaveBeenCalledTimes(1)
    const selection: SelectedCommit = onSelectSpy.mock.calls[0]![0] as SelectedCommit
    expect(selection.kind).toBe("commit")
    if (selection.kind === "commit") {
      expect(selection.commit.sha).toBe("aaa111bbb222")
    }
  })

  test("calls onSelect with second commit when navigating down twice", async () => {
    const onSelectSpy = mock<(s: SelectedCommit) => void>(() => {})
    const commits = [
      makeCommit("first commit", "aaa111bbb222"),
      makeCommit("second commit", "ccc333ddd444"),
    ]

    testSetup = await mount(
      <Wrapper>
        <ControlledCommitSelector
          commits={commits}
          uncommitedFileCount={2}
          initialSelection={{ kind: "uncommitted" }}
          onSelectSpy={onSelectSpy}
          focused
        />
      </Wrapper>,
    )

    await pressKeyAndRender(testSetup, "j")
    await pressKeyAndRender(testSetup, "j")

    expect(onSelectSpy).toHaveBeenCalledTimes(2)
    const selection: SelectedCommit = onSelectSpy.mock.calls[1]![0] as SelectedCommit
    expect(selection.kind).toBe("commit")
    if (selection.kind === "commit") {
      expect(selection.commit.sha).toBe("ccc333ddd444")
    }
  })

  test("uncommitted option appears before commits in navigation order", async () => {
    const onSelectSpy = mock<(s: SelectedCommit) => void>(() => {})
    const commits = [makeCommit("a commit", "aaa111bbb222")]

    testSetup = await mount(
      <Wrapper>
        <ControlledCommitSelector
          commits={commits}
          uncommitedFileCount={1}
          initialSelection={{ kind: "uncommitted" }}
          onSelectSpy={onSelectSpy}
          focused
        />
      </Wrapper>,
    )

    // Down arrow goes to the commit
    await pressKeyAndRender(testSetup, "j")
    expect(onSelectSpy).toHaveBeenCalledTimes(1)
    const selection: SelectedCommit = onSelectSpy.mock.calls[0]![0] as SelectedCommit
    expect(selection.kind).toBe("commit")
  })
})
