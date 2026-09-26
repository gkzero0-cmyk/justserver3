import Link from 'next/link'

import { WikiShell } from '@/components/wiki-shell'
import { readNotionAssetManifest, readNotionIndex } from '@/lib/notion-index'
import { notionPublicUrl, ROOT_PAGE_ID } from '@/lib/notion'
import { wikiContentStatus } from '@/lib/wiki-content-status'
import {
  buildWikiContentBacklog,
  wikiContentReadiness
} from '@/lib/wiki-content-health'
import { categoryTitleForPage } from '@/lib/wiki-taxonomy'
import { resolveCachedAsset, withBasePath } from '@/lib/url-utils'
import { buildWikiFeedbackUrl } from '@/lib/wiki-ux'
import verifiedFaqEntries from '@/data/wiki-verified-faq.json'
import { buildTopicCoverage } from '@/lib/wiki-search-topics'

export const revalidate = 300

export const metadata = {
  title: '위키 상태',
  description:
    '그냥서버 : 적자생존 공식 위키의 문서, 이미지, 자동 수집 및 빌드 상태입니다.',
  robots: {
    index: false,
    follow: false
  }
}

type WorkflowState = {
  status: string
  conclusion: string | null
  updatedAt: string | null
  title: string | null
  url: string | null
}

type ProductionHealth = {
  ok: boolean
  status: number | null
  deployedSha: string | null
  mainSha: string | null
}

function shortSha(value: string | null) {
  if (!value || value === 'unknown') return '확인 불가'
  return value.slice(0, 7)
}

async function getWorkflowState(workflow: string): Promise<WorkflowState | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/gkzero0-cmyk/justserver3/actions/workflows/${workflow}/runs?branch=main&per_page=1`,
      {
        headers: {
          Accept: 'application/vnd.github+json'
        },
        next: { revalidate: 300 }
      }
    )

    if (!response.ok) return null

    const data = (await response.json()) as {
      workflow_runs?: Array<{
        status?: string
        conclusion?: string | null
        updated_at?: string | null
        display_title?: string | null
        html_url?: string | null
      }>
    }
    const run = data.workflow_runs?.[0]
    if (!run) return null

    return {
      status: run.status || 'unknown',
      conclusion: run.conclusion ?? null,
      updatedAt: run.updated_at ?? null,
      title: run.display_title ?? null,
      url: run.html_url ?? null
    }
  } catch {
    return null
  }
}

async function getProductionHealth(): Promise<ProductionHealth> {
  try {
    const [healthResponse, versionResponse, branchResponse] = await Promise.all([
      fetch('https://justserver3.vercel.app/', {
        method: 'HEAD',
        next: { revalidate: 300 }
      }),
      fetch('https://justserver3.vercel.app/api/version', {
        next: { revalidate: 300 }
      }),
      fetch('https://api.github.com/repos/gkzero0-cmyk/justserver3/branches/main', {
        headers: {
          Accept: 'application/vnd.github+json'
        },
        next: { revalidate: 300 }
      })
    ])

    const version = versionResponse.ok
      ? ((await versionResponse.json()) as { commit?: string | null })
      : null
    const branch = branchResponse.ok
      ? ((await branchResponse.json()) as { commit?: { sha?: string | null } })
      : null

    return {
      ok: healthResponse.ok,
      status: healthResponse.status,
      deployedSha: version?.commit || null,
      mainSha: branch?.commit?.sha || null
    }
  } catch {
    return {
      ok: false,
      status: null,
      deployedSha: null,
      mainSha: null
    }
  }
}

function formatDate(value: string | null) {
  if (!value) return '확인되지 않음'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '확인되지 않음'
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul'
  }).format(date)
}

function formatBytes(value?: number) {
  if (!value || value <= 0) return '확인 중'
  return `${(value / 1024 / 1024).toFixed(1)}MB`
}

function statusLabel(state: WorkflowState | null) {
  if (!state) return '확인 불가'
  if (state.status !== 'completed') return '진행 중'
  if (state.conclusion === 'success') return '정상'
  return '주의'
}

function statusTone(state: WorkflowState | null) {
  if (!state) return 'unknown'
  if (state.status !== 'completed') return 'working'
  return state.conclusion === 'success' ? 'success' : 'warning'
}

export default async function StatusPage() {
  const [
    index,
    manifest,
    syncWorkflow,
    buildWorkflow,
    productionVerifyWorkflow,
    productionHealth
  ] = await Promise.all([
    readNotionIndex(),
    readNotionAssetManifest(),
    getWorkflowState('sync-notion-assets.yml'),
    getWorkflowState('build.yml'),
    getWorkflowState('verify-production.yml'),
    getProductionHealth()
  ])

  const rootId = index.rootPageId.replaceAll('-', '')
  const rootPage =
    index.pages.find(
      (page) => page.pageId.replaceAll('-', '') === rootId
    ) ?? null
  const pages = index.pages.filter(
    (page) => page.pageId.replaceAll('-', '') !== rootId
  )
  const pagesWithStatus = pages.map((page) => ({
    ...page,
    status:
      page.title === '많이 물어보는 것'
        ? ('detailed' as const)
        : wikiContentStatus(page)
  }))
  const topicCoverage = buildTopicCoverage(pagesWithStatus)
  const faqCandidates = index.faqCandidates || []
  const reviewQueue = index.reviewQueue || []

  const contentCounts = pages.reduce(
    (counts, page) => {
      counts[
        page.title === '많이 물어보는 것'
          ? 'detailed'
          : wikiContentStatus(page)
      ] += 1
      return counts
    },
    { detailed: 0, brief: 0, draft: 0 }
  )
  const contentBacklog = buildWikiContentBacklog(pagesWithStatus, 12)
  const contentReadiness = wikiContentReadiness(pagesWithStatus)
  const brandLogo = rootPage?.logo128
    ? resolveCachedAsset(rootPage.logo128)
    : rootPage?.logo
      ? resolveCachedAsset(rootPage.logo)
      : rootPage?.icon
      ? resolveCachedAsset(rootPage.icon)
      : null
  const recentPages = [...pages]
    .filter(
      (page) =>
        page.lastEdited && wikiContentStatus(page) !== 'draft'
    )
    .sort(
      (a, b) =>
        new Date(b.lastEdited || 0).getTime() -
        new Date(a.lastEdited || 0).getTime()
    )
    .slice(0, 5)

  const syncHealthy =
    !syncWorkflow ||
    syncWorkflow.status !== 'completed' ||
    syncWorkflow.conclusion === 'success'
  const buildHealthy =
    !buildWorkflow ||
    buildWorkflow.status !== 'completed' ||
    buildWorkflow.conclusion === 'success'
  const deploymentCurrent =
    Boolean(productionHealth.mainSha) &&
    Boolean(productionHealth.deployedSha) &&
    productionHealth.mainSha === productionHealth.deployedSha
  const overallHealthy =
    syncHealthy && buildHealthy && productionHealth.ok && deploymentCurrent
  const webhookSignatureReady = Boolean(
    process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN
  )
  const instantAssetSyncReady = Boolean(process.env.GITHUB_ACTIONS_TOKEN)
  const production = process.env.VERCEL_ENV === 'production'

  return (
    <WikiShell
      sourceUrl={notionPublicUrl(ROOT_PAGE_ID)}
      title="위키 상태"
      pageCount={pages.length || 1}
      pages={pages.map((page) => ({
        pageId: page.pageId,
        title: page.title,
        status:
          page.title === '많이 물어보는 것'
            ? 'detailed'
            : wikiContentStatus(page),
        category: categoryTitleForPage(page.title)
      }))}
      brandLogo={brandLogo}
    >
      <section className="status-dashboard">
        <div className="status-summary">
          <div>
            <span
              className={`status-dot ${overallHealthy ? '' : 'is-warning'}`}
            />
            <strong>
              {overallHealthy ? '자동화 정상 운영 중' : '확인이 필요한 작업이 있습니다'}
            </strong>
            <small>
              Notion 수집, 이미지 최적화, GitHub 빌드 상태를 함께 확인합니다.
            </small>
          </div>
          <time>마지막 데이터 동기화 {formatDate(index.generatedAt)}</time>
        </div>

        <div className="status-grid status-grid-primary">
          <article>
            <small>세부 문서</small>
            <strong>{pages.length}</strong>
            <span>
              상세 {contentCounts.detailed} · 간단 {contentCounts.brief} · 작성 중 {contentCounts.draft}
            </span>
          </article>
          <article>
            <small>이미지 매핑</small>
            <strong>{Object.keys(manifest).length}</strong>
            <span>Notion 원본 이미지 연결 항목</span>
          </article>
          <article>
            <small>고유 이미지</small>
            <strong>{index.assetStats?.uniqueSourceImages ?? '—'}</strong>
            <span>
              중복 매핑 {index.assetStats?.duplicateMappings ?? '—'}개 감지
            </span>
          </article>
          <article>
            <small>카드용 이미지 총량</small>
            <strong>{formatBytes(index.assetStats?.thumbnailBytes)}</strong>
            <span>480px WebP 썸네일 기준</span>
          </article>
        </div>

        <div className="status-content-metrics" aria-label="문서 완성도">
          <article data-status="detailed">
            <small>상세 가이드</small>
            <strong>{contentCounts.detailed}</strong>
            <span>충분한 내용이 정리된 문서</span>
          </article>
          <article data-status="brief">
            <small>간단 안내</small>
            <strong>{contentCounts.brief}</strong>
            <span>핵심 내용만 먼저 정리된 문서</span>
          </article>
          <article data-status="draft">
            <small>작성 중</small>
            <strong>{contentCounts.draft}</strong>
            <span>Notion 원문 보강을 기다리는 문서</span>
          </article>
        </div>

        <section className="status-content-backlog" aria-labelledby="status-content-backlog-title">
          <div className="status-section-head">
            <div>
              <p>CONTENT BACKLOG</p>
              <h2 id="status-content-backlog-title">콘텐츠 보강 대기열</h2>
              <span>
                원문이 비어 있거나 설명이 짧은 문서를 자동으로 우선순위화합니다.
                확인되지 않은 게임 정보는 자동 게시하지 않습니다.
              </span>
            </div>
            <strong>{contentReadiness.percent}% 준비</strong>
          </div>

          <div className="status-readiness-track" aria-label={`사용 가능한 문서 ${contentReadiness.ready}개, 전체 ${contentReadiness.total}개`}>
            <span>
              <i style={{ width: `${contentReadiness.percent}%` }} />
            </span>
            <small>
              상세 {contentReadiness.detailed} · 간단 {contentReadiness.brief} · 작성 중 {contentReadiness.draft}
            </small>
          </div>

          <div className="status-backlog-list">
            {contentBacklog.map((item, index) => (
              <Link
                key={item.pageId}
                href={withBasePath(`/page/${item.pageId}/`)}
                prefetch={false}
                className="status-backlog-card"
                data-stage={item.stage}
              >
                <span className="status-backlog-rank">{String(index + 1).padStart(2, '0')}</span>
                <span className="status-backlog-copy">
                  <span className="status-backlog-title">
                    <strong>{item.title}</strong>
                    <em>
                      {item.stage === 'source-needed'
                        ? '자료 확인 필요'
                        : '내용 보강'}
                    </em>
                  </span>
                  <small>
                    {item.issues.join(' · ')}
                  </small>
                  <span>{item.nextAction}</span>
                </span>
                <span className="status-backlog-score">
                  <small>우선도</small>
                  <strong>{item.score}</strong>
                </span>
              </Link>
            ))}
          <div className="status-source-review">
            <div>
              <small>자료 검토 큐</small>
              <strong>확인되지 않은 내용은 자동 게시하지 않습니다.</strong>
              <span>
                우선순위가 높은 문서부터 원본 Notion을 확인하고, 추가 자료가 필요하면 문서명이 미리 채워진 제보를 열 수 있습니다.
              </span>
            </div>
            <div className="status-source-review-links">
              {contentBacklog.slice(0, 6).map((item) => (
                <span key={item.pageId}>
                  <strong>{item.title}</strong>
                  <a
                    href={notionPublicUrl(item.pageId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Notion 원문 ↗
                  </a>
                  <a
                    href={buildWikiFeedbackUrl({
                      pageId: item.pageId,
                      title: item.title,
                      kind: 'improve'
                    })}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    자료 후보 제보 ↗
                  </a>
                </span>
              ))}
            </div>
          </div>
          </div>
        </section>

        <section className="status-intelligence" aria-labelledby="status-demand-title">
          <div className="status-section-head">
            <div>
              <p>SEARCH DEMAND SIGNALS</p>
              <h2 id="status-demand-title">검색 수요 대응 우선순위</h2>
              <span>
                검색어 원문은 저장하지 않고 규칙·경제·장비·콘텐츠·API 주제 ID만
                Vercel Analytics에 기록합니다. 아래 점수는 현재 문서 공백과
                운영상 중요도를 결합한 대응 우선도입니다.
              </span>
            </div>
            <strong>{topicCoverage.length}개 주제</strong>
          </div>
          <div className="status-topic-grid">
            {topicCoverage.map((topic, index) => (
              <article key={topic.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{topic.label}</strong>
                  <small>
                    상세 {topic.detailed} · 간단 {topic.brief} · 작성 중 {topic.draft}
                  </small>
                </div>
                <b>{topic.score}</b>
              </article>
            ))}
          </div>
          <p className="status-intelligence-note">
            실제 검색량은 <code>wiki_search_topic</code> 이벤트의 <code>topic</code>
            속성으로 집계되며, 사이트 내부에는 검색어 원문을 저장하지 않습니다.
          </p>
        </section>

        <section className="status-intelligence" aria-labelledby="status-review-automation-title">
          <div className="status-section-head">
            <div>
              <p>AUTOMATED REVIEW</p>
              <h2 id="status-review-automation-title">변경 감지 · FAQ 후보 검토 큐</h2>
              <span>
                Notion 이전 스냅샷과 현재 스냅샷을 비교해 변경 이력을 누적하고,
                검증된 FAQ에 없는 규칙·조건형 소제목만 후보로 올립니다.
                후보는 자동 게시되지 않습니다.
              </span>
            </div>
            <strong>{reviewQueue.length}개 검토</strong>
          </div>

          <div className="status-review-queue">
            {reviewQueue.slice(0, 10).map((item) => (
              <article key={item.id} data-kind={item.kind}>
                <span>{item.kind === 'change' ? '변경' : 'FAQ 후보'}</span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.summary || '검토가 필요한 항목입니다.'}</small>
                </div>
                <a
                  href={notionPublicUrl(item.pageId)}
                  target="_blank"
                  rel="noreferrer"
                >
                  원문 ↗
                </a>
              </article>
            ))}
            {!reviewQueue.length && (
              <p className="status-empty-state">
                새 변경이나 FAQ 후보가 생기면 다음 Notion 동기화에서 자동으로 표시됩니다.
              </p>
            )}
          </div>

          {faqCandidates.length > 0 && (
            <details className="status-faq-candidates">
              <summary>
                <strong>FAQ 후보 전체 보기</strong>
                <span>{faqCandidates.length}개</span>
              </summary>
              <div>
                {faqCandidates.slice(0, 16).map((candidate) => (
                  <a
                    key={candidate.id}
                    href={notionPublicUrl(candidate.sourcePageId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>
                      <strong>{candidate.sourceTitle}</strong>
                      <small>{candidate.reason}</small>
                    </span>
                    <b>{candidate.sourceHeading}</b>
                  </a>
                ))}
              </div>
            </details>
          )}
        </section>

        <div className="status-services">
          <article data-tone={statusTone(syncWorkflow)}>
            <span className="status-service-icon">↻</span>
            <div>
              <small>Notion 수집 + 이미지 최적화</small>
              <strong>{statusLabel(syncWorkflow)}</strong>
              <span>
                최근 실행 {formatDate(syncWorkflow?.updatedAt ?? index.generatedAt)}
              </span>
            </div>
            {syncWorkflow?.url && (
              <a href={syncWorkflow.url} target="_blank" rel="noreferrer">
                실행 기록 ↗
              </a>
            )}
          </article>

          <article data-tone={statusTone(buildWorkflow)}>
            <span className="status-service-icon">✓</span>
            <div>
              <small>GitHub Build</small>
              <strong>{statusLabel(buildWorkflow)}</strong>
              <span>{buildWorkflow?.title || '최신 main 검증'}</span>
            </div>
            {buildWorkflow?.url && (
              <a href={buildWorkflow.url} target="_blank" rel="noreferrer">
                빌드 기록 ↗
              </a>
            )}
          </article>

          <article
            data-tone={
              productionHealth.ok && deploymentCurrent
                ? 'success'
                : production
                  ? 'warning'
                  : 'working'
            }
          >
            <span className="status-service-icon">▲</span>
            <div>
              <small>Vercel Production</small>
              <strong>
                {!productionHealth.ok
                  ? production
                    ? '응답 확인 필요'
                    : 'Preview / Local'
                  : deploymentCurrent
                    ? '최신 main 반영됨'
                    : '배포 대기 중'}
              </strong>
              <span>
                {productionHealth.status
                  ? `HTTP ${productionHealth.status} · main ${shortSha(productionHealth.mainSha)} · prod ${shortSha(productionHealth.deployedSha)}`
                  : '운영 URL 응답을 확인하지 못했습니다.'}
              </span>
            </div>
            <a
              href="https://justserver3.vercel.app/"
              target="_blank"
              rel="noreferrer"
            >
              운영 사이트 ↗
            </a>
          </article>

          <article data-tone={statusTone(productionVerifyWorkflow)}>
            <span className="status-service-icon">↗</span>
            <div>
              <small>Production 검증</small>
              <strong>{statusLabel(productionVerifyWorkflow)}</strong>
              <span>
                {productionVerifyWorkflow?.title || 'Build 이후 실제 운영 반영 확인'}
              </span>
            </div>
            {productionVerifyWorkflow?.url && (
              <a
                href={productionVerifyWorkflow.url}
                target="_blank"
                rel="noreferrer"
              >
                검증 기록 ↗
              </a>
            )}
          </article>

          <article data-tone={webhookSignatureReady ? 'success' : 'working'}>
            <span className="status-service-icon">⚡</span>
            <div>
              <small>Notion Webhook</small>
              <strong>
                {webhookSignatureReady
                  ? instantAssetSyncReady
                    ? '즉시 동기화 연결됨'
                    : '본문 실시간 연결됨'
                  : '5분 동기화 사용 중'}
              </strong>
              <span>
                {webhookSignatureReady
                  ? instantAssetSyncReady
                    ? 'Notion 이벤트 수신 후 캐시 무효화와 자산 동기화를 즉시 실행'
                    : 'Notion 이벤트 수신 후 본문 갱신 · 이미지는 5분 안전망 사용'
                  : 'Webhook 인증 전에는 GitHub Actions 5분 안전망으로 최신 내용을 확인'}
              </span>
            </div>
            <a href="/api/notion-webhook" target="_blank" rel="noreferrer">
              수신기 상태 ↗
            </a>
          </article>

          <article data-tone="success">
            <span className="status-service-icon">⌕</span>
            <div>
              <small>검색 UX 분석</small>
              <strong>계측 활성</strong>
              <span>
                검색 열기 · 결과 이동 · 빠른 답변 · 0건 검색을 구분해 집계합니다.
                검색어 원문은 분석 이벤트에 저장하지 않습니다.
              </span>
            </div>
          </article>

          <article data-tone="success">
            <span className="status-service-icon">FAQ</span>
            <div>
              <small>검증형 FAQ</small>
              <strong>{verifiedFaqEntries.length}개 확인됨</strong>
              <span>
                서버규칙에서 직접 확인되는 답변만 검색과 FAQ 페이지에 노출합니다.
              </span>
            </div>
            <Link href={withBasePath('/guide/faq/')} prefetch={false}>
              FAQ 확인 →
            </Link>
          </article>

          <article data-tone="success">
            <span className="status-service-icon">Aa</span>
            <div>
              <small>검색 인덱스 정제</small>
              <strong>파일명 제거 활성</strong>
              <span>
                이미지 파일명 · 첨부 식별자 · UUID가 검색 문맥에 섞이지 않도록 생성 단계에서 정리합니다.
              </span>
            </div>
          </article>

          <article data-tone="working">
            <span className="status-service-icon">◷</span>
            <div>
              <small>자동 동기화 안전망</small>
              <strong>약 5분 주기</strong>
              <span>
                {syncWorkflow?.updatedAt
                  ? `최근 확인 ${formatDate(syncWorkflow.updatedAt)}`
                  : 'GitHub Actions에서 주기적으로 최신 상태를 확인'}
              </span>
            </div>
          </article>
        </div>

        <div className="status-asset-metrics">
          <div>
            <small>원본 이미지 보존량</small>
            <strong>{formatBytes(index.assetStats?.originalBytes)}</strong>
          </div>
          <div>
            <small>본문 표시용 WebP</small>
            <strong>{formatBytes(index.assetStats?.displayBytes)}</strong>
          </div>
          <div>
            <small>카드 전용 WebP</small>
            <strong>{formatBytes(index.assetStats?.thumbnailBytes)}</strong>
          </div>
        </div>

        <div className="status-recent">
          <div className="status-section-head">
            <div>
              <p>RECENT CHANGES</p>
              <h2>최근 수정 문서</h2>
            </div>
            <Link href={withBasePath('/')} prefetch={false}>위키 홈 →</Link>
          </div>
          <div className="status-recent-list">
            {recentPages.map((page) => (
              <Link
                key={page.pageId}
                href={withBasePath(`/page/${page.pageId}/`)}
                prefetch={false}
              >
                <span>
                  <strong>{page.title}</strong>
                  {page.changeSummary && <small>{page.changeSummary}</small>}
                </span>
                <span>{formatDate(page.lastEdited)}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </WikiShell>
  )
}
