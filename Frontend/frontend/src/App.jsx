import { useState } from "react";
import {
  UserManagement,
  TeamManagement
} from "./pages/Management";

function App() {
  const [currentPage, setCurrentPage] = useState("users");

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>

      {/* Sidebar */}
      <aside
        style={{
          width: "230px",
          minHeight: "100vh",
          backgroundColor: "#111827",
          color: "white",
          padding: "24px 16px",
          boxSizing: "border-box",
          flexShrink: 0
        }}
      >
        <h2 style={{ fontSize: "19px", marginBottom: "32px" }}>
          Cloud Security
        </h2>

        <button
          style={{
            width: "100%",
            padding: "12px",
            textAlign: "left",
            border: "none",
            borderRadius: "6px",
            backgroundColor: "#2563eb",
            color: "white",
            fontSize: "15px",
            cursor: "pointer"
          }}
        >
          👥 User & Team Management
        </button>
      </aside>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          backgroundColor: "#f3f4f6"
        }}
      >

        {/* Page Tabs */}
        <div
          style={{
            display: "flex",
            gap: "15px",
            padding: "20px 32px 0"
          }}
        >
          <button
            onClick={() => setCurrentPage("users")}
            style={tabStyle(currentPage === "users")}
          >
            👤 User Management
          </button>

          <button
            onClick={() => setCurrentPage("teams")}
            style={tabStyle(currentPage === "teams")}
          >
            👥 Team Management
          </button>
        </div>

        {/* Display Selected Page */}
        {currentPage === "users" ? (
          <UserManagement />
        ) : (
          <TeamManagement />
        )}

      </main>
    </div>
  );
}

const tabStyle = (active) => ({
  padding: "12px 20px",
  border: "none",
  borderRadius: "7px",
  backgroundColor: active ? "#2563eb" : "#e5e7eb",
  color: active ? "white" : "#374151",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "600"
});

export default App;