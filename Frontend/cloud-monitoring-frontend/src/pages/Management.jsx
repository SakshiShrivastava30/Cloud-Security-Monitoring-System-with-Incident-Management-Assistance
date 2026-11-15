
import { useEffect, useState } from "react";
import "./Management.css";

const API_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const emptyUser = {
  name: "",
  email: "",
  password: "",
  role: "VIEWER",
};

const emptyTeam = {
  name: "",
  description: "",
};

function getToken() {
  return (
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("jwt") ||
    sessionStorage.getItem("accessToken") ||
    localStorage.getItem("token") ||
    ""
  );
}

export default function Management() {
  const [activeTab, setActiveTab] = useState("users");

  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);

  const [userForm, setUserForm] = useState(emptyUser);
  const [teamForm, setTeamForm] = useState(emptyTeam);

  const [editingUserId, setEditingUserId] = useState(null);
  const [editingTeamId, setEditingTeamId] = useState(null);

  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // API request helper
  async function apiRequest(endpoint, options = {}) {
    const token = getToken();

    if (!token) {
      throw new Error(
        "JWT token not found. Please login again."
      );
    }

    const response = await fetch(`${API_URL}/api/management${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    const text = await response.text();

    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      throw new Error(
        typeof data === "string"
          ? data
          : data?.message || `Request failed: ${response.status}`
      );
    }

    return data;
  }

  // Fetch users and teams
  async function fetchData() {
    try {
      setLoading(true);
      setError("");

      const [usersData, teamsData] = await Promise.all([
        apiRequest("/users"),
        apiRequest("/teams"),
      ]);

      setUsers(Array.isArray(usersData) ? usersData : []);
      setTeams(Array.isArray(teamsData) ? teamsData : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  // Create or update user
  async function handleUserSubmit(e) {
    e.preventDefault();

    try {
      setError("");
      setSuccess("");

      if (editingUserId) {
        await apiRequest(`/users/${editingUserId}`, {
          method: "PUT",
          body: JSON.stringify({
            name: userForm.name,
            email: userForm.email,
            role: userForm.role,
          }),
        });

        setSuccess("User updated successfully!");
      } else {
        await apiRequest("/users", {
          method: "POST",
          body: JSON.stringify(userForm),
        });

        setSuccess("User added successfully!");
      }

      setUserForm(emptyUser);
      setEditingUserId(null);
      await fetchData();
    } catch (err) {
      setError(err.message);
    }
  }

  // Edit user
  function editUser(user) {
    setEditingUserId(user.id);

    setUserForm({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "VIEWER",
    });

    setActiveTab("users");
  }

  // Delete user
  async function deleteUser(id) {
    if (!window.confirm("Are you sure you want to delete this user?")) {
      return;
    }

    try {
      setError("");

      await apiRequest(`/users/${id}`, {
        method: "DELETE",
      });

      setSuccess("User deleted successfully!");
      await fetchData();
    } catch (err) {
      setError(err.message);
    }
  }

  // Activate / deactivate user
  async function toggleUserStatus(user) {
    try {
      setError("");

      await apiRequest(`/users/${user.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          active: !user.active,
        }),
      });

      setSuccess("User status updated!");
      await fetchData();
    } catch (err) {
      setError(err.message);
    }
  }

  // Create or update team
  async function handleTeamSubmit(e) {
    e.preventDefault();

    try {
      setError("");
      setSuccess("");

      if (editingTeamId) {
        await apiRequest(`/teams/${editingTeamId}`, {
          method: "PUT",
          body: JSON.stringify(teamForm),
        });

        setSuccess("Team updated successfully!");
      } else {
        await apiRequest("/teams", {
          method: "POST",
          body: JSON.stringify(teamForm),
        });

        setSuccess("Team created successfully!");
      }

      setTeamForm(emptyTeam);
      setEditingTeamId(null);
      await fetchData();
    } catch (err) {
      setError(err.message);
    }
  }

  // Edit team
  function editTeam(team) {
    setEditingTeamId(team.id);

    setTeamForm({
      name: team.name || "",
      description: team.description || "",
    });

    setActiveTab("teams");
  }

  // Delete team
  async function deleteTeam(id) {
    if (!window.confirm("Are you sure you want to delete this team?")) {
      return;
    }

    try {
      setError("");

      await apiRequest(`/teams/${id}`, {
        method: "DELETE",
      });

      setSuccess("Team deleted successfully!");
      await fetchData();
    } catch (err) {
      setError(err.message);
    }
  }

  // Add user to team
  async function addMember(e) {
    e.preventDefault();

    if (!selectedTeamId || !selectedUserId) {
      setError("Please select both team and user.");
      return;
    }

    try {
      setError("");

      await apiRequest(
        `/teams/${selectedTeamId}/members/${selectedUserId}`,
        {
          method: "POST",
        }
      );

      setSuccess("User added to team successfully!");
      setSelectedUserId("");
      await fetchData();
    } catch (err) {
      setError(err.message);
    }
  }

  // Remove user from team
  async function removeMember(teamId, userId) {
    try {
      setError("");

      await apiRequest(
        `/teams/${teamId}/members/${userId}`,
        {
          method: "DELETE",
        }
      );

      setSuccess("User removed from team!");
      await fetchData();
    } catch (err) {
      setError(err.message);
    }
  }

  function cancelUserEdit() {
    setEditingUserId(null);
    setUserForm(emptyUser);
  }

  function cancelTeamEdit() {
    setEditingTeamId(null);
    setTeamForm(emptyTeam);
  }

  return (
    <div className="management-page">
      <div className="management-header">
        <div>
          <h1>User & Team Management</h1>
          <p>Manage system users, roles and team assignments.</p>
        </div>

        <button className="refresh-btn" onClick={fetchData}>
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="management-alert error-alert">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {success && (
        <div className="management-alert success-alert">
          {success}
          <button onClick={() => setSuccess("")}>×</button>
        </div>
      )}

      {/* Statistics */}
      <div className="management-stats">
        <div className="management-stat-card">
          <span>Total Users</span>
          <h2>{users.length}</h2>
        </div>

        <div className="management-stat-card">
          <span>Active Users</span>
          <h2>{users.filter((u) => u.active).length}</h2>
        </div>

        <div className="management-stat-card">
          <span>Total Teams</span>
          <h2>{teams.length}</h2>
        </div>

        <div className="management-stat-card">
          <span>Administrators</span>
          <h2>{users.filter((u) => u.role === "ADMIN").length}</h2>
        </div>
      </div>

      {/* Navigation */}
      <div className="management-tabs">
        <button
          className={activeTab === "users" ? "active" : ""}
          onClick={() => setActiveTab("users")}
        >
          Users
        </button>

        <button
          className={activeTab === "teams" ? "active" : ""}
          onClick={() => setActiveTab("teams")}
        >
          Teams
        </button>

        <button
          className={activeTab === "members" ? "active" : ""}
          onClick={() => setActiveTab("members")}
        >
          Team Members
        </button>
      </div>

      {loading && <p className="loading-text">Loading data...</p>}

      {/* USER MANAGEMENT */}
      {activeTab === "users" && (
        <>
          <div className="management-panel">
            <h2>
              {editingUserId ? "Update User" : "Add New User"}
            </h2>

            <form onSubmit={handleUserSubmit} className="management-form">
              <input
                type="text"
                placeholder="Full Name"
                value={userForm.name}
                onChange={(e) =>
                  setUserForm({ ...userForm, name: e.target.value })
                }
                required
              />

              <input
                type="email"
                placeholder="Email Address"
                value={userForm.email}
                onChange={(e) =>
                  setUserForm({ ...userForm, email: e.target.value })
                }
                required
              />

              {!editingUserId && (
                <input
                  type="password"
                  placeholder="Password"
                  value={userForm.password}
                  onChange={(e) =>
                    setUserForm({
                      ...userForm,
                      password: e.target.value,
                    })
                  }
                  required
                />
              )}

              <select
                value={userForm.role}
                onChange={(e) =>
                  setUserForm({ ...userForm, role: e.target.value })
                }
              >
                <option value="VIEWER">Viewer</option>
                <option value="ANALYST">Analyst</option>
                <option value="ADMIN">Admin</option>
              </select>

              <button type="submit" className="primary-btn">
                {editingUserId ? "Update User" : "Add User"}
              </button>

              {editingUserId && (
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={cancelUserEdit}
                >
                  Cancel
                </button>
              )}
            </form>
          </div>

          <div className="management-panel">
            <h2>All Users ({users.length})</h2>

            <div className="management-table-wrapper">
              <table className="management-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Teams</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`role-badge ${user.role?.toLowerCase()}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        {user.teamNames?.length
                          ? user.teamNames.join(", ")
                          : "No team"}
                      </td>
                      <td>
                        <span
                          className={
                            user.active ? "status-active" : "status-inactive"
                          }
                        >
                          {user.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="edit-btn"
                            onClick={() => editUser(user)}
                          >
                            Edit
                          </button>

                          <button
                            className="status-btn"
                            onClick={() => toggleUserStatus(user)}
                          >
                            {user.active ? "Deactivate" : "Activate"}
                          </button>

                          <button
                            className="delete-btn"
                            onClick={() => deleteUser(user.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {users.length === 0 && (
                    <tr>
                      <td colSpan="7" className="empty-row">
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TEAM MANAGEMENT */}
      {activeTab === "teams" && (
        <>
          <div className="management-panel">
            <h2>
              {editingTeamId ? "Update Team" : "Create New Team"}
            </h2>

            <form onSubmit={handleTeamSubmit} className="management-form">
              <input
                type="text"
                placeholder="Team Name"
                value={teamForm.name}
                onChange={(e) =>
                  setTeamForm({ ...teamForm, name: e.target.value })
                }
                required
              />

              <input
                type="text"
                placeholder="Team Description"
                value={teamForm.description}
                onChange={(e) =>
                  setTeamForm({
                    ...teamForm,
                    description: e.target.value,
                  })
                }
              />

              <button type="submit" className="primary-btn">
                {editingTeamId ? "Update Team" : "Create Team"}
              </button>

              {editingTeamId && (
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={cancelTeamEdit}
                >
                  Cancel
                </button>
              )}
            </form>
          </div>

          <div className="management-panel">
            <h2>All Teams ({teams.length})</h2>

            <div className="team-grid">
              {teams.map((team) => (
                <div className="team-card" key={team.id}>
                  <h3>{team.name}</h3>

                  <p>
                    {team.description || "No description available"}
                  </p>

                  <div className="team-card-info">
                    <span>
                      Members: {team.members ?? team.memberIds?.length ?? 0}
                    </span>
                    <span>Team ID: {team.id}</span>
                  </div>

                  <div className="action-buttons">
                    <button
                      className="edit-btn"
                      onClick={() => editTeam(team)}
                    >
                      Edit
                    </button>

                    <button
                      className="delete-btn"
                      onClick={() => deleteTeam(team.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {teams.length === 0 && (
                <p>No teams found.</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* TEAM MEMBERS */}
      {activeTab === "members" && (
        <>
          <div className="management-panel">
            <h2>Assign User to Team</h2>

            <form onSubmit={addMember} className="management-form">
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                required
              >
                <option value="">Select Team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                required
              >
                <option value="">Select User</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>

              <button type="submit" className="primary-btn">
                Add to Team
              </button>
            </form>
          </div>

          <div className="management-panel">
            <h2>Team Members</h2>

            <div className="team-grid">
              {teams.map((team) => (
                <div className="team-card" key={team.id}>
                  <h3>{team.name}</h3>

                  {team.memberNames?.length > 0 ? (
                    team.memberNames.map((memberName, index) => (
                      <div className="member-row" key={team.memberIds?.[index] ?? index}>
                        <span>{memberName}</span>

                        <button
                          className="delete-btn"
                          onClick={() =>
                            removeMember(team.id, team.memberIds[index])
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  ) : (
                    <p>No members assigned.</p>
                  )}
                </div>
              ))}

              {teams.length === 0 && <p>No teams available.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
