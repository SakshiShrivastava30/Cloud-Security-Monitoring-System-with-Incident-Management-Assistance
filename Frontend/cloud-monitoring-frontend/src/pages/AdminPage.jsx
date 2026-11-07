
function AdminPage() {
  return (
    <section className="panel">
      <div className="eyebrow">ADMINISTRATION</div>
      <h1>Admin Control Center</h1>
      <p className="subtitle">
        Manage users, security policies, and monitoring configuration.
      </p>

      <div className="stats-grid">
        <article className="stat-card">
          <div className="stat-top">Registered Users</div>
          <div className="stat-value">—</div>
          <div className="stat-detail">Connect user API</div>
        </article>

        <article className="stat-card">
          <div className="stat-top">Security Policies</div>
          <div className="stat-value">—</div>
          <div className="stat-detail">Connect policy API</div>
        </article>
      </div>

      <h2>User & Role Management</h2>
      <p className="subtitle">
        Admins will be able to manage accounts and assign Analyst or Viewer
        access after the backend permissions are connected.
      </p>
    </section>
  )
}

export default AdminPage
