
function Topbar({
  search,
  setSearch,
  role,
  notifications,
  setNotifications,
}) {
  return (
    <header className="cm-topbar">
      <div className="cm-brand">
        <div className="cm-brand-icon">☁</div>

        <div>
          <h2>
            Cloud<span>Monitor</span>
          </h2>
          <small>Cloud Security Monitoring System</small>
        </div>
      </div>

      <label className="cm-search">
        <span>⌕</span>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assets, incidents, logs, playbooks..."
        />

        <kbd>Ctrl + K</kbd>
      </label>

      <div className="cm-top-actions">
        <select className="cm-select" aria-label="Environment">
          <option>☁ Production</option>
          <option>Staging</option>
          <option>Development</option>
        </select>

        <button
          className="cm-icon-btn"
          onClick={() => setNotifications(0)}
          aria-label="Clear notifications"
        >
          ♧

          {notifications > 0 && (
            <span className="cm-notice">
              {notifications}
            </span>
          )}
        </button>

        <div className="cm-user">
          <div className="cm-avatar">S</div>

          <div>
            <b>Sakshi</b>
            <br />
            <span style={{ color: "#b6cce5" }}>
              {role.toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Topbar;

