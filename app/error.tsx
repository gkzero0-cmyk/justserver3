'use client'

export default function ErrorPage({
  reset
}: {
  reset: () => void
}) {
  return (
    <div className="state-page">
      <div className="state-card">
        <strong>문서를 불러오지 못했습니다.</strong>
        <p>Notion 공개 상태나 일시적인 연결 문제를 확인해 주세요.</p>
        <button type="button" onClick={() => reset()}>
          다시 시도
        </button>
      </div>
    </div>
  )
}
