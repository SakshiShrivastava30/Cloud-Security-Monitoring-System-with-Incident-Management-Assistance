
import { useEffect, useRef, useState } from "react";

const searchableModules = [
  {
    name: "Dashboard / Overview",
    keywords: ["dashboard", "overview", "home"],
  },
  {
    name: "Asset Inventory",
    keywords: ["asset", "inventory", "cloud resources"],
  },
  {
    name: "Alert Engine",
    keywords: ["alert", "alerts", "rules", "detection"],
  },
  {
    name: "Incident Management",
    keywords: ["incident", "response", "investigation"],
  },
  {
    name: "Honeypot Monitoring",
    keywords: ["honeypot", "trap", "attacker"],
  },
  {
    name: "User & Team Management",
    keywords: ["user", "team", "admin", "management"],
  },
  {
    name: "System Activity Monitoring",
    keywords: ["system", "activity", "monitoring", "events"],
  },
];

export default function Topbar({
  role,
  search,
  setSearch,
  notifications,
  setNotifications,
  onOpenModule,
}) {
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);

  const results = searchableModules.filter((module) => {
    const query = search.trim().toLowerCase();

    if (!query) return false;

    return (
      module.name.toLowerCase().includes(query) ||
      module.keywords.some((keyword) =>
        keyword.toLowerCase().includes(query)
      )
    );
  });

  const openModule = (moduleName) => {
    onOpenModule(moduleName);
    setSearch("");
    setShowResults(false);
  };

  useEffect(() => {
    const handleKeyboard = (event) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        searchRef.current?.focus();
        setShowResults(true);
      }

      if (event.key === "Escape") {
        setShowResults(false);
      }
    };

    window.addEventListener("keydown", handleKeyboard);

    return () => {
      window.removeEventListener("keydown", handleKeyboard);
    };
  }, []);

  const handleAdminClick = () => {
    if (role?.toLowerCase() === "admin") {
      openModule("User & Team Management");
    }
  };

  return (
    <header className="cm-topbar">
      {/* BRAND */}
      <div className="cm-brand">
        <div className="cm-brand-icon">☁</div>

        <div>
          <h2>
            Cloud<span>Monitor</span>
          </h2>
          <small>Cloud Security Monitoring System</small>
        </div>
      </div>

      {/* SEARCH */}
      <div className="cm-search-container">
        <label className="cm-search">
          <span>⌕</span>

          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            placeholder="Search modules..."
          />

          <kbd>Ctrl + K</kbd>
        </label>

        {showResults && search.trim() && (
          <div className="cm-search-results">
            {results.length > 0 ? (
              results.map((module) => (
                <button
                  type="button"
                  key={module.name}
                  onClick={() => openModule(module.name)}
                >
                  <span>◈</span>
                  <span>{module.name}</span>
                </button>
              ))
            ) : (
              <div className="cm-search-empty">
                No modules found
              </div>
            )}
          </div>
        )}
      </div>

      {/* TOP ACTIONS */}
      <div className="cm-top-actions">
        <select className="cm-select" aria-label="Environment">
          <option>☁ Production</option>
          <option>Staging</option>
          <option>Development</option>
        </select>

        <button
          type="button"
          className="cm-icon-btn"
          onClick={() => setNotifications(0)}
          aria-label="Clear notifications"
          title="Clear notifications"
        >
          ♧

          {notifications > 0 && (
            <span className="cm-notice">
              {notifications}
            </span>
          )}
        </button>

        {/* ADMIN PROFILE - CLICKABLE */}
        <div
          className="cm-user"
          onClick={handleAdminClick}
          style={{ cursor: "pointer" }}
        >
          <div
            className="cm-avatar"
            style={{ borderRadius: "50%" }}
          >
            S
          </div>

          <div>
            <b>Sakshi</b>
            <br />
            <span style={{ color: "#b6cce5" }}>
              {role?.toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
