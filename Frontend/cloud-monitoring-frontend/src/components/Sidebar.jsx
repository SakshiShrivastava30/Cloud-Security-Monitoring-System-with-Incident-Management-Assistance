
import { useEffect, useState } from "react";
import { securityApi } from "../services/securityApi";

const modules = [
  ["♟", "User & Team Management", "blue"],
  ["◎", "Threat Intelligence", "blue"],
  ["⚠", "Incident Management", "red"],
  ["⚡", "Alert Engine", "cyan"],
  ["◈", "Honeypot Monitoring", "red"],
  ["⬡", "Vulnerability Scanner", "red"],
  ["▣", "Asset Inventory", "orange"],
  ["◉", "System Activity Monitoring", "cyan"],
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
  onLogout,
  role,
}) {
  const [alertCount, setAlertCount] = useState(0);
  const [incidentCount, setIncidentCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadCounts() {
      try {
        const [alertData, incidentData] = await Promise.all([
          securityApi.getAlerts(),
          securityApi.getIncidents(),
        ]);

        if (mounted) {
          setAlertCount(
            alertData.totalElements ??
              alertData.alerts?.length ??
              0
          );

          setIncidentCount(
            incidentData.totalElements ??
              incidentData.content?.length ??
              incidentData.length ??
              0
          );
        }
      } catch (error) {
        console.error(
          "Unable to fetch sidebar counts:",
          error
        );
      }
    }

    loadCounts();

    const interval = setInterval(loadCounts, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const openModule = (name) => {
    onModuleChange(name);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const visibleModules = modules.filter(
    ([, name]) =>
      name !== "User & Team Management" ||
      role === "Admin"
  );

  return (
    <aside className="cm-sidebar">
      <div className="cm-sidebar-menu">
        <button
          type="button"
          className={`cm-nav ${
            activeModule === "Dashboard / Overview"
              ? "active"
              : ""
          }`}
          onClick={() =>
            openModule("Dashboard / Overview")
          }
        >
          <span className="cm-nav-icon">⌂</span>
          <span className="cm-nav-name">
            Dashboard Overview
          </span>
        </button>

        {visibleModules.map(([icon, name, color]) => (
          <button
            type="button"
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
                    : color === "cyan"
                    ? "#46d8f4"
                    : "#60a5fa",
              }}
            >
              {icon}
            </span>

            <span className="cm-nav-name">
              {name}
            </span>

            {name === "Incident Management" &&
              incidentCount > 0 && (
                <span className="cm-nav-count">
                  {incidentCount}
                </span>
              )}

            {name === "Alert Engine" &&
              alertCount > 0 && (
                <span className="cm-nav-count">
                  {alertCount}
                </span>
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
        <span className="cm-nav-name">
          Logout
        </span>
      </button>
    </aside>
  );
}

export default Sidebar;
