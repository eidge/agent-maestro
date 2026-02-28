import { useEffect, useMemo, useState } from "react"
import { Git, type ChangedFile, type CommitInfo, type FileDiff } from "../lib/git"
import { RGBA, SyntaxStyle } from "@opentui/core"
import { Panel } from "../components/ui/Panel"
import { CommitSelector, type SelectedCommit } from "../components/CommitSelector"
import { FileSelector } from "../components/FileSelector"
import { useKeyboardShortcut } from "../hooks/keyboard"

const focusablePanels = [
  "commits",
  "files",
  "diff"
] as const

type FocusablePanel = (typeof focusablePanels)[number]

const diffSyntaxStyle = SyntaxStyle.fromStyles({
  default: { fg: RGBA.fromHex('#0000FF') },
  keyword: { fg: RGBA.fromHex('#FF0000') }
})

export function MainScreen() {
  const git = useMemo(() => new Git(), [])
  const [loadingGitInfo, setLoadingGitInfo] = useState<boolean>(true)
  const [branchName, setBranchName] = useState<string>()
  const [commits, setCommits] = useState<CommitInfo[]>([])
  const [uncommitedFiles, setUncommitedFiles] = useState<ChangedFile[]>([])

  const [selectedCommit, setSelectedCommit] = useState<SelectedCommit | null>(null)
  const [commitChangedFiles, setCommitChangedFiles] = useState<ChangedFile[]>([])
  const [fileDiffs, setFileDiffs] = useState<FileDiff[]>([])
  const [selectedFile, setSelectedFile] = useState<ChangedFile | null>(null)
  const [focusedPanel, setFocusedPanel] = useState<FocusablePanel>("commits")

  useKeyboardShortcut('tab', 'move between panels', () => {
    let index = focusablePanels.indexOf(focusedPanel) + 1

    if (index >= focusablePanels.length) {
      index = 0
    }

    setFocusedPanel(focusablePanels[index]!)
  })

  useEffect(() => {
    const updateCountsFn = async () => {
      const [branch, commits, uncommitted] = await Promise.all([
        git.getCurrentBranchName(),
        git.getCommitsSinceBase(),
        git.getUncommitedFiles(),
      ])
      setBranchName(branch)
      setCommits(commits)
      setUncommitedFiles(uncommitted)
      setLoadingGitInfo(false)
    }
    updateCountsFn()
    const interval = setInterval(updateCountsFn, 2000)
    return () => clearInterval(interval)
  }, [git])

  // Auto-select first commit/uncommitted when options become available
  const hasCommitOptions = uncommitedFiles.length > 0 || commits.length > 0
  const [prevHasCommitOptions, setPrevHasCommitOptions] = useState(false)
  if (hasCommitOptions !== prevHasCommitOptions) {
    setPrevHasCommitOptions(hasCommitOptions)
    if (hasCommitOptions) {
      setSelectedCommit(
        uncommitedFiles.length > 0
          ? { kind: "uncommitted" }
          : { kind: "commit", commit: commits[0]! }
      )
    } else {
      setSelectedCommit(null)
    }
  }

  // Reset async commit files when selected commit changes (render-time adjustment)
  const commitSha = selectedCommit?.kind === "commit" ? selectedCommit.commit.sha : null
  const [prevCommitSha, setPrevCommitSha] = useState<string | null>(null)
  if (commitSha !== prevCommitSha) {
    setPrevCommitSha(commitSha)
    setCommitChangedFiles([])
  }

  // Derive currentFiles: synchronous for null/uncommitted, async result for commits
  const currentFiles = useMemo(() => {
    if (!selectedCommit) return []
    if (selectedCommit.kind === "uncommitted") return uncommitedFiles
    return commitChangedFiles
  }, [selectedCommit, uncommitedFiles, commitChangedFiles])

  // Reset file diffs and auto-select first file when current files change
  const currentFilesKey = currentFiles.map(f => f.path).join("\0")
  const [prevFilesKey, setPrevFilesKey] = useState("")
  if (currentFilesKey !== prevFilesKey) {
    setPrevFilesKey(currentFilesKey)
    setFileDiffs([])
    setSelectedFile(currentFiles[0] ?? null)
  }

  // Fetch changed files for commit selections (async)
  useEffect(() => {
    if (!selectedCommit || selectedCommit.kind !== "commit") return
    git.getChangedFilesForCommit(selectedCommit.commit).then(setCommitChangedFiles)
  }, [git, selectedCommit])

  // Fetch diffs for current files (async)
  useEffect(() => {
    if (currentFiles.length === 0) return
    ;(async () => {
      const diffs = await Promise.all(currentFiles.map(f => git.getFileDiff(f)))
      setFileDiffs(diffs)
    })()
  }, [git, currentFiles])

  const selectedDiff = fileDiffs.find(d => d.path === selectedFile?.path) ?? null

  if (loadingGitInfo) {
    return null
  }

  return (
    <box flexDirection="column" width="100%" height="100%">
      {/* Header */}
      <box
        flexDirection="row"
        paddingX={1}
        marginY={1}
        height={2}
        alignItems="flex-end"
        >
        <ascii-font font="tiny" text="Agent-Maestro" />
        <box marginLeft={1} paddingY={0}>
          <text>
            <span fg="#7aa2f7"><strong>{branchName ?? "..."}</strong></span>
          </text>
        </box>
      </box>

      {/* Body: sidebar + main */}
      <box flexDirection="row" flexGrow={1} width="100%" columnGap={2}>
        {/* Sidebar */}
        <box
          width={50}
          flexDirection="column"
        >
          {/* Branch */}

          {/* Commits select */}
          <Panel
            title="Commits"
            height={20}
          >
            <CommitSelector
              commits={commits}
              uncommitedFileCount={uncommitedFiles.length}
              selectedCommit={selectedCommit}
              onSelect={setSelectedCommit}
              focused={focusedPanel === "commits"}
            />
          </Panel>

          {/* File select for selected commit */}
          <Panel
            marginTop={1}
            title="Changed Files"
            flexGrow={1}
          >
            <FileSelector
              files={currentFiles}
              selectedFile={selectedFile}
              onSelect={setSelectedFile}
              focused={focusedPanel === "files"}
            />
          </Panel>
        </box>

        {/* Main diff area */}
        {selectedDiff ? (
          <Panel
            title={selectedDiff.path}
            flexGrow={1}
          >
            <scrollbox focused={focusedPanel === "diff"}>
              <box flexDirection="column">
                <diff
                  syntaxStyle={diffSyntaxStyle}
                  filetype="typescript"
                  showLineNumbers={true}
                  diff={selectedDiff.unifiedDiff}
                />
              </box>
            </scrollbox>
          </Panel>
        ) : (
          <box flexGrow={1} justifyContent="center" alignItems="center">
            <text fg="#565f89">No diffs to display</text>
          </box>
        )}
      </box>
    </box>
  )
}
