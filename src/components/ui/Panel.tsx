import type { BoxProps } from "@opentui/react";
import { theme } from "../../lib/styles/default";

const defaults = {
  borderStyle: "rounded",
  paddingX: 1,
  titleAlignment: "left",
  borderColor: theme.border,
  focusedBorderColor: theme.borderFocused,
} satisfies Partial<BoxProps>;

export function Panel({ children, ...props }: BoxProps) {
  if (props.title) {
    props.title = ` ${props.title} `;
  }

  return (
    <box {...defaults} {...props}>
      {children}
    </box>
  );
}
