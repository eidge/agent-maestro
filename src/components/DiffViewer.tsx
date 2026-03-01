import { useCallback, useEffect, useMemo, useRef } from "react";
import { pathToFiletype, type ScrollBoxRenderable } from "@opentui/core";
import { resolveFiletype } from "../lib/syntax/parsers";
import { syntaxStyle } from "../lib/syntax/style";
import type { FileDiff } from "../lib/git";
import { theme } from "../lib/themes/default";
import { useKeyboardShortcut } from "../hooks/keyboard";

export interface DiffViewerProps {
  diff: FileDiff;
  focused?: boolean;
}

/**
 * Finds the rendered line indices where each change block (group of
 * consecutive +/- lines) begins.  The file header lines (everything
 * before the first @@ marker) are skipped by the diff renderer, so
 * we mirror that logic here.
 */
export function getChangeBlockStarts(unifiedDiff: string): number[] {
  const rawLines = unifiedDiff.split("\n");

  // Skip file header lines (diff --git, index, ---, +++) until the first @@
  let start = 0;
  while (start < rawLines.length && !rawLines[start]!.startsWith("@@")) {
    start++;
  }

  const starts: number[] = [];
  let renderedLine = 0;
  let inChangeBlock = false;

  for (let i = start; i < rawLines.length; i++) {
    const line = rawLines[i]!;
    const isChange = line.startsWith("+") || line.startsWith("-");

    if (isChange && !inChangeBlock) {
      starts.push(renderedLine);
      inChangeBlock = true;
    } else if (!isChange) {
      inChangeBlock = false;
    }

    renderedLine++;
  }

  return starts;
}

export function DiffViewer({ diff, focused }: DiffViewerProps) {
  const scrollRef = useRef<ScrollBoxRenderable>(null);
  const previousPathRef = useRef<string>(diff.path);

  const changeBlockStarts = useMemo(
    () => getChangeBlockStarts(diff.unifiedDiff),
    [diff.unifiedDiff],
  );

  useKeyboardShortcut("g g", "scroll to top", () => {
    if (!focused) return;
    scrollRef.current?.scrollTo(0);
  });

  useKeyboardShortcut("shift-g", "scroll to bottom", () => {
    if (!focused) return;
    const sb = scrollRef.current;
    if (sb) sb.scrollTo(sb.scrollHeight);
  });

  const goToPreviousChangeBlock = useCallback(() => {
    if (!focused) return;
    const sb = scrollRef.current;
    if (!sb || changeBlockStarts.length === 0) return;

    const current = sb.scrollTop;
    // Find the last block start that is above the current scroll position
    for (let i = changeBlockStarts.length - 1; i >= 0; i--) {
      if (changeBlockStarts[i]! < current) {
        sb.scrollTo(changeBlockStarts[i]!);
        return;
      }
    }
    // Already above the first block — scroll to top
    sb.scrollTo(0);
  }, [focused, changeBlockStarts]);

  const goToNextChangeBlock = useCallback(() => {
    if (!focused) return;
    const sb = scrollRef.current;
    if (!sb || changeBlockStarts.length === 0) return;

    const current = sb.scrollTop;
    // Find the first block start that is below the current scroll position
    for (let i = 0; i < changeBlockStarts.length; i++) {
      if (changeBlockStarts[i]! > current) {
        sb.scrollTo(changeBlockStarts[i]!);
        return;
      }
    }
    // Past the last block — scroll to bottom
    sb.scrollTo(sb.scrollHeight);
  }, [focused, changeBlockStarts]);

  useKeyboardShortcut("shift-up", "previous change block", goToPreviousChangeBlock);
  useKeyboardShortcut("shift-k", "previous change block", goToPreviousChangeBlock);
  useKeyboardShortcut("shift-down", "next change block", goToNextChangeBlock);
  useKeyboardShortcut("shift-j", "next change block", goToNextChangeBlock);

  useEffect(() => {
    if (diff.path === previousPathRef.current) return
    previousPathRef.current = diff.path
    const sb = scrollRef.current;

    if (sb) sb.scrollTo(0);
  }, [diff])

  return (
    <scrollbox
      ref={scrollRef}
      focused={focused}
      scrollbarOptions={{
        trackOptions: {
          backgroundColor: theme.scrollTrack,
          foregroundColor: theme.scrollThumb,
        },
      }}
    >
      <box flexDirection="column">
        <diff
          filetype={resolveFiletype(pathToFiletype(diff.path))}
          syntaxStyle={syntaxStyle}
          showLineNumbers={true}
          diff={diff.unifiedDiff}
          addedSignColor={theme.diffAddedSign}
          removedSignColor={theme.diffRemovedSign}
          addedBg={theme.diffAddedBg}
          removedBg={theme.diffRemovedBg}
        />
      </box>
    </scrollbox>
  );
}
