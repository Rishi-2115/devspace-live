import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { AuthGate } from './components/auth/AuthGate';
import { VirtualLab } from './components/VirtualLab';
import './App.css';

function App() {
  // You can change these props as needed
  const labId = 'demo-lab-1';
  const assignmentId = 'assignment-1';

  return (
    <AuthProvider>
      <div className="App">
        <AuthGate>
          <VirtualLab 
            labId={labId}
            assignmentId={assignmentId}
          />
        </AuthGate>
      </div>
    </AuthProvider>
  );
}

export default App;
