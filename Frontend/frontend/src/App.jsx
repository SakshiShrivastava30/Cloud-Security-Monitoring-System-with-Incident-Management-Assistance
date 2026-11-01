import { useState } from 'react';
import UserManagement from './pages/UserManagement';
import TeamManagement from './pages/TeamManagement';

function App() {
const [currentPage, setCurrentPage] = useState('users');

const sidebarStyle = {
width: '230px',
minHeight: '100vh',
backgroundColor: '#111827',
color: 'white',
padding: '24px 16px',
boxSizing: 'border-box',
flexShrink: 0,
};

const buttonStyle = (page) => ({
width: '100%',
padding: '12px',
marginBottom: '10px',
textAlign: 'left',
border: 'none',
borderRadius: '6px',
cursor: 'pointer',
fontSize: '15px',
backgroundColor: currentPage === page ? '#2563eb' : 'transparent',
color: 'white',
});

return (
<div style={{ display: 'flex', minHeight: '100vh' }}> <aside style={sidebarStyle}>
<h2 style={{ fontSize: '19px', marginBottom: '32px' }}>
Cloud Security </h2>


    <button
      style={buttonStyle('users')}
      onClick={() => setCurrentPage('users')}
    >
      👤 User Management
    </button>

    <button
      style={buttonStyle('teams')}
      onClick={() => setCurrentPage('teams')}
    >
      👥 Team Management
    </button>
  </aside>

  <main style={{ flex: 1, minWidth: 0, backgroundColor: '#f3f4f6' }}>
    {currentPage === 'users' ? (
      <UserManagement />
    ) : (
      <TeamManagement />
    )}
  </main>
</div>


);
}

export default App;
