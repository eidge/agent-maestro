import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile as bunWriteFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { Git } from "./index.ts";

let dir: string;

function runGitCmd(cwd: string, args: string[]) {
  const result = Bun.spawnSync(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString());
  }
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "git-test-"));
  runGitCmd(dir, ["init", "-b", "main"]);
  runGitCmd(dir, ["config", "user.email", "test@test.com"]);
  runGitCmd(dir, ["config", "user.name", "Test"]);
  runGitCmd(dir, ["commit", "--allow-empty", "-m", "init"]);
});

afterEach(async () => {
  await rm(dir, { recursive: true });
});

describe("getCurrentBranchName", () => {
  test("returns the current branch", async () => {
    const git = new Git(dir);
    expect(await git.getCurrentBranchName()).toBe("main");
  });

  test("returns a non-default branch after checkout", async () => {
    runGitCmd(dir, ["checkout", "-b", "feature/foo"]);
    const git = new Git(dir);
    expect(await git.getCurrentBranchName()).toBe("feature/foo");
  });
});

describe("getBaseBranchName", () => {
  test("returns main when it exists", async () => {
    const git = new Git(dir);
    expect(await git.getBaseBranchName()).toBe("main");
  });

  test("returns master when main does not exist", async () => {
    runGitCmd(dir, ["branch", "-m", "main", "master"]);
    const git = new Git(dir);
    expect(await git.getBaseBranchName()).toBe("master");
  });

  test("resolves via origin/HEAD when a remote is set", async () => {
    // Create a bare "remote" repo with a default branch called "develop"
    const remoteDir = await mkdtemp(join(tmpdir(), "git-remote-"));
    runGitCmd(remoteDir, ["init", "--bare", "-b", "develop"]);

    // Push main as "develop" to the remote, then delete local main
    runGitCmd(dir, ["remote", "add", "origin", remoteDir]);
    runGitCmd(dir, ["push", "-u", "origin", "main:develop"]);
    runGitCmd(dir, ["remote", "set-head", "origin", "develop"]);
    runGitCmd(dir, ["checkout", "-b", "feature/bar"]);
    runGitCmd(dir, ["branch", "-D", "main"]);

    const git = new Git(dir);
    expect(await git.getBaseBranchName()).toBe("develop");

    await rm(remoteDir, { recursive: true });
  });

  test("throws when neither main nor master exists and no remote", async () => {
    runGitCmd(dir, ["branch", "-m", "main", "something-else"]);
    const git = new Git(dir);
    expect(git.getBaseBranchName()).rejects.toThrow("Could not determine base branch");
  });
});

describe("getCommitsSinceBase", () => {
  test("returns empty array when on the base branch with no new commits", async () => {
    const git = new Git(dir);
    expect(await git.getCommitsSinceBase()).toEqual([]);
  });

  test("returns empty array when base branch has extra commits ahead of branch point", async () => {
    runGitCmd(dir, ["checkout", "-b", "feature/early"]);
    runGitCmd(dir, ["checkout", "main"]);
    runGitCmd(dir, ["commit", "--allow-empty", "-m", "main commit 1"]);
    runGitCmd(dir, ["commit", "--allow-empty", "-m", "main commit 2"]);
    runGitCmd(dir, ["checkout", "feature/early"]);

    const git = new Git(dir);
    expect(await git.getCommitsSinceBase()).toEqual([]);
  });

  test("returns empty array on a feature branch with no new commits", async () => {
    runGitCmd(dir, ["checkout", "-b", "feature/empty"]);

    const git = new Git(dir);
    expect(await git.getCommitsSinceBase()).toEqual([]);
  });

  test("returns commits made on a feature branch", async () => {
    runGitCmd(dir, ["checkout", "-b", "feature/stuff"]);
    runGitCmd(dir, ["commit", "--allow-empty", "-m", "first feature commit"]);
    runGitCmd(dir, ["commit", "--allow-empty", "-m", "second feature commit"]);

    const git = new Git(dir);
    const commits = await git.getCommitsSinceBase();

    expect(commits).toHaveLength(2);
    expect(commits[0]!.title).toBe("second feature commit");
    expect(commits[1]!.title).toBe("first feature commit");
    expect(commits[0]!.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(commits[1]!.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(commits[0]!.sha).not.toBe(commits[1]!.sha);
  });

  test("includes commit body", async () => {
    runGitCmd(dir, ["checkout", "-b", "feature/with-body"]);
    runGitCmd(dir, [
      "commit",
      "--allow-empty",
      "-m",
      "title line\n\nThis is the body\nwith multiple lines",
    ]);

    const git = new Git(dir);
    const commits = await git.getCommitsSinceBase();

    expect(commits).toHaveLength(1);
    expect(commits[0]!.title).toBe("title line");
    expect(commits[0]!.body).toContain("This is the body");
    expect(commits[0]!.body).toContain("with multiple lines");
  });

  test("returns empty body when commit has no body", async () => {
    runGitCmd(dir, ["checkout", "-b", "feature/no-body"]);
    runGitCmd(dir, ["commit", "--allow-empty", "-m", "just a title"]);

    const git = new Git(dir);
    const commits = await git.getCommitsSinceBase();

    expect(commits).toHaveLength(1);
    expect(commits[0]!.title).toBe("just a title");
    expect(commits[0]!.body).toBeNull();
  });

  test("does not include commits from the base branch", async () => {
    // Add another commit on main before branching
    runGitCmd(dir, ["commit", "--allow-empty", "-m", "second main commit"]);
    runGitCmd(dir, ["checkout", "-b", "feature/scoped"]);
    runGitCmd(dir, ["commit", "--allow-empty", "-m", "branch commit"]);

    const git = new Git(dir);
    const commits = await git.getCommitsSinceBase();

    expect(commits).toHaveLength(1);
    expect(commits[0]!.title).toBe("branch commit");
  });
});

describe("getChangedFilesForCommit", () => {
  async function writeAndAdd(path: string, content: string) {
    await bunWriteFile(join(dir, path), content);
    runGitCmd(dir, ["add", path]);
  }

  test("returns a created file", async () => {
    runGitCmd(dir, ["checkout", "-b", "feature/add"]);
    await writeAndAdd("hello.txt", "hello world\n");
    runGitCmd(dir, ["commit", "-m", "add hello"]);

    const git = new Git(dir);
    const commits = await git.getCommitsSinceBase();
    const files = await git.getChangedFilesForCommit(commits[0]!);

    expect(files).toEqual([
      {
        path: "hello.txt",
        commitSha: commits[0]!.sha,
        insertions: 1,
        deletions: 0,
        operation: "created",
      },
    ]);
  });

  test("returns a removed file", async () => {
    await writeAndAdd("remove-me.txt", "gone soon\n");
    runGitCmd(dir, ["commit", "-m", "add file to remove later"]);

    runGitCmd(dir, ["checkout", "-b", "feature/remove"]);
    runGitCmd(dir, ["rm", "remove-me.txt"]);
    runGitCmd(dir, ["commit", "-m", "remove file"]);

    const git = new Git(dir);
    const commits = await git.getCommitsSinceBase();
    const files = await git.getChangedFilesForCommit(commits[0]!);

    expect(files).toEqual([
      {
        path: "remove-me.txt",
        commitSha: commits[0]!.sha,
        insertions: 0,
        deletions: 1,
        operation: "removed",
      },
    ]);
  });

  test("returns a changed file", async () => {
    await writeAndAdd("edit-me.txt", "line one\n");
    runGitCmd(dir, ["commit", "-m", "add file to edit later"]);

    runGitCmd(dir, ["checkout", "-b", "feature/edit"]);
    await writeAndAdd("edit-me.txt", "line one\nline two\nline three\n");
    runGitCmd(dir, ["commit", "-m", "edit file"]);

    const git = new Git(dir);
    const commits = await git.getCommitsSinceBase();
    const files = await git.getChangedFilesForCommit(commits[0]!);

    expect(files).toEqual([
      {
        path: "edit-me.txt",
        commitSha: commits[0]!.sha,
        insertions: 2,
        deletions: 0,
        operation: "changed",
      },
    ]);
  });

  test("returns multiple changed files in a single commit", async () => {
    await writeAndAdd("existing.txt", "original\n");
    runGitCmd(dir, ["commit", "-m", "setup"]);

    runGitCmd(dir, ["checkout", "-b", "feature/multi"]);
    await writeAndAdd("new-file.txt", "I am new\n");
    await writeAndAdd("existing.txt", "modified\n");
    runGitCmd(dir, ["commit", "-m", "multiple changes"]);

    const git = new Git(dir);
    const commits = await git.getCommitsSinceBase();
    const files = await git.getChangedFilesForCommit(commits[0]!);

    const byPath = Object.fromEntries(files.map((f) => [f.path, f]));
    expect(files).toHaveLength(2);
    expect(byPath["new-file.txt"]!.operation).toBe("created");
    expect(byPath["new-file.txt"]!.commitSha).toBe(commits[0]!.sha);
    expect(byPath["existing.txt"]!.operation).toBe("changed");
    expect(byPath["existing.txt"]!.commitSha).toBe(commits[0]!.sha);
  });

  test("returns empty array for a commit with no file changes", async () => {
    runGitCmd(dir, ["checkout", "-b", "feature/empty-commit"]);
    runGitCmd(dir, ["commit", "--allow-empty", "-m", "empty"]);

    const git = new Git(dir);
    const commits = await git.getCommitsSinceBase();
    const files = await git.getChangedFilesForCommit(commits[0]!);

    expect(files).toEqual([]);
  });
});

describe("getUncommitedFiles", () => {
  async function writeFile(path: string, content: string) {
    await bunWriteFile(join(dir, path), content);
  }

  test("returns empty array when there are no uncommitted changes", async () => {
    const git = new Git(dir);
    expect(await git.getUncommitedFiles()).toEqual([]);
  });

  test("returns staged files", async () => {
    await writeFile("staged.txt", "hello\n");
    runGitCmd(dir, ["add", "staged.txt"]);

    const git = new Git(dir);
    const files = await git.getUncommitedFiles();

    expect(files).toEqual([
      {
        path: "staged.txt",
        commitSha: "uncommitted",
        insertions: 1,
        deletions: 0,
        operation: "created",
      },
    ]);
  });

  test("returns unstaged changes to tracked files", async () => {
    await writeFile("tracked.txt", "original\n");
    runGitCmd(dir, ["add", "tracked.txt"]);
    runGitCmd(dir, ["commit", "-m", "add tracked"]);

    await writeFile("tracked.txt", "original\nmodified\n");

    const git = new Git(dir);
    const files = await git.getUncommitedFiles();

    expect(files).toEqual([
      {
        path: "tracked.txt",
        commitSha: "uncommitted",
        insertions: 1,
        deletions: 0,
        operation: "changed",
      },
    ]);
  });

  test("returns both staged and unstaged changes", async () => {
    await writeFile("existing.txt", "line one\n");
    runGitCmd(dir, ["add", "existing.txt"]);
    runGitCmd(dir, ["commit", "-m", "setup"]);

    // Stage a new file
    await writeFile("new.txt", "new content\n");
    runGitCmd(dir, ["add", "new.txt"]);

    // Modify an existing file without staging
    await writeFile("existing.txt", "line one\nline two\n");

    const git = new Git(dir);
    const files = await git.getUncommitedFiles();
    const byPath = Object.fromEntries(files.map((f) => [f.path, f]));

    expect(files).toHaveLength(2);
    expect(byPath["new.txt"]!.operation).toBe("created");
    expect(byPath["new.txt"]!.commitSha).toBe("uncommitted");
    expect(byPath["existing.txt"]!.operation).toBe("changed");
    expect(byPath["existing.txt"]!.commitSha).toBe("uncommitted");
  });

  test("returns removed files", async () => {
    await writeFile("doomed.txt", "bye\n");
    runGitCmd(dir, ["add", "doomed.txt"]);
    runGitCmd(dir, ["commit", "-m", "add doomed"]);

    runGitCmd(dir, ["rm", "doomed.txt"]);

    const git = new Git(dir);
    const files = await git.getUncommitedFiles();

    expect(files).toEqual([
      {
        path: "doomed.txt",
        commitSha: "uncommitted",
        insertions: 0,
        deletions: 1,
        operation: "removed",
      },
    ]);
  });

  test("returns staged files inside a new directory", async () => {
    await mkdir(join(dir, "src", "components"), { recursive: true });
    await writeFile("src/components/foo.txt", "hello\n");
    await writeFile("src/components/bar.txt", "world\n");
    runGitCmd(dir, ["add", "src/"]);

    const git = new Git(dir);
    const files = await git.getUncommitedFiles();
    const byPath = Object.fromEntries(files.map((f) => [f.path, f]));

    expect(files).toHaveLength(2);
    expect(byPath["src/components/foo.txt"]!.operation).toBe("created");
    expect(byPath["src/components/foo.txt"]!.insertions).toBe(1);
    expect(byPath["src/components/bar.txt"]!.operation).toBe("created");
    expect(byPath["src/components/bar.txt"]!.insertions).toBe(1);
  });

  test("skips untracked nested git repos", async () => {
    await mkdir(join(dir, "nested"));
    runGitCmd(join(dir, "nested"), ["init"]);
    await bunWriteFile(join(dir, "nested", "file.txt"), "hello\n");

    // Also create a regular untracked file to ensure those still work
    await writeFile("regular.txt", "world\n");

    const git = new Git(dir);
    const files = await git.getUncommitedFiles();

    expect(files).toHaveLength(1);
    expect(files[0]!.path).toBe("regular.txt");
    expect(files[0]!.operation).toBe("created");
  });

  test("returns untracked files inside a new directory", async () => {
    await mkdir(join(dir, "src", "components"), { recursive: true });
    await writeFile("src/components/foo.txt", "hello\n");
    await writeFile("src/components/bar.txt", "world\n");

    const git = new Git(dir);
    const files = await git.getUncommitedFiles();
    const byPath = Object.fromEntries(files.map((f) => [f.path, f]));

    expect(files).toHaveLength(2);
    expect(byPath["src/components/foo.txt"]!.operation).toBe("created");
    expect(byPath["src/components/foo.txt"]!.insertions).toBe(1);
    expect(byPath["src/components/bar.txt"]!.operation).toBe("created");
    expect(byPath["src/components/bar.txt"]!.insertions).toBe(1);
  });
});

describe("getFileDiff", () => {
  async function writeFile(path: string, content: string) {
    await bunWriteFile(join(dir, path), content);
  }

  async function writeAndAdd(path: string, content: string) {
    await writeFile(path, content);
    runGitCmd(dir, ["add", path]);
  }

  describe("committed files", () => {
    test("returns diff for a created file", async () => {
      runGitCmd(dir, ["checkout", "-b", "feature/diff-add"]);
      await writeAndAdd("new.txt", "hello\nworld\n");
      runGitCmd(dir, ["commit", "-m", "add new"]);

      const git = new Git(dir);
      const commits = await git.getCommitsSinceBase();
      const files = await git.getChangedFilesForCommit(commits[0]!);
      const diff = await git.getFileDiff(files[0]!);

      expect(diff.path).toBe("new.txt");
      expect(diff.unifiedDiff).toContain("+hello");
      expect(diff.unifiedDiff).toContain("+world");
    });

    test("returns diff for a removed file", async () => {
      await writeAndAdd("remove-me.txt", "goodbye\n");
      runGitCmd(dir, ["commit", "-m", "add file"]);

      runGitCmd(dir, ["checkout", "-b", "feature/diff-rm"]);
      runGitCmd(dir, ["rm", "remove-me.txt"]);
      runGitCmd(dir, ["commit", "-m", "remove file"]);

      const git = new Git(dir);
      const commits = await git.getCommitsSinceBase();
      const files = await git.getChangedFilesForCommit(commits[0]!);
      const diff = await git.getFileDiff(files[0]!);

      expect(diff.path).toBe("remove-me.txt");
      expect(diff.unifiedDiff).toContain("-goodbye");
    });

    test("returns diff for a changed file", async () => {
      await writeAndAdd("edit.txt", "before\n");
      runGitCmd(dir, ["commit", "-m", "add file"]);

      runGitCmd(dir, ["checkout", "-b", "feature/diff-edit"]);
      await writeAndAdd("edit.txt", "before\nafter\n");
      runGitCmd(dir, ["commit", "-m", "edit file"]);

      const git = new Git(dir);
      const commits = await git.getCommitsSinceBase();
      const files = await git.getChangedFilesForCommit(commits[0]!);
      const diff = await git.getFileDiff(files[0]!);

      expect(diff.path).toBe("edit.txt");
      expect(diff.unifiedDiff).toContain("+after");
      expect(diff.unifiedDiff).not.toContain("-before");
    });

    test("returns diff for only the specified file in a multi-file commit", async () => {
      await writeAndAdd("a.txt", "aaa\n");
      runGitCmd(dir, ["commit", "-m", "setup"]);

      runGitCmd(dir, ["checkout", "-b", "feature/diff-multi"]);
      await writeAndAdd("a.txt", "aaa\nbbb\n");
      await writeAndAdd("b.txt", "new file\n");
      runGitCmd(dir, ["commit", "-m", "multi change"]);

      const git = new Git(dir);
      const commits = await git.getCommitsSinceBase();
      const files = await git.getChangedFilesForCommit(commits[0]!);
      const byPath = Object.fromEntries(files.map((f) => [f.path, f]));

      const diffA = await git.getFileDiff(byPath["a.txt"]!);
      expect(diffA.path).toBe("a.txt");
      expect(diffA.unifiedDiff).toContain("+bbb");
      expect(diffA.unifiedDiff).not.toContain("b.txt");

      const diffB = await git.getFileDiff(byPath["b.txt"]!);
      expect(diffB.path).toBe("b.txt");
      expect(diffB.unifiedDiff).toContain("+new file");
      expect(diffB.unifiedDiff).not.toContain("a.txt");
    });

    test("returns correct unified diff format for a modified tracked file", async () => {
      const original = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join("\n") + "\n";
      await writeAndAdd("tracked.txt", original);
      runGitCmd(dir, ["commit", "-m", "add tracked file"]);

      runGitCmd(dir, ["checkout", "-b", "feature/diff-format"]);
      const modified =
        [
          "line 1",
          "line 2",
          "line changed",
          "line 4",
          "line 5",
          "line 7",
          "line 8",
          "new line",
          "line 9",
          "line 10",
        ].join("\n") + "\n";
      await writeAndAdd("tracked.txt", modified);
      runGitCmd(dir, ["commit", "-m", "modify tracked file"]);

      const git = new Git(dir);
      const commits = await git.getCommitsSinceBase();
      const files = await git.getChangedFilesForCommit(commits[0]!);
      const diff = await git.getFileDiff(files[0]!);

      expect(diff.path).toBe("tracked.txt");

      // Strip the dynamic header lines (commit sha, index hashes) and keep
      // everything from the "diff --git" line onward with placeholders replaced.
      const normalized = diff.unifiedDiff
        .replace(/^[0-9a-f]{40}\n/, "")
        .replace(/^index [0-9a-f]+\.\.[0-9a-f]+ /m, "index HEAD ");

      expect(normalized).toBe(
        [
          "diff --git a/tracked.txt b/tracked.txt",
          "index HEAD 100644",
          "--- a/tracked.txt",
          "+++ b/tracked.txt",
          "@@ -1,10 +1,10 @@",
          " line 1",
          " line 2",
          "-line 3",
          "+line changed",
          " line 4",
          " line 5",
          "-line 6",
          " line 7",
          " line 8",
          "+new line",
          " line 9",
          " line 10",
        ].join("\n"),
      );
    });

    test("includes full file context, not just surrounding lines", async () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`);
      await writeAndAdd("big.txt", lines.join("\n") + "\n");
      runGitCmd(dir, ["commit", "-m", "add big file"]);

      runGitCmd(dir, ["checkout", "-b", "feature/diff-full"]);
      lines[10] = "changed line 11";
      await writeAndAdd("big.txt", lines.join("\n") + "\n");
      runGitCmd(dir, ["commit", "-m", "edit middle"]);

      const git = new Git(dir);
      const commits = await git.getCommitsSinceBase();
      const files = await git.getChangedFilesForCommit(commits[0]!);
      const diff = await git.getFileDiff(files[0]!);

      // All unchanged lines should appear as context
      expect(diff.unifiedDiff).toContain(" line 1");
      expect(diff.unifiedDiff).toContain(" line 5");
      expect(diff.unifiedDiff).toContain(" line 15");
      expect(diff.unifiedDiff).toContain(" line 20");
      expect(diff.unifiedDiff).toContain("+changed line 11");
      expect(diff.unifiedDiff).toContain("-line 11");
    });
  });

  describe("uncommitted files", () => {
    test("returns diff for a staged created file", async () => {
      await writeFile("staged.txt", "staged content\n");
      runGitCmd(dir, ["add", "staged.txt"]);

      const git = new Git(dir);
      const files = await git.getUncommitedFiles();
      const diff = await git.getFileDiff(files[0]!);

      expect(diff.path).toBe("staged.txt");
      expect(diff.unifiedDiff).toContain("+staged content");
    });

    test("returns diff for an unstaged modified file", async () => {
      await writeAndAdd("tracked.txt", "original\n");
      runGitCmd(dir, ["commit", "-m", "add tracked"]);

      await writeFile("tracked.txt", "original\nmodified\n");

      const git = new Git(dir);
      const files = await git.getUncommitedFiles();
      const diff = await git.getFileDiff(files[0]!);

      expect(diff.path).toBe("tracked.txt");
      expect(diff.unifiedDiff).toContain("+modified");
      expect(diff.unifiedDiff).not.toContain("-original");
    });

    test("returns diff for a removed file", async () => {
      await writeAndAdd("doomed.txt", "bye\n");
      runGitCmd(dir, ["commit", "-m", "add doomed"]);

      runGitCmd(dir, ["rm", "doomed.txt"]);

      const git = new Git(dir);
      const files = await git.getUncommitedFiles();
      const diff = await git.getFileDiff(files[0]!);

      expect(diff.path).toBe("doomed.txt");
      expect(diff.unifiedDiff).toContain("-bye");
    });

    test("returns diff for an untracked file", async () => {
      await writeFile("untracked.txt", "new content\n");

      const git = new Git(dir);
      const files = await git.getUncommitedFiles();
      const diff = await git.getFileDiff(files[0]!);

      expect(diff.path).toBe("untracked.txt");
      expect(diff.unifiedDiff).toContain("+new content");
    });
  });
});
