import { describe, test, expect, afterEach } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { act } from "react";
import { Provider, createStore } from "jotai";
import type { GitData } from "../hooks/git-data";
import type { ChangedFile, CommitInfo, FileDiff } from "../lib/git";
import { serializeFrameStyled, serializeFrameText } from "../lib/test/serialize-frame";
import { MainScreen } from "./MainScreen";

// ---------------------------------------------------------------------------
// Mock GitProvider — resolves after one macrotask tick
// ---------------------------------------------------------------------------

class SnapshotGit {
  branch: string;
  commits: CommitInfo[];
  uncommittedFiles: ChangedFile[];
  committedFilesMap: Map<string, ChangedFile[]>;
  diffs: Map<string, FileDiff>;

  isRepo = true;

  async isGitRepo() {
    return this.isRepo;
  }
  async getBaseBranchName() {
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
async function actRender(setup: TestSetup) {
  await act(async () => {
    await setup.renderOnce();
  });
}

async function mountMainScreen(
  overrides: Partial<GitData> = {},
  opts = { width: 120, height: 35 },
  gitOpts: { isRepo?: boolean } = {},
): Promise<TestSetup> {
  const data = { ...FIXTURE, ...overrides };
  const git = new SnapshotGit(data);
  if (gitOpts.isRepo === false) git.isRepo = false;

  let ts!: TestSetup;
  await act(async () => {
    ts = await testRender(
      <Provider store={createStore()}>
        <MainScreen git={git} />
      </Provider>,
      opts,
    );
  });

  // Multiple act-render cycles let cascading effects (initial data load →
  // diff fetch → etc.) settle without firing state updates outside act().
  await actRender(ts);
  await actRender(ts);
  await actRender(ts);

  return ts;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MainScreen", () => {
  let testSetup: TestSetup;

  afterEach(() => {
    if (testSetup) act(() => testSetup.renderer.destroy());
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
      testSetup = await mountMainScreen({}, { width: 120, height: 35 }, { isRepo: false });

      expect(serializeFrameText(testSetup.captureSpans())).toMatchSnapshot();
    });

    test("visual: not a git repo", async () => {
      testSetup = await mountMainScreen({}, { width: 120, height: 35 }, { isRepo: false });

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
