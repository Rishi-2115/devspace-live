# Virtual Lab - Real-Time Collaborative Development Environment

## Project Structure

```
virtual-lab/
├── virtual-lab-frontend/    # React frontend application
├── virtual-lab-backend/     # Node.js backend services
└── README.md               # This file
```

## Quick Start

### 1. Start Backend Services

```bash
# Terminal 1: Start REST API server (port 3001)
cd virtual-lab-backend
node simple-server.js

# Terminal 2: Start WebSocket server (port 3002)
cd virtual-lab-backend
node collaboration-server.js
```

### 2. Start Frontend

```bash
# Terminal 3: Start React development server (port 3000)
cd virtual-lab-frontend
npm start
```

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **REST API**: http://localhost:3001
- **WebSocket**: http://localhost:3002

## Demo Credentials

- **Email**: demo@example.com, **Password**: demo123
- **Email**: john@example.com, **Password**: password123

## Features

- ✅ Real-time collaborative code editing
- ✅ Multi-language code execution (Python, JavaScript, C/C++)
- ✅ File management with drag-and-drop
- ✅ Live chat and user presence
- ✅ Authentication and user management
- ✅ Resource monitoring
- ✅ WebSocket-based real-time synchronization

## Technology Stack

**Frontend**: React, TypeScript, Socket.IO, Monaco Editor
**Backend**: Node.js, Express, Socket.IO, JWT Authentication
**Architecture**: Microservices with separate API and WebSocket servers
