
import { useEffect, useMemo, useState } from "react";
import { securityApi } from "../services/securityApi";
import "./SystemActivityPage.css";

function SystemActivityPage() {
  const [events, setEvents] = useState([]);

  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [severity, setSeverity] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);

  // =========================
  // FETCH MONITORING EVENTS
  // =========================

  useEffect(() => {
    const controller = new AbortController();

    async function fetchEvents() {
      try {
        setLoading(true);
        setError("");

        const token =
          sessionStorage.getItem("token") ||
          sessionStorage.getItem("jwtToken") ||
          localStorage.getItem("token") ||
          "";

        if (!token) {
          throw new Error(
            "Please login to access monitoring events."
          );
        }

        const data = await securityApi.getMonitoringEvents(
          page,
          50,
          { signal: controller.signal }
        );

        setEvents(data.events || []);
        setTotalPages(data.totalPages || 0);
        setTotalElements(data.totalElements || 0);

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

    fetchEvents();

    return () => controller.abort();

  }, [page]);

  // =========================
  // FILTER EVENTS
  // =========================

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch = [
        event.eventType,
        event.eventCategory,
        event.source,
        event.username,
        event.filePath,
        event.domain,
        event.sourceIp,
        event.destinationIp,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesCategory =
        category === "ALL" ||
        event.eventCategory?.toUpperCase() ===
          category.toUpperCase();

      const matchesSeverity =
        severity === "ALL" ||
        event.severity?.toUpperCase() === severity;

      return matchesSearch && matchesCategory && matchesSeverity;
    });
  }, [events, search, category, severity]);

  // =========================
  // STATISTICS
  // =========================

  const highCount = events.filter(
    (event) => event.severity?.toLowerCase() === "high"
  ).length;

  const securityCount = events.filter(
    (event) => event.eventCategory?.toLowerCase() === "security"
  ).length;

  const processCount = events.filter(
    (event) => event.eventCategory?.toLowerCase() === "process"
  ).length;

  // =========================
  // FORMAT DATE
  // =========================

  const formatDate = (value) => {
    if (!value) return "N/A";

    return new Date(value).toLocaleString();
  };

  // =========================
  // FORMAT EVENT DETAILS
  // =========================

  const getDetails = (value) => {
    try {
      return JSON.stringify(
        JSON.parse(value || "{}"),
        null,
        2
      );
    } catch {
      return value || "{}";
    }
  };

  // =========================
  // UI
  // =========================

  return (
    <div className="sam-page">

      {/* HEADER */}

      <div className="sam-header">
        <div>
          <p className="sam-eyebrow">
            SECURITY OPERATIONS
          </p>

          <h1>System Activity Monitoring</h1>

          <p className="sam-subtitle">
            Monitor system events, processes, files and network activity.
          </p>
        </div>
      </div>

      {/* ERROR MESSAGE */}

      {error && (
        <div className="sam-error">
          {error}
        </div>
      )}

      {/* STATISTICS */}

      <div className="sam-stats">

        <div className="sam-stat-card">
          <span>Total Events</span>
          <strong>{totalElements.toLocaleString()}</strong>
          <small>All recorded events</small>
        </div>

        <div className="sam-stat-card">
          <span>High Severity</span>
          <strong>{highCount}</strong>
          <small>On current page</small>
        </div>

        <div className="sam-stat-card">
          <span>Security Events</span>
          <strong>{securityCount}</strong>
          <small>On current page</small>
        </div>

        <div className="sam-stat-card">
          <span>Process Events</span>
          <strong>{processCount}</strong>
          <small>On current page</small>
        </div>

      </div>

      {/* SEARCH AND FILTERS */}

      <div className="sam-toolbar">

        <input
          type="text"
          placeholder="Search event, process, IP, username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="ALL">All Categories</option>
          <option value="SYSTEM">System</option>
          <option value="LOGIN">Login</option>
          <option value="PROCESS">Process</option>
          <option value="FILE">File</option>
          <option value="NETWORK">Network</option>
          <option value="DNS">DNS</option>
          <option value="DEVICE">Device</option>
          <option value="SECURITY">Security</option>
        </select>

        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          <option value="ALL">All Severities</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
          <option value="INFORMATIONAL">Informational</option>
        </select>

      </div>

      {/* MONITORING EVENTS TABLE */}

      <div className="sam-table-wrapper">

        <div className="sam-table-heading">
          <h2>Monitoring Events</h2>

          <span>
            {filteredEvents.length} events on this page
          </span>
        </div>

        {loading ? (
          <div className="sam-message">
            Loading monitoring events...
          </div>
        ) : (

          <table className="sam-table">

            <thead>
              <tr>
                <th>Event</th>
                <th>Category</th>
                <th>Severity</th>
                <th>Username</th>
                <th>Source</th>
                <th>Time</th>
                <th>Details</th>
              </tr>
            </thead>

            <tbody>

              {filteredEvents.map((event) => (
                <tr key={event.id}>

                  <td>
                    <strong>{event.eventType}</strong>
                  </td>

                  <td>
                    <span className="sam-category">
                      {event.eventCategory}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`sam-severity ${
                        event.severity?.toLowerCase() || "unknown"
                      }`}
                    >
                      {event.severity || "Unknown"}
                    </span>
                  </td>

                  <td>{event.username || "System"}</td>

                  <td>{event.source || "N/A"}</td>

                  <td>{formatDate(event.timestamp)}</td>

                  <td>
                    <button
                      className="sam-details-btn"
                      onClick={() => setSelectedEvent(event)}
                    >
                      View
                    </button>
                  </td>

                </tr>
              ))}

              {filteredEvents.length === 0 && (
                <tr>
                  <td colSpan="7" className="sam-empty">
                    No matching events found.
                  </td>
                </tr>
              )}

            </tbody>

          </table>
        )}

        {/* PAGINATION */}

        <div className="sam-pagination">

          <button
            disabled={page === 0 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>

          <span>
            Page {totalPages ? page + 1 : 0} of {totalPages}
          </span>

          <button
            disabled={page + 1 >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>

        </div>

      </div>

      {/* EVENT DETAILS MODAL */}

      {selectedEvent && (
        <div className="sam-modal-backdrop">

          <div className="sam-modal">

            <div className="sam-modal-header">
              <h2>Event Details</h2>

              <button
                onClick={() => setSelectedEvent(null)}
              >
                ✕
              </button>
            </div>

            <p>
              <strong>Event:</strong>{" "}
              {selectedEvent.eventType}
            </p>

            <p>
              <strong>Category:</strong>{" "}
              {selectedEvent.eventCategory}
            </p>

            <p>
              <strong>Severity:</strong>{" "}
              {selectedEvent.severity}
            </p>

            <p>
              <strong>Timestamp:</strong>{" "}
              {formatDate(selectedEvent.timestamp)}
            </p>

            <p>
              <strong>Process ID:</strong>{" "}
              {selectedEvent.processId || "N/A"}
            </p>

            <p>
              <strong>File path:</strong>{" "}
              {selectedEvent.filePath || "N/A"}
            </p>

            <p>
              <strong>Source IP:</strong>{" "}
              {selectedEvent.sourceIp || "N/A"}
            </p>

            <p>
              <strong>Destination IP:</strong>{" "}
              {selectedEvent.destinationIp || "N/A"}
            </p>

            <p>
              <strong>Domain:</strong>{" "}
              {selectedEvent.domain || "N/A"}
            </p>

            <h3>Additional Details</h3>

            <pre className="sam-json">
              {getDetails(selectedEvent.detailsJson)}
            </pre>

          </div>
        </div>
      )}

    </div>
  );
}

export default SystemActivityPage;
