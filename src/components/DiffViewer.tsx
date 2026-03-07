import { useCallback, useEffect, useMemo, useRef } from "react";
import { KeyEvent, pathToFiletype, type ScrollBoxRenderable } from "@opentui/core";
import { resolveFiletype } from "../lib/syntax/parsers";
import { syntaxStyle } from "../lib/syntax/style";
import type { FileDiff } from "../lib/git";
import { parseUnifiedDiff } from "../lib/git/diff-parser";
import { theme } from "../lib/themes/default";
import { useKeyboardShortcut } from "../hooks/keyboard";

export interface DiffViewerProps {
  diff: FileDiff;
  focused?: boolean;
}

function getDiffStartScrollPoints(diff: FileDiff): number[] {
  const parsed = parseUnifiedDiff(diff);
  return parsed.chunks.map((chunk) => chunk.start - 1); // -1 lines so we have some padding at the top
}

export function DiffViewer({ diff, focused }: DiffViewerProps) {
  const scrollRef = useRef<ScrollBoxRenderable>(null);
  const previousPathRef = useRef<string>(diff.path);

  const changeBlockStarts = useMemo(() => getDiffStartScrollPoints(diff), [diff]);

  useKeyboardShortcut("g g", "scroll to top", () => {
    if (!focused) return;
    scrollRef.current?.scrollTo(0);
  });

  useKeyboardShortcut("shift-g", "scroll to bottom", () => {
    if (!focused) return;
    const sb = scrollRef.current;
    if (sb) sb.scrollTo(sb.scrollHeight);
  });

  const goToPreviousChangeBlock = useCallback(
    (e: KeyEvent) => {
      e.preventDefault();

      if (!focused) return;
      const sb = scrollRef.current;
      if (!sb || changeBlockStarts.length === 0) return;

      const current = sb.scrollTop;
      // Find the last block start that is above the current scroll position
      for (let i = changeBlockStarts.length - 1; i >= 0; i--) {
        if (changeBlockStarts[i]! < current) {
          sb.scrollTop = changeBlockStarts[i]!;
          return;
        }
      }
      // Already above the first block — scroll to top
      sb.scrollTo(0);
    },
    [focused, changeBlockStarts],
  );

  const goToNextChangeBlock = useCallback(
    (e: KeyEvent) => {
      e.preventDefault();

      if (!focused) return;
      const sb = scrollRef.current;
      if (!sb || changeBlockStarts.length === 0) return;

      const current = sb.scrollTop;
      // Find the first block start that is below the current scroll position
      for (let i = 0; i < changeBlockStarts.length; i++) {
        if (changeBlockStarts[i]! > current) {
          sb.scrollTop = changeBlockStarts[i]!;
          return;
        }
      }
      // Past the last block — scroll to bottom
      sb.scrollTo(sb.scrollHeight);
    },
    [focused, changeBlockStarts],
  );

  useKeyboardShortcut("shift-up", "previous change block", goToPreviousChangeBlock);
  useKeyboardShortcut("shift-k", "previous change block", goToPreviousChangeBlock);
  useKeyboardShortcut("shift-down", "next change block", goToNextChangeBlock);
  useKeyboardShortcut("shift-j", "next change block", goToNextChangeBlock);

  useEffect(() => {
    if (diff.path === previousPathRef.current) return;
    previousPathRef.current = diff.path;
    const sb = scrollRef.current;

    if (sb) sb.scrollTo(0);
  }, [diff]);

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
