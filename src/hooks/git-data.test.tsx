import { describe, test, expect, afterEach } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { act, type ReactNode } from "react";
import { useKeyboard } from "@opentui/react";
import type { ChangedFile, CommitInfo, FileDiff } from "../lib/git";
import type { SelectedCommit } from "../components/CommitSelector";
import {
  commitsEqual,
  filesEqual,
  isSelectedCommitValid,
  isSelectedFileValid,
  useGitData,
  type GitProvider,
} from "./git-data";

// ---------------------------------------------------------------------------
// Global type declaration
// ---------------------------------------------------------------------------

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeCommit(title: string, sha: string): CommitInfo {
  return { title, body: null, sha };
}

function makeFile(
  path: string,
  commitSha = "uncommitted",
  overrides?: Partial<ChangedFile>,
): ChangedFile {
  return {
    path,
    commitSha,
    insertions: 1,
    deletions: 0,
    operation: "changed",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock GitProvider
// ---------------------------------------------------------------------------

class MockGit implements GitProvider {
  branch = "feature/test";
  commits: CommitInfo[] = [];
  uncommittedFiles: ChangedFile[] = [];
  committedFilesMap = new Map<string, ChangedFile[]>();
  diffs = new Map<string, FileDiff>();
  isRepo = true;

  async isGitRepo() {
    return this.isRepo;
  }
  async getCurrentBranchName() {
    return this.branch;
  }
  async getCommitsSinceBase() {
    return this.commits;
  }
  async getUncommitedFiles() {
    return this.uncommittedFiles;
  }
  async getChangedFilesForCommit(commit: CommitInfo) {
    return this.committedFilesMap.get(commit.sha) ?? [];
  }
  async getFileDiff(file: ChangedFile) {
    return (
      this.diffs.get(`${file.commitSha}:${file.path}`) ?? {
        path: file.path,
        unifiedDiff: `diff for ${file.path}`,
      }
    );
  }
}

// ---------------------------------------------------------------------------
// Test-render helpers
// ---------------------------------------------------------------------------

type TestSetup = Awaited<ReturnType<typeof testRender>>;

async function mount(jsx: ReactNode, opts = { width: 80, height: 20 }): Promise<TestSetup> {
  const ts = await testRender(jsx, opts);
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  await ts.renderOnce();
  return ts;
}

/**
 * Wait for async operations to settle (promises from mock git resolve
 * immediately, so a short delay is enough), then render within act()
 * to flush all resulting state updates.
 */
async function waitAndRender(setup: TestSetup, ms = 20) {
  // Let async effect callbacks (promise chains, setInterval ticks) complete
  await new Promise((r) => setTimeout(r, ms));
  // Flush pending state updates and re-render
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    await setup.renderOnce();
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
}

async function pressKeyAndRender(setup: TestSetup, key: string) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    setup.mockInput.pressKey(key);
    await setup.renderOnce();
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
}

// ---------------------------------------------------------------------------
// Test component — renders hook state as inspectable text
// ---------------------------------------------------------------------------

function GitDataDisplay({
  mockGit,
  pollInterval = 50,
}: {
  mockGit: MockGit;
  pollInterval?: number;
}) {
  const data = useGitData({ git: mockGit, pollInterval });

  // Allow tests to drive selection via keyboard
  useKeyboard((e) => {
    if (e.eventType !== "press") return;
    // 'f' = select the second file in the current commit's file list
    if (e.name === "f") {
      const files =
        data.selectedCommit?.kind === "uncommitted"
          ? data.uncommitedFiles
          : data.committedFiles.filter(
              (f) =>
                f.commitSha ===
                (data.selectedCommit as Extract<SelectedCommit, { kind: "commit" }>)?.commit.sha,
            );
      if (files.length > 1) {
        data.setSelectedFile(files[1]!);
      }
    }
    // 'c' = select the first real commit (switch away from uncommitted)
    if (e.name === "c" && data.commits.length > 0) {
      data.setSelectedCommit({ kind: "commit", commit: data.commits[0]! });
    }
  });

  const commitStr = data.selectedCommit
    ? data.selectedCommit.kind === "uncommitted"
      ? "uncommitted"
      : data.selectedCommit.commit.sha
    : "none";

  return (
    <box flexDirection="column" width="100%" height="100%">
      <text>loading:{String(data.loading)}</text>
      <text>notGitRepo:{String(data.notGitRepo)}</text>
      <text>branch:{data.branchName ?? "none"}</text>
      <text>commits:{data.commits.map((c) => c.sha).join(",") || "empty"}</text>
      <text>uncommitted:{data.uncommitedFiles.map((f) => f.path).join(",") || "empty"}</text>
      <text>committed:{data.committedFiles.map((f) => f.path).join(",") || "empty"}</text>
      <text>selectedCommit:{commitStr}</text>
      <text>selectedFile:{data.selectedFile?.path ?? "none"}</text>
      <text>diff:{data.selectedDiff?.path ?? "none"}</text>
    </box>
  );
}

// ===========================================================================
// commitsEqual
// ===========================================================================

describe("commitsEqual", () => {
  test("returns true for two empty arrays", () => {
    expect(commitsEqual([], [])).toBe(true);
  });

  test("returns true when SHAs match", () => {
    const a = [makeCommit("a", "sha1"), makeCommit("b", "sha2")];
    const b = [makeCommit("a", "sha1"), makeCommit("b", "sha2")];
    expect(commitsEqual(a, b)).toBe(true);
  });

  test("returns true when titles differ but SHAs match", () => {
    const a = [makeCommit("title A", "sha1")];
    const b = [makeCommit("title B", "sha1")];
    expect(commitsEqual(a, b)).toBe(true);
  });

  test("returns false for different lengths", () => {
    const a = [makeCommit("a", "sha1")];
    const b = [makeCommit("a", "sha1"), makeCommit("b", "sha2")];
    expect(commitsEqual(a, b)).toBe(false);
  });

  test("returns false when a SHA differs", () => {
    const a = [makeCommit("a", "sha1"), makeCommit("b", "sha2")];
    const b = [makeCommit("a", "sha1"), makeCommit("b", "sha3")];
    expect(commitsEqual(a, b)).toBe(false);
  });

  test("returns false when order differs", () => {
    const a = [makeCommit("a", "sha1"), makeCommit("b", "sha2")];
    const b = [makeCommit("b", "sha2"), makeCommit("a", "sha1")];
    expect(commitsEqual(a, b)).toBe(false);
  });
});

// ===========================================================================
// filesEqual
// ===========================================================================

describe("filesEqual", () => {
  test("returns true for two empty arrays", () => {
    expect(filesEqual([], [])).toBe(true);
  });

  test("returns true for identical files", () => {
    const a = [makeFile("a.ts"), makeFile("b.ts")];
    const b = [makeFile("a.ts"), makeFile("b.ts")];
    expect(filesEqual(a, b)).toBe(true);
  });

  test("returns false for different lengths", () => {
    expect(filesEqual([makeFile("a.ts")], [])).toBe(false);
  });

  test("returns false when paths differ", () => {
    const a = [makeFile("a.ts")];
    const b = [makeFile("b.ts")];
    expect(filesEqual(a, b)).toBe(false);
  });

  test("returns false when commitSha differs", () => {
    const a = [makeFile("a.ts", "sha1")];
    const b = [makeFile("a.ts", "sha2")];
    expect(filesEqual(a, b)).toBe(false);
  });

  test("returns false when insertions differ", () => {
    const a = [makeFile("a.ts", "uncommitted", { insertions: 1 })];
    const b = [makeFile("a.ts", "uncommitted", { insertions: 5 })];
    expect(filesEqual(a, b)).toBe(false);
  });

  test("returns false when deletions differ", () => {
    const a = [makeFile("a.ts", "uncommitted", { deletions: 0 })];
    const b = [makeFile("a.ts", "uncommitted", { deletions: 3 })];
    expect(filesEqual(a, b)).toBe(false);
  });

  test("returns false when operation differs", () => {
    const a = [makeFile("a.ts", "uncommitted", { operation: "changed" })];
    const b = [makeFile("a.ts", "uncommitted", { operation: "created" })];
    expect(filesEqual(a, b)).toBe(false);
  });

  test("returns false when order differs", () => {
    const a = [makeFile("a.ts"), makeFile("b.ts")];
    const b = [makeFile("b.ts"), makeFile("a.ts")];
    expect(filesEqual(a, b)).toBe(false);
  });
});

// ===========================================================================
// isSelectedCommitValid
// ===========================================================================

describe("isSelectedCommitValid", () => {
  const commits = [makeCommit("feat", "sha1"), makeCommit("fix", "sha2")];
  const uncommittedFiles = [makeFile("a.ts")];

  test("returns false for null selection", () => {
    expect(isSelectedCommitValid(null, commits, uncommittedFiles)).toBe(false);
  });

  test("returns true for uncommitted when uncommitted files exist", () => {
    expect(isSelectedCommitValid({ kind: "uncommitted" }, commits, uncommittedFiles)).toBe(true);
  });

  test("returns false for uncommitted when no uncommitted files", () => {
    expect(isSelectedCommitValid({ kind: "uncommitted" }, commits, [])).toBe(false);
  });

  test("returns true for a commit whose SHA exists in the list", () => {
    expect(isSelectedCommitValid({ kind: "commit", commit: commits[0]! }, commits, [])).toBe(true);
  });

  test("returns false for a commit whose SHA is not in the list", () => {
    expect(
      isSelectedCommitValid(
        { kind: "commit", commit: makeCommit("gone", "sha-gone") },
        commits,
        [],
      ),
    ).toBe(false);
  });

  test("returns true with empty commit list when uncommitted selected and files exist", () => {
    expect(isSelectedCommitValid({ kind: "uncommitted" }, [], uncommittedFiles)).toBe(true);
  });
});

// ===========================================================================
// isSelectedFileValid
// ===========================================================================

describe("isSelectedFileValid", () => {
  const files = [makeFile("a.ts", "sha1"), makeFile("b.ts", "sha2")];

  test("returns false for null selection", () => {
    expect(isSelectedFileValid(null, files)).toBe(false);
  });

  test("returns true when file exists in list", () => {
    expect(isSelectedFileValid(makeFile("a.ts", "sha1"), files)).toBe(true);
  });

  test("returns false when path is not in list", () => {
    expect(isSelectedFileValid(makeFile("z.ts", "sha1"), files)).toBe(false);
  });

  test("returns false when path matches but commitSha differs", () => {
    expect(isSelectedFileValid(makeFile("a.ts", "other-sha"), files)).toBe(false);
  });

  test("returns false for empty file list", () => {
    expect(isSelectedFileValid(makeFile("a.ts"), [])).toBe(false);
  });
});

// ===========================================================================
// useGitData — integration tests
// ===========================================================================

describe("useGitData", () => {
  let testSetup: TestSetup;

  afterEach(() => {
    if (testSetup) testSetup.renderer.destroy();
  });

  describe("not a git repo", () => {
    test("sets notGitRepo when directory is not a git repo", async () => {
      const mockGit = new MockGit();
      mockGit.isRepo = false;

      testSetup = await mount(<GitDataDisplay mockGit={mockGit} />);
      await waitAndRender(testSetup);

      const frame = testSetup.captureCharFrame();
      expect(frame).toContain("loading:false");
      expect(frame).toContain("notGitRepo:true");
    });
  });

  describe("initial load", () => {
    test("starts in loading state", async () => {
      const mockGit = new MockGit();

      testSetup = await mount(<GitDataDisplay mockGit={mockGit} />);

      // Before async completes, loading should be true
      expect(testSetup.captureCharFrame()).toContain("loading:true");
    });

    test("loads data and selects uncommitted when uncommitted files exist", async () => {
      const mockGit = new MockGit();
      mockGit.uncommittedFiles = [makeFile("a.ts"), makeFile("b.ts")];
      mockGit.commits = [makeCommit("feat", "sha1")];
      mockGit.committedFilesMap.set("sha1", [makeFile("c.ts", "sha1")]);

      testSetup = await mount(<GitDataDisplay mockGit={mockGit} />);
      await waitAndRender(testSetup);

      const frame = testSetup.captureCharFrame();
      expect(frame).toContain("loading:false");
      expect(frame).toContain("branch:feature/test");
      expect(frame).toContain("uncommitted:a.ts,b.ts");
      expect(frame).toContain("committed:c.ts");
      expect(frame).toContain("selectedCommit:uncommitted");
      expect(frame).toContain("selectedFile:a.ts");
    });

    test("selects first commit when no uncommitted files exist", async () => {
      const mockGit = new MockGit();
      mockGit.commits = [makeCommit("first", "sha1"), makeCommit("second", "sha2")];
      mockGit.committedFilesMap.set("sha1", [makeFile("x.ts", "sha1")]);
      mockGit.committedFilesMap.set("sha2", [makeFile("y.ts", "sha2")]);

      testSetup = await mount(<GitDataDisplay mockGit={mockGit} />);
      await waitAndRender(testSetup);

      const frame = testSetup.captureCharFrame();
      expect(frame).toContain("selectedCommit:sha1");
      expect(frame).toContain("selectedFile:x.ts");
    });

    test("selects nothing when no data exists", async () => {
      const mockGit = new MockGit();

      testSetup = await mount(<GitDataDisplay mockGit={mockGit} />);
      await waitAndRender(testSetup);

      const frame = testSetup.captureCharFrame();
      expect(frame).toContain("loading:false");
      expect(frame).toContain("selectedCommit:none");
      expect(frame).toContain("selectedFile:none");
    });
  });

  describe("diff fetching", () => {
    test("fetches diff for the selected file", async () => {
      const mockGit = new MockGit();
      mockGit.uncommittedFiles = [makeFile("main.ts")];
      mockGit.diffs.set("uncommitted:main.ts", {
        path: "main.ts",
        unifiedDiff: "+hello world",
      });

      testSetup = await mount(<GitDataDisplay mockGit={mockGit} />);
      await waitAndRender(testSetup);
      // Extra render for the diff effect (fires after selectedFile is set)
      await waitAndRender(testSetup);

      expect(testSetup.captureCharFrame()).toContain("diff:main.ts");
    });
  });

  describe("poll stability", () => {
    test("preserves selection when poll returns identical data", async () => {
      const mockGit = new MockGit();
      mockGit.uncommittedFiles = [makeFile("a.ts"), makeFile("b.ts")];

      testSetup = await mount(<GitDataDisplay mockGit={mockGit} pollInterval={40} />);
      await waitAndRender(testSetup);

      const frameBefore = testSetup.captureCharFrame();
      expect(frameBefore).toContain("selectedCommit:uncommitted");
      expect(frameBefore).toContain("selectedFile:a.ts");

      // Wait for at least one poll cycle (40ms) + slack
      await waitAndRender(testSetup, 80);

      const frameAfter = testSetup.captureCharFrame();
      expect(frameAfter).toContain("selectedCommit:uncommitted");
      expect(frameAfter).toContain("selectedFile:a.ts");
    });
  });

  describe("user selection preserved through poll", () => {
    test("preserves user-changed file selection through poll", async () => {
      const mockGit = new MockGit();
      mockGit.uncommittedFiles = [makeFile("a.ts"), makeFile("b.ts")];

      testSetup = await mount(<GitDataDisplay mockGit={mockGit} pollInterval={40} />);
      await waitAndRender(testSetup);
      expect(testSetup.captureCharFrame()).toContain("selectedFile:a.ts");

      // User selects the second file via 'f' key
      await pressKeyAndRender(testSetup, "f");
      await waitAndRender(testSetup);
      expect(testSetup.captureCharFrame()).toContain("selectedFile:b.ts");

      // Wait for a poll cycle — selection should stay on b.ts
      await waitAndRender(testSetup, 80);
      expect(testSetup.captureCharFrame()).toContain("selectedFile:b.ts");
    });

    test("preserves user-changed commit selection through poll", async () => {
      const mockGit = new MockGit();
      mockGit.uncommittedFiles = [makeFile("a.ts")];
      mockGit.commits = [makeCommit("feat", "sha1")];
      mockGit.committedFilesMap.set("sha1", [makeFile("c.ts", "sha1")]);

      testSetup = await mount(<GitDataDisplay mockGit={mockGit} pollInterval={40} />);
      await waitAndRender(testSetup);
      expect(testSetup.captureCharFrame()).toContain("selectedCommit:uncommitted");

      // User switches to the first commit via 'c' key
      await pressKeyAndRender(testSetup, "c");
      await waitAndRender(testSetup);
      expect(testSetup.captureCharFrame()).toContain("selectedCommit:sha1");

      // Wait for a poll cycle — commit selection should stay
      await waitAndRender(testSetup, 80);
      expect(testSetup.captureCharFrame()).toContain("selectedCommit:sha1");
    });
  });

  describe("data updates", () => {
    test("updates lists when poll returns new data", async () => {
      const mockGit = new MockGit();
      mockGit.uncommittedFiles = [makeFile("a.ts")];

      testSetup = await mount(<GitDataDisplay mockGit={mockGit} pollInterval={40} />);
      await waitAndRender(testSetup);
      expect(testSetup.captureCharFrame()).toContain("uncommitted:a.ts");

      // Simulate a new file appearing
      mockGit.uncommittedFiles = [makeFile("a.ts"), makeFile("new.ts")];

      await waitAndRender(testSetup, 80);
      expect(testSetup.captureCharFrame()).toContain("uncommitted:a.ts,new.ts");
    });

    test("updates branch name when it changes", async () => {
      const mockGit = new MockGit();
      mockGit.branch = "feature/old";
      mockGit.uncommittedFiles = [makeFile("a.ts")];

      testSetup = await mount(<GitDataDisplay mockGit={mockGit} pollInterval={40} />);
      await waitAndRender(testSetup);
      expect(testSetup.captureCharFrame()).toContain("branch:feature/old");

      mockGit.branch = "feature/new";

      await waitAndRender(testSetup, 80);
      expect(testSetup.captureCharFrame()).toContain("branch:feature/new");
    });
  });

  describe("selection recovery", () => {
    test("resets commit selection when selected commit is removed", async () => {
      const mockGit = new MockGit();
      mockGit.commits = [makeCommit("first", "sha1"), makeCommit("second", "sha2")];
      mockGit.committedFilesMap.set("sha1", [makeFile("a.ts", "sha1")]);
      mockGit.committedFilesMap.set("sha2", [makeFile("b.ts", "sha2")]);

      testSetup = await mount(<GitDataDisplay mockGit={mockGit} pollInterval={40} />);
      await waitAndRender(testSetup);
      expect(testSetup.captureCharFrame()).toContain("selectedCommit:sha1");

      // Remove the first commit (e.g. rebased away)
      mockGit.commits = [makeCommit("second", "sha2")];
      mockGit.committedFilesMap.delete("sha1");

      await waitAndRender(testSetup, 80);

      // Should fall back to the remaining commit
      const frame = testSetup.captureCharFrame();
      expect(frame).toContain("selectedCommit:sha2");
      expect(frame).toContain("selectedFile:b.ts");
    });

    test("resets to uncommitted when all commits are removed but uncommitted files exist", async () => {
      const mockGit = new MockGit();
      mockGit.commits = [makeCommit("only", "sha1")];
      mockGit.committedFilesMap.set("sha1", [makeFile("a.ts", "sha1")]);

      testSetup = await mount(<GitDataDisplay mockGit={mockGit} pollInterval={40} />);
      await waitAndRender(testSetup);
      expect(testSetup.captureCharFrame()).toContain("selectedCommit:sha1");

      // Commit is gone, but new uncommitted changes appeared
      mockGit.commits = [];
      mockGit.committedFilesMap.clear();
      mockGit.uncommittedFiles = [makeFile("new.ts")];

      await waitAndRender(testSetup, 80);

      const frame = testSetup.captureCharFrame();
      expect(frame).toContain("selectedCommit:uncommitted");
      expect(frame).toContain("selectedFile:new.ts");
    });

    test("clears selection when all data is removed", async () => {
      const mockGit = new MockGit();
      mockGit.uncommittedFiles = [makeFile("a.ts")];

      testSetup = await mount(<GitDataDisplay mockGit={mockGit} pollInterval={40} />);
      await waitAndRender(testSetup);
      expect(testSetup.captureCharFrame()).toContain("selectedFile:a.ts");

      // Everything gone
      mockGit.uncommittedFiles = [];

      await waitAndRender(testSetup, 80);

      const frame = testSetup.captureCharFrame();
      expect(frame).toContain("selectedCommit:none");
      expect(frame).toContain("selectedFile:none");
    });

    test("resets file selection when selected file is removed but commit still exists", async () => {
      const mockGit = new MockGit();
      mockGit.uncommittedFiles = [makeFile("a.ts"), makeFile("b.ts")];

      testSetup = await mount(<GitDataDisplay mockGit={mockGit} pollInterval={40} />);
      await waitAndRender(testSetup);
      expect(testSetup.captureCharFrame()).toContain("selectedFile:a.ts");

      // Remove a.ts but keep b.ts
      mockGit.uncommittedFiles = [makeFile("b.ts")];

      await waitAndRender(testSetup, 80);

      const frame = testSetup.captureCharFrame();
      expect(frame).toContain("selectedCommit:uncommitted");
      expect(frame).toContain("selectedFile:b.ts");
    });
  });
});
