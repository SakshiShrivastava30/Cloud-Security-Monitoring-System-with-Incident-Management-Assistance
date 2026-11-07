
import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function DashboardStats({ incidents = [] }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadAssets() {
      try {
        const token = sessionStorage.getItem("token");

        const response = await fetch(`${API}/api/assets`, {
          headers: token
            ? { Authorization: `Bearer ${token}` }
            : {},
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        setAssets(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadAssets();

    return () => controller.abort();
  }, []);

  const totalAssets = assets.length;

  const vulnerabilities = assets.reduce(
    (sum, asset) => sum + (Number(asset.vulnerabilities) || 0),
    0
  );

  const criticalAssets = assets.filter(
    (asset) =>
      String(asset.criticality || "").toLowerCase() === "critical" ||
      Number(asset.riskScore) >= 85
  ).length;

  const openIncidents = incidents.filter(
    (incident) => incident.status !== "Resolved"
  ).length;

  const metrics = [
    {
      icon: "⬡",
      label: "Cloud Assets",
      value: loading ? "..." : totalAssets,
      detail: "Registered cloud assets",
      color: "#04d9f5",
    },
    {
      icon: "⚠",
      label: "Open Incidents",
      value: openIncidents,
      detail: "From connected incident data",
      color: "#ff4c4c",
    },
    {
      icon: "⬡",
      label: "Vulnerabilities",
      value: loading ? "..." : vulnerabilities,
      detail: "Across registered assets",
      color: "#f5428a",
    },
    {
      icon: "▤",
      label: "Critical Assets",
      value: loading ? "..." : criticalAssets,
      detail: "Critical classification or risk score ≥ 85",
      color: "#00dfaa",
    },
    {
      icon: "♟",
      label: "Active Users",
      value: "—",
      detail: "Users API not connected",
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
          </div>

          <div className="cm-sub">
            {error && metric.label !== "Open Incidents" &&
            metric.label !== "Active Users"
              ? "Unable to load asset data"
              : metric.detail}
          </div>
        </article>
      ))}
    </section>
  );
}

export default DashboardStats;
