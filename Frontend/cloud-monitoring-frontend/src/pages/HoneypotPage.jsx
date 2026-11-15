
import { useEffect, useState } from "react";
import { securityApi } from "../services/securityApi";
import "./SecurityPages.css";

export default function HoneypotPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [severity, setSeverity] = useState("");

  async function loadEvents() {
    try {
      setLoading(true);
      setError("");

      const data = await securityApi.getMonitoringEvents(0, 200);
      const honeypotEvents = (data.events || []).filter(
        event => event.eventCategory === "HONEYPOT"
      );

      setEvents(honeypotEvents);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  const filteredEvents = events.filter(event =>
    !severity || event.severity?.toUpperCase() === severity
  );

  const critical = events.filter(
    event => event.severity?.toUpperCase() === "CRITICAL"
  ).length;

  const high = events.filter(
    event => event.severity?.toUpperCase() === "HIGH"
  ).length;

  return (
    <div className="security-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">THREAT DECEPTION</p>
          <h1>Honeypot Monitoring</h1>
          <p>Track suspicious access attempts against decoy resources.</p>
        </div>
        <button className="refresh-btn" onClick={loadEvents}>↻ Refresh</button>
      </div>

      <div className="security-stats">
        <div className="security-stat">
          <span>Total Interactions</span>
          <strong>{events.length}</strong>
        </div>
        <div className="security-stat critical">
          <span>Critical Attempts</span>
          <strong>{critical}</strong>
        </div>
        <div className="security-stat high">
          <span>High Severity</span>
          <strong>{high}</strong>
        </div>
        <div className="security-stat">
          <span>Decoy Endpoints</span>
          <strong>5</strong>
        </div>
      </div>

      <div className="honeypot-banner">
        <div className="honeypot-icon">⌁</div>
        <div>
          <strong>Honeypot Detection Active</strong>
          <p>
            Requests to decoy endpoints are recorded as security events.
            Sensitive request bodies are not displayed here.
          </p>
        </div>
        <span className="live-indicator">● Monitoring</span>
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <div>
            <h2>Captured Interactions</h2>
            <p>Recorded honeypot access attempts.</p>
          </div>

          <select value={severity} onChange={e => setSeverity(e.target.value)}>
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        {error && <div className="error-message">{error}</div>}

        {loading ? <p className="empty-state">Loading honeypot events...</p> :
          filteredEvents.length === 0 ? (
            <p className="empty-state">No honeypot interactions found.</p>
          ) : (
            <div className="table-scroll">
              <table className="security-table">
                <thead>
                  <tr>
                    <th>Event ID</th>
                    <th>Event Type</th>
                    <th>Source IP</th>
                    <th>Endpoint</th>
                    <th>Severity</th>
                    <th>Collector</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map(event => {
                    let details = {};
                    try {
                      details = JSON.parse(event.detailsJson || "{}");
                    } catch {
                      details = {};
                    }

                    return (
                      <tr key={event.id}>
                        <td>#{event.id}</td>
                        <td><strong>{event.eventType}</strong></td>
                        <td>{event.sourceIp || "Local / Unknown"}</td>
                        <td>{details.path || "—"}</td>
                        <td>
                          <span className={`severity ${String(event.severity).toLowerCase()}`}>
                            {event.severity}
                          </span>
                        </td>
                        <td>{event.collector || event.source}</td>
                        <td>
                          {event.timestamp
                            ? new Date(event.timestamp).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}
