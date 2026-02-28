import { useEffect, useMemo, useState } from "react"
import { Git, type ChangedFile, type CommitInfo } from "../lib/git"

export function MainScreen() {
  const git = useMemo(() => new Git(), [])
  const [loadingGitInfo, setLoadingGitInfo] = useState<boolean>(true)
  const [branchName, setBranchName] = useState<string>()
  const [commits, setCommits] = useState<CommitInfo[]>([])
  const [uncommitedFiles, setUncommitedFiles] = useState<ChangedFile[]>([])

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

  return (
    <box flexGrow={1}>
      <ascii-font font="tiny" text="Agent-Maestro" />
      <box alignItems="center" justifyContent="center" flexGrow={1}>
        <box justifyContent="center" alignItems="center" marginTop={3}>
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
            uncommitedFiles.map(file => {
              return (
                <text>
                  {file.path}
                  <span fg="green"> +{file.insertions}</span>
                  <span fg="red"> -{file.deletions} </span>
                  ({file.operation})
                </text>
              )
            })
          }

          {
            commits.map(commit => {
              return <text>{commit.title} (#{commit.sha.slice(0, 6)})</text>
            })
          }
        </box>
      </box>
    </box>
  )
}
