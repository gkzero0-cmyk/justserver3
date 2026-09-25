export type WikiSearchTopicId =
  | 'rules'
  | 'economy'
  | 'equipment'
  | 'content'
  | 'api'
  | 'general'

export type WikiSearchTopic = {
  id: WikiSearchTopicId
  label: string
  keywords: string[]
  titles: string[]
  demandWeight: number
}

export const WIKI_SEARCH_TOPICS: WikiSearchTopic[] = [
  {
    id: 'rules',
    label: '규칙 · 입장',
    keywords: [
      '규칙','룰','금지','허용','입장','재입주','거래','자동화','겉날개',
      '인챈트','모루','복구','농사','용암'
    ],
    titles: ['서버규칙', '기초설정(뉴비필독)', '많이 물어보는 것'],
    demandWeight: 100
  },
  {
    id: 'economy',
    label: '경제 · 신용',
    keywords: [
      '돈','골드','경제','빚','상환','신용','등급','땅','토지','수수료',
      '복권','경마','카지노'
    ],
    titles: ['빚 갚기', '신용등급', '땅 구매', '즉석복권', '경마장', '카지노'],
    demandWeight: 95
  },
  {
    id: 'equipment',
    label: '장비 · 성장',
    keywords: [
      '장비','강화','수리','내구도','곡괭이','무기','방어구','강화석',
      '재료'
    ],
    titles: ['장비강화', '장비수리', '채광', '사냥'],
    demandWeight: 90
  },
  {
    id: 'content',
    label: '콘텐츠 · 보상',
    keywords: [
      '채광','광질','낚시','도축','사냥','요리','도감','파쿠르','보상',
      '콘텐츠','미니게임'
    ],
    titles: ['채광', '낚시', '도축', '사냥', '요리', '도감', '파쿠르'],
    demandWeight: 80
  },
  {
    id: 'api',
    label: 'API · 후원',
    keywords: ['api','후원','별풍선','도전미션','연동'],
    titles: ['API', '서버규칙'],
    demandWeight: 65
  }
]

export function classifyWikiSearchTopic(query: string): WikiSearchTopicId {
  const normalized = query
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return 'general'

  let best: { id: WikiSearchTopicId; score: number } = {
    id: 'general',
    score: 0
  }

  for (const topic of WIKI_SEARCH_TOPICS) {
    let score = 0
    for (const keyword of topic.keywords) {
      const token = keyword.toLocaleLowerCase('ko-KR')
      if (normalized === token) score += 4
      else if (normalized.includes(token)) score += Math.max(1, token.length / 2)
    }
    for (const title of topic.titles) {
      const token = title.toLocaleLowerCase('ko-KR')
      if (normalized === token) score += 5
      else if (normalized.includes(token)) score += 2
    }
    if (score > best.score) best = { id: topic.id, score }
  }

  return best.id
}

export function wikiTopicLabel(id: WikiSearchTopicId) {
  return WIKI_SEARCH_TOPICS.find((topic) => topic.id === id)?.label || '기타'
}

export function buildTopicCoverage(
  pages: Array<{ title: string; status?: 'draft' | 'brief' | 'detailed' }>
) {
  return WIKI_SEARCH_TOPICS.map((topic) => {
    const related = pages.filter((page) => topic.titles.includes(page.title))
    const draft = related.filter((page) => page.status === 'draft').length
    const brief = related.filter((page) => page.status === 'brief').length
    const detailed = related.filter((page) => page.status === 'detailed').length
    const gapScore =
      draft * 30 +
      brief * 12 +
      Math.max(0, topic.titles.length - related.length) * 18

    return {
      id: topic.id,
      label: topic.label,
      demandWeight: topic.demandWeight,
      pages: related.length,
      draft,
      brief,
      detailed,
      score: topic.demandWeight + gapScore,
      targetTitles: topic.titles
    }
  }).sort((a, b) => b.score - a.score)
}
