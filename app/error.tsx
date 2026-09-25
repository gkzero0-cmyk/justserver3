'use client'

import Link from 'next/link'

export default function ErrorPage({
  reset
}: {
  reset: () => void
}) {
  return (
    <div className="state-page">
      <div className="state-card">
        <span className="state-icon" aria-hidden="true">!</span>
        <strong>일시적으로 문서를 불러오지 못했습니다.</strong>
        <p>잠시 후 다시 시도하거나 위키 홈에서 다른 문서를 확인해 주세요.</p>
        <div className="state-actions">
          <button type="button" onClick={() => reset()}>
            다시 시도
          </button>
          <Link href="/" prefetch={false}>위키 홈</Link>
        </div>
      </div>
    </div>
  )
}
