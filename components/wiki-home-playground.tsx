'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'

import type { WikiContentStatus } from '@/lib/wiki-content-status'

type PlaygroundPage = {
  pageId: string
  title: string
  category?: string
  status?: WikiContentStatus
}

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
  const readyCount = pages.filter((page) => page.status !== 'draft').length

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
            운세·성향 테스트·미션·완독 기록·보물찾기·주간 보스를 하나의 탐험 기록으로 연결했습니다.
          </span>
          <div className="home-playground-chips" aria-label="위키 탐험 기능">
            <b>📚 {readyCount}개 공개 가이드</b>
            <b>🏆 완독·업적</b>
            <b>🎲 PLAY ZONE</b>
            <b>⚔️ 주간 보스</b>
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
          <WikiFunZone pages={pages} />
          <WikiSurvivalLog pages={pages} />
          <WikiReadingExplorer pages={pages} />
          <WikiAdventureHub pages={pages} />
        </div>
      )}
    </section>
  )
}
