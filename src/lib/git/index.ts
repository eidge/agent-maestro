export interface CommitInfo {
  title: string,
  body: string | null,
  sha: string,
}

export interface ChangedFile {
  path: string,
  insertions: number,
  deletions: number,
  operation: "created" | "removed" | "changed"
}

export class Git {
  private baseBranchName: string | null = null;

  constructor(private readonly cwd?: string) {}

  getCurrentBranchName(): string {
    return this.run(["rev-parse", "--abbrev-ref", "HEAD"]);
  }

  getBaseBranchName(): string {
    if (this.baseBranchName) return this.baseBranchName

    // Try to resolve via the remote's cached default branch
    try {
      const ref = this.run(["symbolic-ref", "refs/remotes/origin/HEAD"]);
      this.baseBranchName = ref.replace("refs/remotes/origin/", "");
      return this.baseBranchName
    } catch {
      // origin/HEAD not set — fall back to checking known default branches
    }

    for (const candidate of ["main", "master"]) {
      try {
        this.run(["rev-parse", "--verify", candidate]);
        this.baseBranchName = candidate;
        return this.baseBranchName
      } catch {
        // branch doesn't exist, try next
      }
    }

    throw new Error(
      "Could not determine base branch. No origin remote and neither 'main' nor 'master' exists.",
    );
  }

  getCommitsSinceBase(): CommitInfo[] {
    const base = this.getBaseBranchName();
    const separator = "---commit---";
    const fieldSep = "---field---";
    const format = [`%s`, `%b`, `%H`].join(fieldSep);

    const output = this.run([
      "log",
      `${base}..HEAD`,
      `--pretty=format:${format}${separator}`,
    ]);

    if (!output) return [];

    return output
      .split(separator)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [title, body, sha] = entry.split(fieldSep);
        return {
          title: title!.trim(),
          body: body!.trim() || null,
          sha: sha!.trim(),
        };
      });
  }

  getUncommitedFiles(): ChangedFile[] {
    // Numstat for both staged and unstaged changes against HEAD
    const output = this.run(["diff", "HEAD", "--numstat"]);
    if (!output) return [];

    const statusOutput = this.run(["diff", "HEAD", "--name-status"]);

    const statusMap = new Map<string, string>();
    for (const line of statusOutput.split("\n")) {
      const [status, path] = line.split("\t");
      if (status && path) {
        statusMap.set(path, status);
      }
    }

    return output.split("\n").filter(Boolean).map((line) => {
      const [ins, del, path] = line.split("\t");
      const status = statusMap.get(path!);
      let operation: ChangedFile["operation"];
      if (status === "A") {
        operation = "created";
      } else if (status === "D") {
        operation = "removed";
      } else {
        operation = "changed";
      }
      return {
        path: path!,
        insertions: Number(ins),
        deletions: Number(del),
        operation,
      };
    });
  }

  getChangedFilesForCommit(commit: CommitInfo): ChangedFile[] {
    const output = this.run([
      "diff-tree",
      "--no-commit-id",
      "--numstat",
      "-r",
      commit.sha,
    ]);

    if (!output) return [];

    // Get the list of added/deleted/modified files for this commit
    const statusOutput = this.run([
      "diff-tree",
      "--no-commit-id",
      "--diff-filter=ADM",
      "-r",
      "--name-status",
      commit.sha,
    ]);

    const statusMap = new Map<string, string>();
    for (const line of statusOutput.split("\n")) {
      const [status, path] = line.split("\t");
      if (status && path) {
        statusMap.set(path, status);
      }
    }

    return output.split("\n").filter(Boolean).map((line) => {
      const [ins, del, path] = line.split("\t");
      const status = statusMap.get(path!);
      let operation: ChangedFile["operation"];
      if (status === "A") {
        operation = "created";
      } else if (status === "D") {
        operation = "removed";
      } else {
        operation = "changed";
      }
      return {
        path: path!,
        insertions: Number(ins),
        deletions: Number(del),
        operation,
      };
    });
  }

  private run(args: string[]): string {
    const result = Bun.spawnSync(["git", ...args], {
      cwd: this.cwd,
      stdout: "pipe",
      stderr: "pipe",
    });

    if (result.exitCode !== 0) {
      const stderr = result.stderr.toString().trim();
      throw new Error(`git ${args.join(" ")} failed: ${stderr}`);
    }

    return result.stdout.toString().trim();
  }
}
