import { useCallback, useEffect, useMemo, useState } from "react"
import type { ChangedFile } from "../lib/git"

export interface FileSelectorProps {
  files: ChangedFile[]
  onSelect: (file: ChangedFile) => void
  focused?: boolean
}

export function FileSelector({
  files,
  onSelect,
  focused,
}: FileSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectOptions = useMemo(() =>
    files.map(f => ({
      name: `${f.operation === "created" ? "+" : f.operation === "removed" ? "-" : "~"} ${f.path}`,
      description: `+${f.insertions} -${f.deletions}`,
      value: f.path,
    })),
    [files],
  )

  // Auto-select first file when files change
  useEffect(() => {
    if (files.length === 0) return
    setSelectedIndex(0)
    onSelect(files[0]!)
  }, [files.length > 0, files[0]?.path]) // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = useCallback(
    (index: number, _option: unknown) => {
      setSelectedIndex(index)
      const file = files[index]
      if (file) onSelect(file)
    },
    [files, onSelect],
  )

  if (selectOptions.length === 0) {
    return <text fg="#565f89">no changed files</text>
  }

  return (
    <select
      options={selectOptions}
      selectedIndex={selectedIndex}
      onChange={onChange}
      focused={focused}
      showScrollIndicator
      height="100%"
    />
  )
}
