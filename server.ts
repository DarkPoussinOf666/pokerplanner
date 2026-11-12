import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { RoomState, VoteValue, HistoryItem, ParticipantVote, CreatedRoomSummary } from './src/types.js';
import {
  initFirestore,
  saveRoomToFirestore,
  loadRoomFromFirestore,
  fetchCreatedRoomsFromFirestore,
  deleteRoomFromFirestore
} from './src/lib/firebaseStore.js';

const app = express();
const httpServer = createServer(app);
const PORT = 3000;

// Initialize Firestore
initFirestore();

app.use(express.json());

// In-memory state for rooms with active timestamp tracking
const rooms: Record<string, RoomState> = {};

// Periodic Cleanup Manager (Memory Eviction & TTL Expiration)
const IDLE_MEMORY_EVICTION_MS = 2 * 60 * 60 * 1000; // 2 hours idle -> evict to Firestore
const HARD_ROOM_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days -> permanently delete room

setInterval(() => {
  const now = Date.now();
  Object.keys(rooms).forEach(async (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    
    // Check if any socket is currently in this room
    const roomSockets = io.sockets.adapter.rooms.get(roomId);
    const activeSocketCount = roomSockets ? roomSockets.size : 0;
    
    const lastActive = room.lastActiveTimestamp || room.lastUpdatedTimestamp || room.createdTimestamp || now;
    const roomAge = now - (room.createdTimestamp || now);

    // 1. Permanent expiration cleanup (older than 7 days)
    if (roomAge > HARD_ROOM_EXPIRATION_MS || (room.expireAtMs && room.expireAtMs < now)) {
      console.log(`[Lifecycle] Room ${roomId} has reached its 7-day TTL expiration. Deleting completely.`);
      delete rooms[roomId];
      try {
        await deleteRoomFromFirestore(roomId);
      } catch (err) {
        console.error(`[Lifecycle] Error deleting expired room ${roomId}:`, err);
      }
      return;
    }

    // 2. Idle memory eviction (no active sockets and idle for >2h)
    const isIdle = now - lastActive > IDLE_MEMORY_EVICTION_MS;
    if (activeSocketCount === 0 && isIdle) {
      console.log(`[Lifecycle] Evicting idle room ${roomId} from memory to Firestore.`);
      try {
        await saveRoomToFirestore(room);
      } catch (err) {
        console.error(`[Lifecycle] Error saving room ${roomId}:`, err);
      }
      delete rooms[roomId];
    }
  });
}, 10 * 60 * 1000); // Check every 10 minutes

// Socket.io initialization
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true
  }
});

// Helper to sanitize strings and prevent CSV formula injection
function sanitizeText(input: string, maxLen = 120): string {
  if (!input) return '';
  let clean = input.trim().slice(0, maxLen);
  // Neutralize CSV formula triggers (=, +, -, @, \t, \r)
  if (/^[=+\-@\t\r]/.test(clean)) {
    clean = `'${clean}`;
  }
  return clean;
}

// Helper to calculate average and mode for revealed votes
const FIBONACCI_NUMBERS = [0.5, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];

function findNearestFibonacci(num: number): number {
  return FIBONACCI_NUMBERS.reduce((prev, curr) => {
    return Math.abs(curr - num) < Math.abs(prev - num) ? curr : prev;
  });
}

function calculateValueStats(
  votes: Record<string, ParticipantVote>,
  valueExtractor: (p: ParticipantVote) => VoteValue | undefined
) {
  const numericValues: number[] = [];
  const counts: Record<string, number> = {};

  Object.values(votes).forEach(p => {
    const val = valueExtractor(p);
    if (p.hasVoted && val !== undefined) {
      const valStr = String(val);
      counts[valStr] = (counts[valStr] || 0) + 1;

      if (typeof val === 'number') {
        numericValues.push(val);
      } else if (!isNaN(Number(val)) && val !== '?' && val !== '☕') {
        numericValues.push(Number(val));
      }
    }
  });

  const totalVotes = Object.values(votes).filter(p => p.hasVoted && valueExtractor(p) !== undefined).length;

  let average: number | null = null;
  if (numericValues.length > 0) {
    const sum = numericValues.reduce((acc, curr) => acc + curr, 0);
    average = Math.round((sum / numericValues.length) * 10) / 10;
  }

  let mode: VoteValue | null = null;
  let maxCount = 0;
  let topValues: string[] = [];

  Object.entries(counts).forEach(([valStr, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topValues = [valStr];
    } else if (count === maxCount) {
      topValues.push(valStr);
    }
  });

  if (topValues.length === 1 && (totalVotes === 1 || maxCount > 1)) {
    const valStr = topValues[0];
    const parsedNum = parseFloat(valStr);
    if (!isNaN(parsedNum) && valStr !== '☕' && valStr !== '?') {
      mode = parsedNum;
    } else {
      mode = valStr as VoteValue;
    }
  }

  return { average, mode, totalVotes };
}

function calculateStats(votes: Record<string, ParticipantVote>) {
  return calculateValueStats(votes, p => p.value);
}

// Helper to check if a user is the room host based on Google UID, persistent User ID, participant flag, or secure Host Token
function checkIsHost(
  room: RoomState | undefined,
  user: { id: string; isGoogleAuth?: boolean },
  hostToken?: string
): boolean {
  if (!room) return false;
  // 1. Check Google UID or persistent user ID match
  if (user.id && room.hostId && user.id === room.hostId) return true;
  if (user.id && room.hostGoogleUid && user.id === room.hostGoogleUid) return true;
  // 2. Check participant isHost flag
  if (user.id && room.participants && room.participants[user.id]?.isHost) return true;
  // 3. Check secure hostToken match
  if (hostToken && room.hostToken && hostToken === room.hostToken) return true;
  return false;
}

// Helper to retrieve the last 10 rooms created by a user from memory and Firestore
async function getCreatedRoomsForHost(userId: string): Promise<CreatedRoomSummary[]> {
  if (!userId) return [];
  const memoryRooms: Record<string, CreatedRoomSummary> = {};

  Object.values(rooms).forEach(room => {
    if (room.hostId === userId || (room.hostGoogleUid && room.hostGoogleUid === userId)) {
      memoryRooms[room.id] = {
        roomId: room.id,
        roomName: room.name || `Salle ${room.id}`,
        createdTimestamp: room.createdTimestamp || Date.now(),
        hostId: room.hostId,
        hostName: room.hostName || 'Anonyme',
        currentStory: room.currentStory || '',
        history: room.history || [],
        backlog: room.backlog || [],
        participantCount: Object.keys(room.participants || {}).length
      };
    }
  });

  const firestoreRooms = await fetchCreatedRoomsFromFirestore(userId);
  firestoreRooms.forEach(fRoom => {
    if (!memoryRooms[fRoom.roomId]) {
      memoryRooms[fRoom.roomId] = fRoom;
    }
  });

  const allRooms = Object.values(memoryRooms);
  allRooms.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
  return allRooms.slice(0, 10);
}

// Socket.io Connection Logic
io.on('connection', (socket) => {
  let currentRoomId: string | null = null;
  let currentUserId: string | null = null;

  socket.on('room:join', async ({ roomId, user, hostToken, isReconnect }: { roomId: string; user: { id: string; name: string; email?: string; avatarUrl?: string; color?: string; icon?: string; isGoogleAuth?: boolean; isSpectator?: boolean }; hostToken?: string; isReconnect?: boolean }) => {
    socket.data.userId = user.id;
    currentRoomId = roomId;
    currentUserId = user.id;

    // Load from Firestore if not in memory
    let dbLoadTimeout = false;
    if (!rooms[roomId]) {
      try {
        const timeoutPromise = new Promise<{timeout: boolean}>((resolve) => setTimeout(() => resolve({timeout: true}), 3000));
        const dbPromise = loadRoomFromFirestore(roomId).then(r => ({ room: r }));
        const result = await Promise.race([dbPromise, timeoutPromise]) as {timeout?: boolean, room?: any};
        
        if (result.timeout) {
          console.warn(`[room-join] DB load timeout for room ${roomId}`);
          dbLoadTimeout = true;
        } else if (result.room) {
          rooms[roomId] = result.room;
        }
      } catch (err) {
        console.error('DB load catch:', err);
      }
    }

    // Initialize room if it still doesn't exist
    if (!rooms[roomId]) {
      if (isReconnect) {
        // Do not auto-create on socket reconnect
        if (dbLoadTimeout) {
          socket.emit('error:toast', { message: 'Le serveur met du temps à vérifier la salle. Veuillez patienter.' });
        } else {
          socket.emit('room:not_found', { roomId });
        }
        return;
      }
      
      const generatedToken = hostToken || `htoken-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      rooms[roomId] = {
        id: roomId,
        name: `Salle ${roomId}`,
        hostId: user.id,
        hostName: user.name,
        hostToken: generatedToken,
        hostGoogleUid: user.isGoogleAuth ? user.id : undefined,
        deckType: 'fibonacci',
        currentStory: 'US-01: Ma première User Story',
        storyStartTime: undefined,
        timerDuration: null,
        isSessionStarted: false,
        isRevealed: false,
        participants: {},
        history: [],
        backlog: [],
        emojiStats: { totalCount: 0, userCounts: {} },
        createdTimestamp: Date.now(),
        lastActiveTimestamp: Date.now(),
        kickedUserIds: []
      };
    }

    const room = rooms[roomId];
    if (!room.kickedUserIds) {
      room.kickedUserIds = [];
    }

    // Check if user was previously kicked from this room
    if (room.kickedUserIds.includes(user.id)) {
      socket.emit('user:kicked', { targetUserId: user.id });
      return;
    }

    socket.join(roomId);

    // If room has no hostId set yet, set hostId
    if (!room.hostId) {
      room.hostId = user.id;
      room.hostName = user.name;
      if (user.isGoogleAuth) room.hostGoogleUid = user.id;
      if (hostToken) room.hostToken = hostToken;
    }

    // Validate host identity using Google UID or Host Token
    const isHost = checkIsHost(room, user, hostToken);

    if (isHost) {
      room.hostId = user.id;
      room.hostName = user.name;
      if (user.isGoogleAuth) {
        room.hostGoogleUid = user.id;
      }
      if (hostToken && !room.hostToken) {
        room.hostToken = hostToken;
      }
      // Send hostToken back to socket so client can persist it in localStorage
      if (room.hostToken) {
        socket.emit('room:host_token', { roomId, hostToken: room.hostToken });
      }
    }

    const isSpectator = !!user.isSpectator;
    const prev = room.participants[user.id];

    // Add or update participant while rigorously preserving existing votes and timestamps
    room.participants[user.id] = {
      ...prev,
      userId: user.id,
      userName: user.name,
      avatarUrl: user.avatarUrl || prev?.avatarUrl,
      avatarSeed: (user as any).avatarSeed || prev?.avatarSeed,
      color: user.color || prev?.color,
      icon: user.icon || prev?.icon,
      isHost,
      isGoogleAuth: !!user.isGoogleAuth,
      isSpectator,
      isOffline: false,
      socketId: socket.id,
      hasVoted: isSpectator ? false : (prev?.hasVoted || false),
      votedAt: isSpectator ? undefined : prev?.votedAt,
      value: isSpectator ? undefined : prev?.value,
      backValue: isSpectator ? undefined : prev?.backValue,
      frontValue: isSpectator ? undefined : prev?.frontValue
    };

    // Synchronize host flag on all participants
    Object.keys(room.participants).forEach(id => {
      room.participants[id].isHost = checkIsHost(
        room,
        { id: room.participants[id].userId, isGoogleAuth: room.participants[id].isGoogleAuth },
        id === user.id ? hostToken : undefined
      );
    });

    // Send sanitized room state to everyone in the room
    broadcastRoomState(roomId);
  });

  socket.on('user:toggle_spectator', ({ roomId, userId, isSpectator }: { roomId: string; userId: string; isSpectator: boolean }) => {
    const room = rooms[roomId];
    if (room && room.participants[userId]) {
      room.participants[userId].isSpectator = isSpectator;
      if (isSpectator) {
        room.participants[userId].hasVoted = false;
        delete room.participants[userId].value;
      }
      broadcastRoomState(roomId);
    }
  });

  socket.on('session:start', ({ roomId, userId, hostToken }: { roomId: string; userId: string; hostToken?: string }) => {
    const room = rooms[roomId];
    if (room && checkIsHost(room, { id: userId, isGoogleAuth: room.participants[userId]?.isGoogleAuth }, hostToken)) {
      room.isSessionStarted = true;
      room.storyStartTime = Date.now();
      room.isRevealed = false;
      broadcastRoomState(roomId);
    }
  });

  socket.on('session:stop', ({ roomId, userId, hostToken }: { roomId: string; userId: string; hostToken?: string }) => {
    const room = rooms[roomId];
    if (room && checkIsHost(room, { id: userId, isGoogleAuth: room.participants[userId]?.isGoogleAuth }, hostToken)) {
      room.isSessionStarted = false;
      room.storyStartTime = undefined;
      room.isRevealed = false;
      Object.keys(room.participants).forEach(id => {
        room.participants[id].hasVoted = false;
        delete room.participants[id].votedAt;
        delete room.participants[id].value;
        delete room.participants[id].backValue;
        delete room.participants[id].frontValue;
      });
      broadcastRoomState(roomId);
    }
  });

  socket.on('story:update', ({ roomId, storyTitle }: { roomId: string; storyTitle: string }) => {
    const room = rooms[roomId];
    if (room) {
      room.currentStory = storyTitle.trim() || 'User Story sans titre';
      if (room.isSessionStarted) {
        room.storyStartTime = Date.now();
      }
      broadcastRoomState(roomId);
      saveRoomToFirestore(room);
    }
  });

  socket.on('backlog:update', ({ roomId, backlog }: { roomId: string; backlog: any[] }) => {
    const room = rooms[roomId];
    if (room) {
      room.backlog = Array.isArray(backlog) ? backlog : [];
      broadcastRoomState(roomId);
      saveRoomToFirestore(room);
    }
  });

  socket.on('estimation_mode:toggle', ({ roomId, userId, mode, hostToken }: { roomId: string; userId?: string; mode: 'GLOBAL' | 'DUAL'; hostToken?: string }) => {
    const room = rooms[roomId];
    const effectiveUserId = userId || socket.data?.userId;
    if (room && effectiveUserId && checkIsHost(room, { id: effectiveUserId, isGoogleAuth: room.participants[effectiveUserId]?.isGoogleAuth }, hostToken)) {
      room.estimationMode = mode;
      room.isRevealed = false;
      // Reset votes for all participants when switching estimation mode
      Object.keys(room.participants).forEach(id => {
        room.participants[id].hasVoted = false;
        delete room.participants[id].votedAt;
        delete room.participants[id].value;
        delete room.participants[id].backValue;
        delete room.participants[id].frontValue;
      });
      broadcastRoomState(roomId);
    }
  });

  socket.on('story:select_from_backlog', ({ roomId, storyTitle }: { roomId: string; storyTitle: string }) => {
    const room = rooms[roomId];
    if (room) {
      room.currentStory = storyTitle.trim() || 'User Story sans titre';
      room.isRevealed = false;
      room.isSessionStarted = true;
      room.storyStartTime = Date.now();
      
      // Reset votes for all participants when starting a new US
      Object.keys(room.participants).forEach(id => {
        room.participants[id].hasVoted = false;
        delete room.participants[id].votedAt;
        delete room.participants[id].value;
        delete room.participants[id].backValue;
        delete room.participants[id].frontValue;
      });

      broadcastRoomState(roomId);
    }
  });

  socket.on('room:update_name', ({ roomId, userId, name, hostToken }: { roomId: string; userId: string; name: string; hostToken?: string }) => {
    const room = rooms[roomId];
    if (room && checkIsHost(room, { id: userId, isGoogleAuth: room.participants[userId]?.isGoogleAuth }, hostToken)) {
      const trimmed = name.trim();
      if (trimmed) {
        room.name = trimmed;
        broadcastRoomState(roomId);
      }
    }
  });

  socket.on('vote:submit', ({ roomId, userId, value, backValue, frontValue }: { roomId: string; userId: string; value?: VoteValue; backValue?: VoteValue; frontValue?: VoteValue }) => {
    const room = rooms[roomId];
    if (room && !room.isRevealed && room.participants[userId] && !room.participants[userId].isSpectator) {
      const p = room.participants[userId];
      p.isOffline = false; // Reset offline status if they vote
      if (room.estimationMode === 'DUAL') {
        if (backValue !== undefined) p.backValue = backValue;
        if (frontValue !== undefined) p.frontValue = frontValue;
        const nowHasVoted = p.backValue !== undefined || p.frontValue !== undefined;
        if (nowHasVoted && !p.votedAt) {
          p.votedAt = Date.now();
        }
        p.hasVoted = nowHasVoted;
      } else {
        if (value !== undefined) p.value = value;
        const nowHasVoted = p.value !== undefined;
        if (nowHasVoted && !p.votedAt) {
          p.votedAt = Date.now();
        }
        p.hasVoted = nowHasVoted;
      }
      broadcastRoomState(roomId);
    }
  });

  socket.on('vote:reveal', ({ roomId, userId, hostToken }: { roomId: string; userId: string; hostToken?: string }) => {
    const room = rooms[roomId];
    if (room && checkIsHost(room, { id: userId }, hostToken) && !room.isRevealed) {
      room.isRevealed = true;
      room.revealCountdown = undefined;

      const isDual = room.estimationMode === 'DUAL';
      const startTime = room.storyStartTime || room.createdTimestamp || Date.now();
      const durationSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));

      // Calculate first voter for this story round
      const votersList = Object.values(room.participants).filter(p => p.hasVoted && p.votedAt);
      votersList.sort((a, b) => (a.votedAt || 0) - (b.votedAt || 0));
      const firstVoter = votersList.length > 0 ? votersList[0] : undefined;
      const firstVoterName = firstVoter?.userName;
      const firstVoterId = firstVoter?.userId;
      const timeToFirstVoteSeconds = firstVoter?.votedAt && room.storyStartTime
        ? Math.max(0, Math.floor((firstVoter.votedAt - room.storyStartTime) / 1000))
        : (firstVoter ? durationSeconds : undefined);

      if (isDual) {
        const backStats = calculateValueStats(room.participants, p => p.backValue);
        const frontStats = calculateValueStats(room.participants, p => p.frontValue);
        const totalVoters = Object.values(room.participants).filter(p => p.hasVoted).length;

        const votesSummary = Object.values(room.participants)
          .filter(p => p.hasVoted)
          .map(p => ({
            userId: p.userId,
            userName: p.userName,
            votedAt: p.votedAt,
            backValue: p.backValue,
            frontValue: p.frontValue
          }));

        const backDefaultFinalScore: VoteValue | null = backStats.mode !== null
          ? backStats.mode
          : (backStats.average !== null ? findNearestFibonacci(backStats.average) : null);

        const frontDefaultFinalScore: VoteValue | null = frontStats.mode !== null
          ? frontStats.mode
          : (frontStats.average !== null ? findNearestFibonacci(frontStats.average) : null);

        let combinedFinalScore: VoteValue | null = null;
        if (typeof backDefaultFinalScore === 'number' && typeof frontDefaultFinalScore === 'number') {
          combinedFinalScore = backDefaultFinalScore + frontDefaultFinalScore;
        } else if (typeof backDefaultFinalScore === 'number') {
          combinedFinalScore = backDefaultFinalScore;
        } else if (typeof frontDefaultFinalScore === 'number') {
          combinedFinalScore = frontDefaultFinalScore;
        }

        const historyEntry: HistoryItem = {
          id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          storyTitle: room.currentStory,
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          durationSeconds,
          firstVoterName,
          firstVoterId,
          timeToFirstVoteSeconds,
          estimationMode: 'DUAL',
          average: null,
          mode: null,
          finalScore: combinedFinalScore,
          backAverage: backStats.average,
          backMode: backStats.mode,
          backFinalScore: backDefaultFinalScore,
          frontAverage: frontStats.average,
          frontMode: frontStats.mode,
          frontFinalScore: frontDefaultFinalScore,
          totalVotes: totalVoters,
          votes: votesSummary
        };

        if (room.backlog) {
          const bItem = room.backlog.find(b => b.title.trim().toLowerCase() === room.currentStory.trim().toLowerCase());
          if (bItem) {
            bItem.estimatedScore = combinedFinalScore;
            bItem.estimatedBackScore = backDefaultFinalScore;
            bItem.estimatedFrontScore = frontDefaultFinalScore;
          }
        }

        room.history = [historyEntry, ...room.history].slice(0, 30);
      } else {
        const { average, mode, totalVotes } = calculateStats(room.participants);
        
        const votesSummary = Object.values(room.participants)
          .filter(p => p.hasVoted && p.value !== undefined)
          .map(p => ({
            userId: p.userId,
            userName: p.userName,
            votedAt: p.votedAt,
            value: p.value!
          }));

        const defaultFinalScore: VoteValue | null = mode !== null ? mode : (average !== null ? findNearestFibonacci(average) : null);

        const historyEntry: HistoryItem = {
          id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          storyTitle: room.currentStory,
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          durationSeconds,
          firstVoterName,
          firstVoterId,
          timeToFirstVoteSeconds,
          estimationMode: 'GLOBAL',
          average,
          mode,
          finalScore: defaultFinalScore,
          totalVotes,
          votes: votesSummary
        };

        if (room.backlog) {
          const bItem = room.backlog.find(b => b.title.trim().toLowerCase() === room.currentStory.trim().toLowerCase());
          if (bItem) {
            bItem.estimatedScore = defaultFinalScore;
          }
        }

        room.history = [historyEntry, ...room.history].slice(0, 30);
      }

      broadcastRoomState(roomId);
      saveRoomToFirestore(room);
    }
  });

  socket.on('history:arbitrate', ({ roomId, userId, historyId, finalScore, backFinalScore, frontFinalScore, hostToken }: { roomId: string; userId: string; historyId?: string; finalScore?: VoteValue; backFinalScore?: VoteValue; frontFinalScore?: VoteValue; hostToken?: string }) => {
    const room = rooms[roomId];
    const effectiveUserId = userId || socket.data?.userId;
    if (room && checkIsHost(room, { id: effectiveUserId, isGoogleAuth: room.participants[effectiveUserId]?.isGoogleAuth }, hostToken)) {
      let item = room.history.find(h => h.id === historyId);
      
      // If historyId is 'current' or not found, target the newest history entry or create one
      if (!item) {
        if (room.history.length > 0 && (!historyId || historyId === 'current')) {
          item = room.history[0];
        } else {
          const isDual = room.estimationMode === 'DUAL';
          item = {
            id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            storyTitle: room.currentStory,
            timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            durationSeconds: 0,
            estimationMode: isDual ? 'DUAL' : 'GLOBAL',
            average: null,
            mode: null,
            totalVotes: 0,
            votes: []
          };
          room.history = [item, ...room.history].slice(0, 30);
        }
      }

      if (item) {
        if (item.estimationMode === 'DUAL') {
          if (backFinalScore !== undefined) item.backFinalScore = backFinalScore;
          if (frontFinalScore !== undefined) item.frontFinalScore = frontFinalScore;

          let calcTotal = finalScore;
          if (calcTotal === undefined) {
            const b = item.backFinalScore;
            const f = item.frontFinalScore;
            if (typeof b === 'number' && typeof f === 'number') {
              calcTotal = b + f;
            } else if (typeof b === 'number') {
              calcTotal = b;
            } else if (typeof f === 'number') {
              calcTotal = f;
            } else {
              calcTotal = null;
            }
          }
          item.finalScore = calcTotal;

          if (room.backlog) {
            const bItem = room.backlog.find(b => b.title.trim().toLowerCase() === item!.storyTitle.trim().toLowerCase());
            if (bItem) {
              bItem.estimatedScore = item.finalScore;
              bItem.estimatedBackScore = item.backFinalScore;
              bItem.estimatedFrontScore = item.frontFinalScore;
            }
          }
        } else {
          if (finalScore !== undefined) {
            item.finalScore = finalScore;
          }

          if (room.backlog) {
            const bItem = room.backlog.find(b => b.title.trim().toLowerCase() === item!.storyTitle.trim().toLowerCase());
            if (bItem) {
              bItem.estimatedScore = item.finalScore;
            }
          }
        }

        broadcastRoomState(roomId);
        saveRoomToFirestore(room);
      }
    }
  });

  socket.on('vote:reset', ({ roomId, userId, nextStoryTitle, hostToken }: { roomId: string; userId: string; nextStoryTitle?: string; hostToken?: string }) => {
    const room = rooms[roomId];
    if (room && checkIsHost(room, { id: userId }, hostToken)) {
      room.isRevealed = false;
      room.isSessionStarted = true;
      room.storyStartTime = Date.now();
      if (nextStoryTitle) {
        room.currentStory = nextStoryTitle;
      }
      
      // Reset votes for all participants
      Object.keys(room.participants).forEach(id => {
        room.participants[id].hasVoted = false;
        delete room.participants[id].votedAt;
        delete room.participants[id].value;
        delete room.participants[id].backValue;
        delete room.participants[id].frontValue;
      });

      broadcastRoomState(roomId);
    }
  });

  socket.on('timer:reset', ({ roomId }: { roomId: string }) => {
    const room = rooms[roomId];
    if (room) {
      room.isSessionStarted = true;
      room.storyStartTime = Date.now();
      broadcastRoomState(roomId);
    }
  });

  socket.on('deck:change', ({ roomId, userId, deckType, deckValues, hostToken }: { roomId: string; userId?: string; deckType: any; deckValues?: any[]; hostToken?: string }) => {
    const room = rooms[roomId];
    const effectiveUserId = userId || socket.data?.userId;
    if (room && effectiveUserId && checkIsHost(room, { id: effectiveUserId, isGoogleAuth: room.participants[effectiveUserId]?.isGoogleAuth }, hostToken)) {
      room.deckType = deckType;
      if (Array.isArray(deckValues) && deckValues.length > 0) {
        // Sanitize cards: maximum 24 cards, max 12 chars each, trim
        const sanitized: VoteValue[] = [];
        for (const item of deckValues.slice(0, 24)) {
          if (typeof item === 'number' && !isNaN(item)) {
            sanitized.push(item);
          } else if (typeof item === 'string') {
            const trimmed = sanitizeText(item.trim(), 12);
            if (trimmed) {
              const numVal = parseFloat(trimmed);
              if (!isNaN(numVal) && String(numVal) === trimmed) {
                sanitized.push(numVal);
              } else {
                sanitized.push(trimmed);
              }
            }
          }
        }
        if (sanitized.length > 0) {
          room.deckValues = sanitized;
        }
      }
      room.isRevealed = false;
      // Reset votes on deck change
      Object.keys(room.participants).forEach(id => {
        room.participants[id].hasVoted = false;
        delete room.participants[id].votedAt;
        delete room.participants[id].value;
        delete room.participants[id].backValue;
        delete room.participants[id].frontValue;
      });
      broadcastRoomState(roomId);
      saveRoomToFirestore(room);
    }
  });

  socket.on('timer:config', ({ roomId, userId, duration, hostToken }: { roomId: string; userId?: string; duration: number | null; hostToken?: string }) => {
    const room = rooms[roomId];
    const effectiveUserId = userId || socket.data?.userId;
    if (room && effectiveUserId && checkIsHost(room, { id: effectiveUserId, isGoogleAuth: room.participants[effectiveUserId]?.isGoogleAuth }, hostToken)) {
      room.timerDuration = duration;
      if (duration && duration > 0) {
        room.storyStartTime = Date.now();
      }
      broadcastRoomState(roomId);
    }
  });

  // Track emoji timestamps per socket for rate-limiting (max 4 per 1000ms)
  const emojiHistory: number[] = [];

  socket.on('emoji:throw', ({ roomId, emoji, senderName, x, y }: { roomId: string; emoji: string; senderName: string; x: number; y: number }) => {
    if (!roomId || !emoji) return;

    const now = Date.now();
    // Clean history older than 1s
    while (emojiHistory.length > 0 && emojiHistory[0] < now - 1000) {
      emojiHistory.shift();
    }

    if (emojiHistory.length >= 6) {
      // Throttle excess emojis
      return;
    }
    emojiHistory.push(now);

    // Extract only emoji symbols (filter out text)
    const emojiMatches = emoji.match(/\p{Extended_Pictographic}/gu);
    if (!emojiMatches || emojiMatches.length === 0) {
      return; // Reject plain text input
    }

    const cleanEmoji = emojiMatches.slice(0, 2).join('');
    const cleanSender = sanitizeText(senderName, 24) || 'Anonyme';

    const room = rooms[roomId];
    if (room) {
      if (!room.emojiStats) {
        room.emojiStats = { totalCount: 0, userCounts: {} };
      }
      room.emojiStats.totalCount = (room.emojiStats.totalCount || 0) + 1;
      
      const senderKey = socket.data?.userId || cleanSender;
      if (!room.emojiStats.userCounts[senderKey]) {
        room.emojiStats.userCounts[senderKey] = {
          userName: cleanSender,
          count: 0,
          emojis: {}
        };
      }
      const userStat = room.emojiStats.userCounts[senderKey];
      userStat.count = (userStat.count || 0) + 1;
      userStat.emojis[cleanEmoji] = (userStat.emojis[cleanEmoji] || 0) + 1;

      // Find top emoji across whole room
      const allCounts: Record<string, number> = {};
      Object.values(room.emojiStats.userCounts).forEach(u => {
        if (u.emojis) {
          Object.entries(u.emojis).forEach(([em, c]) => {
            allCounts[em] = (allCounts[em] || 0) + c;
          });
        }
      });
      let topEm = cleanEmoji;
      let topMax = 0;
      Object.entries(allCounts).forEach(([em, c]) => {
        if (c > topMax) {
          topMax = c;
          topEm = em;
        }
      });
      room.emojiStats.topEmoji = topEm;

      // Broadcast room state so statistics modal & overlays reflect live counts
      broadcastRoomState(roomId);
    }

    io.to(roomId).emit('emoji:received', {
      id: `emoji-${Date.now()}-${Math.random()}`,
      emoji: cleanEmoji,
      senderName: cleanSender,
      x,
      y
    });
  });

  socket.on('user:kick', ({ roomId, hostUserId, targetUserId, hostToken }: { roomId: string; hostUserId: string; targetUserId: string; hostToken?: string }) => {
    const room = rooms[roomId];
    if (room && checkIsHost(room, { id: hostUserId }, hostToken) && targetUserId !== room.hostId) {
      if (!room.kickedUserIds) {
        room.kickedUserIds = [];
      }
      if (!room.kickedUserIds.includes(targetUserId)) {
        room.kickedUserIds.push(targetUserId);
      }
      delete room.participants[targetUserId];
      io.to(roomId).emit('user:kicked', { targetUserId });
      broadcastRoomState(roomId);
    }
  });

  socket.on('history:clear', ({ roomId, userId, hostToken }: { roomId: string; userId: string; hostToken?: string }) => {
    const room = rooms[roomId];
    if (room && checkIsHost(room, { id: userId }, hostToken)) {
      room.history = [];
      broadcastRoomState(roomId);
      saveRoomToFirestore(room);
    }
  });

  socket.on('history:delete_items', ({ roomId, userId, historyIds, hostToken }: { roomId: string; userId: string; historyIds: string[]; hostToken?: string }) => {
    const room = rooms[roomId];
    if (room && checkIsHost(room, { id: userId }, hostToken)) {
      if (Array.isArray(historyIds) && historyIds.length > 0) {
        room.history = room.history.filter(h => !historyIds.includes(h.id));
        broadcastRoomState(roomId);
        saveRoomToFirestore(room);
      }
    }
  });

  socket.on('vote:nudge', ({ roomId, targetUserId }: { roomId: string; targetUserId: string }) => {
    const room = rooms[roomId];
    if (room) {
      io.to(roomId).emit('vote:nudge', { targetUserId });
    }
  });

  socket.on('user:update', ({ roomId, userId, updates }: { roomId: string; userId: string; updates: any }) => {
    const room = rooms[roomId];
    if (room && room.participants[userId]) {
      const newName = updates.name || updates.userName || room.participants[userId].userName;
      
      room.participants[userId] = {
        ...room.participants[userId],
        ...updates,
        userName: newName
      };
      
      if (userId === room.hostId && newName) {
        room.hostName = newName;
      }
      
      broadcastRoomState(roomId);
    }
  });

  socket.on('room:update_name', ({ roomId, userId, name, hostToken }: { roomId: string; userId: string; name: string; hostToken?: string }) => {
    const room = rooms[roomId];
    if (room && checkIsHost(room, { id: userId }, hostToken)) {
      room.name = name;
      broadcastRoomState(roomId);
      saveRoomToFirestore(room);
    }
  });

  socket.on('user:get_created_rooms', async ({ userId }: { userId: string }) => {
    const createdRooms = await getCreatedRoomsForHost(userId);
    socket.emit('user:created_rooms', { createdRooms });
  });

  socket.on('session:check', ({ roomId, userId }: { roomId: string; userId: string }, callback: (res: { status: string }) => void) => {
    const room = rooms[roomId];
    if (!room) {
      if (typeof callback === 'function') callback({ status: 'room_not_found' });
    } else if (!room.participants[userId]) {
      if (typeof callback === 'function') callback({ status: 'user_not_found' });
    } else {
      if (typeof callback === 'function') callback({ status: 'ok' });
    }
  });

  socket.on('disconnect', () => {
    if (currentRoomId && currentUserId) {
      const room = rooms[currentRoomId];
      if (room && room.participants[currentUserId]) {
        // Mark participant as offline ONLY if the disconnecting socket matches their current socket.
        // This prevents old connection drops from marking reconnected users as offline.
        if (room.participants[currentUserId].socketId === socket.id) {
          room.participants[currentUserId].isOffline = true;
          broadcastRoomState(currentRoomId);
        }
      }
    }
  });
});

// Broadcast state to all sockets in a room while masking secret votes when not revealed
function broadcastRoomState(roomId: string) {
  const room = rooms[roomId];
  if (!room) return;

  room.lastActiveTimestamp = Date.now();
  if (!room.deckType) {
    room.deckType = 'fibonacci';
  }

  const roomSockets = io.sockets.adapter.rooms.get(roomId);
  if (roomSockets && roomSockets.size > 0) {
    for (const socketId of roomSockets) {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) continue;

      const socketUserId = socket.data?.userId;

      const sanitizedParticipants: Record<string, ParticipantVote> = {};

      Object.entries(room.participants).forEach(([id, p]) => {
        const isSelf = Boolean(socketUserId && id === socketUserId);
        const canSeeVote = Boolean(room.isRevealed || isSelf);

        sanitizedParticipants[id] = {
          ...p,
          hasVoted: Boolean(p.hasVoted),
          hasBackVoted: Boolean(p.backValue !== undefined),
          hasFrontVoted: Boolean(p.frontValue !== undefined),
          value: canSeeVote ? p.value : undefined,
          backValue: canSeeVote ? p.backValue : undefined,
          frontValue: canSeeVote ? p.frontValue : undefined
        };
      });

      const sanitizedRoomState: RoomState = {
        ...room,
        hostToken: undefined,
        participants: sanitizedParticipants
      };

      socket.emit('room:state', sanitizedRoomState);
    }
  } else {
    // Fallback broadcast
    const sanitizedParticipants: Record<string, ParticipantVote> = {};
    Object.entries(room.participants).forEach(([id, p]) => {
      sanitizedParticipants[id] = {
        ...p,
        hasVoted: Boolean(p.hasVoted),
        hasBackVoted: Boolean(p.backValue !== undefined),
        hasFrontVoted: Boolean(p.frontValue !== undefined),
        value: room.isRevealed ? p.value : undefined,
        backValue: room.isRevealed ? p.backValue : undefined,
        frontValue: room.isRevealed ? p.frontValue : undefined
      };
    });

    const sanitizedRoomState: RoomState = {
      ...room,
      hostToken: undefined,
      participants: sanitizedParticipants
    };

    io.to(roomId).emit('room:state', sanitizedRoomState);
  }
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeRooms: Object.keys(rooms).length });
});

// Endpoint to check or validate a room
app.get('/api/rooms/:roomId', async (req, res) => {
  const { roomId } = req.params;
  let room = rooms[roomId];
  if (!room) {
    const loaded = await loadRoomFromFirestore(roomId);
    if (loaded) {
      rooms[roomId] = loaded;
      room = loaded;
    }
  }
  if (!room) {
    return res.status(404).json({ exists: false, message: 'Salle non trouvée' });
  }
  res.json({
    exists: true,
    id: room.id,
    name: room.name,
    hostName: room.hostName,
    participantCount: Object.keys(room.participants).length
  });
});

// Endpoint to retrieve created rooms history for an authenticated user
app.get('/api/users/:userId/created-rooms', async (req, res) => {
  const { userId } = req.params;
  const createdRooms = await getCreatedRoomsForHost(userId);
  res.json({ createdRooms });
});

// Endpoint to delete one or multiple created rooms for a user
app.delete('/api/users/:userId/created-rooms', async (req, res) => {
  const { userId } = req.params;
  const { roomIds } = req.body || {};
  if (Array.isArray(roomIds) && roomIds.length > 0) {
    for (const rId of roomIds) {
      if (rooms[rId]) {
        delete rooms[rId];
      }
      await deleteRoomFromFirestore(rId);
    }
  }
  res.json({ success: true });
});

// Vite Middleware for Development / Static serving in Production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
