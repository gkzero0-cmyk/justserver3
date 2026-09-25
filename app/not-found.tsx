import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="not-found-page">
      <section className="not-found-card">
        <span>404</span>
        <h1>문서를 찾을 수 없습니다.</h1>
        <p>주소가 바뀌었거나 더 이상 제공되지 않는 문서일 수 있습니다.</p>
        <Link href="/" prefetch={false}>위키 홈으로 돌아가기</Link>
      </section>
    </main>
  )
}
