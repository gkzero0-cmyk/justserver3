export default function NotFound() {
  return (
    <main className="not-found-page">
      <section className="not-found-card">
        <span>404</span>
        <h1>문서를 찾을 수 없습니다.</h1>
        <p>
          링크가 변경되었거나 Notion 원본에서 문서가 삭제되었을 수 있습니다.
        </p>
        <a href="/">위키 홈으로 돌아가기</a>
      </section>
    </main>
  )
}
