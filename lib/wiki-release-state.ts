export type WikiReleaseCommit = {
  sha: string | null
  message: string | null
}

export function isVercelSkippedCommit(message: string | null) {
  const normalized = message?.trim().toLowerCase() || ''

  return (
    normalized.startsWith('refresh deploy bundle [skip ci]') ||
    normalized.includes('[skip vercel]')
  )
}

export function resolveDeployableMainShaFromHistory(
  commits: WikiReleaseCommit[]
) {
  return (
    commits.find(
      (commit) => Boolean(commit.sha) && !isVercelSkippedCommit(commit.message)
    )?.sha ?? null
  )
}

export function resolveDeployableMainSha({
  sha,
  message,
  parentSha
}: {
  sha: string | null
  message: string | null
  parentSha: string | null
}) {
  if (!sha) return null

  if (isVercelSkippedCommit(message) && parentSha) {
    return parentSha
  }

  return sha
}
