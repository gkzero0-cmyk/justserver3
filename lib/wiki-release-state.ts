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

  if (
    message?.trim().startsWith('Refresh deploy bundle [skip ci]') &&
    parentSha
  ) {
    return parentSha
  }

  return sha
}
