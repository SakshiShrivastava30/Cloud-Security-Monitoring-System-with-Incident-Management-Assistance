
import { useEffect, useState } from "react";

const API =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function DashboardStats({ incidents = [], onOpenModule }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadAssets() {
      try {
        const token =
          sessionStorage.getItem("token") ||
          sessionStorage.getItem("jwtToken") ||
          localStorage.getItem("token") ||
          "";

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
        setError("");
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
    (sum, asset) =>
      sum + (Number(asset.vulnerabilities) || 0),
    0
  );

  const criticalAssets = assets.filter(
    (asset) =>
      String(asset.criticality || "").toLowerCase() === "critical" ||
      Number(asset.riskScore) >= 85
  ).length;

  const openIncidents = incidents.filter(
    (incident) =>
      String(incident.status).toLowerCase() !== "resolved"
  ).length;

  const metrics = [
    {
      icon: "⬡",
      label: "Cloud Assets",
      value: loading ? "..." : totalAssets,
      detail: "Registered cloud assets",
      color: "#04d9f5",
      module: "Asset Inventory",
    },
    {
      icon: "⚠",
      label: "Open Incidents",
      value: openIncidents,
      detail: "From connected incident data",
      color: "#ff4c4c",
      module: "Incident Management",
    },
    {
      icon: "⬡",
      label: "Vulnerabilities",
      value: loading ? "..." : vulnerabilities,
      detail: "Across registered assets",
      color: "#f5428a",
      module: "Vulnerability Scanner",
    },
    {
      icon: "▤",
      label: "Critical Assets",
      value: loading ? "..." : criticalAssets,
      detail: "Critical classification or risk score ≥ 85",
      color: "#00dfaa",
      module: "Asset Inventory",
    },
    {
      icon: "♟",
      label: "Active Users",
      value: "—",
      detail: "Users API not connected",
      color: "#159bff",
      module: "User & Team Management",
    },
  ];

  const handleCardClick = (module) => {
    if (onOpenModule) {
      onOpenModule(module);
    }
  };

  return (
    <section className="cm-metrics">
      {metrics.map((metric) => (
        <article
          className="cm-metric"
          key={metric.label}
          role="button"
          tabIndex={0}
          title={`Open ${metric.module}`}
          onClick={() => handleCardClick(metric.module)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleCardClick(metric.module);
            }
          }}
          style={{ cursor: "pointer" }}
        >
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
            {error &&
            metric.label !== "Open Incidents" &&
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
