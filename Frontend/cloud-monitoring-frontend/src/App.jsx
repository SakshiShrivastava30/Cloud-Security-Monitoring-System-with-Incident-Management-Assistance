
import AuthPage from "./AuthPage";
import AssetInventoryPage from "./pages/AssetInventoryPage";
import { useState, useEffect } from "react";
import "./App.css";

const modules = [
  ["♟", "User & Team Management", "blue"],
  ["◎", "Threat Intelligence", "blue"],
  ["⚠", "Incident Management", "red"],
  ["⚡", "Alert Engine", "cyan"],
  ["⬡", "Vulnerability Scanner", "red"],
  ["▣", "Asset Inventory", "orange"],
  ["▤", "Log Management (SIEM)", "purple"],
  ["▧", "Playbook Automation", "cyan"],
  ["⬡", "Compliance Manager", "cyan"],
  ["▦", "Audit Trail", "purple"],
  ["▤", "Report Generator", "purple"],
  ["▧", "Notification Service", "cyan"],
  ["▤", "Risk Scoring Engine", "orange"],
  ["⬡", "Knowledge Base", "red"],
  ["⚙", "Settings & Configuration", "purple"],
  ["◈", "Incident Assistance", "cyan"],
];

const initialIncidents = [
  { id: "INC-001", title: "Unauthorized Access Attempt", severity: "Critical", status: "Open", asset: "AWS EC2", owner: "Priya Singh", time: "10 min ago" },
  { id: "INC-002", title: "Suspicious API Activity", severity: "High", status: "In Progress", asset: "Azure App", owner: "Rahul Mehta", time: "45 min ago" },
  { id: "INC-003", title: "Malware Detected", severity: "High", status: "Open", asset: "GCP VM", owner: "Anita Verma", time: "1 hour ago" },
  { id: "INC-004", title: "Unusual Network Traffic", severity: "Medium", status: "Investigating", asset: "AWS S3", owner: "Vikram Rao", time: "2 hours ago" },
  { id: "INC-005", title: "Policy Compliance Violation", severity: "Medium", status: "Resolved", asset: "Azure DB", owner: "Neha Kapoor", time: "3 hours ago" },
];

const feed = [
  ["red", "Suspicious API activity detected", "From IP 192.168.1.45", "2 min ago"],
  ["orange", "Unauthorized access attempt", "on AWS EC2 instance", "5 min ago"],
  ["red", "High severity vulnerability found", "in payment-service", "12 min ago"],
  ["green", "New user login", "User account activity", "18 min ago"],
  ["orange", "Compliance policy violated", "Data encryption disabled", "25 min ago"],
];

function Panel({ title, action, children, className = "" }) {
  return (
    <section className={`cm-panel ${className}`}>
      <div className="cm-panel-heading">
        <h3>{title}</h3>
        {action && (
          <button
            className="cm-text-button"
            onClick={() => alert(`${title} workspace selected`)}
          >
            {action} →
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function MiniChart() {
  const series = [
    { color: "#ff4149", points: "0,112 25,105 50,100 75,88 100,83 125,67 150,80 175,91 200,72 225,50 250,12 275,2 300,24 325,48 350,39 375,53 400,70 425,76 450,66 475,78 500,91 525,82 550,93" },
    { color: "#ffbd13", points: "0,124 25,121 50,117 75,112 100,114 125,106 150,119 175,114 200,102 225,106 250,96 275,100 300,111 325,119 350,113 375,115 400,108 425,114 450,120 475,114 500,118 525,111 550,117" },
    { color: "#129bff", points: "0,142 25,139 50,142 75,136 100,141 125,134 150,140 175,138 200,144 225,135 250,125 275,130 300,139 325,143 350,135 375,141 400,136 425,142 450,140 475,145 500,138 525,142 550,138" },
  ];

  return (
    <svg viewBox="0 0 550 190" className="cm-chart" role="img" aria-label="Sample security threat activity">
      {[20, 50, 80, 110, 140, 170].map((y) => (
        <line key={y} x1="0" y1={y} x2="550" y2={y} stroke="#123149" strokeWidth="1" />
      ))}
      {[0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550].map((x) => (
        <line key={x} x1={x} y1="15" x2={x} y2="170" stroke="#102b41" strokeWidth="1" />
      ))}
      {series.map((line) => (
        <polyline
          key={line.color}
          points={line.points}
          transform="translate(0 18)"
          fill="none"
          stroke={line.color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "24:00"].map((time, i) => (
        <text key={time} x={i * 91} y="187" fill="#91a9c4" fontSize="10">
          {time}
        </text>
      ))}
    </svg>
  );
}

function SeverityChart() {
  const legend = [
    ["#ff343c", "Critical", "4 (14%)"],
    ["#ff8a00", "High", "8 (29%)"],
    ["#ffd21a", "Medium", "10 (36%)"],
    ["#168dff", "Low", "6 (21%)"],
  ];

  return (
    <div className="cm-severity-content">
      <div className="cm-donut">
        <div>
          <strong>28</strong>
          <span>Total</span>
        </div>
      </div>
      <div className="cm-legend">
        {legend.map(([color, label, value]) => (
          <div className="cm-legend-row" key={label}>
            <i style={{ background: color }} />
            <span>{label}</span>
            <b>{value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(sessionStorage.getItem("token"))
  );

  const [activeModule, setActiveModule] = useState("Dashboard / Overview");

  const [role, setRole] = useState(() => {
    const token = sessionStorage.getItem("token");
    if (!token) return "Viewer";

    try {
      const payload = JSON.parse(
        atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
      );

      const tokenRole = String(payload.role || "VIEWER").toUpperCase();

      return tokenRole === "ADMIN"
        ? "Admin"
        : tokenRole === "ANALYST"
          ? "Analyst"
          : "Viewer";
    } catch {
      return "Viewer";
    }
  });

  const [range, setRange] = useState("Last 24 Hours");
  const [incidents, setIncidents] = useState(initialIncidents);
  const [dashboardAssets, setDashboardAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState("");

  // Load real asset data from the existing Asset Inventory API.
  useEffect(() => {
    if (!isAuthenticated) return;

    const controller = new AbortController();

    const loadDashboardAssets = async () => {
      try {
        setAssetsLoading(true);
        setAssetsError("");

        const token = sessionStorage.getItem("token");
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL || "http://localhost:8080"}/api/assets`,
          {
            headers: token
              ? { Authorization: `Bearer ${token}` }
              : {},
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`Asset API returned ${response.status}`);
        }

        const data = await response.json();
        setDashboardAssets(Array.isArray(data) ? data : []);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Dashboard asset loading failed:", error);
          setAssetsError(error.message || "Unable to load assets");
        }
      } finally {
        if (!controller.signal.aborted) {
          setAssetsLoading(false);
        }
      }
    };

    loadDashboardAssets();

    return () => controller.abort();
  }, [isAuthenticated]);

  const totalAssets = dashboardAssets.length;
  const totalVulnerabilities = dashboardAssets.reduce(
    (total, asset) => total + (Number(asset.vulnerabilities) || 0),
    0
  );
  const criticalAssets = dashboardAssets.filter(
    (asset) =>
      String(asset.criticality || "").toLowerCase() === "critical" ||
      Number(asset.riskScore) >= 85
  ).length;

  const providerDefinitions = [
    { name: "AWS", logo: "aws", color: "#00d6a0" },
    { name: "Azure", logo: "Azure", color: "#168dff" },
    { name: "Google Cloud", logo: "🌈", color: "#ffc21b" },
  ];

  const providers = providerDefinitions.map((provider) => {
    const providerAssets = dashboardAssets.filter((asset) => {
      const value = String(asset.provider || "").toLowerCase();
      if (provider.name === "Google Cloud") {
        return value === "gcp" || value === "google cloud" || value === "google";
      }
      return value === provider.name.toLowerCase();
    });

    const averageRisk = providerAssets.length
      ? providerAssets.reduce(
          (sum, asset) => sum + (Number(asset.riskScore) || 0),
          0
        ) / providerAssets.length
      : 0;

    const score = providerAssets.length
      ? Math.max(0, Math.round(100 - averageRisk))
      : 0;

    return {
      ...provider,
      count: providerAssets.length,
      score,
      status:
        providerAssets.length === 0
          ? "No assets"
          : score >= 75
            ? "Healthy"
            : score >= 50
              ? "Degraded"
              : "At Risk",
    };
  });

  const riskyAssets = [...dashboardAssets]
    .sort((a, b) => (Number(b.riskScore) || 0) - (Number(a.riskScore) || 0))
    .slice(0, 5);
  const [search, setSearch] = useState("");
  const [notifications, setNotifications] = useState(3);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAuthenticated = (token) => {
    try {
      const payload = JSON.parse(
        atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
      );

      const tokenRole = String(payload.role || "VIEWER").toUpperCase();

      setRole(
        tokenRole === "ADMIN"
          ? "Admin"
          : tokenRole === "ANALYST"
            ? "Analyst"
            : "Viewer"
      );
    } catch {
      setRole("Viewer");
    }

    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    setIsAuthenticated(false);
    setActiveModule("Dashboard / Overview");
    setSearch("");
  };

  if (!isAuthenticated) {
    return <AuthPage onAuthenticated={handleAuthenticated} />;
  }

  const filteredIncidents = incidents.filter((incident) =>
    `${incident.id} ${incident.title} ${incident.asset} ${incident.owner}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const createIncident = () => {
    const newIncident = {
      id: `INC-${String(incidents.length + 1).padStart(3, "0")}`,
      title: "New security incident",
      severity: "Medium",
      status: "Open",
      asset: "Pending review",
      owner: "Unassigned",
      time: "Just now",
    };

    setIncidents((previous) => [newIncident, ...previous]);
    setActiveModule("Incident Management");
  };

  const getAssistance = (incident) => {
    alert(
      `Incident Assistance: ${incident.id}\n\nSuggested Actions:\n1. Validate the incident evidence.\n2. Review affected cloud assets and access logs.\n3. Follow the response playbook.\n\nDemo guidance only; no automated remediation was performed.`
    );
  };

  const openModule = (name) => {
    setActiveModule(name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="cm-app">
      <style>{`
        .cm-app{--bg:#00101d;--panel:#041a2b;--border:#10344d;--muted:#9bb3cc;--cyan:#08d6f5;min-height:100vh;background:var(--bg);color:#f2f7ff;font:13px Inter,Segoe UI,Arial,sans-serif}
        .cm-app *{box-sizing:border-box}
        .cm-app button,.cm-app input,.cm-app select{font:inherit}
        .cm-app button{cursor:pointer}

        .cm-topbar{min-height:68px;position:sticky;top:0;z-index:5;background:#031526;border-bottom:1px solid #12334c;display:flex;align-items:center;gap:20px;padding:10px 22px}
        .cm-brand{display:flex;align-items:center;gap:10px;min-width:260px}
        .cm-brand-icon{font-size:36px;color:var(--cyan)}
        .cm-brand h2{margin:0;font-size:23px}
        .cm-brand h2 span{color:var(--cyan)}
        .cm-brand small{display:block;font-size:10px;color:#b5c8de;margin-top:3px}

        .cm-search{flex:1;max-width:620px;display:flex;align-items:center;gap:10px;border:1px solid #194365;border-radius:9px;padding:9px 13px;background:#071e33;color:#a8c1dc}
        .cm-search input{background:transparent;border:0;outline:0;color:white;width:100%;min-width:0}
        .cm-search kbd{white-space:nowrap;color:#c4d7ed;background:#173653;padding:4px 7px;border-radius:4px;font-size:10px}

        .cm-top-actions{margin-left:auto;display:flex;align-items:center;gap:15px}
        .cm-select{background:#071f34;border:1px solid #174564;color:#e5f5ff;padding:10px;border-radius:7px;max-width:150px}
        .cm-icon-btn{background:transparent;color:#d8eaff;border:0;font-size:20px;position:relative}
        .cm-notice{position:absolute;right:-5px;top:-5px;background:#ff343c;border-radius:50%;font-size:10px;padding:3px 6px}
        .cm-user{display:flex;align-items:center;gap:9px;border-left:1px solid #183750;padding-left:15px}
        .cm-avatar{width:39px;height:39px;display:grid;place-items:center;border-radius:50%;background:#0769ff;font-size:19px;font-weight:700}

        .cm-body{display:grid;grid-template-columns:250px minmax(0,1fr);min-height:calc(100vh - 68px)}

        /* Sidebar */
        .cm-sidebar{background:#031526;border-right:1px solid #12334a;padding:10px 9px 12px;display:flex;flex-direction:column;gap:6px;min-width:0;height:calc(100vh - 68px);position:sticky;top:68px;overflow:hidden}
        .cm-sidebar-menu{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:3px}
        .cm-sidebar-menu::-webkit-scrollbar{width:5px}
        .cm-sidebar-menu::-webkit-scrollbar-thumb{background:#24516d;border-radius:10px}
        .cm-nav{width:100%;border:0;background:transparent;color:#e0ebfa;display:flex;align-items:center;text-align:left;gap:10px;padding:7px 8px;border-radius:7px;min-height:38px;flex-shrink:0}
        .cm-nav:hover,.cm-nav.active{background:#092941}
        .cm-nav.active{box-shadow:inset 3px 0 var(--cyan)}
        .cm-nav-icon{width:27px;height:27px;border-radius:6px;display:grid;place-items:center;font-size:15px;background:#0a3450;color:#42dcf6;flex-shrink:0}
        .cm-nav-name{flex:1;font-size:12px}
        .cm-nav-count{background:#ff303d;color:white;border-radius:50%;padding:4px 7px;font-size:10px}
        .cm-sidebar-foot{flex-shrink:0;border:1px solid #17415c;background:#041a2c;padding:9px;border-radius:9px;line-height:1.6;color:#d9ebff;font-size:11px}
        .cm-logout-nav{flex-shrink:0;margin-top:4px;color:#ff9298;border:1px solid #542630;background:#251522}
        .cm-logout-nav .cm-nav-icon{background:#4a202b;color:#ff9298}
        .cm-logout-nav:hover{background:#3a1d28;border-color:#a94351}

        .cm-main{min-width:0;padding:12px 17px 25px;overflow:hidden}
        .cm-welcome{display:flex;justify-content:space-between;align-items:center;gap:15px;min-height:100px;padding:16px 22px;border:1px solid #123c60;border-radius:10px;background:radial-gradient(ellipse at 75% 45%,#163a84 0%,#0b2146 30%,#07182d 65%);margin-bottom:12px}
        .cm-welcome h1{font-size:27px;margin:0 0 7px}
        .cm-welcome p{margin:0;color:#b5d9f9;font-size:15px}
        .cm-date{border:1px solid #214c77;background:#05172b;border-radius:8px;padding:12px;line-height:1.6;white-space:nowrap}

        .cm-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}
        .cm-tabs{display:flex;gap:4px;padding:4px;background:#061a2b;border:1px solid #12374f;border-radius:8px}
        .cm-tab{padding:9px 18px;background:transparent;border:0;color:#d5e7fb;border-radius:6px}
        .cm-tab.active{background:#05334d;color:var(--cyan);box-shadow:inset 0 0 0 1px #078eb4}

        .cm-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:12px}
        .cm-metric{border:1px solid var(--border);background:linear-gradient(135deg,#061c2e,#031523);padding:14px;border-radius:9px;min-width:0}
        .cm-metric-top{display:flex;gap:8px;align-items:center}
        .cm-metric-icon{width:44px;height:44px;display:grid;place-items:center;font-size:22px;border-radius:10px;background:#07334b;color:var(--cyan);flex-shrink:0}
        .cm-metric-label{font-size:12px;color:#dce9f9}
        .cm-metric-value{font-size:28px;font-weight:750;margin-top:3px;white-space:nowrap}
        .cm-trend{color:#00ddb1;font-size:12px;margin-left:8px}
        .cm-sub{font-size:10px;color:#a7bdd5;margin-top:6px}

        .cm-grid-top{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:12px;margin-bottom:12px}
        .cm-grid-bottom{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:12px;margin-bottom:12px}
        .cm-panel{min-width:0;border:1px solid var(--border);border-radius:9px;background:linear-gradient(135deg,#041a2b,#021321);padding:13px}
        .cm-panel-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}
        .cm-panel-heading h3{font-size:14px;margin:0}
        .cm-text-button{background:transparent;border:0;color:var(--cyan);white-space:nowrap;font-size:11px}
        .cm-chart-legend{display:flex;justify-content:flex-end;gap:12px;font-size:10px;color:#d3e3f4;margin-bottom:4px}
        .cm-chart-legend i,.cm-legend-row i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px}
        .cm-chart{width:100%;display:block}
        .cm-severity-content{display:flex;align-items:center;justify-content:space-around;gap:10px;min-height:175px}
        .cm-donut{width:150px;height:150px;flex-shrink:0;border-radius:50%;background:conic-gradient(#ff343c 0 14%,#ff8a00 14% 43%,#ffd21a 43% 79%,#168dff 79% 100%);display:grid;place-items:center}
        .cm-donut>div{width:94px;height:94px;background:#041929;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-direction:column}
        .cm-donut strong{font-size:24px}
        .cm-donut span{font-size:11px}
        .cm-legend{display:grid;gap:14px;min-width:105px}
        .cm-legend-row{display:flex;align-items:center;gap:4px;font-size:10px}
        .cm-legend-row span{flex:1}
        .cm-legend-row b{font-weight:500}

        .cm-feed-item{display:grid;grid-template-columns:13px 1fr auto;gap:9px;padding:10px 0;border-bottom:1px solid #0d3046;align-items:start}
        .cm-feed-item:last-child{border:0}
        .cm-feed-dot{width:12px;height:12px;border-radius:50%;margin-top:3px;box-shadow:0 0 10px currentColor}
        .cm-feed-item p{margin:0;font-size:11px;line-height:1.5}
        .cm-feed-item small{color:#9ab1ca;font-size:10px;display:block;margin-top:3px}
        .cm-feed-time{font-size:10px;color:#9ab1ca;white-space:nowrap}

        .cm-provider-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
        .cm-provider{background:#061d30;border:1px solid #103650;border-radius:8px;padding:11px;min-width:0}
        .cm-provider-name{font-size:12px;font-weight:700;margin:7px 0}
        .cm-provider-count{font-size:10px;color:#a4bed7}
        .cm-provider-score{font-size:15px;font-weight:700;margin:12px 0 7px}
        .cm-progress{height:9px;border-radius:10px;background:#12324b;overflow:hidden}
        .cm-progress span{height:100%;display:block;border-radius:10px}
        .cm-provider-status{font-size:10px;margin-top:10px}

        .cm-table-wrap{overflow-x:auto}
        .cm-table{border-collapse:collapse;width:100%;font-size:10px;white-space:nowrap}
        .cm-table th{text-align:left;background:#09243b;color:#bcd1e7;font-weight:500;padding:9px 7px}
        .cm-table td{padding:8px 7px;border-bottom:1px solid #102c41}
        .cm-pill{border-radius:5px;padding:4px 7px;background:#10334c;display:inline-block;font-size:10px}
        .cm-pill.Critical{background:#541d27;color:#ff9298}
        .cm-pill.High{background:#55301b;color:#ffc17b}
        .cm-pill.Medium{background:#4b401c;color:#ffe087}
        .cm-pill.Low{background:#0a3d6e;color:#9bd2ff}
        .cm-pill.Open{background:#541d27;color:#ff9298}
        .cm-pill.Resolved{background:#064638;color:#70f1ca}
        .cm-pill.InProgress{background:#073d66;color:#87d8ff}

        .cm-quick-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
        .cm-quick{border:1px solid #15415c;background:#061d30;color:#eaf5ff;border-radius:7px;min-height:60px;padding:9px 4px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:5px;font-size:10px}
        .cm-quick span{font-size:19px;color:var(--cyan)}
        .cm-quick:hover{border-color:var(--cyan);background:#092940}

        .cm-bottom-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:12px}
        .cm-assist-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:12px}
        .cm-assist-card{display:flex;gap:8px;align-items:flex-start;text-align:left;border:1px solid #12415e;background:#051e32;color:#f2f7ff;padding:11px;border-radius:8px;min-width:0}
        .cm-assist-card>span{font-size:20px;color:var(--cyan)}
        .cm-assist-card strong{font-size:10px;display:block;margin-bottom:5px}
        .cm-assist-card small{font-size:10px;line-height:1.4;color:#a6bfd7;display:block}
        .cm-assist-card:hover{border-color:#00cbe9}
        .cm-assist-list{border:1px solid #11364e;border-radius:7px;overflow:hidden}
        .cm-assist-list-head{display:flex;justify-content:space-between;padding:9px;background:#08243a;font-weight:600;font-size:11px;gap:8px}
        .cm-assist-row{display:grid;grid-template-columns:58px minmax(0,1fr) 70px 85px;align-items:center;gap:7px;padding:8px;border-top:1px solid #103047;font-size:10px}
        .cm-small-btn{background:#07385d;border:1px solid #0c6591;color:#e3f5ff;border-radius:5px;padding:6px;font-size:10px;white-space:nowrap}
        .cm-empty{padding:28px 10px;text-align:center;color:#9bb3cc}

        .cm-module-page{padding:22px 5px}
        .cm-module-page h1{font-size:25px}
        .cm-module-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:20px}
        .cm-module-cards article{padding:20px;border:1px solid var(--border);border-radius:9px;background:#041a2b}
        .cm-module-cards h3{font-size:14px}
        .cm-module-cards p{font-size:12px;line-height:1.7;color:var(--muted)}
        .cm-footer{text-align:center;color:#6888a7;font-size:10px;padding:20px}

        @media(max-width:1300px){
          .cm-body{grid-template-columns:230px minmax(0,1fr)}
          .cm-brand{min-width:210px}
          .cm-grid-top{grid-template-columns:1.3fr 1fr}
          .cm-feed-panel{grid-column:1/-1}
          .cm-feed-panel .cm-feed-list{display:grid;grid-template-columns:1fr 1fr;column-gap:20px}
          .cm-grid-bottom{grid-template-columns:1fr 1fr}
          .cm-risk-panel{grid-column:1/-1}
          .cm-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}
        }

        @media(max-width:800px){
          .cm-topbar{height:auto;flex-wrap:wrap}
          .cm-brand{min-width:0}
          .cm-search{order:3;flex-basis:100%;max-width:none}
          .cm-body{grid-template-columns:1fr}
          .cm-sidebar{position:relative;top:0;height:auto;overflow:visible}
          .cm-sidebar-menu{max-height:350px}
          .cm-sidebar-foot{margin-top:8px}
          .cm-grid-top,.cm-grid-bottom,.cm-bottom-grid{grid-template-columns:1fr}
          .cm-feed-panel,.cm-risk-panel{grid-column:auto}
          .cm-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}
          .cm-welcome{align-items:flex-start;flex-direction:column}
          .cm-date{white-space:normal}
          .cm-assist-cards{grid-template-columns:1fr}
          .cm-module-cards{grid-template-columns:1fr}
          .cm-main{padding:10px}
          .cm-provider-grid{grid-template-columns:1fr}
          .cm-assist-row{grid-template-columns:55px minmax(0,1fr) 65px}
          .cm-assist-row .cm-small-btn{grid-column:2/-1}
          .cm-feed-panel .cm-feed-list{display:block}
        }
      `}</style>

      {/* TOP NAVIGATION */}
      <header className="cm-topbar">
        <div className="cm-brand">
          <div className="cm-brand-icon">☁</div>
          <div>
            <h2>Cloud<span>Monitor</span></h2>
            <small>Cloud Security Monitoring System</small>
          </div>
        </div>

        <label className="cm-search">
          <span>⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets, incidents, logs, playbooks..."
          />
          <kbd>Ctrl + K</kbd>
        </label>

        <div className="cm-top-actions">
          <select className="cm-select" aria-label="Environment">
            <option>☁ Production</option>
            <option>Staging</option>
            <option>Development</option>
          </select>

          <button
            className="cm-icon-btn"
            onClick={() => setNotifications(0)}
            aria-label="Clear notifications"
          >
            ♧
            {notifications > 0 && <span className="cm-notice">{notifications}</span>}
          </button>

          <div className="cm-user">
            <div className="cm-avatar">S</div>
            <div>
              <b>Sakshi</b>
              <br />
              <span style={{ color: "#b6cce5" }}>{role.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="cm-body">

        {/* UPDATED SIDEBAR */}
        <aside className="cm-sidebar">
          <div className="cm-sidebar-menu">

            <button
              className={`cm-nav ${activeModule === "Dashboard / Overview" ? "active" : ""}`}
              onClick={() => openModule("Dashboard / Overview")}
            >
              <span className="cm-nav-icon">⌂</span>
              <span className="cm-nav-name">Dashboard Overview</span>
            </button>

            {modules.map(([icon, name, color]) => (
              <button
                key={name}
                className={`cm-nav ${activeModule === name ? "active" : ""}`}
                onClick={() => openModule(name)}
              >
                <span
                  className="cm-nav-icon"
                  style={{
                    color:
                      color === "red"
                        ? "#ff5d66"
                        : color === "orange"
                          ? "#ffb64d"
                          : color === "purple"
                            ? "#ba8bff"
                            : "#46d8f4",
                  }}
                >
                  {icon}
                </span>

                <span className="cm-nav-name">{name}</span>

                {name === "Incident Management" && (
                  <span className="cm-nav-count">
                    {incidents.filter((i) => i.status !== "Resolved").length + 3}
                  </span>
                )}

                {name === "Alert Engine" && (
                  <span className="cm-nav-count">3</span>
                )}
              </button>
            ))}

          </div>

          <div className="cm-sidebar-foot">
            🛡️ &nbsp; Secure Clouds
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Safer Tomorrows
          </div>

          <button
            className="cm-nav cm-logout-nav"
            type="button"
            onClick={handleLogout}
            title="Sign out of CloudMonitor"
          >
            <span className="cm-nav-icon">⇥</span>
            <span className="cm-nav-name">Logout</span>
          </button>
        </aside>

        {/* DASHBOARD CONTENT */}
        <main className="cm-main">
          {activeModule === "Dashboard / Overview" ? (
            <>
              <section className="cm-welcome">
                <div>
                  <h1>Cloud Security Overview</h1>
                  <p>
                    Monitor your cloud infrastructure, security posture, and active threats.
                  </p>
                </div>

                

                <div className="cm-date">
                  <div>
                    ▦ &nbsp;
                    {now.toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>

                  <div style={{ fontSize: 20, fontWeight: 700, marginTop: 5 }}>
                    {now.toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: true,
                    })}
                  </div>

                  <div style={{ fontSize: 10, color: "#8eb5d7", marginTop: 4 }}>
                    Local Time
                  </div>
                </div>
              </section>

              <div className="cm-toolbar">
                <span style={{ color: "#8aa9c6", fontSize: 11 }}>
                  SECURITY COMMAND CENTER
                </span>

                <div className="cm-tabs">
                  {["Admin", "Analyst", "Viewer"].map((item) => (
                    <button
                      key={item}
                      className={`cm-tab ${role === item ? "active" : ""}`}
                      onClick={() => setRole(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <select
                  className="cm-select"
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                >
                  <option>Last 24 Hours</option>
                  <option>Last 7 Days</option>
                  <option>Last 30 Days</option>
                </select>
              </div>

              {/* METRIC CARDS */}
              <section className="cm-metrics">
                {[
                  ["⬡", "Cloud Assets", assetsLoading ? "…" : String(totalAssets), "", assetsError ? "Asset API unavailable" : "Live data from Asset Inventory", "#04d9f5"],
                  ["⚠", "Open Incidents", String(incidents.filter((i) => i.status !== "Resolved").length + 3), "Demo", "Incident API not integrated yet", "#ff4c4c"],
                  ["⬡", "Vulnerabilities", assetsLoading ? "…" : String(totalVulnerabilities), "", "Total vulnerabilities across registered assets", "#f5428a"],
                  ["▤", "Critical Assets", assetsLoading ? "…" : String(criticalAssets), "", "Critical classification or risk score ≥ 85", "#00dfaa"],
                  ["♟", "Active Users", "—", "Not connected", "User metrics API not integrated yet", "#159bff"],
                ].map(([icon, label, value, trend, detail, color]) => (
                  <article className="cm-metric" key={label}>
                    <div className="cm-metric-top">
                      <span className="cm-metric-icon" style={{ color }}>{icon}</span>
                      <span className="cm-metric-label">{label}</span>
                    </div>
                    <div className="cm-metric-value">
                      {value}<span className="cm-trend">{trend}</span>
                    </div>
                    <div className="cm-sub">{detail}</div>
                  </article>
                ))}
              </section>

              {/* CHARTS AND FEED */}
              <div className="cm-grid-top">
                <Panel title="Security Threat Activity">
                  <div className="cm-chart-legend">
                    <span><i style={{ background: "#ff4149" }} />Critical</span>
                    <span><i style={{ background: "#ff8a00" }} />High</span>
                    <span><i style={{ background: "#ffd21a" }} />Medium</span>
                    <span><i style={{ background: "#168dff" }} />Low</span>
                  </div>
                  <MiniChart />
                </Panel>

                <Panel title="Incidents by Severity">
                  <SeverityChart />
                </Panel>

                <Panel title="Live Security Feed" action="View All" className="cm-feed-panel">
                  <div className="cm-feed-list">
                    {feed.map(([color, title, detail, time]) => (
                      <div className="cm-feed-item" key={title}>
                        <span
                          className="cm-feed-dot"
                          style={{
                            background: color === "red" ? "#ff303c" : color === "orange" ? "#ff8b19" : "#00dfaa",
                            color: color === "red" ? "#ff303c" : color === "orange" ? "#ff8b19" : "#00dfaa",
                          }}
                        />
                        <div>
                          <p>{title}</p>
                          <small>{detail}</small>
                        </div>
                        <span className="cm-feed-time">{time}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              {/* CLOUD PROVIDERS, RISKY ASSETS AND QUICK ACTIONS */}
              <div className="cm-grid-bottom">
                <Panel title="Cloud Provider Status">
                  <div className="cm-provider-grid">
                    {providers.map((provider) => (
                      <article className="cm-provider" key={provider.name}>
                        <div style={{ fontSize: 22, fontWeight: 800 }}>
                          {provider.logo}
                        </div>
                        <div className="cm-provider-name">{provider.name}</div>
                        <div className="cm-provider-count">{provider.count} assets</div>
                        <div className="cm-provider-score">{provider.score}%</div>
                        <div className="cm-progress">
                          <span style={{ width: `${provider.score}%`, background: provider.color }} />
                        </div>
                        <div
                          className="cm-provider-status"
                          style={{ color: provider.status === "Healthy" ? "#00dfaa" : "#ffad17" }}
                        >
                          ● &nbsp;{provider.status}
                        </div>
                      </article>
                    ))}
                  </div>
                </Panel>

                <Panel title="Top Risky Assets" action="View All" className="cm-risk-panel">
                  <div className="cm-table-wrap">
                    <table className="cm-table">
                      <thead>
                        <tr>
                          <th>Asset Name</th>
                          <th>Risk Score</th>
                          <th>Provider</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {riskyAssets.map((asset) => {
                          const score = Number(asset.riskScore) || 0;
                          const status =
                            score >= 85 ? "Critical" :
                            score >= 70 ? "High" :
                            score >= 40 ? "Medium" : "Low";

                          return (
                            <tr key={asset.id}>
                              <td>{asset.name || asset.id}</td>
                              <td><span className={`cm-pill ${status}`}>{score}</span></td>
                              <td>{asset.provider || "—"}</td>
                              <td><span className={`cm-pill ${status}`}>{status}</span></td>
                            </tr>
                          );
                        })}
                        {riskyAssets.length === 0 && (
                          <tr>
                            <td colSpan="4" className="cm-empty">
                              {assetsLoading ? "Loading assets..." : "No asset data available"}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Panel>

                <Panel title="Quick Actions" action="Customize">
                  <div className="cm-quick-grid">
                    {[
                      ["⚠", "Create Incident", createIncident],
                      ["⬡", "Run Scan", () => alert("Demo: scan request prepared. Connect the backend scan API to execute it.")],
                      ["▶", "Execute Playbook", () => openModule("Playbook Automation")],
                      ["▤", "Generate Report", () => openModule("Report Generator")],
                      ["⬡", "Add Asset", () => openModule("Asset Inventory")],
                      ["♟", "Manage Users", () => openModule("User & Team Management")],
                    ].map(([icon, label, action]) => (
                      <button key={label} className="cm-quick" onClick={action}>
                        <span>{icon}</span>
                        {label}
                      </button>
                    ))}
                  </div>
                </Panel>
              </div>

              {/* RECENT INCIDENTS AND ASSISTANCE */}
              <div className="cm-bottom-grid">
                <Panel title="Recent Incidents" action="View All">
                  <div className="cm-table-wrap">
                    <table className="cm-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Title</th>
                          <th>Severity</th>
                          <th>Status</th>
                          <th>Affected Asset</th>
                          <th>Assigned To</th>
                          <th>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredIncidents.map((incident) => (
                          <tr key={incident.id}>
                            <td>{incident.id}</td>
                            <td>{incident.title}</td>
                            <td>
                              <span className={`cm-pill ${incident.severity}`}>
                                ✦ {incident.severity}
                              </span>
                            </td>
                            <td>
                              <span className={`cm-pill ${incident.status.replace(" ", "")}`}>
                                {incident.status}
                              </span>
                            </td>
                            <td>{incident.asset}</td>
                            <td>{incident.owner}</td>
                            <td>{incident.time}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {filteredIncidents.length === 0 && (
                      <div className="cm-empty">No incidents match your search.</div>
                    )}
                  </div>
                </Panel>

                <Panel title="Incident Management Assistance" action="View">
                  <div className="cm-assist-cards">
                    <button
                      className="cm-assist-card"
                      onClick={() => alert("Suggested Actions: Validate evidence, check related logs, contain the affected asset, then document the result.")}
                    >
                      <span>💡</span>
                      <div>
                        <strong>Suggested Actions</strong>
                        <small>AI-powered recommendations</small>
                      </div>
                    </button>

                    <button
                      className="cm-assist-card"
                      onClick={() => alert("Auto Investigation preview: correlate authentication events, cloud audit logs and affected assets. No automatic actions were executed.")}
                    >
                      <span>⌕</span>
                      <div>
                        <strong>Auto Investigation</strong>
                        <small>Correlates logs, alerts &amp; assets</small>
                      </div>
                    </button>

                    <button
                      className="cm-assist-card"
                      onClick={() => alert("Playbook Guidance: identify scope, preserve evidence, contain the threat, remediate, and verify recovery.")}
                    >
                      <span>▣</span>
                      <div>
                        <strong>Playbook Guidance</strong>
                        <small>Step-by-step remediation steps</small>
                      </div>
                    </button>
                  </div>

                  <div className="cm-assist-list">
                    <div className="cm-assist-list-head">
                      <span>Open Incidents Needing Assistance</span>
                      <span style={{ color: "#00d7f4" }}>
                        {incidents.filter((i) => i.status !== "Resolved").length} open
                      </span>
                    </div>

                    {incidents.filter((i) => i.status !== "Resolved").slice(0, 3).map((incident) => (
                      <div className="cm-assist-row" key={incident.id}>
                        <span>{incident.id}</span>
                        <span>{incident.title}</span>
                        <span className={`cm-pill ${incident.severity}`}>
                          {incident.severity}
                        </span>
                        <button
                          className="cm-small-btn"
                          onClick={() => getAssistance(incident)}
                        >
                          Get Assistance
                        </button>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              <div className="cm-footer">
                CloudMonitor · Asset metrics use live backend data; incident and activity panels are still demo data.
              </div>
            </>
          ) : activeModule === "Asset Inventory" ? (
            <AssetInventoryPage />
          ) : (
            <section className="cm-module-page">
              <div style={{ color: "#00d7f4", fontSize: 11, letterSpacing: 2 }}>
                CLOUD SECURITY OPERATIONS / MODULE
              </div>

              <h1>{activeModule}</h1>

              <p style={{ color: "#9bb3cc", lineHeight: 1.8 }}>
                Welcome to the {activeModule} workspace. This page is ready for its dedicated functionality and backend integration.
              </p>

              <div className="cm-module-cards">
                <article>
                  <h3>Module Overview</h3>
                  <p>
                    Review the current status, important metrics, and recent activity for {activeModule}.
                  </p>
                  <button
                    className="cm-small-btn"
                    onClick={() => setActiveModule("Dashboard / Overview")}
                  >
                    Return to Dashboard
                  </button>
                </article>

                <article>
                  <h3>Actions &amp; Operations</h3>
                  <p>
                    Use this workspace for authorized security operations. Real actions require connected APIs and permissions.
                  </p>
                  <button
                    className="cm-small-btn"
                    onClick={() => alert("This module action requires backend integration.")}
                  >
                    Open Actions
                  </button>
                </article>

                <article>
                  <h3>Recent Activity</h3>
                  <p>
                    Search, review, and investigate relevant events. Live data will appear after backend integration.
                  </p>
                  <button
                    className="cm-small-btn"
                    onClick={() => setActiveModule("Incident Management")}
                  >
                    View Incidents
                  </button>
                </article>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
