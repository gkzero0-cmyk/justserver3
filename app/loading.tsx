export default function Loading() {
  return (
    <div className="loading-wiki-shell" aria-label="위키를 불러오는 중">
      <header className="loading-topbar">
        <span className="loading-logo" />
        <span className="loading-line is-brand" />
        <span className="loading-search" />
      </header>
      <aside className="loading-sidebar">
        <span className="loading-line is-title" />
        {Array.from({ length: 7 }).map((_, index) => (
          <span className="loading-nav-item" key={index} />
        ))}
      </aside>
      <main className="loading-main">
        <section className="loading-hero">
          <span className="loading-line is-kicker" />
          <span className="loading-line is-heading" />
        </section>
        <section className="loading-document">
          <span className="loading-line is-wide" />
          <span className="loading-line is-wide" />
          <span className="loading-line is-medium" />
          <span className="loading-block" />
        </section>
      </main>
    </div>
  )
}
