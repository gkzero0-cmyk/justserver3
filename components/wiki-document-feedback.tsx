'use client'

import { track } from '@vercel/analytics'
import { useState } from 'react'

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
  canonicalUrl
}: {
  pageId: string
  title: string
  canonicalUrl: string
}) {
  const [status, setStatus] = useState('')

  async function shareDocument() {
    const data = {
      title: `${title} | 그냥서버 : 적자생존 위키`,
      text: `${title} 문서를 확인해보세요.`,
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
    setStatus(
      copied
        ? '문서 링크를 복사했습니다.'
        : '링크를 복사하지 못했습니다. 주소창의 링크를 복사해주세요.'
    )

    if (copied) {
      track('wiki_document_share', {
        method: 'clipboard',
        page_id: pageId.replaceAll('-', '')
      })
    }
  }

  return (
    <aside
      className="document-feedback"
      id="document-feedback"
      aria-labelledby="document-feedback-title"
    >
      <div>
        <p>DOCUMENT SHARE</p>
        <h2 id="document-feedback-title">문서 공유</h2>
        <span>
          현재 보고 있는 문서를 다른 이용자에게 간단히 공유할 수 있습니다.
        </span>
      </div>

      <div className="document-feedback-actions">
        <button type="button" onClick={shareDocument}>
          <strong>공유하기</strong>
          <small>휴대폰 공유창 또는 링크 복사</small>
          <b aria-hidden="true">↗</b>
        </button>
      </div>

      {status && (
        <p className="document-action-status" role="status">
          {status}
        </p>
      )}
    </aside>
  )
}
