import { describe, test, expect, afterEach, mock } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { act, type ReactNode } from "react"
import { CommitSelector, type SelectedCommit } from "./CommitSelector"
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CommitSelector", () => {
  let testSetup: TestSetup

  afterEach(() => {
    if (testSetup) testSetup.renderer.destroy()
  })

  test("shows 'no commits' when there are no commits and no uncommitted files", async () => {
    const onSelect = mock((_s: SelectedCommit) => {})

    testSetup = await mount(
      <Wrapper>
        <CommitSelector
          commits={[]}
          uncommitedFileCount={0}
          onSelect={onSelect}
        />
      </Wrapper>,
    )

    expect(testSetup.captureCharFrame()).toContain("no commits")
    expect(onSelect).not.toHaveBeenCalled()
  })

  test("shows uncommitted changes option when uncommitedFileCount > 0", async () => {
    const onSelect = mock((_s: SelectedCommit) => {})

    testSetup = await mount(
      <Wrapper>
        <CommitSelector
          commits={[]}
          uncommitedFileCount={3}
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
    const onSelect = mock((_s: SelectedCommit) => {})
    const commits = [
      makeCommit("feat: add login", "abc123def456"),
      makeCommit("fix: typo in readme", "789012fed345"),
    ]

    testSetup = await mount(
      <Wrapper>
        <CommitSelector
          commits={commits}
          uncommitedFileCount={0}
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
    const onSelect = mock((_s: SelectedCommit) => {})
    const commits = [makeCommit("some change", "abcdef123456")]

    testSetup = await mount(
      <Wrapper>
        <CommitSelector
          commits={commits}
          uncommitedFileCount={0}
          onSelect={onSelect}
          focused
        />
      </Wrapper>,
    )

    expect(testSetup.captureCharFrame()).toContain("#abcdef")
  })

  test("auto-selects uncommitted changes on mount when present", async () => {
    const onSelect = mock((_s: SelectedCommit) => {})

    testSetup = await mount(
      <Wrapper>
        <CommitSelector
          commits={[makeCommit("a commit", "aaa111bbb222")]}
          uncommitedFileCount={2}
          onSelect={onSelect}
          focused
        />
      </Wrapper>,
    )

    expect(onSelect).toHaveBeenCalledTimes(1)
    const selection: SelectedCommit = onSelect.mock.calls[0]![0] as SelectedCommit
    expect(selection.kind).toBe("uncommitted")
  })

  test("auto-selects first commit on mount when no uncommitted files", async () => {
    const onSelect = mock((_s: SelectedCommit) => {})
    const commits = [
      makeCommit("first commit", "aaa111bbb222"),
      makeCommit("second commit", "ccc333ddd444"),
    ]

    testSetup = await mount(
      <Wrapper>
        <CommitSelector
          commits={commits}
          uncommitedFileCount={0}
          onSelect={onSelect}
          focused
        />
      </Wrapper>,
    )

    expect(onSelect).toHaveBeenCalledTimes(1)
    const selection: SelectedCommit = onSelect.mock.calls[0]![0] as SelectedCommit
    expect(selection.kind).toBe("commit")
    if (selection.kind === "commit") {
      expect(selection.commit.sha).toBe("aaa111bbb222")
    }
  })

  test("calls onSelect with correct commit when navigating down", async () => {
    const onSelect = mock((_s: SelectedCommit) => {})
    const commits = [
      makeCommit("first commit", "aaa111bbb222"),
      makeCommit("second commit", "ccc333ddd444"),
    ]

    testSetup = await mount(
      <Wrapper>
        <CommitSelector
          commits={commits}
          uncommitedFileCount={2}
          onSelect={onSelect}
          focused
        />
      </Wrapper>,
    )

    // Auto-select fires first (uncommitted)
    expect(onSelect).toHaveBeenCalledTimes(1)

    // Navigate down to first commit
    await pressKeyAndRender(testSetup, "j")

    expect(onSelect).toHaveBeenCalledTimes(2)
    const selection: SelectedCommit = onSelect.mock.calls[1]![0] as SelectedCommit
    expect(selection.kind).toBe("commit")
    if (selection.kind === "commit") {
      expect(selection.commit.sha).toBe("aaa111bbb222")
    }
  })

  test("calls onSelect with second commit when navigating down twice", async () => {
    const onSelect = mock((_s: SelectedCommit) => {})
    const commits = [
      makeCommit("first commit", "aaa111bbb222"),
      makeCommit("second commit", "ccc333ddd444"),
    ]

    testSetup = await mount(
      <Wrapper>
        <CommitSelector
          commits={commits}
          uncommitedFileCount={2}
          onSelect={onSelect}
          focused
        />
      </Wrapper>,
    )

    await pressKeyAndRender(testSetup, "j")
    await pressKeyAndRender(testSetup, "j")

    expect(onSelect).toHaveBeenCalledTimes(3)
    const selection: SelectedCommit = onSelect.mock.calls[2]![0] as SelectedCommit
    expect(selection.kind).toBe("commit")
    if (selection.kind === "commit") {
      expect(selection.commit.sha).toBe("ccc333ddd444")
    }
  })

  test("uncommitted option appears before commits in navigation order", async () => {
    const onSelect = mock((_s: SelectedCommit) => {})
    const commits = [makeCommit("a commit", "aaa111bbb222")]

    testSetup = await mount(
      <Wrapper>
        <CommitSelector
          commits={commits}
          uncommitedFileCount={1}
          onSelect={onSelect}
          focused
        />
      </Wrapper>,
    )

    // First call is auto-select of uncommitted
    const first: SelectedCommit = onSelect.mock.calls[0]![0] as SelectedCommit
    expect(first.kind).toBe("uncommitted")

    // Down arrow goes to the commit
    await pressKeyAndRender(testSetup, "j")
    const second: SelectedCommit = onSelect.mock.calls[1]![0] as SelectedCommit
    expect(second.kind).toBe("commit")
  })
})
