
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
    count: 42,
    score: 90,
    color: "#168dff",
    status: "Healthy",
  },
  {
    name: "Google Cloud",
    logo: "🌈",
    count: 28,
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
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {provider.logo}
            </div>

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

function RiskyAssets() {
  return (
    <Panel
      title="Top Risky Assets"
      action="View All"
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
    ["⚠", "Create Incident", onCreateIncident],
    [
      "⬡",
      "Run Scan",
      () =>
        alert(
          "Demo: scan request prepared. Connect the backend scan API to execute it."
        ),
    ],
    ["▶", "Execute Playbook", () => onOpenModule("Playbook Automation")],
    ["▤", "Generate Report", () => onOpenModule("Report Generator")],
    ["⬡", "Add Asset", () => onOpenModule("Asset Inventory")],
    ["♟", "Manage Users", () => onOpenModule("User & Team Management")],
  ];

  return (
    <Panel title="Quick Actions" action="Customize">
      <div className="cm-quick-grid">
        {actions.map(([icon, label, action]) => (
          <button
            key={label}
            className="cm-quick"
            onClick={action}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </div>
    </Panel>
  );
}

function RecentIncidents({ incidents, search }) {
  return (
    <Panel title="Recent Incidents" action="View All">
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
                  <span className={`cm-pill ${incident.severity}`}>
                    ✦ {incident.severity}
                  </span>
                </td>

                <td>
                  <span
                    className={`cm-pill ${incident.status.replace(" ", "")}`}
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

function IncidentAssistance({ incidents, onGetAssistance }) {
  const assistanceCards = [
    {
      icon: "💡",
      title: "Suggested Actions",
      description: "AI-powered recommendations",
      message:
        "Suggested Actions: Validate evidence, check related logs, contain the affected asset, then document the result.",
    },
    {
      icon: "⌕",
      title: "Auto Investigation",
      description: "Correlates logs, alerts & assets",
      message:
        "Auto Investigation preview: correlate authentication events, cloud audit logs and affected assets. No automatic actions were executed.",
    },
    {
      icon: "▣",
      title: "Playbook Guidance",
      description: "Step-by-step remediation steps",
      message:
        "Playbook Guidance: identify scope, preserve evidence, contain the threat, remediate, and verify recovery.",
    },
  ];

  const openIncidents = incidents.filter(
    (incident) => incident.status !== "Resolved"
  );

  return (
    <Panel title="Incident Management Assistance" action="View">
      <div className="cm-assist-cards">
        {assistanceCards.map((card) => (
          <button
            key={card.title}
            className="cm-assist-card"
            onClick={() => alert(card.message)}
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
              className="cm-small-btn"
              onClick={() => onGetAssistance(incident)}
            >
              Get Assistance
            </button>
          </div>
        ))}

        {openIncidents.length === 0 && (
          <div className="cm-empty">No open incidents.</div>
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
        <RiskyAssets />

        <QuickActions
          onCreateIncident={onCreateIncident}
          onOpenModule={onOpenModule}
        />
      </div>

      <div className="cm-bottom-grid">
        <RecentIncidents incidents={filteredIncidents} />

        <IncidentAssistance
          incidents={incidents}
          onGetAssistance={onGetAssistance}
        />
      </div>
    </>
  );
}

export default IncidentSection;
