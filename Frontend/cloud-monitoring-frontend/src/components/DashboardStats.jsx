
const DashboardStats = ({ incidents = [] }) => {
  const metrics = [
    {
      icon: "⬡",
      label: "Cloud Assets",
      value: "142",
      trend: "↑ 12%",
      detail: "Across AWS, Azure and GCP",
      color: "#04d9f5",
    },
    {
      icon: "⚠",
      label: "Open Incidents",
      value: String(
        incidents.filter(
          (incident) => incident.status !== "Resolved"
        ).length + 3
      ),
      trend: "↑ 33%",
      detail: "2 Critical • 3 High",
      color: "#ff4c4c",
    },
    {
      icon: "⬡",
      label: "Vulnerabilities",
      value: "56",
      trend: "↓ 15%",
      detail: "12 Critical • 18 High",
      color: "#f5428a",
    },
    {
      icon: "▤",
      label: "Compliance Score",
      value: "92%",
      trend: "↑ 2%",
      detail: "Meets security standards",
      color: "#00dfaa",
    },
    {
      icon: "♟",
      label: "Active Users",
      value: "24",
      trend: "↑ 9%",
      detail: "3 Admin • 5 Analyst • 16 Viewer",
      color: "#159bff",
    },
  ];

  return (
    <section className="cm-metrics">
      {metrics.map((metric) => (
        <article className="cm-metric" key={metric.label}>
          <div className="cm-metric-top">
            <span
              className="cm-metric-icon"
              style={{ color: metric.color }}
            >
              {metric.icon}
            </span>

            <span className="cm-metric-label">
              {metric.label}
            </span>
          </div>

          <div className="cm-metric-value">
            {metric.value}
            <span className="cm-trend">
              {metric.trend}
            </span>
          </div>

          <div className="cm-sub">
            {metric.detail}
          </div>
        </article>
      ))}
    </section>
  );
};

export default DashboardStats;

