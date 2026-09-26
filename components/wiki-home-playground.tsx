'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

import type { WikiContentStatus } from '@/lib/wiki-content-status'

type PlaygroundPage = {
  pageId: string
  title: string
  category?: string
  status?: WikiContentStatus
}

type PlaygroundTab = 'enhancement' | 'play' | 'records'

const WikiEnhancementLab = dynamic(
  () =>
    import('@/components/wiki-enhancement-lab').then(
      (mod) => mod.WikiEnhancementLab
    ),
  {
    ssr: false,
    loading: () => <PlaygroundLoading label="강화 체험소를 준비하는 중" />
  }
)

const WikiFunZone = dynamic(
  () => import('@/components/wiki-fun-zone').then((mod) => mod.WikiFunZone),
  { ssr: false, loading: () => <PlaygroundLoading label="PLAY ZONE을 여는 중" /> }
)

const WikiSurvivalLog = dynamic(
  () => import('@/components/wiki-survival-log').then((mod) => mod.WikiSurvivalLog),
  { ssr: false, loading: () => <PlaygroundLoading label="생존 기록을 불러오는 중" /> }
)

const WikiReadingExplorer = dynamic(
  () => import('@/components/wiki-reading-explorer').then((mod) => mod.WikiReadingExplorer),
  { ssr: false, loading: () => <PlaygroundLoading label="위키 탐험을 준비하는 중" /> }
)

const WikiAdventureHub = dynamic(
  () => import('@/components/wiki-adventure-hub').then((mod) => mod.WikiAdventureHub),
  { ssr: false, loading: () => <PlaygroundLoading label="생존 어드벤처를 불러오는 중" /> }
)

function PlaygroundLoading({ label }: { label: string }) {
  return (
    <div className="home-playground-loading" role="status">
      <span aria-hidden="true">✦</span>
      <strong>{label}</strong>
    </div>
  )
}

export function WikiHomePlayground({ pages }: { pages: PlaygroundPage[] }) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<PlaygroundTab>('enhancement')
  const readyCount = pages.filter((page) => page.status !== 'draft').length

  useEffect(() => {
    const openFromHash = () => {
      const hash = window.location.hash

      if (
        hash === '#wiki-explore' ||
        hash === '#enhancement-lab' ||
        hash === '#wiki-survival-log-title' ||
        hash === '#reading-explorer-title' ||
        hash === '#wiki-adventure-title'
      ) {
        setOpen(true)

        if (hash === '#enhancement-lab') setActiveTab('enhancement')
        if (
          hash === '#wiki-survival-log-title' ||
          hash === '#reading-explorer-title' ||
          hash === '#wiki-adventure-title'
        ) {
          setActiveTab('records')
        }

        if (hash !== '#wiki-explore') {
          window.setTimeout(() => {
            document.querySelector(hash)?.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            })
          }, 180)
        }
      }
    }

    openFromHash()
    window.addEventListener('hashchange', openFromHash)
    return () => window.removeEventListener('hashchange', openFromHash)
  }, [])

  return (
    <section
      className={`home-playground ${open ? 'is-open' : ''}`}
      id="wiki-explore"
      aria-labelledby="home-playground-title"
    >
      <div className="home-playground-intro">
        <div className="home-playground-icon" aria-hidden="true">🎮</div>
        <div className="home-playground-copy">
          <p>WIKI ADVENTURE</p>
          <h2 id="home-playground-title">가이드를 읽으면서 같이 놀아보세요</h2>
          <span>
            강화 체험·미니게임·완독 기록을 탭으로 나눠 필요한 기능만 빠르게 불러옵니다.
          </span>
          <div className="home-playground-chips" aria-label="위키 탐험 기능">
            <b>📚 {readyCount}개 공개 가이드</b>
            <b>⚒️ 강화 체험소</b>
            <b>🎲 PLAY ZONE</b>
            <b>🏆 기록·업적</b>
          </div>
        </div>
        <button
          type="button"
          className="home-playground-toggle"
          aria-expanded={open}
          aria-controls="home-playground-content"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? '탐험 접기' : '위키 탐험 시작'}
          <span aria-hidden="true">{open ? '↑' : '→'}</span>
        </button>
      </div>

      {open && (
        <div className="home-playground-content" id="home-playground-content">
          <div className="home-playground-tabs" role="tablist" aria-label="위키 탐험">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'enhancement'}
              className={activeTab === 'enhancement' ? 'is-active' : ''}
              onClick={() => setActiveTab('enhancement')}
            >
              <span aria-hidden="true">⚒️</span>
              강화
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'play'}
              className={activeTab === 'play' ? 'is-active' : ''}
              onClick={() => setActiveTab('play')}
            >
              <span aria-hidden="true">🎲</span>
              미니게임
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'records'}
              className={activeTab === 'records' ? 'is-active' : ''}
              onClick={() => setActiveTab('records')}
            >
              <span aria-hidden="true">🏆</span>
              탐험 기록
            </button>
          </div>

          <div className="home-playground-panel" role="tabpanel">
            {activeTab === 'enhancement' && <WikiEnhancementLab pages={pages} />}
            {activeTab === 'play' && <WikiFunZone pages={pages} />}
            {activeTab === 'records' && (
              <>
                <WikiSurvivalLog pages={pages} />
                <WikiReadingExplorer pages={pages} />
                <WikiAdventureHub pages={pages} />
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
