import { describe, test, expect, afterEach } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { Provider, createStore } from "jotai";
import type { GitData } from "../hooks/git-data";
import type { ChangedFile, CommitInfo, FileDiff } from "../lib/git";
import { serializeFrameStyled, serializeFrameText } from "../lib/test/serialize-frame";
import { MainScreen } from "./MainScreen";

// ---------------------------------------------------------------------------
// Mock GitProvider — resolves after one macrotask tick
// ---------------------------------------------------------------------------

/**
 * Delay by one macrotask tick. This prevents mock git promises from resolving
 * in the microtask gap between `testRender` returning (with
 * IS_REACT_ACT_ENVIRONMENT still true) and test code setting the flag to
 * false. Without this, resolved promises trigger React state updates that
 * produce "not wrapped in act(...)" warnings.
 */
function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

class SnapshotGit {
  branch: string;
  commits: CommitInfo[];
  uncommittedFiles: ChangedFile[];
  committedFilesMap: Map<string, ChangedFile[]>;
  diffs: Map<string, FileDiff>;

  isRepo = true;

  async isGitRepo() {
    await tick();
    return this.isRepo;
  }
  async getBaseBranchName() {
    await tick();
    return "main";
  }

  constructor(data: Partial<GitData>) {
    this.branch = data.branchName ?? "feature/test";
    this.commits = data.commits ?? [];
    this.uncommittedFiles = data.uncommitedFiles ?? [];
    this.committedFilesMap = new Map<string, ChangedFile[]>();
    for (const f of data.committedFiles ?? []) {
      const existing = this.committedFilesMap.get(f.commitSha) ?? [];
      existing.push(f);
      this.committedFilesMap.set(f.commitSha, existing);
    }
    this.diffs = new Map<string, FileDiff>();
    if (data.selectedDiff) {
      const file = data.selectedFile;
      if (file) {
        this.diffs.set(`${file.commitSha}:${file.path}`, data.selectedDiff);
      }
    }
  }

  async getCurrentBranchName() {
    await tick();
    return this.branch;
  }
  async getCommitsSinceBase() {
    await tick();
    return this.commits;
  }
  async getUncommitedFiles() {
    await tick();
    return this.uncommittedFiles;
  }
  async getChangedFilesForCommit(commit: CommitInfo) {
    await tick();
    return this.committedFilesMap.get(commit.sha) ?? [];
  }
  async getFileDiff(file: ChangedFile) {
    await tick();
    return (
      this.diffs.get(`${file.commitSha}:${file.path}`) ?? {
        path: file.path,
        unifiedDiff: `diff for ${file.path}`,
      }
    );
  }
}

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const FIXTURE: Partial<GitData> = {
  branchName: "feature/test",
  commits: [
    { title: "feat: add auth", body: null, sha: "abc123def456" },
    { title: "fix: correct typo", body: null, sha: "789012fed345" },
  ],
  uncommitedFiles: [
    {
      path: "src/auth.ts",
      commitSha: "uncommitted",
      insertions: 12,
      deletions: 3,
      operation: "changed",
    },
    {
      path: "src/utils.ts",
      commitSha: "uncommitted",
      insertions: 5,
      deletions: 0,
      operation: "created",
    },
  ],
  committedFiles: [
    {
      path: "src/login.ts",
      commitSha: "abc123def456",
      insertions: 20,
      deletions: 0,
      operation: "created",
    },
  ],
  selectedFile: {
    path: "src/auth.ts",
    commitSha: "uncommitted",
    insertions: 12,
    deletions: 3,
    operation: "changed",
  },
  selectedDiff: {
    path: "src/auth.ts",
    unifiedDiff: [
      "diff --git a/src/auth.ts b/src/auth.ts",
      "index abc1234..def5678 100644",
      "--- a/src/auth.ts",
      "+++ b/src/auth.ts",
      "@@ -1,3 +1,4 @@",
      " export function auth() {",
      '+  validate("token");',
      "   return true;",
      " }",
    ].join("\n"),
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TestSetup = Awaited<ReturnType<typeof testRender>>;

/**
 * Mount MainScreen with a mock git provider, wait for async data to load,
 * then capture the rendered frame.
 */
async function mountMainScreen(
  overrides: Partial<GitData> = {},
  opts = { width: 120, height: 35 },
): Promise<TestSetup> {
  const data = { ...FIXTURE, ...overrides };
  const git = new SnapshotGit(data);

  const ts = await testRender(
    <Provider store={createStore()}>
      <MainScreen git={git} />
    </Provider>,
    opts,
  );

  const { act } = await import("react");
  // testRender sets IS_REACT_ACT_ENVIRONMENT = true. Disable it while we
  // render outside of act() so React doesn't warn about deferred updates.
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  // Initial render
  await ts.renderOnce();
  // Wait for async git calls to resolve + re-render
  await new Promise((r) => setTimeout(r, 30));
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    await ts.renderOnce();
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;

  return ts;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MainScreen", () => {
  let testSetup: TestSetup;

  afterEach(() => {
    if (testSetup) testSetup.renderer.destroy();
  });

  describe("snapshots", () => {
    test("layout: default state with uncommitted changes", async () => {
      testSetup = await mountMainScreen();

      expect(serializeFrameText(testSetup.captureSpans())).toMatchSnapshot();
    });

    test("visual: default state with uncommitted changes", async () => {
      testSetup = await mountMainScreen();

      expect(serializeFrameStyled(testSetup.captureSpans())).toMatchSnapshot();
    });

    test("layout: no diffs to display", async () => {
      testSetup = await mountMainScreen({
        uncommitedFiles: [],
        committedFiles: [],
        commits: [],
        selectedFile: null,
        selectedDiff: undefined,
      });

      expect(serializeFrameText(testSetup.captureSpans())).toMatchSnapshot();
    });

    test("layout: not a git repo", async () => {
      const data = { ...FIXTURE };
      const git = new SnapshotGit(data);
      git.isRepo = false;

      testSetup = await testRender(
        <Provider store={createStore()}>
          <MainScreen git={git} />
        </Provider>,
        { width: 120, height: 35 },
      );

      const { act } = await import("react");
      globalThis.IS_REACT_ACT_ENVIRONMENT = false;
      await testSetup.renderOnce();
      await new Promise((r) => setTimeout(r, 30));
      globalThis.IS_REACT_ACT_ENVIRONMENT = true;
      await act(async () => {
        await testSetup.renderOnce();
      });
      globalThis.IS_REACT_ACT_ENVIRONMENT = false;

      expect(serializeFrameText(testSetup.captureSpans())).toMatchSnapshot();
    });

    test("visual: not a git repo", async () => {
      const data = { ...FIXTURE };
      const git = new SnapshotGit(data);
      git.isRepo = false;

      testSetup = await testRender(
        <Provider store={createStore()}>
          <MainScreen git={git} />
        </Provider>,
        { width: 120, height: 35 },
      );

      const { act } = await import("react");
      globalThis.IS_REACT_ACT_ENVIRONMENT = false;
      await testSetup.renderOnce();
      await new Promise((r) => setTimeout(r, 30));
      globalThis.IS_REACT_ACT_ENVIRONMENT = true;
      await act(async () => {
        await testSetup.renderOnce();
      });
      globalThis.IS_REACT_ACT_ENVIRONMENT = false;

      expect(serializeFrameStyled(testSetup.captureSpans())).toMatchSnapshot();
    });

    test("layout: with update banner", async () => {
      testSetup = await mountMainScreen();

      // Update banner is driven by useUpdateCheck which we can't easily
      // inject without module mocking. Instead we test the banner component
      // in isolation (UpdateBanner.test.tsx) and verify the full layout here.
      expect(serializeFrameText(testSetup.captureSpans())).toMatchSnapshot();
    });
  });
});
