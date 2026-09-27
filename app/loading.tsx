export default function Loading() {
  return (
    <div
      className="loading-wiki-shell"
      role="status"
      aria-live="polite"
      aria-label="위키를 불러오는 중"
    >
      <div className="loading-topbar">
        <span className="loading-logo" />
        <span className="loading-line is-brand" />
        <span className="loading-search" />
      </div>
      <div className="loading-sidebar">
        <span className="loading-line is-title" />
        {Array.from({ length: 7 }).map((_, index) => (
          <span className="loading-nav-item" key={index} />
        ))}
      </div>
      <div className="loading-main">
        <div className="loading-hero">
          <span className="loading-line is-kicker" />
          <span className="loading-line is-heading" />
        </div>
        <div className="loading-document">
          <span className="loading-line is-wide" />
          <span className="loading-line is-wide" />
          <span className="loading-line is-medium" />
          <span className="loading-block" />
        </div>
      </div>
    </div>
  )
}
