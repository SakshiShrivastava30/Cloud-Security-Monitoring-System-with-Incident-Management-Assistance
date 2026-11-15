
import { useEffect, useState } from "react";
import { securityApi } from "../services/securityApi";
import "./SecurityPages.css";

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assignments, setAssignments] = useState({});
  const [notes, setNotes] = useState({});

  // Add Incident Form
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
  });

  async function loadIncidents() {
    try {
      setLoading(true);
      setError("");

      const data = await securityApi.getIncidents(status);
      setIncidents(data.content || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIncidents();
  }, [status]);

  // CREATE INCIDENT
  async function handleCreateIncident(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");

      await securityApi.createIncident(formData);

      setFormData({
        title: "",
        description: "",
        priority: "MEDIUM",
      });

      setShowForm(false);
      await loadIncidents();

    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ASSIGN INCIDENT
  async function assign(id) {
    try {
      const userId = assignments[id];

      if (!userId || Number(userId) <= 0) {
        setError("Enter a valid analyst user ID.");
        return;
      }

      await securityApi.assignIncident(id, userId);
      await loadIncidents();

    } catch (err) {
      setError(err.message);
    }
  }

  // UPDATE STATUS
  async function changeStatus(id, newStatus) {
    try {
      await securityApi.updateIncidentStatus(id, newStatus);
      await loadIncidents();
    } catch (err) {
      setError(err.message);
    }
  }

  // RESOLVE INCIDENT
  async function resolve(id) {
    try {
      await securityApi.resolveIncident(
        id,
        notes[id] || "Incident investigated and resolved."
      );

      await loadIncidents();

    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="security-page">

      {/* PAGE HEADER */}
      <div className="page-heading">
        <div>
          <p className="eyebrow">SECURITY RESPONSE</p>
          <h1>Incident Management</h1>
          <p>
            Track investigations, assign analysts and resolve incidents.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            className="refresh-btn"
            onClick={loadIncidents}
          >
            ↻ Refresh
          </button>

          <button
            className="refresh-btn"
            onClick={() => {
              setError("");
              setShowForm(!showForm);
            }}
          >
            {showForm ? "✕ Cancel" : "+ Add Incident"}
          </button>
        </div>
      </div>

      {/* ERROR MESSAGE */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* CREATE INCIDENT FORM */}
      {showForm && (
        <div className="table-panel" style={{ marginBottom: "24px" }}>

          <div className="table-toolbar">
            <div>
              <h2>Create New Incident</h2>
              <p>Enter the incident details below.</p>
            </div>
          </div>

          <form
            onSubmit={handleCreateIncident}
            className="incident-controls"
          >
            <input
              type="text"
              placeholder="Enter incident title"
              value={formData.title}
              required
              onChange={(e) =>
                setFormData({
                  ...formData,
                  title: e.target.value,
                })
              }
            />

            <textarea
              placeholder="Describe the security incident..."
              value={formData.description}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  description: e.target.value,
                })
              }
              rows="4"
            />

            <select
              value={formData.priority}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  priority: e.target.value,
                })
              }
            >
              <option value="LOW">Low Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="HIGH">High Priority</option>
              <option value="CRITICAL">Critical Priority</option>
            </select>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="submit"
                className="refresh-btn"
                disabled={saving}
              >
                {saving ? "Creating..." : "Create Incident"}
              </button>

              <button
                type="button"
                className="refresh-btn"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STATISTICS */}
      <div className="security-stats">

        <div className="security-stat">
          <span>Total Incidents</span>
          <strong>{incidents.length}</strong>
        </div>

        <div className="security-stat critical">
          <span>Critical</span>
          <strong>
            {incidents.filter(i => i.priority === "CRITICAL").length}
          </strong>
        </div>

        <div className="security-stat high">
          <span>In Progress</span>
          <strong>
            {incidents.filter(i => i.status === "IN_PROGRESS").length}
          </strong>
        </div>

        <div className="security-stat">
          <span>Resolved</span>
          <strong>
            {incidents.filter(i => i.status === "RESOLVED").length}
          </strong>
        </div>

      </div>

      {/* INCIDENT LIST */}
      <div className="table-panel">

        <div className="table-toolbar">
          <div>
            <h2>Incident Register</h2>
            <p>Investigation and response workflow.</p>
          </div>

          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>

        {loading ? (
          <p className="empty-state">Loading incidents...</p>
        ) : incidents.length === 0 ? (
          <p className="empty-state">
            No incidents found. Click Add Incident to create one.
          </p>
        ) : (
          <div className="incident-grid">

            {incidents.map(incident => (

              <article
                className="incident-card"
                key={incident.id}
              >

                <div className="incident-card-top">
                  <span className="incident-id">
                    INC #{incident.id}
                  </span>

                  <span
                    className={`severity ${String(
                      incident.priority
                    ).toLowerCase()}`}
                  >
                    {incident.priority}
                  </span>
                </div>

                <h3>{incident.title}</h3>

                <p className="incident-description">
                  {incident.description || "No description provided."}
                </p>

                <div className="incident-meta">
                  <span>
                    Alert ID: {incident.alertId ?? "Manual"}
                  </span>

                  <span
                    className={`status-pill ${String(
                      incident.status
                    ).toLowerCase()}`}
                  >
                    {incident.status}
                  </span>
                </div>

                <div className="incident-meta">
                  <span>
                    Assigned analyst:{" "}
                    {incident.assignedToUserId || "Unassigned"}
                  </span>

                  <span>
                    {incident.createdAt
                      ? new Date(incident.createdAt).toLocaleDateString()
                      : "—"}
                  </span>
                </div>

                {!["RESOLVED", "CLOSED"].includes(incident.status) && (

                  <div className="incident-controls">

                    <div className="inline-control">

                      <input
                        type="number"
                        min="1"
                        placeholder="Analyst user ID"
                        value={assignments[incident.id] || ""}
                        onChange={e =>
                          setAssignments({
                            ...assignments,
                            [incident.id]: e.target.value,
                          })
                        }
                      />

                      <button onClick={() => assign(incident.id)}>
                        Assign
                      </button>

                    </div>

                    <select
                      value={incident.status}
                      onChange={e =>
                        changeStatus(incident.id, e.target.value)
                      }
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                    </select>

                    <textarea
                      placeholder="Resolution notes..."
                      value={notes[incident.id] || ""}
                      onChange={e =>
                        setNotes({
                          ...notes,
                          [incident.id]: e.target.value,
                        })
                      }
                    />

                    <button
                      className="resolve-btn"
                      onClick={() => resolve(incident.id)}
                    >
                      Resolve Incident
                    </button>

                  </div>
                )}

                {incident.status === "RESOLVED" && (
                  <p className="resolved-note">
                    Resolved:{" "}
                    {incident.resolutionNotes || "No resolution notes."}
                  </p>
                )}

              </article>

            ))}

          </div>
        )}

      </div>
    </div>
  );
}
