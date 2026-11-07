
function ViewerPage() {
  return (
    <section className="panel">
      <div className="eyebrow">READ-ONLY SECURITY INSIGHTS</div>
      <h1>Security Viewer</h1>
      <p className="subtitle">
        Review cloud security posture and incident summaries without making
        changes.
      </p>

      <div className="stats-grid">
        <article className="stat-card">
          <div className="stat-top">Security Score</div>
          <div className="stat-value">94.8%</div>
          <div className="stat-detail">Sample data</div>
        </article>

        <article className="stat-card">
          <div className="stat-top">Monitored Assets</div>
          <div className="stat-value">1,284</div>
          <div className="stat-detail">Sample data</div>
        </article>
      </div>

      <h2>Security reports</h2>
      <p className="subtitle">
        Read-only reports and summaries will be displayed here.
      </p>
    </section>
  )
}

export default ViewerPage
