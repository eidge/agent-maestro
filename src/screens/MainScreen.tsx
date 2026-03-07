import { useRef, useState } from "react";
import { Panel } from "../components/ui/Panel";
import { CommitSelector } from "../components/CommitSelector";
import { FileSelector } from "../components/FileSelector";
import { DiffViewer } from "../components/DiffViewer";
import { UpdateBanner } from "../components/UpdateBanner";
import { HelpMenu } from "../components/HelpMenu";
import { LoadingScreen } from "./LoadingScreen";
import { NotGitRepoScreen } from "./NotGitRepoScreen";
import { ShortcutGroup, useKeyboardShortcut } from "../hooks/keyboard";
import { useGitData, type GitProvider } from "../hooks/git-data";
import { useUpdateCheck } from "../hooks/update-check";
import { theme } from "../lib/themes/default";

const cyclablePanels = ["commits", "files", "diff"] as const;

type CyclablePanel = (typeof cyclablePanels)[number];
type FocusablePanel = CyclablePanel | "help";

export interface MainScreenProps {
  /** Optional git provider for testing. When omitted, uses the real Git CLI. */
  git?: GitProvider;
}

export function MainScreen({ git }: MainScreenProps = {}) {
  const {
    loading,
    notGitRepo,
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

  const cyclablePanel = focusedPanel === "help" ? previousPanelRef.current : focusedPanel;

  const cycleSelectedPanel = (direction: 1 | -1) => {
    let index = cyclablePanels.indexOf(cyclablePanel) + direction;

    if (index >= cyclablePanels.length) {
      index = 0;
    } else if (index < 0) {
      index = cyclablePanels.length - 1;
    }

    setFocusedPanel(cyclablePanels[index]!);
  };

  useKeyboardShortcut("?", "show help", ShortcutGroup.General, () => {
    if (focusedPanel === "help") {
      setFocusedPanel(previousPanelRef.current);
    } else {
      previousPanelRef.current = cyclablePanel;
      setFocusedPanel("help");
    }
  });

  useKeyboardShortcut("tab", "cycle panels forward", ShortcutGroup.Navigation, () => {
    if (focusedPanel === "help") return;
    cycleSelectedPanel(1);
  });

  useKeyboardShortcut("return", "accept selection", ShortcutGroup.Navigation, () => {
    if (focusedPanel === "help") return;
    if (focusedPanel === "diff") return;
    cycleSelectedPanel(1);
  });

  useKeyboardShortcut("shift-tab", "cycle panels backward", ShortcutGroup.Navigation, () => {
    if (focusedPanel === "help") return;
    cycleSelectedPanel(-1);
  });

  useKeyboardShortcut("escape", "cancel / close help", ShortcutGroup.Navigation, () => {
    if (focusedPanel === "help") {
      setFocusedPanel(previousPanelRef.current);
      return;
    }
    if (focusedPanel === "commits") return;
    cycleSelectedPanel(-1);
  });

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
          {/* Branch */}

          {/* Commits select */}
          <Panel title="Commits" height={20}>
            <CommitSelector
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
            <DiffViewer diff={selectedDiff} focused={focusedPanel === "diff"} />
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

      {/* Help menu overlay */}
      {focusedPanel === "help" && <HelpMenu focused />}
    </box>
  );
}
