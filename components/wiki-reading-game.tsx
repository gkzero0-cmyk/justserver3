'use client'

import Link from 'next/link'
import { track } from '@vercel/analytics'
import { useEffect, useMemo, useState } from 'react'

import type { ReadingQuiz } from '@/lib/wiki-reading-game'
import {
  normalizeSurvivalRecord,
  recordSurvivalActivity,
  seoulDateKey
} from '@/lib/wiki-survival'
import { withBasePath } from '@/lib/url-utils'
import {
  readWikiStateValue,
  readWikiStringArray,
  writeWikiStateValue
} from '@/lib/wiki-client-state'

function normalized(value: string) {
  return value.replaceAll('-', '')
}

export function WikiReadingQuiz({
  pageId,
  title,
  quiz
}: {
  pageId: string
  title: string
  quiz: ReadingQuiz | null
}) {
  const normalizedPageId = normalized(pageId)
  const [readComplete, setReadComplete] = useState(false)
  const [quizComplete, setQuizComplete] = useState(false)
  const [answer, setAnswer] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const refresh = () => {
      setReadComplete(
        readWikiStringArray('readPages').some(
          (value) => normalized(value) === normalizedPageId
        )
      )
      setQuizComplete(
        readWikiStringArray('readingQuizzes').some(
          (value) => normalized(value) === normalizedPageId
        )
      )
    }

    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('justserver3:read-pages', refresh)
    window.addEventListener('justserver3:reading-quiz', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('justserver3:read-pages', refresh)
      window.removeEventListener('justserver3:reading-quiz', refresh)
    }
  }, [normalizedPageId])

  if (!quiz) return null

  const submit = (option: string) => {
    setAnswer(option)

    if (option !== quiz.answer) {
      setMessage('본문에서 다시 찾아보세요. 정답은 문서 안에 있습니다.')
      track('wiki_reading_quiz_answer', {
        result: 'wrong',
        page: title
      })
      return
    }

    const completed = readWikiStringArray('readingQuizzes')
    if (!completed.some((value) => normalized(value) === normalizedPageId)) {
      writeWikiStateValue(
        'readingQuizzes',
        [...completed, normalizedPageId],
        'justserver3:reading-quiz'
      )

      let record
      try {
        record = normalizeSurvivalRecord(
          readWikiStateValue('survivalRecord', null)
        )
      } catch {
        record = normalizeSurvivalRecord(null)
      }

      const next = recordSurvivalActivity(
        record,
        seoulDateKey(),
        'reading-quiz',
        normalizedPageId
      )
      writeWikiStateValue(
        'survivalRecord',
        next,
        'justserver3:survival-record'
      )
    }

    setQuizComplete(true)
    setMessage('정답! 이 문서의 완독 배지를 획득했습니다. ✓')
    track('wiki_reading_quiz_answer', {
      result: 'correct',
      page: title
    })
  }

  return (
    <section
      className={`reading-quiz-card ${quizComplete ? 'is-complete' : ''}`}
      aria-labelledby="reading-quiz-title"
    >
      <div className="reading-quiz-head">
        <div>
          <p>ONE QUESTION</p>
          <h2 id="reading-quiz-title">📚 {title} 완독 퀴즈</h2>
          <span>
            시험이 아니라 문서를 한 번 더 훑어보는 작은 확인 문제입니다.
          </span>
        </div>
        <b>{quizComplete ? '완독 인증 ✓' : readComplete ? '퀴즈 열림' : '읽는 중'}</b>
      </div>

      {!readComplete ? (
        <div className="reading-quiz-locked">
          <span aria-hidden="true">🔒</span>
          <div>
            <strong>문서를 조금 더 읽으면 퀴즈가 열립니다.</strong>
            <small>
              본문의 절반 정도를 읽거나 일정 시간 내용을 확인하면 자동으로 완독 처리됩니다.
            </small>
          </div>
        </div>
      ) : (
        <>
          <strong className="reading-quiz-question">{quiz.prompt}</strong>
          <div className="reading-quiz-options">
            {quiz.options.map((option) => {
              const selected = answer === option
              const correct = quizComplete && option === quiz.answer
              return (
                <button
                  key={option}
                  type="button"
                  className={correct ? 'is-correct' : selected ? 'is-selected' : ''}
                  disabled={quizComplete}
                  onClick={() => submit(option)}
                >
                  <span>{option}</span>
                  <b>{correct ? '✓' : '→'}</b>
                </button>
              )
            })}
          </div>
          {message && (
            <p
              className={`reading-quiz-message ${quizComplete ? 'is-success' : ''}`}
              role="status"
            >
              {message}
            </p>
          )}
        </>
      )}
    </section>
  )
}

type NextPage = {
  pageId: string
  title: string
  category?: string | null
  image?: string | null
}

export function WikiNextExploration({
  currentTitle,
  pages
}: {
  currentTitle: string
  pages: NextPage[]
}) {
  const [readIds, setReadIds] = useState<string[]>([])

  useEffect(() => {
    const refresh = () => setReadIds(readWikiStringArray('readPages'))
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('justserver3:read-pages', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('justserver3:read-pages', refresh)
    }
  }, [])

  const readSet = useMemo(
    () => new Set(readIds.map(normalized)),
    [readIds]
  )
  const ordered = useMemo(
    () =>
      [...pages].sort((left, right) => {
        const leftRead = readSet.has(normalized(left.pageId))
        const rightRead = readSet.has(normalized(right.pageId))
        if (leftRead !== rightRead) return leftRead ? 1 : -1
        return 0
      }),
    [pages, readSet]
  )

  if (!ordered.length) return null

  return (
    <section
      className="next-exploration"
      aria-labelledby="next-exploration-title"
    >
      <div className="next-exploration-head">
        <div>
          <p>NEXT EXPLORATION</p>
          <h2 id="next-exploration-title">이 문서를 읽었다면 다음은 여기</h2>
          <span>
            {currentTitle}과 연결되는 가이드 중 아직 완독하지 않은 문서를 먼저 추천합니다.
          </span>
        </div>
      </div>

      <div className="next-exploration-grid">
        {ordered.map((page, index) => {
          const completed = readSet.has(normalized(page.pageId))
          return (
            <Link
              key={page.pageId}
              href={withBasePath(`/page/${page.pageId}/`)}
              className={completed ? 'is-complete' : ''}
              data-wiki-event="wiki_next_exploration_navigate"
              data-wiki-section="next-exploration"
              data-wiki-target={page.title}
            >
              <span className="next-exploration-index">
                {completed ? '✓' : index + 1}
              </span>
              {page.image && (
                <span className="next-exploration-image" aria-hidden="true">
                  <img
                    src={page.image}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width="320"
                    height="180"
                  />
                </span>
              )}
              <span className="next-exploration-copy">
                <small>
                  {completed
                    ? '완독한 가이드'
                    : page.category || '추천 가이드'}
                </small>
                <strong>{page.title}</strong>
                <em>{completed ? '다시 보기' : '다음 탐험 시작'} →</em>
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
