import { useCallback, useMemo, useRef, useState } from "react";
import { Panel } from "../components/ui/Panel";
import { CommitSelector } from "../components/CommitSelector";
import { FileSelector } from "../components/FileSelector";
import { DiffViewer } from "../components/DiffViewer";
import { CommentModal } from "../components/CommentModal";
import { UpdateBanner } from "../components/UpdateBanner";
import { HelpMenu } from "../components/HelpMenu";
import { LoadingScreen } from "./LoadingScreen";
import { NotGitRepoScreen } from "./NotGitRepoScreen";
import { ShortcutGroup, useKeyboardShortcut } from "../hooks/keyboard";
import { useGitData, type GitProvider } from "../hooks/git-data";
import {
  useDiffComments,
  useSyncDiffComments,
  useCleanupOrphanedComments,
  type DiffComment,
  type LineSnapshot,
} from "../hooks/diff-comments";
import { useUpdateCheck } from "../hooks/update-check";
import { parseUnifiedDiff } from "../lib/git/diff-parser";
import { theme } from "../lib/themes/default";

const cyclablePanels = ["commits", "files", "diff"] as const;

type CyclablePanel = (typeof cyclablePanels)[number];
type FocusablePanel = CyclablePanel | "help" | "comment";

interface CommentTarget {
  lineIndex: number;
  existingComment?: DiffComment;
}

export interface MainScreenProps {
  /** Optional git provider for testing. When omitted, uses the real Git CLI. */
  git?: GitProvider;
}

export function MainScreen({ git }: MainScreenProps = {}) {
  const {
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
  } = useGitData(git ? { git, pollInterval: 999_999 } : undefined);

  const { updateAvailable, latestVersion } = useUpdateCheck();
  const [focusedPanel, setFocusedPanel] = useState<FocusablePanel>("commits");
  const previousPanelRef = useRef<CyclablePanel>("commits");
  const [commentTarget, setCommentTarget] = useState<CommentTarget | null>(null);
  const selectedDiffLineRef = useRef(0);

  // ── Comment hooks ──────────────────────────────────────────
  const commitSha = selectedFile?.commitSha;
  const filePath = selectedDiff?.path;

  const {
    comments: commentedLines,
    addComment,
    editComment,
    deleteComment,
  } = useDiffComments(filePath, commitSha);

  // Build line snapshots for the sync hook
  const lineSnapshots: LineSnapshot[] | undefined = useMemo(() => {
    if (!selectedDiff) return undefined;
    const parsed = parseUnifiedDiff(selectedDiff);
    const bodyLines = selectedDiff.unifiedDiff.split("\n");
    const hhIndex = bodyLines.findIndex((l) => l.startsWith("@@"));
    const body = bodyLines
      .slice(hhIndex + 1)
      .filter((l) => !l.startsWith("\\ No newline at end of file"));
    if (body.length > 0 && body[body.length - 1] === "") body.pop();

    return parsed.lineTypes.map((type, i) => ({
      content: body[i] ?? "",
      type,
    }));
  }, [selectedDiff]);

  useSyncDiffComments(filePath, commitSha, lineSnapshots);
  useCleanupOrphanedComments(uncommitedFiles);

  // ── Panel cycling ──────────────────────────────────────────
  const cyclablePanel =
    focusedPanel === "help" || focusedPanel === "comment" ? previousPanelRef.current : focusedPanel;

  const cycleSelectedPanel = (direction: 1 | -1) => {
    let index = cyclablePanels.indexOf(cyclablePanel) + direction;

    if (index >= cyclablePanels.length) {
      index = 0;
    } else if (index < 0) {
      index = cyclablePanels.length - 1;
    }

    setFocusedPanel(cyclablePanels[index]!);
  };

  // ── Keyboard shortcuts ─────────────────────────────────────
  useKeyboardShortcut("?", "show help", ShortcutGroup.General, () => {
    if (focusedPanel === "help") {
      setFocusedPanel(previousPanelRef.current);
    } else if (focusedPanel !== "comment") {
      previousPanelRef.current = cyclablePanel;
      setFocusedPanel("help");
    }
  });

  useKeyboardShortcut("tab", "cycle panels forward", ShortcutGroup.Navigation, () => {
    if (focusedPanel === "help" || focusedPanel === "comment") return;
    cycleSelectedPanel(1);
  });

  useKeyboardShortcut("return", "accept selection / add comment", ShortcutGroup.Navigation, () => {
    if (focusedPanel === "help" || focusedPanel === "comment") return;
    if (focusedPanel === "diff") {
      const lineIndex = selectedDiffLineRef.current;
      const existing = commentedLines.get(lineIndex);
      setCommentTarget({ lineIndex, existingComment: existing });
      previousPanelRef.current = "diff";
      setFocusedPanel("comment");
      return;
    }
    cycleSelectedPanel(1);
  });

  useKeyboardShortcut("shift-tab", "cycle panels backward", ShortcutGroup.Navigation, () => {
    if (focusedPanel === "help" || focusedPanel === "comment") return;
    cycleSelectedPanel(-1);
  });

  useKeyboardShortcut("escape", "cancel / close", ShortcutGroup.Navigation, () => {
    if (focusedPanel === "comment") {
      setCommentTarget(null);
      setFocusedPanel("diff");
      return;
    }
    if (focusedPanel === "help") {
      setFocusedPanel(previousPanelRef.current);
      return;
    }
    if (focusedPanel === "commits") return;
    cycleSelectedPanel(-1);
  });

  useKeyboardShortcut("ctrl-d", "delete comment", ShortcutGroup.Comment, () => {
    if (focusedPanel !== "comment") return;
    if (commentTarget?.existingComment) {
      deleteComment(commentTarget.existingComment.id);
    }
    setCommentTarget(null);
    setFocusedPanel("diff");
  });

  // ── Comment save handler ───────────────────────────────────
  const handleCommentSave = useCallback(
    (text: string) => {
      if (!commentTarget || !lineSnapshots) return;
      const { lineIndex, existingComment } = commentTarget;

      if (existingComment) {
        editComment(existingComment.id, text);
      } else {
        const snapshot = lineSnapshots[lineIndex];
        if (snapshot) {
          addComment(lineIndex, snapshot.content, snapshot.type, text);
        }
      }

      setCommentTarget(null);
      setFocusedPanel("diff");
    },
    [commentTarget, lineSnapshots, editComment, addComment],
  );

  // ── Line selection tracking ────────────────────────────────
  const handleLineSelected = useCallback((lineIndex: number) => {
    selectedDiffLineRef.current = lineIndex;
  }, []);

  // ── Derived state ──────────────────────────────────────────
  const currentFiles =
    selectedCommit?.kind === "uncommitted"
      ? uncommitedFiles
      : committedFiles.filter((f) => f.commitSha === selectedCommit?.commit.sha);

  if (loading) {
    return <LoadingScreen />;
  }

  if (notGitRepo) {
    return <NotGitRepoScreen />;
  }

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={theme.bg}
      paddingBottom={1}
      paddingX={2}
      position="relative"
    >
      {/* Header */}
      <box flexDirection="row" paddingX={1} marginY={1} height={2} alignItems="flex-end">
        <ascii-font font="tiny" text="Agent-Maestro" color={theme.accent} />
        <box marginLeft={1} paddingY={0}>
          <text>
            <span fg={theme.accent}>
              <strong>{branchName ?? "..."}</strong>
            </span>
          </text>
        </box>
        {updateAvailable && latestVersion && <UpdateBanner latestVersion={latestVersion} />}
      </box>

      {/* Body: sidebar + main */}
      <box flexDirection="row" flexGrow={1} width="100%" columnGap={2}>
        {/* Sidebar */}
        <box width={50} flexDirection="column">
          {/* Commits select */}
          <Panel title="Commits" height={20}>
            <CommitSelector
              baseBranchName={baseBranchName}
              commits={commits}
              uncommitedFileCount={uncommitedFiles.length}
              selectedCommit={selectedCommit}
              onSelect={setSelectedCommit}
              focused={focusedPanel === "commits"}
            />
          </Panel>

          {/* File select for selected commit */}
          <Panel marginTop={1} title="Changed Files" flexGrow={1}>
            <FileSelector
              files={currentFiles}
              selectedFile={selectedFile}
              onSelect={setSelectedFile}
              focused={focusedPanel === "files"}
            />
          </Panel>
        </box>

        {/* Main diff area */}
        <Panel title={selectedDiff?.path} flexGrow={1}>
          {selectedDiff ? (
            <DiffViewer
              key={selectedDiff.path}
              diff={selectedDiff}
              focused={focusedPanel === "diff"}
              commentedLines={commentedLines}
              onLineSelected={handleLineSelected}
            />
          ) : (
            <box flexGrow={1} justifyContent="center" alignItems="center">
              <text fg={theme.textMuted}>No diffs to display</text>
            </box>
          )}
        </Panel>
      </box>

      {/* Footer */}
      <box height={1} paddingX={1} flexDirection="row" justifyContent="flex-end">
        <text fg={theme.textMuted}>
          Press <span fg={theme.accent}>?</span> for help
        </text>
      </box>

      {/* Overlay modals */}
      {focusedPanel === "help" && <HelpMenu focused />}
      {focusedPanel === "comment" && (
        <CommentModal
          existingComment={commentTarget?.existingComment}
          focused
          onSave={handleCommentSave}
        />
      )}
    </box>
  );
}
