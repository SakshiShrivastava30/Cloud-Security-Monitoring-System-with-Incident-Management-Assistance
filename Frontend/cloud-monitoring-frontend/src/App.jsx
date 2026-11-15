
import { useState } from "react";

import AuthPage from "./AuthPage";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";

import DashboardStats from "./components/DashboardStats";
import DashboardCharts from "./components/DashboardCharts";
import IncidentSection from "./components/IncidentSection";

import AssetInventoryPage from "./pages/AssetInventoryPage";
import Management from "./pages/Management";
import SystemActivityPage from "./pages/SystemActivityPage";

import AlertsPage from "./pages/AlertsPage";
import IncidentsPage from "./pages/IncidentsPage";
import HoneypotPage from "./pages/HoneypotPage";

import "./App.css";

const initialIncidents = [
  {
    id: "INC-001",
    title: "Unauthorized Access Attempt",
    severity: "Critical",
    status: "Open",
    asset: "AWS EC2",
    owner: "Priya Singh",
    time: "10 min ago",
  },
  {
    id: "INC-002",
    title: "Suspicious API Activity",
    severity: "High",
    status: "In Progress",
    asset: "Azure App",
    owner: "Rahul Mehta",
    time: "45 min ago",
  },
  {
    id: "INC-003",
    title: "Malware Detected",
    severity: "High",
    status: "Open",
    asset: "GCP VM",
    owner: "Anita Verma",
    time: "1 hour ago",
  },
];

function getUserRole(token) {
  if (!token) return "Viewer";

  try {
    const base64Payload = token
      .split(".")[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const payload = JSON.parse(atob(base64Payload));

    const tokenRole = String(
      payload.role || "VIEWER"
    )
      .toUpperCase()
      .replace(/^ROLE_/, "");

    if (tokenRole === "ADMIN") return "Admin";
    if (tokenRole === "ANALYST") return "Analyst";

    return "Viewer";
  } catch (error) {
    console.error("Unable to read JWT role:", error);
    return "Viewer";
  }
}

function App() {
  const [token, setToken] = useState(() =>
    sessionStorage.getItem("token")
  );

  const [activeModule, setActiveModule] = useState(
    "Dashboard / Overview"
  );

  const [search, setSearch] = useState("");
  const [notifications, setNotifications] = useState(3);

  const [incidents] = useState(initialIncidents);

  const handleAuthenticated = (jwtToken) => {
    if (!jwtToken) {
      console.error("JWT token not received.");
      return;
    }

    sessionStorage.setItem("token", jwtToken);
    setToken(jwtToken);
    setActiveModule("Dashboard / Overview");
  };

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    setToken(null);
    setActiveModule("Dashboard / Overview");
  };

  const handleOpenModule = (moduleName) => {
    setActiveModule(moduleName);
    setSearch("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleCreateIncident = () => {
    handleOpenModule("Incident Management");
  };

  const handleGetAssistance = (incident) => {
    console.log(
      "Selected incident for assistance:",
      incident
    );

    handleOpenModule("Incident Assistance");
  };

  if (!token) {
    return (
      <AuthPage
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  const role = getUserRole(token);

  const implementedModules = [
    "Dashboard / Overview",
    "Asset Inventory",
    "Alert Engine",
    "Incident Management",
    "Honeypot Monitoring",
    "User & Team Management",
    "System Activity Monitoring",
  ];

  return (
    <div className="cm-app">
      <Topbar
        search={search}
        setSearch={setSearch}
        role={role}
        notifications={notifications}
        setNotifications={setNotifications}
        onOpenModule={handleOpenModule}
      />

      <div className="cm-body">
        <Sidebar
          activeModule={activeModule}
          onModuleChange={handleOpenModule}
          onLogout={handleLogout}
          role={role}
        />

        <main className="cm-main">

          {/* DASHBOARD */}

          {activeModule === "Dashboard / Overview" && (
            <>
              <DashboardStats
                incidents={incidents}
                onOpenModule={handleOpenModule}
              />

              <DashboardCharts
                onOpenModule={handleOpenModule}
              />

              <IncidentSection
                incidents={incidents}
                search={search}
                onCreateIncident={handleCreateIncident}
                onOpenModule={handleOpenModule}
                onGetAssistance={handleGetAssistance}
              />
            </>
          )}

          {/* ASSET INVENTORY */}

          {activeModule === "Asset Inventory" && (
            <AssetInventoryPage />
          )}

          {/* ALERT ENGINE */}

          {activeModule === "Alert Engine" && (
            <AlertsPage />
          )}

          {/* INCIDENT MANAGEMENT */}

          {activeModule === "Incident Management" && (
            <IncidentsPage />
          )}

          {/* HONEYPOT MONITORING */}

          {activeModule === "Honeypot Monitoring" && (
            <HoneypotPage />
          )}

          {/* USER MANAGEMENT */}

          {activeModule === "User & Team Management" &&
            role === "Admin" && (
              <Management />
            )}

          {/* SYSTEM ACTIVITY MONITORING */}

          {activeModule === "System Activity Monitoring" && (
            <SystemActivityPage />
          )}

          {/* ADMIN RESTRICTION */}

          {activeModule === "User & Team Management" &&
            role !== "Admin" && (
              <section className="cm-module-page">
                <h1>Access Restricted</h1>
                <p>
                  You do not have permission to access
                  User & Team Management.
                </p>
              </section>
            )}

          {/* OTHER MODULES */}

          {!implementedModules.includes(activeModule) && (
            <section className="cm-module-page">
              <h1>{activeModule}</h1>

              <p>
                This module is not connected yet.
                Its functionality is still pending.
              </p>
            </section>
          )}

        </main>
      </div>
    </div>
  );
}

export default App;
