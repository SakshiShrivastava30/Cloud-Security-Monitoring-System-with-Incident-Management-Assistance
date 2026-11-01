import { useState } from "react";
import "./Management.css";

function TeamManagement() {
const [teams, setTeams] = useState([
{ id: 1, name: "Security Team", members: 3 },
{ id: 2, name: "Monitoring Team", members: 4 },
]);

const [teamName, setTeamName] = useState("");
const [members, setMembers] = useState("1");
const [editingId, setEditingId] = useState(null);
const [search, setSearch] = useState("");

function resetForm() {
setTeamName("");
setMembers("1");
setEditingId(null);
}

function handleSubmit(event) {
event.preventDefault();


const name = teamName.trim();
const memberCount = Number(members);

if (!name || !Number.isInteger(memberCount) || memberCount < 1) {
  alert("Enter a team name and a valid member count.");
  return;
}

const duplicate = teams.some(
  (team) =>
    team.name.toLowerCase() === name.toLowerCase() &&
    team.id !== editingId
);

if (duplicate) {
  alert("A team with this name already exists.");
  return;
}

if (editingId !== null) {
  setTeams((previous) =>
    previous.map((team) =>
      team.id === editingId
        ? { ...team, name, members: memberCount }
        : team
    )
  );
} else {
  setTeams((previous) => [
    ...previous,
    {
      id: Date.now(),
      name,
      members: memberCount,
    },
  ]);
}

resetForm();


}

function editTeam(team) {
setEditingId(team.id);
setTeamName(team.name);
setMembers(String(team.members));


window.scrollTo({ top: 0, behavior: "smooth" });


}

function deleteTeam(id) {
if (!window.confirm("Are you sure you want to delete this team?")) {
return;
}


setTeams((previous) =>
  previous.filter((team) => team.id !== id)
);

if (editingId === id) {
  resetForm();
}


}

const filteredTeams = teams.filter((team) =>
team.name.toLowerCase().includes(search.toLowerCase())
);

const totalMembers = teams.reduce(
(total, team) => total + team.members,
0
);

return ( <div className="management-page"> <header className="page-header"> <div> <p className="eyebrow">ORGANIZATION</p> <h1>Team Management</h1> <p className="page-description">
Create teams and manage team information. </p> </div>


    <span className="header-badge">Team Administration</span>
  </header>

  <section className="stats-grid">
    <article className="stat-card">
      <span className="stat-label">Total Teams</span>
      <strong>{teams.length}</strong>
      <span className="stat-note">Created teams</span>
    </article>

    <article className="stat-card">
      <span className="stat-label">Total Members</span>
      <strong>{totalMembers}</strong>
      <span className="stat-note">Sum of entered member counts</span>
    </article>
  </section>

  <section className="panel">
    <div className="panel-heading">
      <div>
        <h2>{editingId !== null ? "Edit Team" : "Create New Team"}</h2>
        <p>Enter the team details below.</p>
      </div>
    </div>

    <form className="management-form" onSubmit={handleSubmit}>
      <label>
        Team Name
        <input
          type="text"
          placeholder="Enter team name"
          value={teamName}
          onChange={(event) => setTeamName(event.target.value)}
          required
        />
      </label>

      <label>
        Number of Members
        <input
          type="number"
          min="1"
          step="1"
          value={members}
          onChange={(event) => setMembers(event.target.value)}
          required
        />
      </label>

      <div className="form-actions">
        <button className="btn btn-primary" type="submit">
          {editingId !== null ? "Save Changes" : "+ Add Team"}
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
        <h2>All Teams</h2>
        <p>View, edit, or remove teams.</p>
      </div>

      <span className="record-count">
        {filteredTeams.length} teams
      </span>
    </div>

    <div className="toolbar">
      <input
        className="search-input"
        type="search"
        placeholder="Search teams..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
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
              <td className="user-name">{team.name}</td>
              <td>{team.members}</td>
              <td>
                <div className="row-actions">
                  <button
                    className="btn-text"
                    type="button"
                    onClick={() => editTeam(team)}
                  >
                    Edit
                  </button>

                  <button
                    className="btn-text danger-text"
                    type="button"
                    onClick={() => deleteTeam(team.id)}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}

          {filteredTeams.length === 0 && (
            <tr>
              <td colSpan="3" className="empty-state">
                No teams found.
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

export default TeamManagement;
