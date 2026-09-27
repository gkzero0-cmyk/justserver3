'use client'

import { track } from '@vercel/analytics'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import type { WikiFeedbackKind } from '@/lib/wiki-feedback'

const FEEDBACK_TYPES: Array<{
  value: WikiFeedbackKind
  label: string
}> = [
  { value: 'incorrect', label: '잘못된 정보' },
  { value: 'add', label: '내용 추가' },
  { value: 'typo', label: '오타·표현' },
  { value: 'bug', label: '기능 오류' },
  { value: 'other', label: '기타' }
]

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.append(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    return copied
  }
}

export function WikiDocumentFeedback({
  pageId,
  title,
  canonicalUrl,
  siteSubmissionEnabled,
  discordUrl
}: {
  pageId: string
  title: string
  canonicalUrl: string
  siteSubmissionEnabled: boolean
  discordUrl?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<WikiFeedbackKind>('incorrect')
  const [message, setMessage] = useState('')
  const [nickname, setNickname] = useState('')
  const [website, setWebsite] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState('')
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => closeRef.current?.focus())

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  async function shareDocument() {
    const data = {
      title: `${title} | 그냥서버 : 적자생존 공식 위키`,
      text: `${title} 가이드를 확인해보세요.`,
      url: canonicalUrl
    }

    try {
      if (navigator.share) {
        await navigator.share(data)
        track('wiki_document_share', {
          method: 'native',
          page_id: pageId.replaceAll('-', '')
        })
        setStatus('공유창을 열었습니다.')
        return
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }

    const copied = await copyText(canonicalUrl)
    setStatus(copied ? '문서 링크를 복사했습니다.' : '링크 복사에 실패했습니다.')
    track('wiki_document_share', {
      method: copied ? 'clipboard' : 'failed',
      page_id: pageId.replaceAll('-', '')
    })
  }

  function feedbackCopyText() {
    const typeLabel =
      FEEDBACK_TYPES.find((item) => item.value === kind)?.label || '기타'

    return [
      `[위키 제보] ${title}`,
      `유형: ${typeLabel}`,
      `문서: ${canonicalUrl}`,
      nickname.trim() ? `닉네임: ${nickname.trim()}` : '',
      '',
      message.trim()
    ]
      .filter(Boolean)
      .join('\n')
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || message.trim().length < 5) return

    setSubmitting(true)
    setStatus('')

    if (!siteSubmissionEnabled) {
      const copied = await copyText(feedbackCopyText())
      setStatus(
        copied
          ? '제보 내용을 복사했습니다. 사이트 접수 저장소가 연결되면 이 화면에서 바로 제출할 수 있습니다.'
          : '제보 내용을 복사하지 못했습니다.'
      )
      setSubmitting(false)
      return
    }

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId,
          title,
          url: canonicalUrl,
          kind,
          message,
          nickname,
          website
        })
      })

      if (response.ok) {
        setMessage('')
        setNickname('')
        setStatus('제보가 접수되었습니다. 확인 후 필요한 내용을 반영하겠습니다.')
        track('wiki_feedback_submit', {
          kind,
          page_id: pageId.replaceAll('-', '')
        })
        return
      }

      if (response.status === 429) {
        setStatus('제보가 너무 빠르게 반복되었습니다. 잠시 뒤 다시 시도해주세요.')
      } else {
        setStatus('현재 사이트 제보 접수가 원활하지 않습니다. 잠시 뒤 다시 시도해주세요.')
      }
    } catch {
      setStatus('네트워크 연결을 확인한 뒤 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <aside
        className="document-feedback"
        id="document-feedback"
        aria-labelledby="document-feedback-title"
      >
        <div>
          <p>DOCUMENT ACTIONS</p>
          <h2 id="document-feedback-title">공유 · 제보</h2>
          <span>
            이 문서를 공유하거나 잘못된 정보와 추가할 내용을 사이트에서 알려주세요.
          </span>
        </div>

        <div className="document-feedback-actions">
          <button type="button" onClick={shareDocument}>
            <strong>공유하기</strong>
            <small>휴대폰 공유창 또는 링크 복사</small>
            <b aria-hidden="true">↗</b>
          </button>
          <button
            type="button"
            onClick={() => {
              setStatus('')
              setOpen(true)
              track('wiki_feedback_open', {
                page_id: pageId.replaceAll('-', '')
              })
            }}
          >
            <strong>제보하기</strong>
            <small>로그인 없이 내용을 작성할 수 있어요.</small>
            <b aria-hidden="true">＋</b>
          </button>
        </div>

        {status && !open && (
          <p className="document-action-status" role="status">
            {status}
          </p>
        )}
      </aside>

      {open && (
        <div
          className="feedback-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false)
          }}
        >
          <section
            className="feedback-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-modal-title"
          >
            <header>
              <div>
                <small>WIKI FEEDBACK</small>
                <h2 id="feedback-modal-title">제보하기</h2>
                <span>{title}</span>
              </div>
              <button
                ref={closeRef}
                type="button"
                aria-label="제보 창 닫기"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>

            <form onSubmit={submitFeedback}>
              <label>
                <span>제보 유형</span>
                <select
                  value={kind}
                  onChange={(event) =>
                    setKind(event.target.value as WikiFeedbackKind)
                  }
                >
                  {FEEDBACK_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>어떤 부분을 확인하면 좋을까요?</span>
                <textarea
                  value={message}
                  minLength={5}
                  maxLength={1500}
                  required
                  placeholder="잘못된 내용, 추가되면 좋은 정보, 기능 문제 등을 적어주세요."
                  onChange={(event) => setMessage(event.target.value)}
                />
                <small>{message.length}/1500</small>
              </label>

              <label>
                <span>닉네임 <em>선택</em></span>
                <input
                  value={nickname}
                  maxLength={40}
                  placeholder="답변을 위한 계정 정보는 필요하지 않습니다."
                  onChange={(event) => setNickname(event.target.value)}
                />
              </label>

              <label className="feedback-honeypot" aria-hidden="true">
                <span>웹사이트</span>
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </label>

              <div className="feedback-privacy-note">
                <strong>가볍게 운영합니다.</strong>
                <span>
                  이미지 첨부와 AI 처리는 사용하지 않습니다. 닉네임도 선택사항입니다.
                </span>
              </div>

              {status && (
                <p className="feedback-submit-status" role="status">
                  {status}
                </p>
              )}

              <div className="feedback-submit-actions">
                <button
                  type="submit"
                  disabled={submitting || message.trim().length < 5}
                >
                  {submitting
                    ? '처리 중…'
                    : siteSubmissionEnabled
                      ? '사이트로 제보하기'
                      : '제보 내용 복사'}
                </button>

                {discordUrl && (
                  <a
                    href={discordUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Discord에서 직접 문의
                  </a>
                )}
              </div>

              {!siteSubmissionEnabled && (
                <p className="feedback-setup-note">
                  사이트 접수 저장소 연결 전까지는 작성한 내용을 복사할 수 있습니다.
                </p>
              )}
            </form>
          </section>
        </div>
      )}
    </>
  )
}
