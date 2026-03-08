import { useCallback, useEffect, useMemo, useRef } from "react";
import { atom, useAtom } from "jotai";
import type { DiffLineType } from "../lib/git/diff-parser";
import type { ChangedFile } from "../lib/git";

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------

export interface DiffComment {
  id: string;
  filePath: string;
  commitSha: string;
  diffLineIndex: number;
  lineContent: string;
  lineType: DiffLineType;
  text: string;
  createdAt: number;
  updatedAt: number;
  stale: boolean;
}

// ---------------------------------------------------------------------------
// Global atom
// ---------------------------------------------------------------------------

export const allCommentsAtom = atom<DiffComment[]>([]);

// ---------------------------------------------------------------------------
// Pure sync helpers (unit-testable without React)
// ---------------------------------------------------------------------------

export interface LineSnapshot {
  content: string;
  type: DiffLineType;
}

/**
 * Synchronise comments for a single file after its diff changed.
 *
 * For each comment whose anchor line no longer matches, we search outward
 * from the old position for a line with the same content & type.  If found
 * the comment is relocated; otherwise it is marked stale.
 */
export function syncCommentsForFile(
  comments: DiffComment[],
  filePath: string,
  commitSha: string,
  newLines: LineSnapshot[],
): DiffComment[] {
  let changed = false;

  const result = comments.map((c) => {
    if (c.filePath !== filePath || c.commitSha !== commitSha) return c;

    // Check if the line at the current index still matches
    const lineAtIndex = newLines[c.diffLineIndex];
    if (lineAtIndex && lineAtIndex.content === c.lineContent && lineAtIndex.type === c.lineType) {
      // Still valid at same position
      if (c.stale) {
        changed = true;
        return { ...c, stale: false };
      }
      return c;
    }

    // Search outward for a matching line
    const newIndex = findNearestMatch(c.lineContent, c.lineType, c.diffLineIndex, newLines);

    if (newIndex !== null) {
      changed = true;
      return { ...c, diffLineIndex: newIndex, stale: false };
    }

    // Not found — mark stale, clamp index
    if (!c.stale || c.diffLineIndex >= newLines.length) {
      changed = true;
      return {
        ...c,
        stale: true,
        diffLineIndex: Math.max(0, Math.min(c.diffLineIndex, newLines.length - 1)),
      };
    }

    return c;
  });

  return changed ? result : comments;
}

/**
 * Search outward from `origin` for a line matching `content` + `type`.
 * Returns the index of the nearest match, or null.
 */
export function findNearestMatch(
  content: string,
  type: DiffLineType,
  origin: number,
  lines: LineSnapshot[],
): number | null {
  const maxRadius = Math.max(origin, lines.length - origin);

  for (let r = 1; r <= maxRadius; r++) {
    for (const delta of [-r, r]) {
      const idx = origin + delta;
      if (idx < 0 || idx >= lines.length) continue;
      const line = lines[idx]!;
      if (line.content === content && line.type === type) {
        return idx;
      }
    }
  }
  return null;
}

/**
 * Mark all comments for files that are no longer in the uncommitted list as stale.
 */
export function markOrphanedComments(
  comments: DiffComment[],
  uncommittedFiles: ChangedFile[],
): DiffComment[] {
  const uncommittedPaths = new Set(uncommittedFiles.map((f) => f.path));
  let changed = false;

  const result = comments.map((c) => {
    if (c.commitSha !== "uncommitted") return c;
    if (uncommittedPaths.has(c.filePath)) return c;
    if (c.stale) return c;
    changed = true;
    return { ...c, stale: true };
  });

  return changed ? result : comments;
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseDiffCommentsResult {
  /** Map from diffLineIndex → comment for the current file/commit. */
  comments: Map<number, DiffComment>;
  addComment: (
    lineIndex: number,
    lineContent: string,
    lineType: DiffLineType,
    text: string,
  ) => void;
  editComment: (id: string, text: string) => void;
  deleteComment: (id: string) => void;
}

export function useDiffComments(
  filePath: string | undefined,
  commitSha: string | undefined,
): UseDiffCommentsResult {
  const [allComments, setAllComments] = useAtom(allCommentsAtom);

  const comments = useMemo(() => {
    const map = new Map<number, DiffComment>();
    if (!filePath || !commitSha) return map;
    for (const c of allComments) {
      if (c.filePath === filePath && c.commitSha === commitSha) {
        map.set(c.diffLineIndex, c);
      }
    }
    return map;
  }, [allComments, filePath, commitSha]);

  const addComment = useCallback(
    (lineIndex: number, lineContent: string, lineType: DiffLineType, text: string) => {
      if (!filePath || !commitSha) return;
      const now = Date.now();
      const comment: DiffComment = {
        id: crypto.randomUUID(),
        filePath,
        commitSha,
        diffLineIndex: lineIndex,
        lineContent,
        lineType,
        text,
        createdAt: now,
        updatedAt: now,
        stale: false,
      };
      setAllComments((prev) => [...prev, comment]);
    },
    [filePath, commitSha, setAllComments],
  );

  const editComment = useCallback(
    (id: string, text: string) => {
      setAllComments((prev) =>
        prev.map((c) => (c.id === id ? { ...c, text, updatedAt: Date.now() } : c)),
      );
    },
    [setAllComments],
  );

  const deleteComment = useCallback(
    (id: string) => {
      setAllComments((prev) => prev.filter((c) => c.id !== id));
    },
    [setAllComments],
  );

  return { comments, addComment, editComment, deleteComment };
}

/**
 * Hook that runs comment sync whenever the diff body lines change.
 * Should be called once from the screen that owns the diff lifecycle.
 */
export function useSyncDiffComments(
  filePath: string | undefined,
  commitSha: string | undefined,
  lineSnapshots: LineSnapshot[] | undefined,
) {
  const [, setAllComments] = useAtom(allCommentsAtom);
  const prevSnapshotsRef = useRef<LineSnapshot[] | undefined>(undefined);

  useEffect(() => {
    if (!filePath || !commitSha || commitSha !== "uncommitted" || !lineSnapshots) {
      prevSnapshotsRef.current = lineSnapshots;
      return;
    }

    const prev = prevSnapshotsRef.current;
    prevSnapshotsRef.current = lineSnapshots;

    // Skip the very first render (no previous to diff against)
    if (!prev) return;

    // Skip if nothing changed
    if (
      prev.length === lineSnapshots.length &&
      prev.every(
        (l, i) => l.content === lineSnapshots[i]!.content && l.type === lineSnapshots[i]!.type,
      )
    ) {
      return;
    }

    setAllComments((comments) => syncCommentsForFile(comments, filePath, commitSha, lineSnapshots));
  }, [filePath, commitSha, lineSnapshots, setAllComments]);
}

/**
 * Hook that marks orphaned comments when the uncommitted file list changes.
 */
export function useCleanupOrphanedComments(uncommittedFiles: ChangedFile[]) {
  const [, setAllComments] = useAtom(allCommentsAtom);

  useEffect(() => {
    setAllComments((comments) => markOrphanedComments(comments, uncommittedFiles));
  }, [uncommittedFiles, setAllComments]);
}
