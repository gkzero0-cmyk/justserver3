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

  async function copyDocumentLink() {
    const copied = await copyText(canonicalUrl)
    setStatus(
      copied
        ? `${title} 문서 링크를 복사했습니다.`
        : '링크를 복사하지 못했습니다. 주소창의 링크를 복사해주세요.'
    )

    if (copied) {
      track('wiki_document_link_copy', {
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
        <p>DOCUMENT LINK</p>
        <h2 id="document-feedback-title">문서 링크</h2>
        <span>
          현재 문서 주소를 복사해 Discord, 카카오톡, SOOP 등 원하는 곳에 붙여넣을 수 있습니다.
        </span>
      </div>

      <div className="document-feedback-actions">
        <button type="button" onClick={copyDocumentLink}>
          <strong>링크 복사</strong>
          <small>현재 문서 주소를 클립보드에 복사</small>
          <b aria-hidden="true">⧉</b>
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
