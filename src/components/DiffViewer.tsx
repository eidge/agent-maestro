import { pathToFiletype } from "@opentui/core";
import { resolveFiletype } from "../lib/syntax/parsers";
import { syntaxStyle } from "../lib/syntax/style";
import type { FileDiff } from "../lib/git";
import { theme } from "../lib/themes/default";

export interface DiffViewerProps {
  diff: FileDiff;
  focused?: boolean;
}

export function DiffViewer({ diff, focused }: DiffViewerProps) {
  return (
    <scrollbox
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
