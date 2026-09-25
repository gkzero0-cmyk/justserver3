'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

import { iconForTitle } from '@/lib/wiki-taxonomy'
import type { WikiContentStatus } from '@/lib/wiki-ux'
import { withBasePath } from '@/lib/url-utils'
import faqEntries from '@/data/wiki-verified-faq.json'

type QuickPage = {
  pageId: string
  title: string
  status?: WikiContentStatus
}

const QUICK_RULE_QUESTIONS = [
  '재입주할 수 있나요?',
  '강화된 아이템을 다른 사람과 주고받아도 되나요?',
  '무한용암은 몇 개까지 만들 수 있나요?',
  '호퍼·팜·주민거래 같은 자동화가 가능한가요?'
]

const QUICK_RULES = QUICK_RULE_QUESTIONS
  .map((question) =>
    faqEntries.find((entry) => entry.question === question)
  )
  .filter(Boolean)

const QUICK_TITLES = [
  '서버규칙',
  '기초설정(뉴비필독)',
  '채광',
  '땅 구매',
  '장비수리',
  '장비강화',
  '빚 갚기',
  '신용등급'
]

export function WikiMobileQuickView({
  pages,
  onClose,
  onOpenSearch
}: {
  pages: QuickPage[]
  onClose: () => void
  onOpenSearch: () => void
}) {
  const sheetRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const readyPages = QUICK_TITLES
    .map((title) => pages.find((page) => page.title === title))
    .filter(
      (page): page is QuickPage =>
        Boolean(page && page.status !== 'draft')
    )

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => closeRef.current?.focus())

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !sheetRef.current) return
      const focusable = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          'button, a[href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('disabled'))

      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div
      className="mobile-quick-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <section
        ref={sheetRef}
        className="mobile-quick-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-quick-title"
      >
        <div className="mobile-quick-handle" aria-hidden="true" />
        <header>
          <div>
            <small>QUICK INFO</small>
            <strong id="mobile-quick-title">게임 중 빠른보기</strong>
            <span>자주 찾는 핵심 가이드를 1번에 열어보세요.</span>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="빠른보기 닫기"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <section className="mobile-quick-rules" aria-labelledby="mobile-quick-rules-title">
          <div className="mobile-quick-rules-head">
            <strong id="mobile-quick-rules-title">지금 바로 보는 핵심 규칙</strong>
            <Link
              href={withBasePath('/guide/faq/')}
              onClick={onClose}
              data-wiki-event="wiki_mobile_quick_faq"
              data-wiki-section="mobile-quick-view"
              data-wiki-target="faq"
              data-wiki-status="verified"
            >
              전체 FAQ →
            </Link>
          </div>
          <div className="mobile-quick-rule-grid">
            {QUICK_RULES.map((entry) => (
              <article key={entry!.question}>
                <small>{entry!.question}</small>
                <strong>{entry!.answer}</strong>
              </article>
            ))}
          </div>
        </section>

        <button
          type="button"
          className="mobile-quick-search"
          onClick={() => {
            onClose()
            requestAnimationFrame(onOpenSearch)
          }}
        >
          <span aria-hidden="true">⌕</span>
          <strong>질문이나 키워드 바로 검색</strong>
          <b aria-hidden="true">→</b>
        </button>

        <nav className="mobile-quick-grid" aria-label="빠른 가이드">
          {readyPages.map((page) => (
            <Link
              key={page.pageId}
              href={withBasePath(`/page/${page.pageId}/`)}
              onClick={onClose}
              data-wiki-event="wiki_mobile_quick_navigate"
              data-wiki-section="mobile-quick-view"
              data-wiki-target={page.title}
              data-wiki-status={page.status || 'ready'}
            >
              <span aria-hidden="true">{iconForTitle(page.title)}</span>
              <strong>{page.title}</strong>
              <b aria-hidden="true">→</b>
            </Link>
          ))}
        </nav>

        {readyPages.length < 5 && (
          <p className="mobile-quick-note">
            아직 준비 중인 핵심 가이드는 내용이 보강되는 즉시 이 목록에 자동으로 추가됩니다.
          </p>
        )}
      </section>
    </div>
  )
}
