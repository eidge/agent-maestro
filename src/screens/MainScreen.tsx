import { useState } from "react";
import { pathToFiletype } from "@opentui/core";
import { resolveFiletype } from "../lib/syntax/parsers";
import { syntaxStyle } from "../lib/syntax/style";
import { Panel } from "../components/ui/Panel";
import { CommitSelector } from "../components/CommitSelector";
import { FileSelector } from "../components/FileSelector";
import { useKeyboardShortcut } from "../hooks/keyboard";
import { useGitData } from "../hooks/git-data";
import { theme } from "../lib/themes/default";

const focusablePanels = ["commits", "files", "diff"] as const;

type FocusablePanel = (typeof focusablePanels)[number];

export function MainScreen() {
  const {
    loading,
    branchName,
    commits,
    uncommitedFiles,
    committedFiles,
    selectedCommit,
    selectedFile,
    selectedDiff,
    setSelectedCommit,
    setSelectedFile,
  } = useGitData();

  const [focusedPanel, setFocusedPanel] = useState<FocusablePanel>("commits");

  useKeyboardShortcut("tab", "cycle panels forward", () => {
    let index = focusablePanels.indexOf(focusedPanel) + 1;

    if (index >= focusablePanels.length) {
      index = 0;
    }

    setFocusedPanel(focusablePanels[index]!);
  });

  useKeyboardShortcut("shift-tab", "cycle panels backward", () => {
    let index = focusablePanels.indexOf(focusedPanel) - 1;

    if (index < 0) {
      index = focusablePanels.length - 1;
    }

    setFocusedPanel(focusablePanels[index]!);
  });

  const currentFiles =
    selectedCommit?.kind === "uncommitted"
      ? uncommitedFiles
      : committedFiles.filter((f) => f.commitSha === selectedCommit?.commit.sha);

  if (loading) {
    return null;
  }

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={theme.bg}
      paddingBottom={1}
      paddingX={2}
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
            <scrollbox
              focused={focusedPanel === "diff"}
              scrollbarOptions={{
                trackOptions: {
                  backgroundColor: theme.scrollTrack,
                  foregroundColor: theme.scrollThumb,
                },
              }}
            >
              <box flexDirection="column">
                <diff
                  filetype={resolveFiletype(pathToFiletype(selectedDiff.path))}
                  syntaxStyle={syntaxStyle}
                  showLineNumbers={true}
                  diff={selectedDiff.unifiedDiff}
                  addedSignColor={theme.diffAddedSign}
                  removedSignColor={theme.diffRemovedSign}
                  addedBg={theme.diffAddedBg}
                  removedBg={theme.diffRemovedBg}
                />
              </box>
            </scrollbox>
          ) : (
            <box flexGrow={1} justifyContent="center" alignItems="center">
              <text fg={theme.textMuted}>No diffs to display</text>
            </box>
          )}
        </Panel>
      </box>
    </box>
  );
}
