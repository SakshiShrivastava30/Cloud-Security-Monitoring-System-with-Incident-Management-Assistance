import { useState } from "react";
import "./Management.css";

function UserManagement() {
const [users, setUsers] = useState([
{
id: 1,
name: "Rahul Sharma",
email: "[rahul@example.com](mailto:rahul@example.com)",
role: "Analyst",
active: true,
},
{
id: 2,
name: "Priya Patil",
email: "[priya@example.com](mailto:priya@example.com)",
role: "Admin",
active: true,
},
]);

const [form, setForm] = useState({
name: "",
email: "",
role: "Analyst",
});

const [editingId, setEditingId] = useState(null);
const [search, setSearch] = useState("");
const [filterRole, setFilterRole] = useState("All");

function resetForm() {
setForm({ name: "", email: "", role: "Analyst" });
setEditingId(null);
}

function handleSubmit(event) {
event.preventDefault();


const name = form.name.trim();
const email = form.email.trim();

if (!name || !email) {
  alert("Please enter the name and email.");
  return;
}

const duplicate = users.some(
  (user) =>
    user.email.toLowerCase() === email.toLowerCase() &&
    user.id !== editingId
);

if (duplicate) {
  alert("This email address already exists.");
  return;
}

if (editingId !== null) {
  setUsers((previous) =>
    previous.map((user) =>
      user.id === editingId
        ? { ...user, name, email, role: form.role }
        : user
    )
  );
} else {
  setUsers((previous) => [
    ...previous,
    {
      id: Date.now(),
      name,
      email,
      role: form.role,
      active: true,
    },
  ]);
}

resetForm();


}

function editUser(user) {
setEditingId(user.id);
setForm({
name: user.name,
email: user.email,
role: user.role,
});


window.scrollTo({ top: 0, behavior: "smooth" });


}

function toggleStatus(id) {
setUsers((previous) =>
previous.map((user) =>
user.id === id ? { ...user, active: !user.active } : user
)
);
}

const filteredUsers = users.filter((user) => {
const matchesSearch =
user.name.toLowerCase().includes(search.toLowerCase()) ||
user.email.toLowerCase().includes(search.toLowerCase());


const matchesRole =
  filterRole === "All" || user.role === filterRole;

return matchesSearch && matchesRole;


});

return ( <div className="management-page"> <header className="page-header"> <div> <p className="eyebrow">ACCESS CONTROL</p> <h1>User Management</h1> <p className="page-description">
Manage users, assign roles, and control account status. </p> </div>

```
    <span className="header-badge">User Administration</span>
  </header>

  <section className="stats-grid">
    <article className="stat-card">
      <span className="stat-label">Total Users</span>
      <strong>{users.length}</strong>
      <span className="stat-note">Registered accounts</span>
    </article>

    <article className="stat-card">
      <span className="stat-label">Active Users</span>
      <strong>
        {users.filter((user) => user.active).length}
      </strong>
      <span className="stat-note">Currently active</span>
    </article>

    <article className="stat-card">
      <span className="stat-label">Administrators</span>
      <strong>
        {users.filter((user) => user.role === "Admin").length}
      </strong>
      <span className="stat-note">Admin role assigned</span>
    </article>
  </section>

  <section className="panel">
    <div className="panel-heading">
      <div>
        <h2>{editingId !== null ? "Edit User" : "Add New User"}</h2>
        <p>Enter the user's details below.</p>
      </div>
    </div>

    <form className="management-form" onSubmit={handleSubmit}>
      <label>
        Full Name
        <input
          type="text"
          placeholder="Enter full name"
          value={form.name}
          onChange={(event) =>
            setForm({ ...form, name: event.target.value })
          }
          required
        />
      </label>

      <label>
        Email Address
        <input
          type="email"
          placeholder="name@example.com"
          value={form.email}
          onChange={(event) =>
            setForm({ ...form, email: event.target.value })
          }
          required
        />
      </label>

      <label>
        User Role
        <select
          value={form.role}
          onChange={(event) =>
            setForm({ ...form, role: event.target.value })
          }
        >
          <option value="Analyst">Analyst</option>
          <option value="Admin">Admin</option>
          <option value="Viewer">Viewer</option>
        </select>
      </label>

      <div className="form-actions">
        <button className="btn btn-primary" type="submit">
          {editingId !== null ? "Save Changes" : "+ Add User"}
        </button>

        {editingId !== null && (
          <button
            className="btn btn-secondary"
            type="button"
            onClick={resetForm}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  </section>

  <section className="panel">
    <div className="panel-heading">
      <div>
        <h2>All Users</h2>
        <p>View and manage registered accounts.</p>
      </div>

      <span className="record-count">
        {filteredUsers.length} users
      </span>
    </div>

    <div className="toolbar">
      <input
        className="search-input"
        type="search"
        placeholder="Search by name or email..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <select
        value={filterRole}
        onChange={(event) => setFilterRole(event.target.value)}
      >
        <option value="All">All Roles</option>
        <option value="Admin">Admin</option>
        <option value="Analyst">Analyst</option>
        <option value="Viewer">Viewer</option>
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
              <td className="user-name">{user.name}</td>
              <td>{user.email}</td>
              <td>
                <span className="role-badge">{user.role}</span>
              </td>
              <td>
                <span
                  className={`status-badge ${
                    user.active ? "status-active" : "status-inactive"
                  }`}
                >
                  {user.active ? "Active" : "Inactive"}
                </span>
              </td>
              <td>
                <div className="row-actions">
                  <button
                    className="btn-text"
                    type="button"
                    onClick={() => editUser(user)}
                  >
                    Edit
                  </button>

                  <button
                    className={`btn-text ${
                      user.active ? "danger-text" : "success-text"
                    }`}
                    type="button"
                    onClick={() => toggleStatus(user.id)}
                  >
                    {user.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </td>
            </tr>
          ))}

          {filteredUsers.length === 0 && (
            <tr>
              <td colSpan="5" className="empty-state">
                No users found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </section>
</div>


);
}

export default UserManagement;
