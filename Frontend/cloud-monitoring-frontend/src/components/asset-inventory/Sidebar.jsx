
const modules = [
  ["♟", "User & Team Management", "blue"],
  ["◎", "Threat Intelligence", "blue"],
  ["⚠", "Incident Management", "red"],
  ["⚡", "Alert Engine", "cyan"],
  ["⬡", "Vulnerability Scanner", "red"],
  ["▣", "Asset Inventory", "orange"],
  ["▤", "Log Management (SIEM)", "purple"],
  ["▧", "Playbook Automation", "cyan"],
  ["⬡", "Compliance Manager", "cyan"],
  ["▦", "Audit Trail", "purple"],
  ["▤", "Report Generator", "purple"],
  ["▧", "Notification Service", "cyan"],
  ["▤", "Risk Scoring Engine", "orange"],
  ["⬡", "Knowledge Base", "red"],
  ["⚙", "Settings & Configuration", "purple"],
  ["◈", "Incident Assistance", "cyan"],
];

function Sidebar({
  activeModule,
  onModuleChange,
  incidents = [],
  onLogout,
}) {
  const openIncidents = incidents.filter(
    (incident) => incident.status !== "Resolved"
  ).length;

  const openModule = (name) => {
    onModuleChange(name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <aside className="cm-sidebar">
      <div className="cm-sidebar-menu">

        <button
          className={`cm-nav ${
            activeModule === "Dashboard / Overview" ? "active" : ""
          }`}
          onClick={() => openModule("Dashboard / Overview")}
        >
          <span className="cm-nav-icon">⌂</span>
          <span className="cm-nav-name">Dashboard Overview</span>
        </button>

        {modules.map(([icon, name, color]) => (
          <button
            key={name}
            className={`cm-nav ${
              activeModule === name ? "active" : ""
            }`}
            onClick={() => openModule(name)}
          >
            <span
              className="cm-nav-icon"
              style={{
                color:
                  color === "red"
                    ? "#ff5d66"
                    : color === "orange"
                      ? "#ffb64d"
                      : color === "purple"
                        ? "#ba8bff"
                        : "#46d8f4",
              }}
            >
              {icon}
            </span>

            <span className="cm-nav-name">{name}</span>

            {name === "Incident Management" && (
              <span className="cm-nav-count">
                {openIncidents + 3}
              </span>
            )}

            {name === "Alert Engine" && (
              <span className="cm-nav-count">3</span>
            )}
          </button>
        ))}

      </div>

      <div className="cm-sidebar-foot">
        🛡️ &nbsp; Secure Clouds
        <br />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Safer Tomorrows
      </div>

      <button
        className="cm-nav cm-logout-nav"
        type="button"
        onClick={onLogout}
        title="Sign out of CloudMonitor"
      >
        <span className="cm-nav-icon">⇥</span>
        <span className="cm-nav-name">Logout</span>
      </button>
    </aside>
  );
}

export default Sidebar;
