
import { useEffect, useState } from "react";
import { securityApi } from "../services/securityApi";
import "./SecurityPages.css";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAlerts() {
    try {
      setLoading(true);
      setError("");
      const data = await securityApi.getAlerts(status);
      setAlerts(data.alerts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts();
  }, [status]);

  async function performAction(action, id) {
    try {
      if (action === "acknowledge") {
        await securityApi.acknowledgeAlert(id);
      } else if (action === "resolve") {
        await securityApi.resolveAlert(id);
      } else if (action === "incident") {
        await securityApi.createIncidentFromAlert(id);
      }

      await loadAlerts();
    } catch (err) {
      setError(err.message);
    }
  }

  const criticalCount = alerts.filter(a => a.severity === "CRITICAL").length;
  const highCount = alerts.filter(a => a.severity === "HIGH").length;

  return (
    <div className="security-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SECURITY OPERATIONS</p>
          <h1>Alert Management</h1>
          <p>Monitor, investigate and respond to security alerts.</p>
        </div>
        <button className="refresh-btn" onClick={loadAlerts}>↻ Refresh</button>
      </div>

      <div className="security-stats">
        <div className="security-stat">
          <span>Total Alerts</span>
          <strong>{alerts.length}</strong>
        </div>
        <div className="security-stat critical">
          <span>Critical Alerts</span>
          <strong>{criticalCount}</strong>
        </div>
        <div className="security-stat high">
          <span>High Severity</span>
          <strong>{highCount}</strong>
        </div>
        <div className="security-stat">
          <span>New Alerts</span>
          <strong>{alerts.filter(a => a.status === "NEW").length}</strong>
        </div>
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <div>
            <h2>Security Alerts</h2>
            <p>Review and manage detected threats.</p>
          </div>

          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="NEW">New</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>

        {error && <div className="error-message">{error}</div>}
        {loading ? <p className="empty-state">Loading alerts...</p> :
          alerts.length === 0 ? (
            <p className="empty-state">No alerts found for this filter.</p>
          ) : (
            <div className="table-scroll">
              <table className="security-table">
                <thead>
                  <tr>
                    <th>Alert</th>
                    <th>Rule</th>
                    <th>Severity</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Detected</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map(alert => (
                    <tr key={alert.id}>
                      <td>
                        <strong>{alert.title}</strong>
                        <small>{alert.description}</small>
                        <small>ID: #{alert.id}</small>
                      </td>
                      <td>{alert.ruleCode}</td>
                      <td>
                        <span className={`severity ${String(alert.severity).toLowerCase()}`}>
                          {alert.severity}
                        </span>
                      </td>
                      <td>{alert.source || "—"}</td>
                      <td>
                        <span className={`status-pill ${String(alert.status).toLowerCase()}`}>
                          {alert.status}
                        </span>
                      </td>
                      <td>{alert.createdAt ? new Date(alert.createdAt).toLocaleString() : "—"}</td>
                      <td>
                        <div className="action-group">
                          {alert.status === "NEW" && (
                            <button onClick={() => performAction("acknowledge", alert.id)}>
                              Acknowledge
                            </button>
                          )}
                          {alert.status !== "RESOLVED" && (
                            <button onClick={() => performAction("resolve", alert.id)}>
                              Resolve
                            </button>
                          )}
                          <button className="secondary-action"
                            onClick={() => performAction("incident", alert.id)}>
                            Create Incident
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}
