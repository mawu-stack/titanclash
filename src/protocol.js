/* =============================================================================
   TITAN CLASH 3D - MULTIPLAYER PROTOCOL & NETWORK SPECIFICATION
   Constants, message schemas, room code generation, and payload validators.
   ============================================================================= */

export const NETWORK_CONFIG = {
  TICK_RATE: 25, // 25 updates per second
  TICK_INTERVAL_MS: 40, // 40ms per authoritative server frame
  RECONNECT_WINDOW_SEC: 15,
  MAX_ROOM_IDLE_SEC: 180,
  CLIENT_INTERPOLATION_OFFSET_MS: 80,
  ALLOWED_CHARACTERS: ['gipsy', 'leatherback'],
  ALLOWED_ACTIONS: [
    'light',
    'heavy',
    'comboFinisher',
    'special',
    'block_start',
    'block_stop',
    'dodge',
    'interact',
    'ultimate'
  ]
};

export const MSG = {
  // Client -> Server
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_SELECT_CHAR: 'room:select_char',
  ROOM_READY: 'room:ready',
  ROOM_ASSET_PROGRESS: 'room:asset_progress',
  MATCH_INPUT: 'match:input',
  MATCH_PING: 'match:ping',
  MATCH_REMATCH: 'match:rematch',
  QUICKMATCH_QUEUE: 'quickmatch:queue',
  QUICKMATCH_CANCEL: 'quickmatch:cancel',
  SESSION_RECONNECT: 'session:reconnect',

  // Server -> Client
  ROOM_CREATED: 'room:created',
  ROOM_JOINED: 'room:joined',
  ROOM_ERROR: 'room:error',
  ROOM_UPDATE: 'room:update',
  MATCH_COUNTDOWN: 'match:countdown',
  MATCH_SNAPSHOT: 'match:snapshot',
  MATCH_PONG: 'match:pong',
  MATCH_DISCONNECTED: 'match:disconnected',
  MATCH_RECONNECTED: 'match:reconnected',
  MATCH_ABANDONED: 'match:abandoned',
  MATCH_REMATCH_UPDATE: 'match:rematch_update',
  QUICKMATCH_STATUS: 'quickmatch:status'
};

const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // excludes ambiguous 0, O, 1, I

export function generateRoomCode(length = 6) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return result;
}

export function sanitizePlayerName(name, defaultName = 'Player') {
  if (typeof name !== 'string') return defaultName;
  const clean = name.trim().replace(/[<>'"/\\&;]/g, '').slice(0, 16);
  return clean.length > 0 ? clean : defaultName;
}

export function validateInputPayload(input) {
  if (!input || typeof input !== 'object') {
    return { valid: false };
  }

  const seq = typeof input.seq === 'number' ? Math.floor(input.seq) : 0;
  let moveX = typeof input.moveX === 'number' ? Number(input.moveX) : 0;
  let moveZ = typeof input.moveZ === 'number' ? Number(input.moveZ) : 0;

  // Clamp movement vectors to unit circle
  if (isNaN(moveX)) moveX = 0;
  if (isNaN(moveZ)) moveZ = 0;
  moveX = Math.max(-1, Math.min(1, moveX));
  moveZ = Math.max(-1, Math.min(1, moveZ));
  const lenSq = moveX * moveX + moveZ * moveZ;
  if (lenSq > 1) {
    const len = Math.sqrt(lenSq);
    moveX /= len;
    moveZ /= len;
  }

  // Action validation - strictly enforce production allowlist
  let action = null;
  if (typeof input.action === 'string' && NETWORK_CONFIG.ALLOWED_ACTIONS.includes(input.action)) {
    action = input.action;
  }

  // Camera yaw basis for directional translation
  const camAngle = typeof input.camAngle === 'number' && !isNaN(input.camAngle) ? input.camAngle : 0;

  return {
    valid: true,
    seq,
    moveX,
    moveZ,
    camAngle,
    action
  };
}
