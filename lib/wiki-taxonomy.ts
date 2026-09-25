export type WikiCategoryKey = 'start' | 'content' | 'growth'

export const WIKI_CATEGORIES: Record<
  WikiCategoryKey,
  { title: string; icon: string; description: string }
> = {
  start: {
    title: '시작하기',
    icon: '🧭',
    description: '처음 접속하기 전에 확인할 필수 안내'
  },
  content: {
    title: '주요 콘텐츠',
    icon: '🎮',
    description: '채광부터 도감·파쿠르·미니게임까지'
  },
  growth: {
    title: '성장 · 경제',
    icon: '📈',
    description: '땅, 빚, 신용등급, 장비 성장과 FAQ'
  }
}

export function categoryForTitle(title: string): WikiCategoryKey {
  const value = title.toLowerCase()

  if (
    value.includes('스토리') ||
    value.includes('규칙') ||
    value.includes('패치') ||
    value.includes('api') ||
    value.includes('뉴비') ||
    value.includes('기초')
  ) {
    return 'start'
  }

  if (
    value.includes('땅') ||
    value.includes('빚') ||
    value.includes('신용') ||
    value.includes('수리') ||
    value.includes('강화') ||
    value.includes('물어보는')
  ) {
    return 'growth'
  }

  return 'content'
}

export function iconForTitle(title: string) {
  const value = title.toLowerCase()

  if (value.includes('스토리')) return '📖'
  if (value.includes('룰') || value.includes('규칙')) return '📜'
  if (value.includes('api') || value.includes('후원')) return '💝'
  if (value.includes('뉴비') || value.includes('기초')) return '🧭'
  if (value.includes('패치')) return '📝'
  if (value.includes('강화')) return '⚒️'
  if (value.includes('수리')) return '🔧'
  if (value.includes('광') || value.includes('채광')) return '⛏️'
  if (value.includes('낚시')) return '🎣'
  if (value.includes('도축')) return '🥩'
  if (value.includes('사냥')) return '⚔️'
  if (value.includes('요리')) return '🍳'
  if (value.includes('도감')) return '📚'
  if (value.includes('파쿠르')) return '🏃'
  if (value.includes('복권')) return '🎟️'
  if (value.includes('경마')) return '🏇'
  if (value.includes('카지노')) return '🎰'
  if (value.includes('땅')) return '🏠'
  if (value.includes('빚')) return '💸'
  if (value.includes('신용')) return '💳'
  if (value.includes('물어보는')) return '❓'

  return '✦'
}

export function categoryTitleForPage(title: string) {
  return WIKI_CATEGORIES[categoryForTitle(title)].title
}

export function categoryAnchorForTitle(title: string) {
  return `category-${categoryForTitle(title)}`
}
