import { useCallback, useRef } from "react";
import type { TextareaRenderable } from "@opentui/core";
import { Panel } from "./ui/Panel";
import { theme } from "../lib/themes/default";
import type { DiffComment } from "../hooks/diff-comments";

/** Enter submits, Shift+Enter inserts a newline. */
const commentKeyBindings = [
  { name: "return", action: "submit" as const },
  { name: "return", shift: true, action: "newline" as const },
];

export interface CommentModalProps {
  existingComment?: DiffComment;
  focused?: boolean;
  onSave: (text: string) => void;
}

export function CommentModal({ existingComment, focused, onSave }: CommentModalProps) {
  const textareaRef = useRef<TextareaRenderable>(null);
  const isEditing = !!existingComment;
  const title = isEditing ? "Edit Comment" : "Add Comment";

  const handleSubmit = useCallback(() => {
    const text = textareaRef.current?.editBuffer.getText().trim();
    if (text) onSave(text);
  }, [onSave]);

  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
      zIndex={100}
    >
      <Panel
        title={title}
        flexDirection="column"
        backgroundColor={theme.bg}
        paddingX={2}
        paddingY={1}
        minWidth={50}
        maxWidth={80}
        width="100%"
      >
        <box flexDirection="column" focused={focused}>
          <textarea
            ref={textareaRef}
            initialValue={existingComment?.text ?? ""}
            onSubmit={handleSubmit}
            keyBindings={commentKeyBindings}
            placeholder="Write a comment..."
            width="100%"
            height={8}
            focused={focused}
          />

          {/* Footer hints */}
          <box marginTop={1} flexDirection="row" justifyContent="space-between">
            <text fg={theme.textMuted}>
              <span fg={theme.accent}>Enter</span> save · <span fg={theme.accent}>Shift+Enter</span>{" "}
              new line · <span fg={theme.accent}>Escape</span> cancel
              {isEditing ? (
                <>
                  {" "}
                  · <span fg={theme.removed}>Ctrl+D</span> delete
                </>
              ) : null}
            </text>
          </box>

          {existingComment?.stale && (
            <box marginTop={0}>
              <text fg={theme.modified}>⚠ This comment may be stale — the line has changed.</text>
            </box>
          )}
        </box>
      </Panel>
    </box>
  );
}
