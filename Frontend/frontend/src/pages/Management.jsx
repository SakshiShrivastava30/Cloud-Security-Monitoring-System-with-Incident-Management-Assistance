import { useState } from "react";
import "./Management.css";

// ================= USER MANAGEMENT =================

export function UserManagement() {
  const [users, setUsers] = useState([
    {
      id: 1,
      name: "Rahul Sharma",
      email: "rahul@example.com",
      role: "Analyst",
      active: true
    },
    {
      id: 2,
      name: "Priya Patil",
      email: "priya@example.com",
      role: "Admin",
      active: true
    }
  ]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Analyst");
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("All");

  const resetForm = () => {
    setName("");
    setEmail("");
    setRole("Analyst");
    setEditingId(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName || !cleanEmail) {
      alert("Please enter name and email.");
      return;
    }

    const duplicate = users.some(
      (user) =>
        user.email.toLowerCase() === cleanEmail.toLowerCase() &&
        user.id !== editingId
    );

    if (duplicate) {
      alert("This email already exists.");
      return;
    }

    if (editingId !== null) {
      setUsers(
        users.map((user) =>
          user.id === editingId
            ? {
                ...user,
                name: cleanName,
                email: cleanEmail,
                role
              }
            : user
        )
      );
    } else {
      setUsers([
        ...users,
        {
          id: Date.now(),
          name: cleanName,
          email: cleanEmail,
          role,
          active: true
        }
      ]);
    }

    resetForm();
  };

  const editUser = (user) => {
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setEditingId(user.id);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const toggleStatus = (id) => {
    setUsers(
      users.map((user) =>
        user.id === id
          ? { ...user, active: !user.active }
          : user
      )
    );
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase());

    const matchesRole =
      filterRole === "All" || user.role === filterRole;

    return matchesSearch && matchesRole;
  });

  const activeUsers = users.filter(
    (user) => user.active
  ).length;

  const adminUsers = users.filter(
    (user) => user.role === "Admin"
  ).length;

  return (
    <div className="management-page">

      <div className="page-header">
        <div>
          <p className="eyebrow">USER ADMINISTRATION</p>
          <h1>User Management</h1>
          <p className="page-description">
            Manage users, roles and account status.
          </p>
        </div>

        <span className="header-badge">User Dashboard</span>
      </div>

      {/* USER STATISTICS */}

      <div className="stats-grid">

        <div className="stat-card">
          <p className="stat-label">Total Users</p>
          <h2>{users.length}</h2>
          <p className="stat-note">Registered users</p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Active Users</p>
          <h2>{activeUsers}</h2>
          <p className="stat-note">Currently active</p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Administrators</p>
          <h2>{adminUsers}</h2>
          <p className="stat-note">Admin accounts</p>
        </div>

      </div>

      {/* ADD / EDIT USER */}

      <div className="panel">

        <div className="panel-heading">
          <h2>
            {editingId !== null ? "Edit User" : "Add New User"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="management-form">

          <div>
            <label>Full Name</label>
            <input
              type="text"
              placeholder="Enter full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label>Email Address</label>
            <input
              type="email"
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label>User Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="Analyst">Analyst</option>
              <option value="Admin">Admin</option>
              <option value="Manager">Manager</option>
            </select>
          </div>

          <div className="form-actions">

            <button type="submit" className="btn btn-primary">
              {editingId !== null ? "Save Changes" : "+ Add User"}
            </button>

            {editingId !== null && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetForm}
              >
                Cancel
              </button>
            )}

          </div>

        </form>

      </div>

      {/* USER LIST */}

      <div className="panel">

        <div className="panel-heading">
          <h2>All Users</h2>
          <span className="record-count">
            {filteredUsers.length} Records
          </span>
        </div>

        <div className="toolbar">

          <input
            type="text"
            className="search-input"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="All">All Roles</option>
            <option value="Admin">Admin</option>
            <option value="Analyst">Analyst</option>
            <option value="Manager">Manager</option>
          </select>

        </div>

        <div className="table-wrapper">

          <table className="management-table">

            <thead>
              <tr>
                <th>User</th>
                <th>Email Address</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>

              {filteredUsers.map((user) => (

                <tr key={user.id}>

                  <td className="user-name">
                    {user.name}
                  </td>

                  <td>{user.email}</td>

                  <td>
                    <span className="role-badge">
                      {user.role}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`status-badge ${
                        user.active
                          ? "status-active"
                          : "status-inactive"
                      }`}
                    >
                      {user.active ? "Active" : "Inactive"}
                    </span>
                  </td>

                  <td>
                    <div className="row-actions">

                      <button
                        className="btn-text"
                        onClick={() => editUser(user)}
                      >
                        Edit
                      </button>

                      <button
                        className={`btn-text ${
                          user.active
                            ? "danger-text"
                            : "success-text"
                        }`}
                        onClick={() => toggleStatus(user.id)}
                      >
                        {user.active ? "Deactivate" : "Activate"}
                      </button>

                    </div>
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

          {filteredUsers.length === 0 && (
            <div className="empty-state">
              No users found.
            </div>
          )}

        </div>

      </div>

    </div>
  );
}


// ================= TEAM MANAGEMENT =================

export function TeamManagement() {
  const [teams, setTeams] = useState([
    {
      id: 1,
      name: "Security Team",
      members: 3
    },
    {
      id: 2,
      name: "Monitoring Team",
      members: 4
    }
  ]);

  const [teamName, setTeamName] = useState("");
  const [members, setMembers] = useState("1");
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");

  const resetForm = () => {
    setTeamName("");
    setMembers("1");
    setEditingId(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const cleanName = teamName.trim();
    const memberCount = Number(members);

    if (!cleanName) {
      alert("Please enter team name.");
      return;
    }

    if (!Number.isInteger(memberCount) || memberCount < 1) {
      alert("Please enter a valid member count.");
      return;
    }

    const duplicate = teams.some(
      (team) =>
        team.name.toLowerCase() === cleanName.toLowerCase() &&
        team.id !== editingId
    );

    if (duplicate) {
      alert("This team already exists.");
      return;
    }

    if (editingId !== null) {
      setTeams(
        teams.map((team) =>
          team.id === editingId
            ? {
                ...team,
                name: cleanName,
                members: memberCount
              }
            : team
        )
      );
    } else {
      setTeams([
        ...teams,
        {
          id: Date.now(),
          name: cleanName,
          members: memberCount
        }
      ]);
    }

    resetForm();
  };

  const editTeam = (team) => {
    setTeamName(team.name);
    setMembers(String(team.members));
    setEditingId(team.id);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const deleteTeam = (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this team?"
    );

    if (!confirmDelete) return;

    setTeams(teams.filter((team) => team.id !== id));

    if (editingId === id) {
      resetForm();
    }
  };

  const filteredTeams = teams.filter((team) =>
    team.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalMembers = teams.reduce(
    (total, team) => total + team.members,
    0
  );

  return (
    <div className="management-page">

      <div className="page-header">
        <div>
          <p className="eyebrow">ORGANIZATION</p>
          <h1>Team Management</h1>
          <p className="page-description">
            Manage teams and their member counts.
          </p>
        </div>

        <span className="header-badge">Team Administration</span>
      </div>

      {/* TEAM STATISTICS */}

      <div className="stats-grid">

        <div className="stat-card">
          <p className="stat-label">Total Teams</p>
          <h2>{teams.length}</h2>
          <p className="stat-note">Created teams</p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Total Members</p>
          <h2>{totalMembers}</h2>
          <p className="stat-note">Across all teams</p>
        </div>

      </div>

      {/* ADD / EDIT TEAM */}

      <div className="panel">

        <div className="panel-heading">
          <h2>
            {editingId !== null ? "Edit Team" : "Add New Team"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="management-form">

          <div>
            <label>Team Name</label>
            <input
              type="text"
              placeholder="Enter team name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
            />
          </div>

          <div>
            <label>Number of Members</label>
            <input
              type="number"
              min="1"
              step="1"
              value={members}
              onChange={(e) => setMembers(e.target.value)}
              required
            />
          </div>

          <div className="form-actions">

            <button type="submit" className="btn btn-primary">
              {editingId !== null ? "Save Changes" : "+ Add Team"}
            </button>

            {editingId !== null && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetForm}
              >
                Cancel
              </button>
            )}

          </div>

        </form>

      </div>

      {/* TEAM LIST */}

      <div className="panel">

        <div className="panel-heading">
          <h2>All Teams</h2>
          <span className="record-count">
            {filteredTeams.length} Records
          </span>
        </div>

        <div className="toolbar">

          <input
            type="text"
            className="search-input"
            placeholder="Search team..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

        </div>

        <div className="table-wrapper">

          <table className="management-table">

            <thead>
              <tr>
                <th>Team Name</th>
                <th>Number of Members</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>

              {filteredTeams.map((team) => (

                <tr key={team.id}>

                  <td className="user-name">
                    {team.name}
                  </td>

                  <td>{team.members}</td>

                  <td>
                    <div className="row-actions">

                      <button
                        className="btn-text"
                        onClick={() => editTeam(team)}
                      >
                        Edit
                      </button>

                      <button
                        className="btn-text danger-text"
                        onClick={() => deleteTeam(team.id)}
                      >
                        Delete
                      </button>

                    </div>
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

          {filteredTeams.length === 0 && (
            <div className="empty-state">
              No teams found.
            </div>
          )}

        </div>

      </div>

    </div>
  );
}