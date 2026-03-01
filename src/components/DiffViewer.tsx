import { useRef } from "react";
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

export function DiffViewer({ diff, focused }: DiffViewerProps) {
  const scrollRef = useRef<ScrollBoxRenderable>(null);

  useKeyboardShortcut("g g", "scroll to top", () => {
    if (!focused) return;
    scrollRef.current?.scrollTo(0);
  });

  useKeyboardShortcut("shift-g", "scroll to bottom", () => {
    if (!focused) return;
    const sb = scrollRef.current;
    if (sb) sb.scrollTo(sb.scrollHeight);
  });

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
