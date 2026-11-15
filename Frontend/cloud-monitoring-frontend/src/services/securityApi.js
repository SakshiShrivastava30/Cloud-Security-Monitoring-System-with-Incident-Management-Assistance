
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function getToken() {
  return (
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("jwtToken") ||
    localStorage.getItem("token") ||
    ""
  );
}

async function apiRequest(endpoint, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    throw new Error(
      data.error || data.message || `HTTP ${response.status}`
    );
  }

  return data;
}

export const securityApi = {
  
  // ALERTS
  

  getAlerts: (status = "") =>
    apiRequest(
      `/api/alerts?page=0&size=100${
        status ? `&status=${status}` : ""
      }`
    ),

  acknowledgeAlert: (id) =>
    apiRequest(`/api/alerts/${id}/acknowledge`, {
      method: "PATCH",
    }),

  resolveAlert: (id) =>
    apiRequest(`/api/alerts/${id}/resolve`, {
      method: "PATCH",
    }),

  createIncidentFromAlert: (alertId) =>
    apiRequest(`/api/incidents/from-alert/${alertId}`, {
      method: "POST",
    }),

  
  // INCIDENT MANAGEMENT
  

  getIncidents: (status = "") =>
    apiRequest(
      `/api/incidents?page=0&size=100${
        status ? `&status=${status}` : ""
      }`
    ),

  createIncident: (incident) =>
    apiRequest("/api/incidents", {
      method: "POST",
      body: JSON.stringify(incident),
    }),

  assignIncident: (id, assignedToUserId) =>
    apiRequest(`/api/incidents/${id}/assign`, {
      method: "PATCH",
      body: JSON.stringify({
        assignedToUserId: Number(assignedToUserId),
      }),
    }),

  updateIncidentStatus: (id, status) =>
    apiRequest(`/api/incidents/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  resolveIncident: (id, resolutionNotes) =>
    apiRequest(`/api/incidents/${id}/resolve`, {
      method: "PATCH",
      body: JSON.stringify({ resolutionNotes }),
    }),

  
  // HONEYPOT / MONITORING EVENTS
  

  getMonitoringEvents: (page = 0, size = 50, options = {}) =>
    apiRequest(
      `/api/monitor/events?page=${page}&size=${size}`,
      {
        method: "GET",
        ...options,
      }
    ),
};
