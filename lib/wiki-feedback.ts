export type WikiFeedbackKind =
  | 'incorrect'
  | 'add'
  | 'typo'
  | 'bug'
  | 'other'

export type WikiFeedbackPayload = {
  pageId: string
  title: string
  url: string
  kind: WikiFeedbackKind
  message: string
  nickname?: string
  website?: string
}

const KIND_LABELS: Record<WikiFeedbackKind, string> = {
  incorrect: '잘못된 정보',
  add: '내용 추가',
  typo: '오타·표현',
  bug: '기능 오류',
  other: '기타'
}

export function wikiFeedbackKindLabel(kind: WikiFeedbackKind) {
  return KIND_LABELS[kind]
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePageId(value: string) {
  return value.replaceAll('-', '').toLowerCase()
}

export function validateWikiFeedbackPayload(
  input: unknown
):
  | { ok: true; value: WikiFeedbackPayload }
  | { ok: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'invalid-payload' }
  }

  const raw = input as Record<string, unknown>
  const pageId = normalizePageId(clean(raw.pageId))
  const title = clean(raw.title)
  const url = clean(raw.url)
  const kind = clean(raw.kind) as WikiFeedbackKind
  const message = clean(raw.message)
  const nickname = clean(raw.nickname)
  const website = clean(raw.website)

  if (!/^[0-9a-f]{32}$/.test(pageId)) {
    return { ok: false, error: 'invalid-page' }
  }

  if (!title || title.length > 100) {
    return { ok: false, error: 'invalid-title' }
  }

  if (!Object.prototype.hasOwnProperty.call(KIND_LABELS, kind)) {
    return { ok: false, error: 'invalid-kind' }
  }

  if (message.length < 5 || message.length > 1500) {
    return { ok: false, error: 'invalid-message' }
  }

  if (nickname.length > 40) {
    return { ok: false, error: 'invalid-nickname' }
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return { ok: false, error: 'invalid-url' }
  }

  if (
    parsedUrl.protocol !== 'https:' ||
    parsedUrl.hostname !== 'justserver3.vercel.app'
  ) {
    return { ok: false, error: 'invalid-url' }
  }

  return {
    ok: true,
    value: {
      pageId,
      title,
      url: parsedUrl.toString(),
      kind,
      message,
      ...(nickname ? { nickname } : {}),
      ...(website ? { website } : {})
    }
  }
}

function neutralizeMentions(value: string) {
  return value.replaceAll('@', '@​')
}

export function buildWikiFeedbackIssue(
  feedback: WikiFeedbackPayload,
  receivedAt: string
) {
  const kindLabel = wikiFeedbackKindLabel(feedback.kind)
  const message = neutralizeMentions(feedback.message)
  const nickname = feedback.nickname
    ? neutralizeMentions(feedback.nickname)
    : '미입력'

  return {
    title: `[사이트 제보] ${feedback.title} · ${kindLabel}`,
    body: [
      '## 위키 사이트 제보',
      '',
      `- 유형: ${kindLabel}`,
      `- 문서: ${feedback.title}`,
      `- 문서 ID: ${feedback.pageId}`,
      `- 문서 주소: ${feedback.url}`,
      `- 닉네임: ${nickname}`,
      `- 접수 시각: ${receivedAt}`,
      '',
      '### 제보 내용',
      '',
      message
        .split(/\r?\n/)
        .map((line) => `> ${line || ' '}`)
        .join('\n')
    ].join('\n')
  }
}
