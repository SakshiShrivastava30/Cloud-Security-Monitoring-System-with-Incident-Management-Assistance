
import Panel from "./panel";

const providers = [
  {
    name: "AWS",
    logo: "aws",
    count: 56,
    score: 95,
    color: "#00d6a0",
    status: "Healthy",
  },
  {
    name: "Azure",
    logo: "Azure",
    count: 3,
    score: 90,
    color: "#168dff",
    status: "Healthy",
  },
  {
    name: "Google Cloud",
    logo: "Google Cloud",
    count: 42,
    score: 88,
    color: "#ffc21b",
    status: "Degraded",
  },
];

const assets = [
  ["prod-ec-01", 92, "AWS", "Critical"],
  ["db-server", 78, "Azure", "High"],
  ["web-app", 65, "GCP", "Medium"],
  ["storage-bucket", 52, "AWS", "Medium"],
  ["k8s-cluster", 40, "Azure", "Low"],
];

function CloudProviderStatus() {
  return (
    <Panel title="Cloud Provider Status">
      <div className="cm-provider-grid">
        {providers.map((provider) => (
          <article className="cm-provider" key={provider.name}>
            {provider.logo && (
              <div style={{ fontSize: 22, fontWeight: 800 }}>
                {provider.logo}
              </div>
            )}

            <div className="cm-provider-name">
              {provider.name}
            </div>

            <div className="cm-provider-count">
              {provider.count} resources
            </div>

            <div className="cm-provider-score">
              {provider.score}%
            </div>

            <div className="cm-progress">
              <span
                style={{
                  width: `${provider.score}%`,
                  background: provider.color,
                }}
              />
            </div>

            <div
              className="cm-provider-status"
              style={{
                color:
                  provider.status === "Healthy"
                    ? "#00dfaa"
                    : "#ffad17",
              }}
            >
              ● &nbsp;{provider.status}
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function RiskyAssets({ onOpenModule }) {
  return (
    <Panel
      title="Top Risky Assets"
      action="View All"
      onAction={() => onOpenModule("Asset Inventory")}
      className="cm-risk-panel"
    >
      <div className="cm-table-wrap">
        <table className="cm-table">
          <thead>
            <tr>
              <th>Asset Name</th>
              <th>Risk Score</th>
              <th>Provider</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {assets.map(([name, score, provider, status]) => (
              <tr key={name}>
                <td>{name}</td>
                <td>
                  <span className={`cm-pill ${status}`}>
                    {score}
                  </span>
                </td>
                <td>{provider}</td>
                <td>
                  <span className={`cm-pill ${status}`}>
                    {status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function QuickActions({ onCreateIncident, onOpenModule }) {
  const actions = [
    {
      icon: "⚠",
      label: "Create Incident",
      action: onCreateIncident,
      enabled: Boolean(onCreateIncident),
    },
    {
      icon: "⬡",
      label: "Run Scan",
      action: () => onOpenModule("Vulnerability Scanner"),
      enabled: false,
    },
    {
      icon: "▶",
      label: "Execute Playbook",
      action: () => onOpenModule("Playbook Automation"),
      enabled: false,
    },
    {
      icon: "▤",
      label: "Generate Report",
      action: () => onOpenModule("Report Generator"),
      enabled: false,
    },
    {
      icon: "⬡",
      label: "Add Asset",
      action: () => onOpenModule("Asset Inventory"),
      enabled: Boolean(onOpenModule),
    },
    {
      icon: "♟",
      label: "Manage Users",
      action: () => onOpenModule("User & Team Management"),
      enabled: Boolean(onOpenModule),
    },
  ];

  return (
    <Panel title="Quick Actions">
      <div className="cm-quick-grid">
        {actions.map((item) => (
          <button
            key={item.label}
            type="button"
            className="cm-quick"
            onClick={item.action}
            disabled={!item.enabled}
            title={
              item.enabled
                ? item.label
                : "This functionality is not connected yet"
            }
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </Panel>
  );
}

function RecentIncidents({
  incidents,
  onOpenModule,
}) {
  return (
    <Panel
      title="Recent Incidents"
      action="View All"
      onAction={() => onOpenModule("Incident Management")}
    >
      <div className="cm-table-wrap">
        <table className="cm-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Affected Asset</th>
              <th>Assigned To</th>
              <th>Time</th>
            </tr>
          </thead>

          <tbody>
            {incidents.map((incident) => (
              <tr key={incident.id}>
                <td>{incident.id}</td>
                <td>{incident.title}</td>
                <td>
                  <span
                    className={`cm-pill ${incident.severity}`}
                  >
                    ✦ {incident.severity}
                  </span>
                </td>
                <td>
                  <span
                    className={`cm-pill ${
                      String(incident.status).replace(/\s/g, "")
                    }`}
                  >
                    {incident.status}
                  </span>
                </td>
                <td>{incident.asset}</td>
                <td>{incident.owner}</td>
                <td>{incident.time}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {incidents.length === 0 && (
          <div className="cm-empty">
            No incidents match your search.
          </div>
        )}
      </div>
    </Panel>
  );
}

function IncidentAssistance({
  incidents,
  onGetAssistance,
  onOpenModule,
}) {
  const assistanceCards = [
    {
      icon: "💡",
      title: "Suggested Actions",
      description: "AI-powered recommendations",
    },
    {
      icon: "⌕",
      title: "Auto Investigation",
      description: "Correlates logs, alerts & assets",
    },
    {
      icon: "▣",
      title: "Playbook Guidance",
      description: "Step-by-step remediation steps",
    },
  ];

  const openIncidents = incidents.filter(
    (incident) =>
      String(incident.status).toLowerCase() !== "resolved"
  );

  return (
    <Panel
      title="Incident Management Assistance"
      action="View"
      onAction={() => onOpenModule("Incident Assistance")}
    >
      <div className="cm-assist-cards">
        {assistanceCards.map((card) => (
          <button
            key={card.title}
            type="button"
            className="cm-assist-card"
            onClick={() => onOpenModule("Incident Assistance")}
          >
            <span>{card.icon}</span>
            <div>
              <strong>{card.title}</strong>
              <small>{card.description}</small>
            </div>
          </button>
        ))}
      </div>

      <div className="cm-assist-list">
        <div className="cm-assist-list-head">
          <span>Open Incidents Needing Assistance</span>
          <span style={{ color: "#00d7f4" }}>
            {openIncidents.length} open
          </span>
        </div>

        {openIncidents.slice(0, 3).map((incident) => (
          <div className="cm-assist-row" key={incident.id}>
            <span>{incident.id}</span>
            <span>{incident.title}</span>

            <span className={`cm-pill ${incident.severity}`}>
              {incident.severity}
            </span>

            <button
              type="button"
              className="cm-small-btn"
              onClick={() => onGetAssistance(incident)}
            >
              Get Assistance
            </button>
          </div>
        ))}

        {openIncidents.length === 0 && (
          <div className="cm-empty">
            No open incidents.
          </div>
        )}
      </div>
    </Panel>
  );
}

function IncidentSection({
  incidents = [],
  search = "",
  onCreateIncident,
  onOpenModule,
  onGetAssistance,
}) {
  const filteredIncidents = incidents.filter((incident) =>
    `${incident.id} ${incident.title} ${incident.asset} ${incident.owner}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <>
      <div className="cm-grid-bottom">
        <CloudProviderStatus />

        <RiskyAssets onOpenModule={onOpenModule} />

        <QuickActions
          onCreateIncident={onCreateIncident}
          onOpenModule={onOpenModule}
        />
      </div>

      <div className="cm-bottom-grid">
        <RecentIncidents
          incidents={filteredIncidents}
          onOpenModule={onOpenModule}
        />

        <IncidentAssistance
          incidents={incidents}
          onGetAssistance={onGetAssistance}
          onOpenModule={onOpenModule}
        />
      </div>
    </>
  );
}

export default IncidentSection;
