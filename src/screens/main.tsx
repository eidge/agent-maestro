import { useEffect, useMemo, useState } from "react"
import { Git, type ChangedFile, type CommitInfo, type FileDiff } from "../lib/git"
import { RGBA, SyntaxStyle } from "@opentui/core"

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
  const [fileDiffs, setFileDiffs] = useState<FileDiff[]>([])

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

  useEffect(() => {
    (async () => {
      const fileDiffs = await Promise.all(uncommitedFiles.flatMap(commit => {
        return git.getFileDiff(commit)
      }))
      setFileDiffs(fileDiffs)
    })()
  }, [git, uncommitedFiles])

  return (
    <box flexDirection="column" width="100%" height="100%">
      {/* Header */}
      <box paddingX={1} marginY={1}>
        <ascii-font font="tiny" text="Agent-Maestro" />
      </box>

      {/* Body: sidebar + main */}
      <box flexDirection="row" flexGrow={1} width="100%">
        {/* Sidebar */}
        <box
          width={34}
          flexDirection="column"
          borderStyle="rounded"
          border={["right"]}
          marginBottom={1}
          paddingX={1}
        >
          {/* Branch */}
          <box paddingY={0}>
            <text>
              <span fg="#7aa2f7"><strong>{branchName ?? "..."}</strong></span>
            </text>
          </box>

          {/* Commits list */}
          <box
            marginTop={1}
            borderStyle="rounded"
            title="Commits"
            titleAlignment="left"
            paddingX={1}
          >
            {commits.map(c => (
              <text key={c.sha}>
                <span fg="#565f89">#{c.sha.slice(0, 6)}</span> {c.title}
              </text>
            ))}
            {commits.length === 0 && <text fg="#565f89">no commits</text>}
          </box>

          {/* File list */}
          <box
            marginTop={1}
            borderStyle="rounded"
            title="Changed Files"
            titleAlignment="left"
            paddingX={1}
            flexGrow={1}
          >
            {uncommitedFiles.map(f => (
              <text key={f.path}>
                <span fg={f.operation === "created" ? "#9ece6a" : f.operation === "removed" ? "#f7768e" : "#e0af68"}>
                  {f.operation === "created" ? "+" : f.operation === "removed" ? "-" : "~"}
                </span>
                {" "}{f.path}
              </text>
            ))}
          </box>
        </box>

        {/* Main diff area */}
        <scrollbox flexGrow={1} height="100%">
          <box flexDirection="column" paddingX={1} width="100%">
            {fileDiffs.map(fd => (
              <box
                key={fd.path}
                title={fd.path}
                maxHeight={10}
                paddingY={1}
                borderStyle="rounded"
                focusable={true}
                focusedBorderColor={'blue'}
              >
                <diff
                  syntaxStyle={diffSyntaxStyle}
                  filetype="typescript"
                  showLineNumbers={true}
                  diff={fd.unifiedDiff}
                />
              </box>
            ))}
            {fileDiffs.length === 0 && <text fg="#565f89">No diffs to display</text>}
          </box>
        </scrollbox>
      </box>
    </box>
  )
}
