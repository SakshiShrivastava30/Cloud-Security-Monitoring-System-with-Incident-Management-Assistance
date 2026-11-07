
import { useState } from "react";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import DashboardStats from "./components/DashboardStats";
import DashboardCharts from "./components/DashboardCharts";
import IncidentSection from "./components/IncidentSection";
import AssetInventoryPage from "./pages/AssetInventoryPage";

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

function App() {
  const [activeModule, setActiveModule] = useState("Dashboard / Overview");
  const [search, setSearch] = useState("");
  const [notifications, setNotifications] = useState(3);
  const [incidents, setIncidents] = useState(initialIncidents);

  const [role] = useState(() => {
    const token = sessionStorage.getItem("token");

    if (!token) return "Viewer";

    try {
      const payload = JSON.parse(
        atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
      );

      const tokenRole = String(payload.role || "VIEWER").toUpperCase();

      if (tokenRole === "ADMIN") return "Admin";
      if (tokenRole === "ANALYST") return "Analyst";

      return "Viewer";
    } catch {
      return "Viewer";
    }
  });

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    window.location.reload();
  };

  return (
    <div className="cm-app">

      <Topbar
        search={search}
        setSearch={setSearch}
        role={role}
        notifications={notifications}
        setNotifications={setNotifications}
      />

      <div className="cm-body">

        <Sidebar
          activeModule={activeModule}
          onModuleChange={setActiveModule}
          incidents={incidents}
          onLogout={handleLogout}
        />

        <main className="cm-main">

          {activeModule === "Dashboard / Overview" && (
            <>
              <DashboardStats incidents={incidents} />

              <DashboardCharts />

              <IncidentSection incidents={incidents} />
            </>
          )}

          {activeModule === "Asset Inventory" && (
            <AssetInventoryPage />
          )}

          {activeModule !== "Dashboard / Overview" &&
            activeModule !== "Asset Inventory" && (
              <section className="cm-module-page">
                <h1>{activeModule}</h1>
                <p>Welcome to {activeModule} workspace.</p>
              </section>
            )}

        </main>
      </div>
    </div>
  );
}

export default App;
