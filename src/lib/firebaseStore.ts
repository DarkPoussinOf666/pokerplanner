import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  limit,
  Timestamp
} from 'firebase/firestore';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { RoomState, CreatedRoomSummary, VoteValue } from '../types.js';
import { hashHostToken } from './firebaseAuthServer.js';

// Room TTL configuration: 7 days of inactivity
export const ROOM_TTL_DAYS = 7;
export const ROOM_TTL_MS = ROOM_TTL_DAYS * 24 * 60 * 60 * 1000;

let db: ReturnType<typeof getFirestore> | null = null;
let isQuotaExceeded = false;
let quotaExceededLoggedTime = 0;

// Ephemeral/configured server encryption key for unrevealed votes during idle eviction
const SERVER_ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(process.env.ROOM_SECRET || `scrum-poker-ephemeral-${process.pid}-${Date.now()}`)
  .digest();

function encryptVotePayload(payload: { value?: VoteValue; backValue?: VoteValue; frontValue?: VoteValue }): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', SERVER_ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
}

function decryptVotePayload(
  sealed: string
): { value?: VoteValue; backValue?: VoteValue; frontValue?: VoteValue } | null {
  try {
    const [ivB64, tagB64, dataB64] = sealed.split('.');
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', SERVER_ENCRYPTION_KEY, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  } catch {
    return null;
  }
}

// Debounce map for saving rooms to coalesce write operations
const pendingRoomSaves = new Map<string, { timeout: NodeJS.Timeout; room: RoomState; includeSealedVotes?: boolean }>();

// In-memory short-lived cache for created rooms queries (TTL 30s) to avoid read bursts
const userCreatedRoomsCache = new Map<string, { data: CreatedRoomSummary[]; expiresAt: number }>();

export function initFirestore() {
  if (db) return db;
  try {
    const configPath = path.resolve('./firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const app = initializeApp(
        {
          apiKey: config.apiKey,
          authDomain: config.authDomain,
          projectId: config.projectId,
          storageBucket: config.storageBucket,
          messagingSenderId: config.messagingSenderId,
          appId: config.appId
        },
        'server-firestore-app'
      );
      const dbId = config.firestoreDatabaseId || '(default)';
      db = getFirestore(app, dbId);
      console.log('✅ Firestore database initialized with TTL support:', dbId);
    }
  } catch (err) {
    console.error('⚠️ Failed to initialize Firestore:', err);
  }
  return db;
}

/**
 * Recursively removes all `undefined` properties from an object/array,
 * ensuring Firestore setDoc never throws "Unsupported field value: undefined".
 */
function stripUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Timestamp) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(item => stripUndefined(item)) as unknown as T;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value !== undefined) {
      result[key] = stripUndefined(value);
    }
  }
  return result as T;
}

/**
 * Strips ephemeral runtime data and protects secrets (hashing hostToken, omitting/encrypting unrevealed votes)
 * before persisting to Firestore, and attaches Firestore native TTL fields (expireAt).
 */
function sanitizeRoomForPersistence(room: RoomState, includeSealedVotes = false): Record<string, unknown> {
  const now = Date.now();
  const expireAtMs = now + ROOM_TTL_MS;

  const cleanRoom: Record<string, unknown> = {
    id: room.id,
    name: (room.name || `Salle ${room.id}`).slice(0, 120),
    hostId: (room.hostId || 'anonymous').slice(0, 128),
    hostName: (room.hostName || 'Anonyme').slice(0, 64),
    deckType: room.deckType || 'fibonacci',
    currentStory: (room.currentStory || '').slice(0, 300),
    estimationMode: room.estimationMode || 'GLOBAL',
    isSessionStarted: Boolean(room.isSessionStarted),
    isRevealed: Boolean(room.isRevealed),
    history: (room.history || []).slice(0, 30),
    backlog: (room.backlog || []).slice(0, 200),
    createdTimestamp: room.createdTimestamp || now,
    lastUpdatedTimestamp: now,
    expireAtMs,
    // Native Firestore TTL field (Timestamp type) for automatic background purging
    expireAt: Timestamp.fromMillis(expireAtMs)
  };

  if (room.deckValues && Array.isArray(room.deckValues) && room.deckValues.length > 0) {
    cleanRoom.deckValues = room.deckValues.slice(0, 24);
  }
  if (room.hostGoogleUid) {
    cleanRoom.hostGoogleUid = room.hostGoogleUid;
  }

  // Never persist raw hostToken in plaintext; only persist SHA-256 hash
  const tokenHash = room.hostTokenHash || (room.hostToken ? hashHostToken(room.hostToken) : undefined);
  if (tokenHash) {
    cleanRoom.hostTokenHash = tokenHash;
  }

  if (room.kickedUserIds && room.kickedUserIds.length > 0) {
    cleanRoom.kickedUserIds = room.kickedUserIds.slice(0, 200);
  }

  if (room.participants) {
    const cleanParticipants: Record<string, unknown> = {};
    for (const [userId, p] of Object.entries(room.participants)) {
      if (!p) continue;
      const participantClean: Record<string, unknown> = {
        userId: p.userId || userId,
        userName: (p.userName || 'Anonyme').slice(0, 32),
        isHost: Boolean(p.isHost),
        isGoogleAuth: Boolean(p.isGoogleAuth),
        isSpectator: Boolean(p.isSpectator),
        hasVoted: room.isRevealed || includeSealedVotes ? Boolean(p.hasVoted) : false
      };
      if (p.avatarUrl) participantClean.avatarUrl = p.avatarUrl;
      if (p.avatarSeed) participantClean.avatarSeed = p.avatarSeed;
      if (p.color) participantClean.color = p.color;
      if (p.icon) participantClean.icon = p.icon;
      if (p.votedAt !== undefined && (room.isRevealed || includeSealedVotes)) {
        participantClean.votedAt = p.votedAt;
      }

      if (room.isRevealed) {
        if (p.value !== undefined) participantClean.value = p.value;
        if (p.backValue !== undefined) participantClean.backValue = p.backValue;
        if (p.frontValue !== undefined) participantClean.frontValue = p.frontValue;
      } else if (includeSealedVotes && p.hasVoted) {
        participantClean.sealedVote = encryptVotePayload({
          value: p.value,
          backValue: p.backValue,
          frontValue: p.frontValue
        });
      }

      cleanParticipants[userId] = participantClean;
    }
    cleanRoom.participants = cleanParticipants;
  }

  return stripUndefined(cleanRoom);
}

async function executeRoomSave(roomData: RoomState, includeSealedVotes = false): Promise<void> {
  const firestore = initFirestore();
  if (!firestore || !roomData?.id) return;

  try {
    const roomRef = doc(firestore, 'rooms', roomData.id);
    const cleanData = sanitizeRoomForPersistence(roomData, includeSealedVotes);

    await setDoc(roomRef, cleanData);
    isQuotaExceeded = false;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (
      errMsg.includes('RESOURCE_EXHAUSTED') ||
      errMsg.includes('Quota limit exceeded') ||
      errMsg.includes('Quota exceeded')
    ) {
      isQuotaExceeded = true;
      if (Date.now() - quotaExceededLoggedTime > 5 * 60 * 1000) {
        quotaExceededLoggedTime = Date.now();
        console.warn(
          'ℹ️ Firestore daily write quota limit reached. Falling back gracefully to in-memory persistence for active rooms.'
        );
      }
    } else {
      console.error(`⚠️ Error saving room ${roomData.id} to Firestore:`, err);
    }
  }
}

/**
 * Saves a room to Firestore with debouncing and selective persistence.
 */
export function saveRoomToFirestore(
  room: RoomState,
  immediate: boolean = false,
  includeSealedVotes: boolean = false
): Promise<void> | void {
  const firestore = initFirestore();
  if (!firestore || !room?.id) return;

  if (room.hostId) userCreatedRoomsCache.delete(room.hostId);
  if (room.hostGoogleUid) userCreatedRoomsCache.delete(room.hostGoogleUid);

  if (isQuotaExceeded && Date.now() - quotaExceededLoggedTime < 15 * 60 * 1000) {
    return;
  }

  const existing = pendingRoomSaves.get(room.id);
  if (existing) {
    clearTimeout(existing.timeout);
    pendingRoomSaves.delete(room.id);
  }

  if (immediate) {
    return executeRoomSave(room, includeSealedVotes);
  } else {
    const timeout = setTimeout(() => {
      pendingRoomSaves.delete(room.id);
      void executeRoomSave(room, includeSealedVotes);
    }, 5000);
    pendingRoomSaves.set(room.id, { timeout, room, includeSealedVotes });
  }
}

/**
 * Flushes all debounced room saves immediately (called on SIGINT / SIGTERM).
 */
export async function flushPendingRoomSaves(): Promise<void> {
  if (pendingRoomSaves.size === 0) return;
  const tasks: Promise<void>[] = [];
  for (const [roomId, entry] of pendingRoomSaves.entries()) {
    clearTimeout(entry.timeout);
    pendingRoomSaves.delete(roomId);
    tasks.push(executeRoomSave(entry.room, true));
  }
  await Promise.allSettled(tasks);
}

export async function loadRoomFromFirestore(roomId: string): Promise<RoomState | null> {
  const firestore = initFirestore();
  if (!firestore || !roomId) return null;

  try {
    const roomRef = doc(firestore, 'rooms', roomId);
    const snap = await getDoc(roomRef);
    if (snap.exists()) {
      const rawData = snap.data() as RoomState & {
        participants?: Record<string, RoomState['participants'][string] & { sealedVote?: string }>;
      };
      const now = Date.now();
      const expireAtMs =
        rawData.expireAtMs || (rawData.lastUpdatedTimestamp ? rawData.lastUpdatedTimestamp + ROOM_TTL_MS : null);
      if (expireAtMs && expireAtMs < now) {
        console.log(`[Lifecycle] Room ${roomId} has expired (TTL passed). Purging from Firestore.`);
        deleteRoomFromFirestore(roomId).catch(() => {});
        return null;
      }

      // Migrate legacy plaintext hostToken to hostTokenHash in memory and drop raw token if needed
      if (!rawData.hostTokenHash && rawData.hostToken) {
        rawData.hostTokenHash = hashHostToken(rawData.hostToken);
      }
      delete rawData.hostToken;

      // Restore sealed votes if encrypted in this server lifecycle
      if (rawData.participants) {
        for (const p of Object.values(rawData.participants)) {
          if (p && p.sealedVote) {
            const unsealed = decryptVotePayload(p.sealedVote);
            if (unsealed) {
              if (unsealed.value !== undefined) p.value = unsealed.value;
              if (unsealed.backValue !== undefined) p.backValue = unsealed.backValue;
              if (unsealed.frontValue !== undefined) p.frontValue = unsealed.frontValue;
            } else {
              p.hasVoted = false;
            }
            delete p.sealedVote;
          }
        }
      }

      return rawData;
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota limit exceeded')) {
      isQuotaExceeded = true;
    } else {
      console.error(`⚠️ Error loading room ${roomId} from Firestore:`, err);
    }
  }
  return null;
}

export async function fetchCreatedRoomsFromFirestore(userId: string): Promise<CreatedRoomSummary[]> {
  const firestore = initFirestore();
  if (!firestore || !userId) return [];

  const cached = userCreatedRoomsCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const roomsCol = collection(firestore, 'rooms');
    const q1 = query(roomsCol, where('hostId', '==', userId), limit(15));
    const snap1 = await getDocs(q1);

    const map = new Map<string, RoomState>();
    snap1.forEach(docSnap => map.set(docSnap.id, docSnap.data() as RoomState));

    if (map.size < 10) {
      const q2 = query(roomsCol, where('hostGoogleUid', '==', userId), limit(15));
      const snap2 = await getDocs(q2);
      snap2.forEach(docSnap => map.set(docSnap.id, docSnap.data() as RoomState));
    }

    const now = Date.now();
    const summaries: CreatedRoomSummary[] = Array.from(map.values())
      .filter(room => {
        const expireAtMs =
          room.expireAtMs || (room.lastUpdatedTimestamp ? room.lastUpdatedTimestamp + ROOM_TTL_MS : null);
        return !expireAtMs || expireAtMs > now;
      })
      .map(room => ({
        roomId: room.id,
        roomName: room.name || `Salle ${room.id}`,
        createdTimestamp: room.createdTimestamp || Date.now(),
        expireAtMs:
          room.expireAtMs ||
          (room.lastUpdatedTimestamp
            ? room.lastUpdatedTimestamp + ROOM_TTL_MS
            : (room.createdTimestamp || Date.now()) + ROOM_TTL_MS),
        hostId: room.hostId,
        hostName: room.hostName || 'Anonyme',
        currentStory: room.currentStory || '',
        history: room.history || [],
        backlog: room.backlog || [],
        participantCount: Object.keys(room.participants || {}).length
      }));

    const result = summaries.sort((a, b) => b.createdTimestamp - a.createdTimestamp).slice(0, 10);
    userCreatedRoomsCache.set(userId, { data: result, expiresAt: Date.now() + 30 * 1000 });
    return result;
  } catch (err) {
    console.error(`⚠️ Error fetching created rooms for user ${userId}:`, err);
  }
  return [];
}

export async function deleteRoomFromFirestore(roomId: string): Promise<void> {
  const firestore = initFirestore();
  if (!firestore || !roomId) return;

  const pending = pendingRoomSaves.get(roomId);
  if (pending) {
    clearTimeout(pending.timeout);
    pendingRoomSaves.delete(roomId);
  }

  try {
    const roomRef = doc(firestore, 'rooms', roomId);
    await deleteDoc(roomRef);
    console.log(`✅ Room ${roomId} successfully deleted from Firestore`);
  } catch (err) {
    console.error(`⚠️ Error deleting room ${roomId} from Firestore:`, err);
  }
}
