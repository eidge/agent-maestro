import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type DiffRenderable,
  KeyEvent,
  pathToFiletype,
  type ScrollBoxRenderable,
} from "@opentui/core";
import { resolveFiletype } from "../lib/syntax/parsers";
import { syntaxStyle } from "../lib/syntax/style";
import type { FileDiff } from "../lib/git";
import { type DiffLineType, parseUnifiedDiff } from "../lib/git/diff-parser";
import { theme } from "../lib/themes/default";
import { ShortcutGroup, useKeyboardShortcut } from "../hooks/keyboard";

/**
 * Returns the original diff line color config for a given line type.
 * This must match what the <diff> component sets internally so we can
 * restore colors after clearing a highlight.
 */
function getDiffLineColor(lineType: DiffLineType): {
  gutter: string;
  content: string;
} {
  switch (lineType) {
    case "added":
      return { gutter: "transparent", content: theme.diffAddedBg };
    case "removed":
      return { gutter: "transparent", content: theme.diffRemovedBg };
    case "context":
      return { gutter: "transparent", content: "transparent" };
  }
}

export interface DiffViewerProps {
  diff: FileDiff;
  focused?: boolean;
}

export function DiffViewer({ diff, focused }: DiffViewerProps) {
  const scrollRef = useRef<ScrollBoxRenderable>(null);
  const diffRef = useRef<DiffRenderable>(null);
  const [currentLine, setCurrentLine] = useState(0);

  const parsed = useMemo(() => parseUnifiedDiff(diff), [diff]);
  const changeBlockStarts = useMemo(() => parsed.chunks.map((chunk) => chunk.start - 1), [parsed]);
  const lineCount = parsed.lineCount;
  const lineTypes = parsed.lineTypes;
  const prevLineRef = useRef<number | null>(null);

  // Apply line highlight whenever currentLine changes.
  // Only touch the two affected lines (old + new) so the diff's own
  // added/removed backgrounds on all other lines stay intact.
  useEffect(() => {
    const d = diffRef.current;
    if (!d || lineCount === 0) return;

    const prev = prevLineRef.current;

    // Restore the previous line's original diff color
    if (prev !== null && prev !== currentLine) {
      d.setLineColor(prev, getDiffLineColor(lineTypes[prev]!));
    }

    // Highlight the current line
    d.setLineColor(currentLine, {
      gutter: theme.diffHighlightLine,
      content: theme.diffHighlightLine,
    });

    prevLineRef.current = currentLine;
  }, [currentLine, lineCount, lineTypes]);

  // Scroll to keep the current line visible
  useEffect(() => {
    const sb = scrollRef.current;
    if (!sb || lineCount === 0) return;

    const viewportHeight = sb.viewport.height;
    const scrollTop = sb.scrollTop;

    if (currentLine < scrollTop) {
      sb.scrollTop = currentLine;
    } else if (currentLine >= scrollTop + viewportHeight) {
      sb.scrollTop = currentLine - viewportHeight + 1;
    }
  }, [currentLine, lineCount]);

  const moveLine = useCallback(
    (delta: number) => {
      if (!focused || lineCount === 0) return;
      setCurrentLine((prev) => Math.max(0, Math.min(lineCount - 1, prev + delta)));
    },
    [focused, lineCount],
  );

  useKeyboardShortcut("up", "previous line", ShortcutGroup.Diff, (e) => {
    e.preventDefault();
    moveLine(-1);
  });

  useKeyboardShortcut("k", "previous line", ShortcutGroup.Diff, (e) => {
    if (!focused) return;
    e.preventDefault();
    moveLine(-1);
  });

  useKeyboardShortcut("down", "next line", ShortcutGroup.Diff, (e) => {
    e.preventDefault();
    moveLine(1);
  });

  useKeyboardShortcut("j", "next line", ShortcutGroup.Diff, (e) => {
    if (!focused) return;
    e.preventDefault();
    moveLine(1);
  });

  useKeyboardShortcut("g g", "scroll to top", ShortcutGroup.Diff, () => {
    if (!focused) return;
    setCurrentLine(0);
    scrollRef.current?.scrollTo(0);
  });

  useKeyboardShortcut("shift-g", "scroll to bottom", ShortcutGroup.Diff, () => {
    if (!focused || lineCount === 0) return;
    setCurrentLine(lineCount - 1);
    const sb = scrollRef.current;
    if (sb) sb.scrollTo(sb.scrollHeight);
  });

  const goToPreviousChangeBlock = useCallback(
    (e: KeyEvent) => {
      e.preventDefault();

      if (!focused) return;
      const sb = scrollRef.current;
      if (!sb || changeBlockStarts.length === 0) return;

      // Find the last block start that is above the current line
      for (let i = changeBlockStarts.length - 1; i >= 0; i--) {
        if (changeBlockStarts[i]! < currentLine) {
          const target = Math.max(0, changeBlockStarts[i]!);
          setCurrentLine(target);
          sb.scrollTop = target;
          return;
        }
      }
      // Already above the first block — go to top
      setCurrentLine(0);
      sb.scrollTo(0);
    },
    [focused, changeBlockStarts, currentLine],
  );

  const goToNextChangeBlock = useCallback(
    (e: KeyEvent) => {
      e.preventDefault();

      if (!focused) return;
      const sb = scrollRef.current;
      if (!sb || changeBlockStarts.length === 0) return;

      // Find the first block start that is below the current line
      for (let i = 0; i < changeBlockStarts.length; i++) {
        if (changeBlockStarts[i]! > currentLine) {
          const target = Math.max(0, changeBlockStarts[i]!);
          setCurrentLine(target);
          sb.scrollTop = target;
          return;
        }
      }
      // Past the last block — go to bottom
      if (lineCount > 0) {
        setCurrentLine(lineCount - 1);
        sb.scrollTo(sb.scrollHeight);
      }
    },
    [focused, changeBlockStarts, currentLine, lineCount],
  );

  useKeyboardShortcut(
    "shift-up",
    "previous change block",
    ShortcutGroup.Diff,
    goToPreviousChangeBlock,
  );
  useKeyboardShortcut(
    "shift-k",
    "previous change block",
    ShortcutGroup.Diff,
    goToPreviousChangeBlock,
  );
  useKeyboardShortcut("shift-down", "next change block", ShortcutGroup.Diff, goToNextChangeBlock);
  useKeyboardShortcut("shift-j", "next change block", ShortcutGroup.Diff, goToNextChangeBlock);

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
          ref={diffRef}
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
