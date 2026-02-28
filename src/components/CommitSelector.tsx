import { useCallback, useEffect, useMemo, useState } from "react"
import type { CommitInfo } from "../lib/git"

export type SelectedCommit =
  | { kind: "uncommitted" }
  | { kind: "commit"; commit: CommitInfo }

export interface CommitSelectorProps {
  commits: CommitInfo[]
  uncommitedFileCount: number
  onSelect: (selection: SelectedCommit) => void
  focused?: boolean
}

export function CommitSelector({
  commits,
  uncommitedFileCount,
  onSelect,
  focused,
}: CommitSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const hasUncommitted = uncommitedFileCount > 0

  const selectOptions = useMemo(() => {
    const opts: { name: string; description: string; value: string }[] = []
    if (hasUncommitted) {
      opts.push({
        name: "● uncommitted changes",
        description: `${uncommitedFileCount} files`,
        value: "uncommitted",
      })
    }
    for (const c of commits) {
      opts.push({
        name: c.title,
        description: `#${c.sha.slice(0, 6)}`,
        value: c.sha,
      })
    }
    return opts
  }, [hasUncommitted, uncommitedFileCount, commits])

  // Resolve a SelectedCommit from an option index
  const resolveSelection = useCallback(
    (index: number): SelectedCommit | null => {
      const option = selectOptions[index]
      if (!option) return null
      if (option.value === "uncommitted") return { kind: "uncommitted" }
      const commit = commits.find((c) => c.sha === option.value)
      return commit ? { kind: "commit", commit } : null
    },
    [selectOptions, commits],
  )

  // Auto-select first option when options become available
  useEffect(() => {
    if (selectOptions.length === 0) return
    const selection = resolveSelection(0)
    if (selection) {
      setSelectedIndex(0)
      onSelect(selection)
    }
  }, [selectOptions.length > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = useCallback(
    (index: number, _option: unknown) => {
      setSelectedIndex(index)
      const selection = resolveSelection(index)
      if (selection) onSelect(selection)
    },
    [resolveSelection, onSelect],
  )

  if (selectOptions.length === 0) {
    return <text fg="#565f89">no commits</text>
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
