import { useCallback, useMemo } from "react";
import type { ChangedFile } from "../lib/git";
import { theme } from "../lib/themes/default";

export interface FileSelectorProps {
  files: ChangedFile[];
  selectedFile: ChangedFile | null;
  onSelect: (file: ChangedFile) => void;
  focused?: boolean;
}

export function FileSelector({ files, selectedFile, onSelect, focused }: FileSelectorProps) {
  const selectOptions = useMemo(
    () =>
      files.map((f) => ({
        name: `${f.operation === "created" ? "+" : f.operation === "removed" ? "-" : "~"} ${f.path}`,
        description: `+${f.insertions} -${f.deletions}`,
        value: f.path,
      })),
    [files],
  );

  const selectedIndex = useMemo(() => {
    if (!selectedFile) return 0;
    const idx = files.findIndex((f) => f.path === selectedFile.path);
    return idx >= 0 ? idx : 0;
  }, [selectedFile, files]);

  const onChange = useCallback(
    (index: number) => {
      const file = files[index];
      if (file) onSelect(file);
    },
    [files, onSelect],
  );

  if (selectOptions.length === 0) {
    return <text fg={theme.textMuted}>no changed files</text>;
  }

  return (
    <select
      options={selectOptions}
      selectedIndex={selectedIndex}
      onChange={onChange}
      focused={focused}
      showScrollIndicator
      height="100%"
      textColor={theme.text}
      descriptionColor={theme.selectDescriptionColor}
      selectedBackgroundColor={theme.selectBg}
      selectedTextColor={theme.selectText}
      selectedDescriptionColor={theme.selectSelectedDescriptionColor}
      focusedBackgroundColor={theme.selectFocusedBg}
      focusedTextColor={theme.selectFocusedText}
    />
  );
}
