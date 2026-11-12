import express from 'express';
import { createServer, Server as HttpServer } from 'node:http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import path from 'node:path';
import {
  RoomState,
  VoteValue,
  HistoryItem,
  ParticipantVote,
  CreatedRoomSummary,
  BacklogItem,
  DeckType
} from './src/types.js';
import {
  initFirestore,
  saveRoomToFirestore,
  loadRoomFromFirestore,
  fetchCreatedRoomsFromFirestore,
  deleteRoomFromFirestore,
  flushPendingRoomSaves
} from './src/lib/firebaseStore.js';
import {
  verifyFirebaseIdToken,
  VerifiedGoogleUser,
  generateSecureHostToken,
  verifyHostTokenHash
} from './src/lib/firebaseAuthServer.js';
import { calculateValueStats, findNearestDeckValue } from './src/lib/stats.js';

const VALID_DECK_TYPES = new Set<DeckType>(['fibonacci', 'tshirt', 'powers_of_2', 'hours', 'custom']);
const IDLE_MEMORY_EVICTION_MS = 2 * 60 * 60 * 1000; // 2 hours idle -> evict to Firestore
const HARD_ROOM_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days -> permanently delete room

export function sanitizeText(input: unknown, maxLen = 120): string {
  if (typeof input !== 'string') return '';
  // Strip control characters except standard spaces
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, maxLen);
}

export function isValidRoomId(roomId: unknown): roomId is string {
  return typeof roomId === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,48}$/.test(roomId);
}

function isValidVoteValue(val: unknown): val is VoteValue {
  if (typeof val === 'number') {
    return Number.isFinite(val) && val >= 0 && val <= 10000;
  }
  if (typeof val === 'string') {
    return val.trim().length > 0 && val.length <= 16;
  }
  return false;
}

function sanitizeBacklogList(rawBacklog: unknown): BacklogItem[] {
  if (!Array.isArray(rawBacklog)) return [];
  const sanitized: BacklogItem[] = [];

  for (const item of rawBacklog.slice(0, 200)) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    const title = sanitizeText(raw.title, 300);
    if (!title) continue;

    const id = sanitizeText(raw.id, 64) || `us-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const cleanItem: BacklogItem = { id, title };

    if (typeof raw.description === 'string') {
      const desc = sanitizeText(raw.description, 1000);
      if (desc) cleanItem.description = desc;
    }
    if (raw.estimatedScore === null || isValidVoteValue(raw.estimatedScore)) {
      cleanItem.estimatedScore = raw.estimatedScore;
    }
    if (raw.estimatedBackScore === null || isValidVoteValue(raw.estimatedBackScore)) {
      cleanItem.estimatedBackScore = raw.estimatedBackScore;
    }
    if (raw.estimatedFrontScore === null || isValidVoteValue(raw.estimatedFrontScore)) {
      cleanItem.estimatedFrontScore = raw.estimatedFrontScore;
    }

    sanitized.push(cleanItem);
  }

  return sanitized;
}

export interface PokerServerOptions {
  tokenVerifier?: (idToken: string | undefined | null) => Promise<VerifiedGoogleUser | null>;
  skipFirestore?: boolean;
}

export interface PokerServerInstance {
  app: express.Express;
  httpServer: HttpServer;
  io: SocketIOServer;
  rooms: Record<string, RoomState>;
  cleanupInterval: NodeJS.Timeout;
  close: () => Promise<void>;
}

export function createPokerServer(options: PokerServerOptions = {}): PokerServerInstance {
  const tokenVerifier = options.tokenVerifier ?? ((token) => verifyFirebaseIdToken(token));
  const skipFirestore = Boolean(options.skipFirestore);

  const app = express();
  const httpServer = createServer(app);

  if (!skipFirestore) {
    initFirestore();
  }

  app.use(express.json({ limit: '100kb' }));

  const rooms: Record<string, RoomState> = Object.create(null);

  const allowedOrigin = process.env.APP_URL ? [process.env.APP_URL] : true;

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigin,
      methods: ['GET', 'POST']
    },
    maxHttpBufferSize: 100_000,
    pingInterval: 10000,
    pingTimeout: 5000,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true
    }
  });

  const persistRoom = (room: RoomState, immediate = false, includeSealedVotes = false) => {
    if (skipFirestore) return;
    return saveRoomToFirestore(room, immediate, includeSealedVotes);
  };

  const loadRoom = async (roomId: string): Promise<RoomState | null> => {
    if (skipFirestore) return null;
    return loadRoomFromFirestore(roomId);
  };

  const removeRoomFromDb = async (roomId: string): Promise<void> => {
    if (skipFirestore) return;
    await deleteRoomFromFirestore(roomId);
  };

  // Periodic Cleanup Manager (Memory Eviction & TTL Expiration)
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    Object.keys(rooms).forEach(async (roomId) => {
      const room = rooms[roomId];
      if (!room) return;

      const roomSockets = io.sockets.adapter.rooms.get(roomId);
      const activeSocketCount = roomSockets ? roomSockets.size : 0;

      const lastActive = room.lastActiveTimestamp || room.lastUpdatedTimestamp || room.createdTimestamp || now;
      const roomAge = now - (room.createdTimestamp || now);

      if (roomAge > HARD_ROOM_EXPIRATION_MS || (room.expireAtMs && room.expireAtMs < now)) {
        console.log(`[Lifecycle] Room ${roomId} has reached its 7-day TTL expiration. Deleting completely.`);
        delete rooms[roomId];
        try {
          await removeRoomFromDb(roomId);
        } catch (err) {
          console.error(`[Lifecycle] Error deleting expired room ${roomId}:`, err);
        }
        return;
      }

      const isIdle = now - lastActive > IDLE_MEMORY_EVICTION_MS;
      if (activeSocketCount === 0 && isIdle) {
        console.log(`[Lifecycle] Evicting idle room ${roomId} from memory to Firestore.`);
        try {
          await persistRoom(room, true, true);
        } catch (err) {
          console.error(`[Lifecycle] Error saving room ${roomId}:`, err);
        }
        delete rooms[roomId];
      }
    });
  }, 10 * 60 * 1000);
  cleanupInterval.unref?.();

  /**
   * Cryptographically checks whether the acting socket is the legitimate room host.
   * Never trusts unverified client-supplied userId or participant flags.
   */
  function checkIsHost(room: RoomState | undefined, socket: Socket, hostToken?: string): boolean {
    if (!room) return false;
    const verifiedUid = socket.data?.verifiedGoogleUid as string | undefined;
    if (verifiedUid && room.hostGoogleUid && verifiedUid === room.hostGoogleUid) {
      return true;
    }
    if (verifiedUid && room.hostId && verifiedUid === room.hostId) {
      return true;
    }
    if (hostToken && room.hostTokenHash && verifyHostTokenHash(hostToken, room.hostTokenHash)) {
      return true;
    }
    return false;
  }

  function isParticipantHost(room: RoomState, participantId: string): boolean {
    return Boolean(
      (room.hostGoogleUid && participantId === room.hostGoogleUid) ||
        (room.hostId && participantId === room.hostId)
    );
  }

  async function getCreatedRoomsForHost(userId: string): Promise<CreatedRoomSummary[]> {
    if (!userId) return [];
    const memoryRooms: Record<string, CreatedRoomSummary> = {};

    Object.values(rooms).forEach((room) => {
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

    if (!skipFirestore) {
      const firestoreRooms = await fetchCreatedRoomsFromFirestore(userId);
      firestoreRooms.forEach((fRoom) => {
        if (!memoryRooms[fRoom.roomId]) {
          memoryRooms[fRoom.roomId] = fRoom;
        }
      });
    }

    const allRooms = Object.values(memoryRooms);
    allRooms.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
    return allRooms.slice(0, 10);
  }

  function broadcastRoomState(roomId: string) {
    const room = rooms[roomId];
    if (!room) return;

    room.lastActiveTimestamp = Date.now();
    if (!room.deckType) {
      room.deckType = 'fibonacci';
    }

    const buildSanitizedState = (viewerUserId?: string): RoomState => {
      const sanitizedParticipants: Record<string, ParticipantVote> = {};

      Object.entries(room.participants).forEach(([id, p]) => {
        const isSelf = Boolean(viewerUserId && id === viewerUserId);
        const canSeeVote = Boolean(room.isRevealed || isSelf);

        sanitizedParticipants[id] = {
          ...p,
          isHost: isParticipantHost(room, id),
          hasVoted: Boolean(p.hasVoted),
          hasBackVoted: Boolean(p.backValue !== undefined),
          hasFrontVoted: Boolean(p.frontValue !== undefined),
          value: canSeeVote ? p.value : undefined,
          backValue: canSeeVote ? p.backValue : undefined,
          frontValue: canSeeVote ? p.frontValue : undefined
        };
      });

      return {
        ...room,
        hostToken: undefined,
        hostTokenHash: undefined,
        hostGoogleUid: undefined,
        participants: sanitizedParticipants
      };
    };

    const roomSockets = io.sockets.adapter.rooms.get(roomId);
    if (roomSockets && roomSockets.size > 0) {
      for (const socketId of roomSockets) {
        const targetSocket = io.sockets.sockets.get(socketId);
        if (!targetSocket) continue;
        targetSocket.emit('room:state', buildSanitizedState(targetSocket.data?.userId));
      }
    } else {
      io.to(roomId).emit('room:state', buildSanitizedState(undefined));
    }
  }

  io.on('connection', (socket) => {
    let currentRoomId: string | null = null;
    let currentUserId: string | null = null;
    const emojiHistory: number[] = [];

    socket.on(
      'room:join',
      async (payload: {
        roomId?: string;
        user?: {
          id?: string;
          name?: string;
          email?: string;
          avatarUrl?: string;
          avatarSeed?: string;
          color?: string;
          icon?: string;
          isGoogleAuth?: boolean;
          isSpectator?: boolean;
        };
        hostToken?: string;
        idToken?: string;
        isCreate?: boolean;
        isReconnect?: boolean;
      }) => {
        const { roomId, user, hostToken, idToken, isCreate, isReconnect } = payload || {};
        if (!isValidRoomId(roomId) || !user || typeof user.id !== 'string') {
          socket.emit('error:toast', { message: 'Paramètres de salle ou utilisateur invalides.' });
          return;
        }

        // Verify Firebase ID token if provided
        let verifiedGoogle: VerifiedGoogleUser | null = null;
        if (idToken) {
          verifiedGoogle = await tokenVerifier(idToken);
          if (verifiedGoogle) {
            socket.data.verifiedGoogleUid = verifiedGoogle.uid;
          }
        }

        // Prevent unverified clients from spoofing a `google-*` user ID
        if (!verifiedGoogle && user.id.startsWith('google-')) {
          socket.emit('error:toast', {
            message: 'Votre session Google a expiré ou est invalide. Veuillez vous reconnecter.'
          });
          return;
        }

        const effectiveUserId = verifiedGoogle ? verifiedGoogle.uid : sanitizeText(user.id, 64);
        if (!effectiveUserId) {
          socket.emit('error:toast', { message: 'Identifiant utilisateur invalide.' });
          return;
        }

        const cleanUserName =
          sanitizeText(user.name || verifiedGoogle?.name || '', 24) || 'Participant';

        // Load room from Firestore if not currently in memory
        let dbLoadTimeout = false;
        if (!rooms[roomId]) {
          try {
            const timeoutPromise = new Promise<{ timeout: boolean }>((resolve) =>
              setTimeout(() => resolve({ timeout: true }), 3000)
            );
            const dbPromise = loadRoom(roomId).then((r) => ({ room: r }));
            const result = (await Promise.race([dbPromise, timeoutPromise])) as {
              timeout?: boolean;
              room?: RoomState | null;
            };

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

        // Room creation requires explicit `isCreate: true` AND verified Google Auth
        if (!rooms[roomId]) {
          if (dbLoadTimeout) {
            socket.emit('error:toast', {
              message: 'Le serveur met du temps à vérifier la salle. Veuillez réessayer.'
            });
            return;
          }

          if (!isCreate || isReconnect) {
            socket.emit('room:not_found', { roomId });
            return;
          }

          if (!verifiedGoogle) {
            socket.emit('error:toast', {
              message: 'La connexion Google est obligatoire pour créer une salle.'
            });
            return;
          }

          const { token: generatedToken, tokenHash } = generateSecureHostToken();
          rooms[roomId] = {
            id: roomId,
            name: `Salle ${roomId}`,
            hostId: verifiedGoogle.uid,
            hostName: cleanUserName,
            hostTokenHash: tokenHash,
            hostGoogleUid: verifiedGoogle.uid,
            deckType: 'fibonacci',
            currentStory: 'US-01: Ma première User Story',
            storyStartTime: undefined,
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

          socket.emit('room:host_token', { roomId, hostToken: generatedToken });
          persistRoom(rooms[roomId]);
        }

        const room = rooms[roomId];
        if (!room.kickedUserIds) {
          room.kickedUserIds = [];
        }

        if (room.kickedUserIds.includes(effectiveUserId)) {
          socket.emit('user:kicked', { targetUserId: effectiveUserId });
          return;
        }

        // Leave previous room cleanly if switching rooms on same socket
        if (currentRoomId && currentRoomId !== roomId) {
          socket.leave(currentRoomId);
          const prevRoom = rooms[currentRoomId];
          if (prevRoom && currentUserId && prevRoom.participants[currentUserId]?.socketId === socket.id) {
            prevRoom.participants[currentUserId].isOffline = true;
            broadcastRoomState(currentRoomId);
          }
        }

        socket.data.userId = effectiveUserId;
        currentRoomId = roomId;
        currentUserId = effectiveUserId;
        socket.join(roomId);

        const isHost = checkIsHost(room, socket, hostToken);
        if (isHost) {
          room.hostId = effectiveUserId;
          room.hostName = cleanUserName;
          if (verifiedGoogle) {
            room.hostGoogleUid = verifiedGoogle.uid;
          }
          // Issue a fresh hostToken if host authenticated via Google on a new browser/device
          if (!hostToken || !verifyHostTokenHash(hostToken, room.hostTokenHash)) {
            const { token: freshToken, tokenHash: freshHash } = generateSecureHostToken();
            room.hostTokenHash = freshHash;
            socket.emit('room:host_token', { roomId, hostToken: freshToken });
            persistRoom(room);
          }
        }

        const isSpectator = Boolean(user.isSpectator);
        const prev = Object.prototype.hasOwnProperty.call(room.participants, effectiveUserId)
          ? room.participants[effectiveUserId]
          : undefined;

        room.participants[effectiveUserId] = {
          ...prev,
          userId: effectiveUserId,
          userName: cleanUserName,
          avatarUrl: sanitizeText(user.avatarUrl, 512) || prev?.avatarUrl,
          avatarSeed: sanitizeText(user.avatarSeed, 128) || prev?.avatarSeed,
          color: sanitizeText(user.color, 64) || prev?.color,
          icon: sanitizeText(user.icon, 16) || prev?.icon,
          isHost: isParticipantHost(room, effectiveUserId),
          isGoogleAuth: Boolean(verifiedGoogle),
          isSpectator,
          isOffline: false,
          socketId: socket.id,
          hasVoted: isSpectator ? false : Boolean(prev?.hasVoted),
          votedAt: isSpectator ? undefined : prev?.votedAt,
          value: isSpectator ? undefined : prev?.value,
          backValue: isSpectator ? undefined : prev?.backValue,
          frontValue: isSpectator ? undefined : prev?.frontValue
        };

        broadcastRoomState(roomId);
      }
    );

    socket.on('user:toggle_spectator', ({ roomId, isSpectator }: { roomId: string; isSpectator: boolean }) => {
      const actorId = socket.data.userId as string | undefined;
      if (!isValidRoomId(roomId) || !actorId || !socket.rooms.has(roomId)) return;
      const room = rooms[roomId];
      if (room && Object.prototype.hasOwnProperty.call(room.participants, actorId)) {
        const p = room.participants[actorId];
        p.isSpectator = Boolean(isSpectator);
        if (p.isSpectator) {
          p.hasVoted = false;
          delete p.votedAt;
          delete p.value;
          delete p.backValue;
          delete p.frontValue;
        }
        broadcastRoomState(roomId);
      }
    });

    socket.on('session:start', ({ roomId, hostToken }: { roomId: string; hostToken?: string }) => {
      if (!isValidRoomId(roomId)) return;
      const room = rooms[roomId];
      if (room && checkIsHost(room, socket, hostToken)) {
        room.isSessionStarted = true;
        room.storyStartTime = Date.now();
        room.isRevealed = false;
        broadcastRoomState(roomId);
        persistRoom(room);
      }
    });

    socket.on('session:stop', ({ roomId, hostToken }: { roomId: string; hostToken?: string }) => {
      if (!isValidRoomId(roomId)) return;
      const room = rooms[roomId];
      if (room && checkIsHost(room, socket, hostToken)) {
        room.isSessionStarted = false;
        room.storyStartTime = undefined;
        room.isRevealed = false;
        Object.keys(room.participants).forEach((id) => {
          room.participants[id].hasVoted = false;
          delete room.participants[id].votedAt;
          delete room.participants[id].value;
          delete room.participants[id].backValue;
          delete room.participants[id].frontValue;
        });
        broadcastRoomState(roomId);
        persistRoom(room);
      }
    });

    socket.on(
      'story:update',
      ({ roomId, storyTitle, hostToken }: { roomId: string; storyTitle: string; hostToken?: string }) => {
        if (!isValidRoomId(roomId)) return;
        const room = rooms[roomId];
        if (!room) return;
        if (!checkIsHost(room, socket, hostToken)) {
          socket.emit('error:toast', { message: "Action réservée à l'hôte de la salle." });
          return;
        }
        room.currentStory = sanitizeText(storyTitle, 300) || 'User Story sans titre';
        if (room.isSessionStarted) {
          room.storyStartTime = Date.now();
        }
        broadcastRoomState(roomId);
        persistRoom(room);
      }
    );

    socket.on(
      'backlog:update',
      ({ roomId, backlog, hostToken }: { roomId: string; backlog: unknown[]; hostToken?: string }) => {
        if (!isValidRoomId(roomId)) return;
        const room = rooms[roomId];
        if (!room) return;
        if (!checkIsHost(room, socket, hostToken)) {
          socket.emit('error:toast', { message: "Action réservée à l'hôte de la salle." });
          return;
        }
        room.backlog = sanitizeBacklogList(backlog);
        broadcastRoomState(roomId);
        persistRoom(room);
      }
    );

    socket.on(
      'estimation_mode:toggle',
      ({ roomId, mode, hostToken }: { roomId: string; mode: 'GLOBAL' | 'DUAL'; hostToken?: string }) => {
        if (!isValidRoomId(roomId) || (mode !== 'GLOBAL' && mode !== 'DUAL')) return;
        const room = rooms[roomId];
        if (room && checkIsHost(room, socket, hostToken)) {
          room.estimationMode = mode;
          room.isRevealed = false;
          Object.keys(room.participants).forEach((id) => {
            room.participants[id].hasVoted = false;
            delete room.participants[id].votedAt;
            delete room.participants[id].value;
            delete room.participants[id].backValue;
            delete room.participants[id].frontValue;
          });
          broadcastRoomState(roomId);
          persistRoom(room);
        }
      }
    );

    socket.on(
      'story:select_from_backlog',
      ({ roomId, storyTitle, hostToken }: { roomId: string; storyTitle: string; hostToken?: string }) => {
        if (!isValidRoomId(roomId)) return;
        const room = rooms[roomId];
        if (!room) return;
        if (!checkIsHost(room, socket, hostToken)) {
          socket.emit('error:toast', { message: "Action réservée à l'hôte de la salle." });
          return;
        }
        room.currentStory = sanitizeText(storyTitle, 300) || 'User Story sans titre';
        room.isRevealed = false;
        room.isSessionStarted = true;
        room.storyStartTime = Date.now();

        Object.keys(room.participants).forEach((id) => {
          room.participants[id].hasVoted = false;
          delete room.participants[id].votedAt;
          delete room.participants[id].value;
          delete room.participants[id].backValue;
          delete room.participants[id].frontValue;
        });

        broadcastRoomState(roomId);
        persistRoom(room);
      }
    );

    socket.on(
      'room:update_name',
      ({ roomId, name, hostToken }: { roomId: string; name: string; hostToken?: string }) => {
        if (!isValidRoomId(roomId)) return;
        const room = rooms[roomId];
        if (room && checkIsHost(room, socket, hostToken)) {
          const cleanName = sanitizeText(name, 80);
          if (cleanName) {
            room.name = cleanName;
            broadcastRoomState(roomId);
            persistRoom(room);
          }
        }
      }
    );

    socket.on(
      'vote:submit',
      ({
        roomId,
        value,
        backValue,
        frontValue
      }: {
        roomId: string;
        value?: VoteValue;
        backValue?: VoteValue;
        frontValue?: VoteValue;
      }) => {
        const actorId = socket.data.userId as string | undefined;
        if (!isValidRoomId(roomId) || !actorId || !socket.rooms.has(roomId)) return;
        const room = rooms[roomId];
        if (
          room &&
          !room.isRevealed &&
          Object.prototype.hasOwnProperty.call(room.participants, actorId) &&
          !room.participants[actorId].isSpectator
        ) {
          const p = room.participants[actorId];
          p.isOffline = false;
          if (room.estimationMode === 'DUAL') {
            if (isValidVoteValue(backValue)) p.backValue = backValue;
            if (isValidVoteValue(frontValue)) p.frontValue = frontValue;
            const nowHasVoted = p.backValue !== undefined || p.frontValue !== undefined;
            if (nowHasVoted && !p.votedAt) {
              p.votedAt = Date.now();
            }
            p.hasVoted = nowHasVoted;
          } else {
            if (isValidVoteValue(value)) p.value = value;
            const nowHasVoted = p.value !== undefined;
            if (nowHasVoted && !p.votedAt) {
              p.votedAt = Date.now();
            }
            p.hasVoted = nowHasVoted;
          }
          broadcastRoomState(roomId);
        }
      }
    );

    socket.on('vote:reveal', ({ roomId, hostToken }: { roomId: string; hostToken?: string }) => {
      if (!isValidRoomId(roomId)) return;
      const room = rooms[roomId];
      if (room && checkIsHost(room, socket, hostToken) && !room.isRevealed) {
        room.isRevealed = true;

        const isDual = room.estimationMode === 'DUAL';
        const startTime = room.storyStartTime || room.createdTimestamp || Date.now();
        const durationSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));

        const votersList = Object.values(room.participants).filter((p) => p.hasVoted && p.votedAt);
        votersList.sort((a, b) => (a.votedAt || 0) - (b.votedAt || 0));
        const firstVoter = votersList.length > 0 ? votersList[0] : undefined;
        const firstVoterName = firstVoter?.userName;
        const firstVoterId = firstVoter?.userId;
        const timeToFirstVoteSeconds =
          firstVoter?.votedAt && room.storyStartTime
            ? Math.max(0, Math.floor((firstVoter.votedAt - room.storyStartTime) / 1000))
            : firstVoter
              ? durationSeconds
              : undefined;

        if (isDual) {
          const backStats = calculateValueStats(room.participants, (p) => p.backValue);
          const frontStats = calculateValueStats(room.participants, (p) => p.frontValue);
          const totalVoters = Object.values(room.participants).filter((p) => p.hasVoted && !p.isSpectator).length;

          const votesSummary = Object.values(room.participants)
            .filter((p) => p.hasVoted && !p.isSpectator)
            .map((p) => ({
              userId: p.userId,
              userName: p.userName,
              votedAt: p.votedAt,
              backValue: p.backValue,
              frontValue: p.frontValue
            }));

          const backDefaultFinalScore: VoteValue | null =
            backStats.mode !== null
              ? backStats.mode
              : backStats.average !== null
                ? findNearestDeckValue(backStats.average, room.deckType, room.deckValues)
                : null;

          const frontDefaultFinalScore: VoteValue | null =
            frontStats.mode !== null
              ? frontStats.mode
              : frontStats.average !== null
                ? findNearestDeckValue(frontStats.average, room.deckType, room.deckValues)
                : null;

          let combinedFinalScore: VoteValue | null = null;
          if (typeof backDefaultFinalScore === 'number' && typeof frontDefaultFinalScore === 'number') {
            combinedFinalScore = backDefaultFinalScore + frontDefaultFinalScore;
          } else if (typeof backDefaultFinalScore === 'number') {
            combinedFinalScore = backDefaultFinalScore;
          } else if (typeof frontDefaultFinalScore === 'number') {
            combinedFinalScore = frontDefaultFinalScore;
          }

          const historyEntry: HistoryItem = {
            id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            storyTitle: room.currentStory,
            timestamp: new Date().toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            }),
            durationSeconds,
            firstVoterName,
            firstVoterId,
            timeToFirstVoteSeconds,
            estimationMode: 'DUAL',
            deckType: room.deckType,
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
            const bItem = room.backlog.find(
              (b) => b.title.trim().toLowerCase() === room.currentStory.trim().toLowerCase()
            );
            if (bItem) {
              bItem.estimatedScore = combinedFinalScore;
              bItem.estimatedBackScore = backDefaultFinalScore;
              bItem.estimatedFrontScore = frontDefaultFinalScore;
            }
          }

          room.history = [historyEntry, ...room.history].slice(0, 30);
        } else {
          const { average, mode, totalVotes } = calculateValueStats(room.participants, (p) => p.value);

          const votesSummary = Object.values(room.participants)
            .filter((p) => p.hasVoted && !p.isSpectator && p.value !== undefined)
            .map((p) => ({
              userId: p.userId,
              userName: p.userName,
              votedAt: p.votedAt,
              value: p.value!
            }));

          const defaultFinalScore: VoteValue | null =
            mode !== null
              ? mode
              : average !== null
                ? findNearestDeckValue(average, room.deckType, room.deckValues)
                : null;

          const historyEntry: HistoryItem = {
            id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            storyTitle: room.currentStory,
            timestamp: new Date().toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            }),
            durationSeconds,
            firstVoterName,
            firstVoterId,
            timeToFirstVoteSeconds,
            estimationMode: 'GLOBAL',
            deckType: room.deckType,
            average,
            mode,
            finalScore: defaultFinalScore,
            totalVotes,
            votes: votesSummary
          };

          if (room.backlog) {
            const bItem = room.backlog.find(
              (b) => b.title.trim().toLowerCase() === room.currentStory.trim().toLowerCase()
            );
            if (bItem) {
              bItem.estimatedScore = defaultFinalScore;
            }
          }

          room.history = [historyEntry, ...room.history].slice(0, 30);
        }

        broadcastRoomState(roomId);
        persistRoom(room);
      }
    });

    socket.on(
      'history:arbitrate',
      ({
        roomId,
        historyId,
        finalScore,
        backFinalScore,
        frontFinalScore,
        hostToken
      }: {
        roomId: string;
        historyId?: string;
        finalScore?: VoteValue;
        backFinalScore?: VoteValue;
        frontFinalScore?: VoteValue;
        hostToken?: string;
      }) => {
        if (!isValidRoomId(roomId)) return;
        const room = rooms[roomId];
        if (room && checkIsHost(room, socket, hostToken)) {
          let item = room.history.find((h) => h.id === historyId);

          if (!item) {
            if (room.history.length > 0 && (!historyId || historyId === 'current')) {
              item = room.history[0];
            } else {
              const isDual = room.estimationMode === 'DUAL';
              item = {
                id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                storyTitle: room.currentStory,
                timestamp: new Date().toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                }),
                durationSeconds: 0,
                estimationMode: isDual ? 'DUAL' : 'GLOBAL',
                deckType: room.deckType,
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
              if (backFinalScore !== undefined && isValidVoteValue(backFinalScore)) {
                item.backFinalScore = backFinalScore;
              }
              if (frontFinalScore !== undefined && isValidVoteValue(frontFinalScore)) {
                item.frontFinalScore = frontFinalScore;
              }

              let calcTotal: VoteValue | null | undefined =
                finalScore !== undefined && isValidVoteValue(finalScore) ? finalScore : undefined;
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
                  calcTotal = b ?? f ?? null;
                }
              }
              item.finalScore = calcTotal;

              if (room.backlog) {
                const bItem = room.backlog.find(
                  (b) => b.title.trim().toLowerCase() === item!.storyTitle.trim().toLowerCase()
                );
                if (bItem) {
                  bItem.estimatedScore = item.finalScore;
                  bItem.estimatedBackScore = item.backFinalScore;
                  bItem.estimatedFrontScore = item.frontFinalScore;
                }
              }
            } else {
              if (finalScore !== undefined && isValidVoteValue(finalScore)) {
                item.finalScore = finalScore;
              }

              if (room.backlog) {
                const bItem = room.backlog.find(
                  (b) => b.title.trim().toLowerCase() === item!.storyTitle.trim().toLowerCase()
                );
                if (bItem) {
                  bItem.estimatedScore = item.finalScore;
                }
              }
            }

            broadcastRoomState(roomId);
            persistRoom(room);
          }
        }
      }
    );

    socket.on(
      'vote:reset',
      ({
        roomId,
        nextStoryTitle,
        hostToken
      }: {
        roomId: string;
        nextStoryTitle?: string;
        hostToken?: string;
      }) => {
        if (!isValidRoomId(roomId)) return;
        const room = rooms[roomId];
        if (room && checkIsHost(room, socket, hostToken)) {
          room.isRevealed = false;
          room.isSessionStarted = true;
          room.storyStartTime = Date.now();
          if (nextStoryTitle) {
            const cleanNext = sanitizeText(nextStoryTitle, 300);
            if (cleanNext) room.currentStory = cleanNext;
          }

          Object.keys(room.participants).forEach((id) => {
            room.participants[id].hasVoted = false;
            delete room.participants[id].votedAt;
            delete room.participants[id].value;
            delete room.participants[id].backValue;
            delete room.participants[id].frontValue;
          });

          broadcastRoomState(roomId);
          persistRoom(room);
        }
      }
    );

    socket.on('timer:reset', ({ roomId, hostToken }: { roomId: string; hostToken?: string }) => {
      if (!isValidRoomId(roomId)) return;
      const room = rooms[roomId];
      if (room && checkIsHost(room, socket, hostToken)) {
        room.isSessionStarted = true;
        room.storyStartTime = Date.now();
        broadcastRoomState(roomId);
        persistRoom(room);
      }
    });

    socket.on(
      'deck:change',
      ({
        roomId,
        deckType,
        deckValues,
        hostToken
      }: {
        roomId: string;
        deckType: DeckType;
        deckValues?: unknown[];
        hostToken?: string;
      }) => {
        if (!isValidRoomId(roomId) || !VALID_DECK_TYPES.has(deckType)) return;
        const room = rooms[roomId];
        if (room && checkIsHost(room, socket, hostToken)) {
          room.deckType = deckType;
          if (Array.isArray(deckValues) && deckValues.length > 0) {
            const sanitized: VoteValue[] = [];
            for (const item of deckValues.slice(0, 24)) {
              if (typeof item === 'number' && Number.isFinite(item)) {
                sanitized.push(item);
              } else if (typeof item === 'string') {
                const trimmed = sanitizeText(item, 12);
                if (trimmed) {
                  const numVal = Number(trimmed);
                  if (!isNaN(numVal) && String(numVal) === trimmed) {
                    sanitized.push(numVal);
                  } else {
                    sanitized.push(trimmed);
                  }
                }
              }
            }
            if (sanitized.length >= 2) {
              room.deckValues = sanitized;
            }
          }
          room.isRevealed = false;
          Object.keys(room.participants).forEach((id) => {
            room.participants[id].hasVoted = false;
            delete room.participants[id].votedAt;
            delete room.participants[id].value;
            delete room.participants[id].backValue;
            delete room.participants[id].frontValue;
          });
          broadcastRoomState(roomId);
          persistRoom(room);
        }
      }
    );

    socket.on(
      'emoji:throw',
      ({
        roomId,
        emoji,
        senderName,
        x,
        y
      }: {
        roomId: string;
        emoji: string;
        senderName: string;
        x: number;
        y: number;
      }) => {
        if (!isValidRoomId(roomId) || !emoji || !socket.rooms.has(roomId)) return;

        const now = Date.now();
        while (emojiHistory.length > 0 && emojiHistory[0] < now - 1000) {
          emojiHistory.shift();
        }
        if (emojiHistory.length >= 6) {
          return;
        }
        emojiHistory.push(now);

        const emojiMatches = String(emoji).match(/\p{Extended_Pictographic}/gu);
        if (!emojiMatches || emojiMatches.length === 0) {
          return;
        }

        const cleanEmoji = emojiMatches.slice(0, 2).join('');
        const actorId = socket.data?.userId as string | undefined;
        const room = rooms[roomId];
        if (!room) return;

        const cleanSender =
          (actorId && room.participants[actorId]?.userName) ||
          sanitizeText(senderName, 24) ||
          'Anonyme';

        if (!room.emojiStats) {
          room.emojiStats = { totalCount: 0, userCounts: {} };
        }
        room.emojiStats.totalCount = (room.emojiStats.totalCount || 0) + 1;

        const senderKey = actorId || cleanSender;
        if (!room.emojiStats.userCounts[senderKey]) {
          room.emojiStats.userCounts[senderKey] = {
            userName: cleanSender,
            count: 0,
            emojis: {}
          };
        }
        const userStat = room.emojiStats.userCounts[senderKey];
        userStat.userName = cleanSender;
        userStat.count = (userStat.count || 0) + 1;
        userStat.emojis[cleanEmoji] = (userStat.emojis[cleanEmoji] || 0) + 1;

        const allCounts: Record<string, number> = {};
        Object.values(room.emojiStats.userCounts).forEach((u) => {
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
        room.lastActiveTimestamp = now;

        const clampedX = Number.isFinite(x) ? Math.min(100, Math.max(0, x)) : 50;
        const clampedY = Number.isFinite(y) ? Math.min(100, Math.max(0, y)) : 50;

        // Lightweight broadcast with embedded emojiStats (avoids full RoomState serialization per emoji)
        io.to(roomId).emit('emoji:received', {
          id: `emoji-${now}-${Math.random().toString(36).slice(2, 8)}`,
          emoji: cleanEmoji,
          senderName: cleanSender,
          x: clampedX,
          y: clampedY,
          emojiStats: room.emojiStats
        });
      }
    );

    socket.on(
      'user:kick',
      ({
        roomId,
        targetUserId,
        hostToken
      }: {
        roomId: string;
        targetUserId: string;
        hostToken?: string;
      }) => {
        if (!isValidRoomId(roomId) || typeof targetUserId !== 'string') return;
        const room = rooms[roomId];
        if (room && checkIsHost(room, socket, hostToken) && targetUserId !== room.hostId) {
          if (!room.kickedUserIds) {
            room.kickedUserIds = [];
          }
          if (!room.kickedUserIds.includes(targetUserId)) {
            room.kickedUserIds.push(targetUserId);
          }
          delete room.participants[targetUserId];
          io.to(roomId).emit('user:kicked', { targetUserId });
          broadcastRoomState(roomId);
          persistRoom(room);
        }
      }
    );

    socket.on('history:clear', ({ roomId, hostToken }: { roomId: string; hostToken?: string }) => {
      if (!isValidRoomId(roomId)) return;
      const room = rooms[roomId];
      if (room && checkIsHost(room, socket, hostToken)) {
        room.history = [];
        broadcastRoomState(roomId);
        persistRoom(room);
      }
    });

    socket.on(
      'history:delete_items',
      ({
        roomId,
        historyIds,
        hostToken
      }: {
        roomId: string;
        historyIds: string[];
        hostToken?: string;
      }) => {
        if (!isValidRoomId(roomId)) return;
        const room = rooms[roomId];
        if (room && checkIsHost(room, socket, hostToken)) {
          if (Array.isArray(historyIds) && historyIds.length > 0) {
            room.history = room.history.filter((h) => !historyIds.includes(h.id));
            broadcastRoomState(roomId);
            persistRoom(room);
          }
        }
      }
    );

    socket.on(
      'vote:nudge',
      ({
        roomId,
        targetUserId,
        hostToken
      }: {
        roomId: string;
        targetUserId: string;
        hostToken?: string;
      }) => {
        if (!isValidRoomId(roomId) || typeof targetUserId !== 'string') return;
        const room = rooms[roomId];
        if (room && checkIsHost(room, socket, hostToken)) {
          io.to(roomId).emit('vote:nudge', { targetUserId });
        }
      }
    );

    socket.on(
      'user:update',
      ({ roomId, updates }: { roomId: string; updates?: Record<string, unknown> }) => {
        const actorId = socket.data.userId as string | undefined;
        if (!isValidRoomId(roomId) || !actorId || !socket.rooms.has(roomId) || !updates || typeof updates !== 'object') {
          return;
        }
        const room = rooms[roomId];
        if (room && Object.prototype.hasOwnProperty.call(room.participants, actorId)) {
          const existing = room.participants[actorId];
          const cleanName =
            sanitizeText(updates.name ?? updates.userName, 24) || existing.userName;

          // Strict whitelist against Mass Assignment (never allow overwriting isHost, value, userId, etc.)
          room.participants[actorId] = {
            ...existing,
            userName: cleanName,
            avatarSeed:
              updates.avatarSeed !== undefined
                ? sanitizeText(updates.avatarSeed, 128) || existing.avatarSeed
                : existing.avatarSeed,
            avatarUrl:
              updates.avatarUrl !== undefined
                ? sanitizeText(updates.avatarUrl, 512) || existing.avatarUrl
                : existing.avatarUrl,
            color:
              updates.color !== undefined
                ? sanitizeText(updates.color, 64) || existing.color
                : existing.color,
            icon:
              updates.icon !== undefined
                ? sanitizeText(updates.icon, 16) || existing.icon
                : existing.icon
          };

          if (actorId === room.hostId && cleanName) {
            room.hostName = cleanName;
          }

          broadcastRoomState(roomId);
        }
      }
    );

    socket.on('user:get_created_rooms', async ({ idToken }: { idToken?: string } = {}) => {
      let verifiedUid = socket.data?.verifiedGoogleUid as string | undefined;
      if (!verifiedUid && idToken) {
        const verified = await tokenVerifier(idToken);
        if (verified) {
          verifiedUid = verified.uid;
          socket.data.verifiedGoogleUid = verified.uid;
        }
      }
      if (!verifiedUid) {
        socket.emit('user:created_rooms', { createdRooms: [] });
        return;
      }
      const createdRooms = await getCreatedRoomsForHost(verifiedUid);
      socket.emit('user:created_rooms', { createdRooms });
    });

    socket.on(
      'session:check',
      async (
        { roomId, userId }: { roomId: string; userId: string },
        callback?: (res: { status: string }) => void
      ) => {
        if (!isValidRoomId(roomId)) {
          if (typeof callback === 'function') callback({ status: 'room_not_found' });
          return;
        }
        let room = rooms[roomId];
        if (!room) {
          const loaded = await loadRoom(roomId);
          if (loaded) {
            rooms[roomId] = loaded;
            room = loaded;
          }
        }
        if (!room) {
          if (typeof callback === 'function') callback({ status: 'room_not_found' });
        } else if (!Object.prototype.hasOwnProperty.call(room.participants, userId)) {
          if (typeof callback === 'function') callback({ status: 'user_not_found' });
        } else {
          if (typeof callback === 'function') callback({ status: 'ok' });
        }
      }
    );

    socket.on('disconnect', () => {
      if (currentRoomId && currentUserId) {
        const room = rooms[currentRoomId];
        if (room && Object.prototype.hasOwnProperty.call(room.participants, currentUserId)) {
          if (room.participants[currentUserId].socketId === socket.id) {
            room.participants[currentUserId].isOffline = true;
            broadcastRoomState(currentRoomId);
          }
        }
      }
    });
  });

  // Helper to extract and verify Bearer token on protected REST endpoints
  async function authenticateRequest(req: express.Request): Promise<VerifiedGoogleUser | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) return null;
    return tokenVerifier(token);
  }

  // API Routes
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', activeRooms: Object.keys(rooms).length });
  });

  app.get('/api/rooms/:roomId', async (req, res) => {
    const { roomId } = req.params;
    if (!isValidRoomId(roomId)) {
      return res.status(400).json({ exists: false, message: 'Identifiant de salle invalide' });
    }
    let room = rooms[roomId];
    if (!room) {
      const loaded = await loadRoom(roomId);
      if (loaded) {
        rooms[roomId] = loaded;
        room = loaded;
      }
    }
    if (!room) {
      return res.status(404).json({ exists: false, message: 'Salle non trouvée' });
    }
    return res.json({
      exists: true,
      id: room.id,
      name: room.name,
      hostName: room.hostName,
      participantCount: Object.keys(room.participants).length
    });
  });

  app.get('/api/users/:userId/created-rooms', async (req, res) => {
    const verified = await authenticateRequest(req);
    if (!verified) {
      return res.status(401).json({ error: 'Authentification Google requise.' });
    }
    if (verified.uid !== req.params.userId) {
      return res.status(403).json({ error: 'Accès interdit aux salles d’un autre utilisateur.' });
    }
    const createdRooms = await getCreatedRoomsForHost(verified.uid);
    return res.json({ createdRooms });
  });

  app.delete('/api/users/:userId/created-rooms', async (req, res) => {
    const verified = await authenticateRequest(req);
    if (!verified) {
      return res.status(401).json({ error: 'Authentification Google requise.' });
    }
    if (verified.uid !== req.params.userId) {
      return res.status(403).json({ error: 'Suppression interdite pour un autre utilisateur.' });
    }

    const { roomIds } = req.body || {};
    const deletedRoomIds: string[] = [];

    if (Array.isArray(roomIds) && roomIds.length > 0) {
      for (const rId of roomIds.slice(0, 20)) {
        if (!isValidRoomId(rId)) continue;

        let targetRoom: RoomState | null | undefined = rooms[rId];
        if (!targetRoom) {
          targetRoom = await loadRoom(rId);
        }

        // Only delete if the authenticated user actually owns this room
        if (
          targetRoom &&
          (targetRoom.hostId === verified.uid || targetRoom.hostGoogleUid === verified.uid)
        ) {
          delete rooms[rId];
          await removeRoomFromDb(rId);
          deletedRoomIds.push(rId);
        }
      }
    }

    return res.json({ success: true, deletedRoomIds });
  });

  const close = async () => {
    clearInterval(cleanupInterval);
    if (!skipFirestore) {
      await flushPendingRoomSaves();
    }
    await new Promise<void>((resolve) => {
      io.close(() => resolve());
    });
    if (httpServer.listening) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }
  };

  return { app, httpServer, io, rooms, cleanupInterval, close };
}

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  const serverInstance = createPokerServer();
  const { app, httpServer, rooms, close } = serverInstance;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const handleShutdown = async (signal: string) => {
    console.log(`[Lifecycle] Received ${signal}. Flushing active rooms before shutdown...`);
    try {
      const savePromises = Object.values(rooms).map((room) =>
        saveRoomToFirestore(room, true, true)
      );
      await Promise.allSettled(savePromises);
      await close();
    } finally {
      process.exit(0);
    }
  };

  process.once('SIGTERM', () => void handleShutdown('SIGTERM'));
  process.once('SIGINT', () => void handleShutdown('SIGINT'));

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

const entryBasename = process.argv[1] ? path.basename(process.argv[1]) : '';
const isDirectEntry =
  !process.env.VITEST &&
  process.env.NODE_ENV !== 'test' &&
  (entryBasename === 'server.ts' || entryBasename === 'server.cjs' || entryBasename === 'server.js');

if (isDirectEntry) {
  void startServer();
}
