import { useEffect, useMemo, useRef, useState } from "react";
import { Git, type ChangedFile, type CommitInfo, type FileDiff } from "../lib/git";
import type { SelectedCommit } from "../components/CommitSelector";

/** The subset of {@link Git} that {@link useGitData} depends on. */
export interface GitProvider {
  isGitRepo(): Promise<boolean>;
  getBaseBranchName(): Promise<string>;
  getCurrentBranchName(): Promise<string>;
  getCommitsSinceBase(): Promise<CommitInfo[]>;
  getUncommitedFiles(): Promise<ChangedFile[]>;
  getChangedFilesForCommit(commit: CommitInfo): Promise<ChangedFile[]>;
  getFileDiff(file: ChangedFile): Promise<FileDiff>;
}

export function commitsEqual(a: CommitInfo[], b: CommitInfo[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((c, i) => c.sha === b[i]!.sha);
}

export function filesEqual(a: ChangedFile[], b: ChangedFile[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((f, i) => {
    const other = b[i]!;
    return (
      f.path === other.path &&
      f.commitSha === other.commitSha &&
      f.insertions === other.insertions &&
      f.deletions === other.deletions &&
      f.operation === other.operation
    );
  });
}

export function isSelectedCommitValid(
  selected: SelectedCommit | null,
  commits: CommitInfo[],
  uncommittedFiles: ChangedFile[],
): boolean {
  if (!selected) return false;
  if (selected.kind === "uncommitted") return uncommittedFiles.length > 0;
  return commits.some((c) => c.sha === selected.commit.sha);
}

export function isSelectedFileValid(selected: ChangedFile | null, files: ChangedFile[]): boolean {
  if (!selected) return false;
  return files.some((f) => f.path === selected.path && f.commitSha === selected.commitSha);
}

export interface GitData {
  loading: boolean;
  notGitRepo: boolean;
  baseBranchName: string | undefined;
  branchName: string | undefined;
  commits: CommitInfo[];
  uncommitedFiles: ChangedFile[];
  committedFiles: ChangedFile[];
  selectedCommit: SelectedCommit | null;
  selectedFile: ChangedFile | null;
  selectedDiff: FileDiff | undefined;
  setSelectedCommit: (commit: SelectedCommit | null) => void;
  setSelectedFile: (file: ChangedFile | null) => void;
}

export interface UseGitDataOptions {
  git?: GitProvider;
  pollInterval?: number;
}

export function useGitData(options?: UseGitDataOptions): GitData {
  const git = useMemo(() => options?.git ?? new Git(), [options?.git]);
  const [loading, setLoading] = useState(true);
  const [notGitRepo, setNotGitRepo] = useState(false);
  const [baseBranchName, setBaseBranchName] = useState<string>();
  const [branchName, setBranchName] = useState<string>();
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [uncommitedFiles, setUncommitedFiles] = useState<ChangedFile[]>([]);
  const [committedFiles, setCommittedFiles] = useState<ChangedFile[]>([]);
  const [selectedDiff, setSelectedDiff] = useState<FileDiff>();

  const [selectedCommit, setSelectedCommit] = useState<SelectedCommit | null>(null);
  const [selectedFile, setSelectedFile] = useState<ChangedFile | null>(null);

  const selectedCommitRef = useRef(selectedCommit);
  const selectedFileRef = useRef(selectedFile);
  useEffect(() => {
    selectedCommitRef.current = selectedCommit;
    selectedFileRef.current = selectedFile;
  }, [selectedCommit, selectedFile]);

  useEffect(() => {
    let prevBranch: string | undefined;
    let prevCommits: CommitInfo[] = [];
    let prevUncommitted: ChangedFile[] = [];
    let prevCommitted: ChangedFile[] = [];
    let prevDiff: FileDiff | undefined;

    const updateCountsFn = async () => {
      const isRepo = await git.isGitRepo();
      if (!isRepo) {
        setNotGitRepo(true);
        setLoading(false);
        return;
      }

      const [baseBranchName, branch, newCommits, uncommitted] = await Promise.all([
        git.getBaseBranchName(),
        git.getCurrentBranchName(),
        git.getCommitsSinceBase(),
        git.getUncommitedFiles(),
      ]);

      const committedRequests = await Promise.all(
        newCommits.map((c) => git.getChangedFilesForCommit(c)),
      );
      const committed = committedRequests.flat();

      setBaseBranchName((prev) => (prev === baseBranchName ? prev : baseBranchName));

      // Only update state when data has actually changed
      if (branch !== prevBranch) {
        setBranchName(branch);
        prevBranch = branch;
      }
      if (!commitsEqual(newCommits, prevCommits)) {
        setCommits(newCommits);
        prevCommits = newCommits;
      }
      if (!filesEqual(uncommitted, prevUncommitted)) {
        setUncommitedFiles(uncommitted);
        prevUncommitted = uncommitted;
      }
      if (!filesEqual(committed, prevCommitted)) {
        setCommittedFiles(committed);
        prevCommitted = committed;
      }

      // Only adjust selection when the currently selected item is no longer valid
      let effectiveCommit = selectedCommitRef.current;
      if (!isSelectedCommitValid(effectiveCommit, newCommits, uncommitted)) {
        if (uncommitted.length > 0) {
          effectiveCommit = { kind: "uncommitted" };
        } else if (newCommits.length > 0) {
          effectiveCommit = { kind: "commit", commit: newCommits[0]! };
        } else {
          effectiveCommit = null;
        }
        setSelectedCommit(effectiveCommit);
      }

      const relevantFiles =
        effectiveCommit?.kind === "uncommitted"
          ? uncommitted
          : committed.filter((f) => f.commitSha === effectiveCommit?.commit.sha);

      let effectiveFile = selectedFileRef.current;
      if (!isSelectedFileValid(effectiveFile, relevantFiles)) {
        effectiveFile = relevantFiles[0] ?? null;
        setSelectedFile(effectiveFile);
      }

      // Refresh diff for on-disk changes (e.g. uncommitted file edited externally)
      if (effectiveFile) {
        const diff = await git.getFileDiff(effectiveFile);
        if (diff.unifiedDiff !== prevDiff?.unifiedDiff || diff.path !== prevDiff?.path) {
          setSelectedDiff(diff);
          prevDiff = diff;
        }
      } else if (prevDiff !== undefined) {
        setSelectedDiff(undefined);
        prevDiff = undefined;
      }

      setLoading(false);
    };
    updateCountsFn();
    const interval = setInterval(updateCountsFn, options?.pollInterval ?? 2000);
    return () => clearInterval(interval);
  }, [git, options?.pollInterval]);

  useEffect(() => {
    if (!selectedFile) return;

    git.getFileDiff(selectedFile).then(setSelectedDiff);
  }, [git, selectedFile, selectedCommit]);

  return {
    loading,
    notGitRepo,
    baseBranchName,
    branchName,
    commits,
    uncommitedFiles,
    committedFiles,
    selectedCommit,
    selectedFile,
    selectedDiff,
    setSelectedCommit,
    setSelectedFile,
  };
}
