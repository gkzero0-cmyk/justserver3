'use client'

import { useEffect, useMemo, useState } from 'react'

type TocItem = {
  id: string
  text: string
  level: number
}

export function WikiShell({
  children,
  sourceUrl
}: {
  children: React.ReactNode
  sourceUrl: string
}) {
  const [toc, setToc] = useState<TocItem[]>([])
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>(
          '.notion-page-content h1, .notion-page-content h2, .notion-page-content h3'
        )
      )

      const next = nodes
        .map((node, index) => {
          const text = node.textContent?.trim() ?? ''
          if (!text) return null
          if (!node.id) node.id = `section-${index + 1}`
          const level = Number(node.tagName.slice(1))
          return { id: node.id, text, level }
        })
        .filter((item): item is TocItem => Boolean(item))

      setToc(next)
    }, 350)

    return () => window.clearTimeout(timer)
  }, [children])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return toc
    return toc.filter((item) => item.text.toLowerCase().includes(keyword))
  }, [query, toc])

  const goTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
    setMenuOpen(false)
  }

  return (
    <div className="wiki-shell">
      <header className="wiki-topbar">
        <button
          className="menu-button"
          type="button"
          aria-label="메뉴 열기"
          onClick={() => setMenuOpen((value) => !value)}
        >
          ☰
        </button>
        <a className="brand" href="/">
          <span className="brand-mark">W</span>
          <span>
            <strong>서버 위키</strong>
            <small>Notion Sync</small>
          </span>
        </a>
        <div className="top-actions">
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            원본 Notion ↗
          </a>
        </div>
      </header>

      <aside className={`wiki-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="sidebar-head">
          <strong>문서 탐색</strong>
          <span>{toc.length}개 항목</span>
        </div>
        <label className="wiki-search">
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="목차 검색"
            aria-label="목차 검색"
          />
        </label>
        <nav className="toc-list">
          {filtered.length ? (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`toc-item level-${item.level}`}
                onClick={() => goTo(item.id)}
              >
                {item.text}
              </button>
            ))
          ) : (
            <p className="toc-empty">일치하는 항목이 없습니다.</p>
          )}
        </nav>
        <div className="sidebar-foot">
          <span className="live-dot" />
          Notion 내용을 약 5분 주기로 갱신
        </div>
      </aside>

      {menuOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="메뉴 닫기"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <main className="wiki-main">{children}</main>
    </div>
  )
}
