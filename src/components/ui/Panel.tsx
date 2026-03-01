import type { BoxProps } from "@opentui/react";

const defaults = {
  borderStyle: "rounded",
  paddingX: 1,
  titleAlignment: "left",
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
