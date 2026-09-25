'use client'

import Link from 'next/link'

import type { WikiContentStatus } from '@/lib/wiki-content-status'
import { iconForTitle } from '@/lib/wiki-taxonomy'
import { withBasePath } from '@/lib/url-utils'

const PREFETCH_TITLES = new Set(['서버규칙', '기초설정(뉴비필독)', '채광'])

export type WikiNavigationPage = {
  pageId: string
  title: string
  category?: string
  status?: WikiContentStatus
}

export type WikiNavigationTocItem = {
  id: string
  text: string
  level: number
}

export function WikiNavigation({
  pages,
  currentPageId,
  currentCategory,
  openMobileCategories,
  onToggleMobileCategory,
  menuOpen,
  onCloseMenu,
  home,
  toc,
  activeTocId,
  onNavigateToc,
  readingProgress,
  sidebarCollapsed,
  onToggleSidebar,
  onOpenSearch,
  categoryForPage
}: {
  pages: WikiNavigationPage[]
  currentPageId?: string | null
  currentCategory: string
  openMobileCategories: string[]
  onToggleMobileCategory: (category: string) => void
  menuOpen: boolean
  onCloseMenu: () => void
  home: boolean
  toc: WikiNavigationTocItem[]
  activeTocId: string
  onNavigateToc: (id: string) => void
  readingProgress: number
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  onOpenSearch: () => void
  categoryForPage: (page: WikiNavigationPage) => string
}) {
  return (
    <>
      <aside className={`wiki-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="sidebar-head">
          <strong>문서 탐색</strong>
          <span>{pages.length}개</span>
        </div>

        {!home && (
          <button
            className="wiki-search wiki-search-trigger"
            type="button"
            aria-keyshortcuts="Control+K Meta+K /"
            onClick={onOpenSearch}
          >
            <span>⌕</span>
            <span>전체 문서 검색</span>
            <kbd>⌘K</kbd>
          </button>
        )}

        <div className="sidebar-primary-links">
          <Link
            className="sidebar-home"
            href={withBasePath('/')}
            prefetch={false}
            onClick={onCloseMenu}
            data-wiki-event="wiki_sidebar_navigate"
            data-wiki-section="primary"
            data-wiki-target="home"
            data-wiki-status="ready"
          >
            <span>🏠</span>
            위키 홈
          </Link>
        </div>

        <nav className="toc-list">
          <div className="global-page-list">
            <span className="nav-section-label">전체 문서</span>
            {['시작하기', '주요 콘텐츠', '성장 · 경제'].map((group) => {
              const groupPages = pages.filter(
                (page) => categoryForPage(page) === group
              )
              const readyPages = groupPages.filter(
                (page) => page.status !== 'draft'
              )
              const draftPages = groupPages.filter(
                (page) => page.status === 'draft'
              )

              if (!groupPages.length) return null

              const pageLink = (page: WikiNavigationPage, draft = false) => {
                const current =
                  Boolean(currentPageId) &&
                  page.pageId.replaceAll('-', '') ===
                    currentPageId!.replaceAll('-', '')

                return (
                  <Link
                    key={page.pageId}
                    href={withBasePath(`/page/${page.pageId}/`)}
                    prefetch={!draft && PREFETCH_TITLES.has(page.title)}
                    onClick={onCloseMenu}
                    className={`global-page-link ${current ? 'is-current' : ''} ${draft ? 'is-draft' : ''}`}
                    aria-current={current ? 'page' : undefined}
                    aria-label={draft ? `${page.title} — 준비 중인 문서` : undefined}
                    data-wiki-event="wiki_sidebar_navigate"
                    data-wiki-section={group}
                    data-wiki-target={page.title}
                    data-wiki-status={page.status || 'unknown'}
                  >
                    <span className="sidebar-page-icon" aria-hidden="true">
                      {iconForTitle(page.title)}
                    </span>
                    <span className="global-page-copy">
                      <strong>{page.title}</strong>
                      {draft && (
                        <em className="sidebar-draft-badge">준비 중</em>
                      )}
                    </span>
                  </Link>
                )
              }

              return (
                <section
                  className={`sidebar-category ${openMobileCategories.includes(group) ? 'is-mobile-open' : ''}`}
                  key={group}
                >
                  <div className="sidebar-category-head sidebar-category-head-static">
                    <strong>{group}</strong>
                    <span className="sidebar-category-meta">
                      <span>{readyPages.length}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="sidebar-category-head sidebar-category-head-toggle"
                    aria-expanded={openMobileCategories.includes(group)}
                    onClick={() => onToggleMobileCategory(group)}
                  >
                    <strong>{group}</strong>
                    <span className="sidebar-category-meta">
                      <span>{readyPages.length}</span>
                      <b aria-hidden="true">⌄</b>
                    </span>
                  </button>
                  <div className="sidebar-category-links">
                    {readyPages.map((page) => pageLink(page))}
                  </div>
                  {draftPages.length > 0 && (
                    <details className="sidebar-draft-group">
                      <summary>
                        <span>준비 중</span>
                        <b>{draftPages.length}</b>
                      </summary>
                      <div className="sidebar-category-links is-draft-list">
                        {draftPages.map((page) => pageLink(page, true))}
                      </div>
                    </details>
                  )}
                </section>
              )
            })}
          </div>

          <div className="current-toc mobile-current-toc">
            <span className="nav-section-label">
              현재 페이지{currentCategory ? ` · ${currentCategory}` : ''}
            </span>
            {toc.length ? (
              toc.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`toc-item level-${item.level} ${activeTocId === item.id ? 'is-active' : ''}`}
                  aria-current={activeTocId === item.id ? 'location' : undefined}
                  onClick={() => onNavigateToc(item.id)}
                >
                  <span>{iconForTitle(item.text)}</span>
                  <span>{item.text}</span>
                </button>
              ))
            ) : (
              <p className="toc-empty">현재 페이지 목차가 없습니다.</p>
            )}
          </div>
        </nav>

        <div className="sidebar-foot">
          <span className="live-dot" />
          공식 가이드 문서
        </div>
      </aside>

      <button
        className="sidebar-edge-toggle"
        type="button"
        aria-label={sidebarCollapsed ? '문서 목록 펼치기' : '문서 목록 접기'}
        aria-pressed={sidebarCollapsed}
        title={sidebarCollapsed ? '문서 목록 펼치기' : '문서 목록 접기'}
        onClick={onToggleSidebar}
      >
        <span className="sidebar-toggle-expanded" aria-hidden="true">‹</span>
        <span className="sidebar-toggle-collapsed" aria-hidden="true">
          <b>☰</b><em>문서</em>
        </span>
      </button>

      {menuOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="메뉴 닫기"
          onClick={onCloseMenu}
        />
      )}

      {!home && toc.length > 0 && (
        <aside className="article-toc" aria-label="현재 문서 목차">
          <div className="article-progress">
            <span>읽는 중</span>
            <strong>{readingProgress}%</strong>
          </div>
          <div className="article-progress-track" aria-hidden="true">
            <span style={{ height: `${readingProgress}%` }} />
          </div>
          <span className="article-toc-label">이 페이지에서</span>
          <nav>
            {toc.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`article-toc-item level-${item.level} ${activeTocId === item.id ? 'is-active' : ''}`}
                aria-current={activeTocId === item.id ? 'location' : undefined}
                onClick={() => onNavigateToc(item.id)}
              >
                {item.text}
              </button>
            ))}
          </nav>
        </aside>
      )}
    </>
  )
}
