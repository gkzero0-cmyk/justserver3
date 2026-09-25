export function seoulDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || ''

  return `${get('year')}-${get('month')}-${get('day')}`
}

export function uniqueNormalizedPageIds(values: string[]) {
  return [
    ...new Set(
      values
        .map((value) => value.replaceAll('-', '').trim())
        .filter(Boolean)
    )
  ]
}

export function wikiExplorationProgress(
  visitedIds: string[],
  availableIds: string[]
) {
  const available = uniqueNormalizedPageIds(availableIds)
  const availableSet = new Set(available)
  const visited = uniqueNormalizedPageIds(visitedIds).filter((pageId) =>
    availableSet.has(pageId)
  )

  const total = available.length
  const count = visited.length
  const percent = total ? Math.round((count / total) * 100) : 0

  return { count, total, percent, visited }
}

export function highestScoreKey<T extends string>(
  scores: Record<T, number>,
  fallback: T
) {
  const entries = Object.entries(scores) as Array<[T, number]>
  return entries.reduce(
    (best, current) => (current[1] > best[1] ? current : best),
    [fallback, scores[fallback] ?? 0] as [T, number]
  )[0]
}
