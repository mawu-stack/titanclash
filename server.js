/* =============================================================================
   TITAN CLASH 3D - STANDALONE AUTHORITATIVE MULTIPLAYER SERVER
   Headless Node.js + Socket.IO server.
   Controls positions, hitboxes, health, stamina, cooldowns, ultimate meters,
   projectiles, destructible buildings, rooms, and matchmaking.
   Zero WebGL, DOM, audio, or visual asset dependencies.
   ============================================================================= */

import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { RoomManager } from './src/room_manager.js';
import { MSG } from './src/protocol.js';

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Configurable Allowed Origins (comma-separated via env var)
const defaultOrigins = [
  'https://titan-clashers.netlify.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://localhost:8080'
];

const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : [];

const allowedOrigins = envOrigins.length > 0 ? envOrigins : defaultOrigins;

let roomManager = null;

// Lightweight HTTP server for health checks & CORS preflight
const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const reqPath = reqUrl.pathname;
  const origin = req.headers.origin || '*';

  // Apply CORS headers
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check endpoint for cloud monitoring (Render, Railway, UptimeRobot, Netlify frontend)
  if (reqPath === '/health' || reqPath === '/api/health' || reqPath === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'Titan Clash 3D Authoritative Multiplayer Server',
      version: '1.0.0',
      uptimeSec: Math.floor(process.uptime()),
      timestamp: Date.now(),
      activeRooms: roomManager ? roomManager.rooms.size : 0,
      activeQueuedPlayers: roomManager ? roomManager.quickMatchQueue.length : 0,
      allowedOrigins: allowedOrigins.includes('*') ? ['*'] : allowedOrigins
    }, null, 2));
    return;
  }

  // Let Socket.IO handle /socket.io/ requests
  if (reqPath.startsWith('/socket.io/')) {
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Titan Clash 3D Multiplayer Server — Endpoint Not Found. Use /health or connect via Socket.IO.');
});

// Configure Socket.IO Server with permissive CORS resolution
const io = new SocketIOServer(server, {
  cors: {
    origin: (requestOrigin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!requestOrigin) return callback(null, true);

      // Check explicit allowed origins list or wildcard
      if (allowedOrigins.includes('*') || allowedOrigins.includes(requestOrigin)) {
        return callback(null, true);
      }

      // Allow any Netlify preview deployments (*.netlify.app)
      try {
        const parsed = new URL(requestOrigin);
        if (parsed.hostname.endsWith('netlify.app') || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
          return callback(null, true);
        }
      } catch (e) {}

      // Fallback: allow to prevent player lockouts while logging origin
      console.log(`[Socket.IO CORS] Accepting connection from origin: ${requestOrigin}`);
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true
  },
  pingInterval: 25000,
  pingTimeout: 60000
});

roomManager = new RoomManager(io);

// Wire Client Socket Events
io.on('connection', (socket) => {
  // Private Room Management
  socket.on(MSG.ROOM_CREATE, (data = {}) => {
    roomManager.createRoom(socket, data.playerName, data.charId);
  });

  socket.on(MSG.ROOM_JOIN, (data = {}) => {
    roomManager.joinRoom(socket, data.roomCode, data.playerName, data.sessionToken);
  });

  socket.on(MSG.ROOM_LEAVE, () => {
    roomManager.leaveRoom(socket);
  });

  socket.on(MSG.ROOM_SELECT_CHAR, (data = {}) => {
    roomManager.selectCharacter(socket, data.charId);
  });

  socket.on(MSG.ROOM_READY, (data = {}) => {
    roomManager.setReady(socket, data.ready);
  });

  socket.on(MSG.ROOM_ASSET_PROGRESS, (data = {}) => {
    roomManager.setAssetProgress(socket, data.progress);
  });

  // Gameplay Inputs & Telemetry
  socket.on(MSG.MATCH_INPUT, (data = {}) => {
    roomManager.handleInput(socket, data);
  });

  socket.on(MSG.MATCH_PING, (data = {}) => {
    roomManager.handlePing(socket, data.clientTime);
  });

  socket.on(MSG.MATCH_REMATCH, () => {
    roomManager.handleRematch(socket);
  });

  // Quick Match Queue
  socket.on(MSG.QUICKMATCH_QUEUE, (data = {}) => {
    roomManager.queueQuickMatch(socket, data.playerName, data.charId);
  });

  socket.on(MSG.QUICKMATCH_CANCEL, () => {
    roomManager.cancelQuickMatch(socket);
  });

  // Session Reconnection
  socket.on(MSG.SESSION_RECONNECT, (data = {}) => {
    roomManager.reconnectPlayer(socket, data.sessionToken);
  });

  // Disconnection
  socket.on('disconnect', () => {
    roomManager.handlePlayerDisconnect(socket);
  });
});

server.listen(PORT, HOST, () => {
  console.log('================================================================');
  console.log(' TITAN CLASH 3D - AUTHORITATIVE MULTIPLAYER SERVER');
  console.log(` Listening on: http://${HOST}:${PORT}`);
  console.log(` Health check: http://${HOST}:${PORT}/health`);
  console.log(` Allowed Origins: ${allowedOrigins.join(', ')}`);
  console.log('================================================================');
});
