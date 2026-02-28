import { useEffect, useMemo, useState } from "react"
import { Git, type ChangedFile, type CommitInfo, type FileDiff } from "../lib/git"
import { RGBA, SyntaxStyle } from "@opentui/core"

const diffSyntaxStyle = SyntaxStyle.fromStyles({
  default: { fg: RGBA.fromHex('#0000FF')},
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
    <box flexDirection="column">
      <ascii-font font="tiny" text="Agent-Maestro" />
      <box flexDirection="row" width="100%">
        <box justifyContent="center" alignItems="center" marginTop={3}>
          <box>
            <text>current branch: {branchName}</text>
            {
              loadingGitInfo ?
                (
                  <text>loading...</text>
                )
                :
                (
                  <>
                    <text>number of uncommited files: {uncommitedFiles.length}</text>
                    <text>number of commits: {commits.length}</text>
                  </>
                )
            }
            {
              commits.map(commit => {
                return <text key={commit.sha}>{commit.title} (#{commit.sha.slice(0, 6)})</text>
              })
            }
          </box>
          <box width="100%">
            {
              fileDiffs.map(fileDiff => {
                return (
                  <box
                    key={fileDiff.path}
                    title={fileDiff.path}
                    maxHeight={10}
                    paddingY={1}
                    borderStyle="rounded"
                    focusable={true}
                    focusedBorderColor={'blue'} >
                    <diff
                      syntaxStyle={diffSyntaxStyle}
                      filetype="typescript"
                      showLineNumbers={true}
                      diff={fileDiff.unifiedDiff} />
                  </box>
                )
              })
            }
          </box>
        </box>
      </box>
    </box>
  )
}
