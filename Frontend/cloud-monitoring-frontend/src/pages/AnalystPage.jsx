
function AnalystPage() {
  return (
    <section className="panel">
      <div className="eyebrow">SECURITY OPERATIONS</div>
      <h1>Analyst Workspace</h1>
      <p className="subtitle">
        Investigate threats, triage incidents, and coordinate responses.
      </p>

      <div className="stats-grid">
        <article className="stat-card">
          <div className="stat-top">Incidents to Review</div>
          <div className="stat-value">24</div>
          <div className="stat-detail">Sample data</div>
        </article>

        <article className="stat-card">
          <div className="stat-top">Investigations</div>
          <div className="stat-value">08</div>
          <div className="stat-detail">Sample data</div>
        </article>
      </div>

      <h2>Investigation workflow</h2>
      <p className="subtitle">
        Review incident evidence, document findings, and follow the response
        playbook. Live incident data will come from the backend API.
      </p>
    </section>
  )
}

export default AnalystPage
