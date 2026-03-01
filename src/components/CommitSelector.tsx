import { useCallback, useMemo } from "react";
import type { CommitInfo } from "../lib/git";
import { theme } from "../lib/styles/default";

export type SelectedCommit = { kind: "uncommitted" } | { kind: "commit"; commit: CommitInfo };

export interface CommitSelectorProps {
  commits: CommitInfo[];
  uncommitedFileCount: number;
  selectedCommit: SelectedCommit | null;
  onSelect: (selection: SelectedCommit) => void;
  focused?: boolean;
}

export function CommitSelector({
  commits,
  uncommitedFileCount,
  selectedCommit,
  onSelect,
  focused,
}: CommitSelectorProps) {
  const hasUncommitted = uncommitedFileCount > 0;

  const selectOptions = useMemo(() => {
    const opts: { name: string; description: string; value: string }[] = [];
    if (hasUncommitted) {
      opts.push({
        name: "● uncommitted changes",
        description: `${uncommitedFileCount} files`,
        value: "uncommitted",
      });
    }
    for (const c of commits) {
      opts.push({
        name: c.title,
        description: `#${c.sha.slice(0, 6)}`,
        value: c.sha,
      });
    }
    return opts;
  }, [hasUncommitted, uncommitedFileCount, commits]);

  const selectedIndex = useMemo(() => {
    if (!selectedCommit) return 0;
    const value = selectedCommit.kind === "uncommitted" ? "uncommitted" : selectedCommit.commit.sha;
    const idx = selectOptions.findIndex((o) => o.value === value);
    return idx >= 0 ? idx : 0;
  }, [selectedCommit, selectOptions]);

  const onChange = useCallback(
    (index: number) => {
      const option = selectOptions[index];
      if (!option) return;
      if (option.value === "uncommitted") {
        onSelect({ kind: "uncommitted" });
      } else {
        const commit = commits.find((c) => c.sha === option.value);
        if (commit) onSelect({ kind: "commit", commit });
      }
    },
    [selectOptions, commits, onSelect],
  );

  if (selectOptions.length === 0) {
    return <text fg={theme.textMuted}>no commits</text>;
  }

  return (
    <select
      options={selectOptions}
      selectedIndex={selectedIndex}
      onChange={onChange}
      focused={focused}
      showScrollIndicator
      height="100%"
      selectedBackgroundColor={theme.selectBg}
      selectedTextColor={theme.selectText}
      descriptionColor={theme.selectDescriptionColor}
      textColor={theme.text}
    />
  );
}
