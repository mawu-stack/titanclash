/* =============================================================================
   TITAN CLASH 3D - MULTIPLAYER ROOM & LOBBY MANAGER
   Controls private rooms, quick match queue, player sessions, 25Hz match
   authoritative loop, disconnections/reconnections, and rematches.
   ============================================================================= */

import { generateRoomCode, sanitizePlayerName, validateInputPayload, MSG, NETWORK_CONFIG } from './protocol.js';
import { ServerCombatMatch } from './server_combat.js';
import crypto from 'crypto';

export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map(); // roomCode -> Room
    this.socketToRoom = new Map(); // socket.id -> roomCode
    this.sessions = new Map(); // sessionToken -> SessionData
    this.quickMatchQueue = []; // array of { socket, playerName, charId }

    // Start 25Hz global simulation tick
    this.tickInterval = setInterval(() => {
      this.tickActiveMatches(NETWORK_CONFIG.TICK_INTERVAL_MS / 1000);
    }, NETWORK_CONFIG.TICK_INTERVAL_MS);

    // Periodic room cleanup for idle rooms
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleRooms();
    }, 15000);
  }

  generateSessionToken() {
    return crypto.randomBytes(16).toString('hex');
  }

  // --- PRIVATE ROOM MANAGEMENT ---

  createRoom(socket, playerName, charId = 'gipsy') {
    // Leave any existing room
    this.leaveRoom(socket);

    let roomCode;
    let attempts = 0;
    do {
      roomCode = generateRoomCode();
      attempts++;
    } while (this.rooms.has(roomCode) && attempts < 50);

    const safeName = sanitizePlayerName(playerName, 'Player 1');
    const safeChar = NETWORK_CONFIG.ALLOWED_CHARACTERS.includes(charId) ? charId : 'gipsy';
    const sessionToken = this.generateSessionToken();

    const room = {
      code: roomCode,
      createdAt: Date.now(),
      lastActive: Date.now(),
      isPublic: false,
      status: 'lobby', // 'lobby' | 'countdown' | 'in_match' | 'abandoned'
      p1: {
        socketId: socket.id,
        sessionToken,
        name: safeName,
        charId: safeChar,
        ready: false,
        assetProgress: 0,
        connected: true,
        rematchVote: false,
        ping: 0
      },
      p2: null,
      match: null,
      reconnectTimeout: null
    };

    this.rooms.set(roomCode, room);
    this.socketToRoom.set(socket.id, roomCode);
    this.sessions.set(sessionToken, { roomCode, slot: 'p1' });

    socket.join(roomCode);
    socket.emit(MSG.ROOM_CREATED, {
      roomCode,
      sessionToken,
      slot: 'p1',
      room: this.serializeRoom(room)
    });

    console.log(`[RoomManager] Room created: ${roomCode} by ${safeName}`);
    return room;
  }

  joinRoom(socket, roomCode, playerName, sessionToken = null) {
    if (!roomCode || typeof roomCode !== 'string') {
      socket.emit(MSG.ROOM_ERROR, { message: 'Invalid room code.' });
      return null;
    }

    const code = roomCode.trim().toUpperCase();
    const room = this.rooms.get(code);

    if (!room) {
      socket.emit(MSG.ROOM_ERROR, { message: `Room ${code} does not exist or has expired.` });
      return null;
    }

    // Check for reconnection with sessionToken
    if (sessionToken && this.sessions.has(sessionToken)) {
      const sess = this.sessions.get(sessionToken);
      if (sess.roomCode === code) {
        return this.reconnectPlayer(socket, sessionToken);
      }
    }

    if (room.status === 'in_match' || room.status === 'countdown') {
      socket.emit(MSG.ROOM_ERROR, { message: 'This match is already in progress.' });
      return null;
    }

    if (room.p1 && room.p2) {
      socket.emit(MSG.ROOM_ERROR, { message: 'Room is full (2/2 players).' });
      return null;
    }

    // Leave any other room first
    this.leaveRoom(socket);

    const safeName = sanitizePlayerName(playerName, 'Player 2');
    const newSessionToken = this.generateSessionToken();

    room.p2 = {
      socketId: socket.id,
      sessionToken: newSessionToken,
      name: safeName,
      // Default to opposite character if p1 chose gipsy, or leatherback
      charId: room.p1.charId === 'gipsy' ? 'leatherback' : 'gipsy',
      ready: false,
      assetProgress: 0,
      connected: true,
      rematchVote: false,
      ping: 0
    };

    // Reset readiness when roster changes
    room.p1.ready = false;
    room.lastActive = Date.now();

    this.socketToRoom.set(socket.id, code);
    this.sessions.set(newSessionToken, { roomCode: code, slot: 'p2' });

    socket.join(code);
    socket.emit(MSG.ROOM_JOINED, {
      roomCode: code,
      sessionToken: newSessionToken,
      slot: 'p2',
      room: this.serializeRoom(room)
    });

    // Notify room of update
    this.broadcastRoomUpdate(room);
    console.log(`[RoomManager] Player ${safeName} joined room ${code}`);
    return room;
  }

  leaveRoom(socket) {
    const code = this.socketToRoom.get(socket.id);
    if (!code) return;

    this.socketToRoom.delete(socket.id);
    const room = this.rooms.get(code);
    if (!room) return;

    socket.leave(code);

    const isP1 = room.p1 && room.p1.socketId === socket.id;
    const isP2 = room.p2 && room.p2.socketId === socket.id;

    if (room.status === 'lobby') {
      if (isP1) {
        if (room.p2) {
          // Promote p2 to p1
          room.p1 = room.p2;
          room.p2 = null;
          room.p1.ready = false;
          this.sessions.set(room.p1.sessionToken, { roomCode: code, slot: 'p1' });
          this.broadcastRoomUpdate(room);
        } else {
          // Close empty room
          this.destroyRoom(code);
        }
      } else if (isP2) {
        room.p2 = null;
        room.p1.ready = false;
        this.broadcastRoomUpdate(room);
      }
    } else {
      // During active match or countdown: trigger disconnect handling
      this.handlePlayerDisconnect(socket, isP1 ? 'p1' : 'p2');
    }
  }

  selectCharacter(socket, charId) {
    const room = this.getRoomBySocket(socket);
    if (!room || room.status !== 'lobby') return;

    if (!NETWORK_CONFIG.ALLOWED_CHARACTERS.includes(charId)) return;

    const isP1 = room.p1 && room.p1.socketId === socket.id;
    const isP2 = room.p2 && room.p2.socketId === socket.id;

    if (isP1) {
      room.p1.charId = charId;
    } else if (isP2) {
      room.p2.charId = charId;
    } else {
      return;
    }

    // Requirement: Reset readiness when character selection changes
    if (room.p1) room.p1.ready = false;
    if (room.p2) room.p2.ready = false;
    room.lastActive = Date.now();

    this.broadcastRoomUpdate(room);
  }

  setReady(socket, isReady) {
    const room = this.getRoomBySocket(socket);
    console.log('[RoomManager] setReady called by socket', socket.id, 'room:', room ? room.code : null, 'isReady:', isReady);
    if (!room || room.status !== 'lobby') return;

    const isP1 = room.p1 && room.p1.socketId === socket.id;
    const isP2 = room.p2 && room.p2.socketId === socket.id;

    if (isP1) room.p1.ready = !!isReady;
    else if (isP2) room.p2.ready = !!isReady;
    else return;

    room.lastActive = Date.now();
    this.broadcastRoomUpdate(room);

    this.checkBothReadyAndLoaded(room);
  }

  setAssetProgress(socket, progress) {
    const room = this.getRoomBySocket(socket);
    if (!room) return;

    const pct = Math.max(0, Math.min(100, Math.floor(progress || 0)));
    const isP1 = room.p1 && room.p1.socketId === socket.id;
    const isP2 = room.p2 && room.p2.socketId === socket.id;

    if (isP1) {
      if (room.p1.assetProgress === pct) return;
      room.p1.assetProgress = pct;
    } else if (isP2) {
      if (room.p2.assetProgress === pct) return;
      room.p2.assetProgress = pct;
    } else return;

    this.broadcastRoomUpdate(room);
    this.checkBothReadyAndLoaded(room);
  }

  checkBothReadyAndLoaded(room) {
    if (room.status !== 'lobby') return;
    if (!room.p1 || !room.p2) return;

    // Both players must be ready and have assets fully loaded (100%) to start countdown
    if (room.p1.ready && room.p2.ready && (room.p1.assetProgress || 0) >= 100 && (room.p2.assetProgress || 0) >= 100) {
      this.startRoomCountdown(room);
    }
  }

  startRoomCountdown(room) {
    room.status = 'countdown';
    room.lastActive = Date.now();

    // Create authoritative combat match
    room.match = new ServerCombatMatch(room.code, room.p1.charId, room.p2.charId);

    console.log(`[RoomManager] Starting countdown for room ${room.code}: ${room.p1.charId} vs ${room.p2.charId}`);

    this.io.to(room.code).emit(MSG.MATCH_COUNTDOWN, {
      seconds: 3,
      p1: { name: room.p1.name, charId: room.p1.charId },
      p2: { name: room.p2.name, charId: room.p2.charId }
    });

    // Match transition happens via match.update tick
  }

  // --- QUICK MATCH QUEUE ---

  queueQuickMatch(socket, playerName, charId = 'gipsy') {
    // Remove if already in queue
    this.cancelQuickMatch(socket);

    const safeName = sanitizePlayerName(playerName, 'Quick Matcher');
    const safeChar = NETWORK_CONFIG.ALLOWED_CHARACTERS.includes(charId) ? charId : 'gipsy';

    // Filter dead sockets from queue
    this.quickMatchQueue = this.quickMatchQueue.filter(entry => entry.socket && entry.socket.connected);

    if (this.quickMatchQueue.length > 0) {
      // Pair with waiting player
      const opponentEntry = this.quickMatchQueue.shift();

      // Create matched room
      const room = this.createRoom(opponentEntry.socket, opponentEntry.playerName, opponentEntry.charId);
      room.isPublic = true;

      // Join second player
      this.joinRoom(socket, room.code, safeName);

      opponentEntry.socket.emit(MSG.QUICKMATCH_STATUS, { status: 'matched', roomCode: room.code });
      socket.emit(MSG.QUICKMATCH_STATUS, { status: 'matched', roomCode: room.code });

      console.log(`[QuickMatch] Paired ${opponentEntry.playerName} and ${safeName} in room ${room.code}`);
    } else {
      // Add to queue
      this.quickMatchQueue.push({ socket, playerName: safeName, charId: safeChar });
      socket.emit(MSG.QUICKMATCH_STATUS, { status: 'searching' });
      console.log(`[QuickMatch] ${safeName} entered matchmaking queue.`);
    }
  }

  cancelQuickMatch(socket) {
    const prevLen = this.quickMatchQueue.length;
    this.quickMatchQueue = this.quickMatchQueue.filter(entry => entry.socket.id !== socket.id);
    if (this.quickMatchQueue.length < prevLen) {
      socket.emit(MSG.QUICKMATCH_STATUS, { status: 'idle' });
      console.log(`[QuickMatch] Socket ${socket.id} cancelled matchmaking.`);
    }
  }

  // --- MATCH INPUT & SIMULATION TICK ---

  handleInput(socket, rawPayload) {
    const room = this.getRoomBySocket(socket);
    if (!room || !room.match) return;

    const validated = validateInputPayload(rawPayload);
    if (!validated.valid) return;

    const isP1 = room.p1 && room.p1.socketId === socket.id;
    const isP2 = room.p2 && room.p2.socketId === socket.id;

    if (isP1) {
      room.match.enqueueInput('p1', validated);
    } else if (isP2) {
      room.match.enqueueInput('p2', validated);
    }
  }

  handlePing(socket, clientTime) {
    const room = this.getRoomBySocket(socket);
    const now = Date.now();
    const rtt = typeof clientTime === 'number' ? Math.max(0, now - clientTime) : 0;

    if (room) {
      if (room.p1 && room.p1.socketId === socket.id) room.p1.ping = rtt;
      else if (room.p2 && room.p2.socketId === socket.id) room.p2.ping = rtt;
    }

    socket.emit(MSG.MATCH_PONG, { clientTime, serverTime: now });
  }

  handleRematch(socket) {
    const room = this.getRoomBySocket(socket);
    if (!room || !room.match || room.match.gameState !== 'match_over') return;

    const isP1 = room.p1 && room.p1.socketId === socket.id;
    const isP2 = room.p2 && room.p2.socketId === socket.id;

    if (isP1) room.p1.rematchVote = true;
    else if (isP2) room.p2.rematchVote = true;
    else return;

    const p1Accepted = room.p1 ? room.p1.rematchVote : false;
    const p2Accepted = room.p2 ? room.p2.rematchVote : false;

    this.io.to(room.code).emit(MSG.MATCH_REMATCH_UPDATE, {
      p1Accepted,
      p2Accepted
    });

    if (p1Accepted && p2Accepted) {
      // Both agreed to rematch!
      room.p1.rematchVote = false;
      room.p2.rematchVote = false;
      room.match.resetMatch();
      room.status = 'in_match';
      this.io.to(room.code).emit(MSG.ROOM_UPDATE, this.serializeRoom(room));
      console.log(`[RoomManager] Rematch accepted in room ${room.code}. Match restarted.`);
    }
  }

  // Authoritative 25Hz simulation loop
  tickActiveMatches(delta) {
    for (const [code, room] of this.rooms.entries()) {
      if (!room.match) continue;

      if (room.status === 'countdown' || room.status === 'in_match') {
        room.match.update(delta);

        // Broadcast snapshot
        const snapshot = room.match.getSnapshot();
        snapshot.p1Ping = room.p1 ? room.p1.ping : 0;
        snapshot.p2Ping = room.p2 ? room.p2.ping : 0;

        this.io.to(code).emit(MSG.MATCH_SNAPSHOT, snapshot);

        if (room.match.gameState === 'match_over') {
          room.lastActive = Date.now();
        }
      }
    }
  }

  // --- DISCONNECT & RECONNECT ---

  handlePlayerDisconnect(socket, explicitSlot = null) {
    this.cancelQuickMatch(socket);

    const code = this.socketToRoom.get(socket.id);
    if (!code) return;

    const room = this.rooms.get(code);
    if (!room) return;

    let slot = explicitSlot;
    if (!slot) {
      if (room.p1 && room.p1.socketId === socket.id) slot = 'p1';
      else if (room.p2 && room.p2.socketId === socket.id) slot = 'p2';
    }

    if (!slot) return;

    console.log(`[RoomManager] Player ${slot} disconnected from room ${code}`);

    if (slot === 'p1' && room.p1) room.p1.connected = false;
    if (slot === 'p2' && room.p2) room.p2.connected = false;

    if (room.status === 'lobby') {
      if (slot === 'p2') {
        room.p2 = null;
        if (room.p1) room.p1.ready = false;
        this.broadcastRoomUpdate(room);
      } else if (slot === 'p1') {
        if (room.p2 && room.p2.connected) {
          room.p1 = room.p2;
          room.p2 = null;
          room.p1.ready = false;
          this.sessions.set(room.p1.sessionToken, { roomCode: code, slot: 'p1' });
          this.broadcastRoomUpdate(room);
        } else {
          // Give 25s grace period before destroying empty lobby
          setTimeout(() => {
            const currentRoom = this.rooms.get(code);
            if (currentRoom && currentRoom.status === 'lobby' && !currentRoom.p1?.connected && !currentRoom.p2?.connected) {
              this.destroyRoom(code);
            }
          }, 25000);
        }
      }
      return;
    }

    // Match in progress: pause combat and start 15s bounded grace period
    if (room.match && room.match.gameState !== 'match_over') {
      room.match.pauseForDisconnect(slot, NETWORK_CONFIG.RECONNECT_WINDOW_SEC);

      this.io.to(code).emit(MSG.MATCH_DISCONNECTED, {
        slot,
        name: slot === 'p1' ? room.p1.name : room.p2.name,
        reconnectWindowSec: NETWORK_CONFIG.RECONNECT_WINDOW_SEC
      });

      // Clear any prior timeout
      if (room.reconnectTimeout) clearTimeout(room.reconnectTimeout);

      room.reconnectTimeout = setTimeout(() => {
        this.handleAbandonmentTimeout(room, slot);
      }, NETWORK_CONFIG.RECONNECT_WINDOW_SEC * 1000);
    }
  }

  reconnectPlayer(socket, sessionToken) {
    const sess = this.sessions.get(sessionToken);
    if (!sess) {
      socket.emit(MSG.ROOM_ERROR, { message: 'Invalid or expired session token.' });
      return null;
    }

    const room = this.rooms.get(sess.roomCode);
    if (!room) {
      socket.emit(MSG.ROOM_ERROR, { message: 'Room has expired or no longer exists.' });
      return null;
    }

    const slot = sess.slot;
    const player = slot === 'p1' ? room.p1 : room.p2;
    if (!player) {
      socket.emit(MSG.ROOM_ERROR, { message: 'Slot is no longer available.' });
      return null;
    }

    // Cancel reconnect timeout
    if (room.reconnectTimeout) {
      clearTimeout(room.reconnectTimeout);
      room.reconnectTimeout = null;
    }

    player.socketId = socket.id;
    player.connected = true;
    this.socketToRoom.set(socket.id, room.code);
    socket.join(room.code);

    socket.emit(MSG.ROOM_JOINED, {
      roomCode: room.code,
      sessionToken,
      slot,
      room: this.serializeRoom(room)
    });

    // If room is already in match or countdown, immediately send countdown transition so player leaves lobby view
    if (room.status === 'countdown' || room.status === 'in_match') {
      socket.emit(MSG.MATCH_COUNTDOWN, {
        seconds: 1,
        p1: { name: room.p1.name, charId: room.p1.charId },
        p2: { name: room.p2 ? room.p2.name : 'Opponent', charId: room.p2 ? room.p2.charId : 'leatherback' }
      });
    }

    if (room.match && room.match.gameState === 'paused_disconnect') {
      room.match.resumeAfterReconnect();
      this.io.to(room.code).emit(MSG.MATCH_RECONNECTED, { slot, name: player.name });
    }

    console.log(`[RoomManager] Player ${player.name} (${slot}) successfully reconnected to ${room.code}`);
    return room;
  }

  handleAbandonmentTimeout(room, disconnectedSlot) {
    if (!room || !room.match || room.match.gameState === 'match_over') return;

    const winnerSlot = disconnectedSlot === 'p1' ? 'p2' : 'p1';
    const winnerPlayer = winnerSlot === 'p1' ? room.p1 : room.p2;
    const winnerName = winnerPlayer ? winnerPlayer.name : 'Remaining Player';

    room.match.gameState = 'match_over';
    room.status = 'abandoned';

    console.log(`[RoomManager] Room ${room.code} abandoned by ${disconnectedSlot}. Winner: ${winnerName}`);

    this.io.to(room.code).emit(MSG.MATCH_ABANDONED, {
      disconnectedSlot,
      winnerSlot,
      winnerName,
      message: `Opponent failed to reconnect. ${winnerName} wins by abandonment!`
    });
  }

  // --- HELPERS ---

  getRoomBySocket(socket) {
    const code = this.socketToRoom.get(socket.id);
    return code ? this.rooms.get(code) : null;
  }

  broadcastRoomUpdate(room) {
    this.io.to(room.code).emit(MSG.ROOM_UPDATE, this.serializeRoom(room));
  }

  serializeRoom(room) {
    return {
      code: room.code,
      status: room.status,
      isPublic: room.isPublic,
      p1: room.p1
        ? {
            name: room.p1.name,
            charId: room.p1.charId,
            ready: room.p1.ready,
            assetProgress: room.p1.assetProgress,
            connected: room.p1.connected,
            ping: room.p1.ping
          }
        : null,
      p2: room.p2
        ? {
            name: room.p2.name,
            charId: room.p2.charId,
            ready: room.p2.ready,
            assetProgress: room.p2.assetProgress,
            connected: room.p2.connected,
            ping: room.p2.ping
          }
        : null
    };
  }

  destroyRoom(code) {
    const room = this.rooms.get(code);
    if (!room) return;

    if (room.reconnectTimeout) clearTimeout(room.reconnectTimeout);

    if (room.p1 && room.p1.sessionToken) this.sessions.delete(room.p1.sessionToken);
    if (room.p2 && room.p2.sessionToken) this.sessions.delete(room.p2.sessionToken);

    if (room.p1 && room.p1.socketId) this.socketToRoom.delete(room.p1.socketId);
    if (room.p2 && room.p2.socketId) this.socketToRoom.delete(room.p2.socketId);

    this.rooms.delete(code);
    console.log(`[RoomManager] Room ${code} destroyed.`);
  }

  cleanupIdleRooms() {
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      if (now - room.lastActive > NETWORK_CONFIG.MAX_ROOM_IDLE_SEC * 1000) {
        if (!room.p1?.connected && !room.p2?.connected) {
          console.log(`[RoomManager] Pruning idle room ${code}`);
          this.destroyRoom(code);
        }
      }
    }
  }
}
