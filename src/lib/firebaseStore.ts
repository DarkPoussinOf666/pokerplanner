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
import fs from 'fs';
import path from 'path';
import { RoomState, CreatedRoomSummary } from '../types.js';

// Room TTL configuration: 7 days of inactivity
export const ROOM_TTL_DAYS = 7;
export const ROOM_TTL_MS = ROOM_TTL_DAYS * 24 * 60 * 60 * 1000;

let db: ReturnType<typeof getFirestore> | null = null;
let isQuotaExceeded = false;
let quotaExceededLoggedTime = 0;

// Debounce map for saving rooms to coalesce write operations
const pendingRoomSaves = new Map<string, { timeout: NodeJS.Timeout; room: RoomState }>();

// In-memory short-lived cache for created rooms queries (TTL 30s) to avoid read bursts
const userCreatedRoomsCache = new Map<string, { data: CreatedRoomSummary[]; expiresAt: number }>();

export function initFirestore() {
  if (db) return db;
  try {
    const configPath = path.resolve('./firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const app = initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
      });
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
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = stripUndefined(value);
    }
  }
  return result as T;
}

/**
 * Strips ephemeral and high-churn runtime data (emojis, socket IDs, offline statuses)
 * before persisting to Firestore, and attaches Firestore native TTL fields (expireAt).
 */
function sanitizeRoomForPersistence(room: RoomState): Partial<RoomState> {
  const now = Date.now();
  const expireAtMs = now + ROOM_TTL_MS;

  const cleanRoom: any = {
    id: room.id,
    name: room.name || `Salle ${room.id}`,
    hostId: room.hostId || 'anonymous',
    hostName: room.hostName || 'Anonyme',
    deckType: room.deckType || 'fibonacci',
    currentStory: room.currentStory || '',
    estimationMode: room.estimationMode || 'GLOBAL',
    isSessionStarted: Boolean(room.isSessionStarted),
    isRevealed: Boolean(room.isRevealed),
    timerDuration: room.timerDuration ?? null,
    history: (room.history || []).slice(0, 30),
    backlog: room.backlog || [],
    createdTimestamp: room.createdTimestamp || now,
    lastUpdatedTimestamp: now,
    expireAtMs: expireAtMs,
    // Native Firestore TTL field (Timestamp type) for automatic background purging
    expireAt: Timestamp.fromMillis(expireAtMs)
  };

  if (room.deckValues && Array.isArray(room.deckValues) && room.deckValues.length > 0) {
    cleanRoom.deckValues = room.deckValues;
  }
  if (room.hostGoogleUid) {
    cleanRoom.hostGoogleUid = room.hostGoogleUid;
  }
  if (room.hostToken) {
    cleanRoom.hostToken = room.hostToken;
  }
  if (room.kickedUserIds && room.kickedUserIds.length > 0) {
    cleanRoom.kickedUserIds = room.kickedUserIds;
  }

  // Sanitize participants: keep persistent profile and last voting states, drop socketIds
  if (room.participants) {
    cleanRoom.participants = {};
    for (const [userId, p] of Object.entries(room.participants)) {
      if (!p) continue;
      const participantClean: any = {
        userId: p.userId || userId,
        userName: p.userName || 'Anonyme',
        isHost: Boolean(p.isHost),
        isGoogleAuth: Boolean(p.isGoogleAuth),
        isSpectator: Boolean(p.isSpectator),
        hasVoted: Boolean(p.hasVoted)
      };
      if (p.avatarUrl) participantClean.avatarUrl = p.avatarUrl;
      if (p.avatarSeed) participantClean.avatarSeed = p.avatarSeed;
      if (p.color) participantClean.color = p.color;
      if (p.icon) participantClean.icon = p.icon;
      if (p.value !== undefined) participantClean.value = p.value;
      if (p.backValue !== undefined) participantClean.backValue = p.backValue;
      if (p.frontValue !== undefined) participantClean.frontValue = p.frontValue;
      if (p.votedAt !== undefined) participantClean.votedAt = p.votedAt;

      cleanRoom.participants[userId] = participantClean;
    }
  }

  return stripUndefined(cleanRoom);
}

/**
 * Saves a room to Firestore with debouncing and selective persistence.
 * Ephemeral operations (such as emojis or temporary connection states) must NOT call this.
 */
export function saveRoomToFirestore(room: RoomState, immediate: boolean = false): void {
  const firestore = initFirestore();
  if (!firestore || !room?.id) return;

  // Invalidate any cached summaries for this host
  if (room.hostId) userCreatedRoomsCache.delete(room.hostId);
  if (room.hostGoogleUid) userCreatedRoomsCache.delete(room.hostGoogleUid);

  // If quota was exceeded in the last 15 minutes, skip write to avoid repeated failed gRPC streams
  if (isQuotaExceeded && Date.now() - quotaExceededLoggedTime < 15 * 60 * 1000) {
    return;
  }

  // Clear existing pending debounce for this room
  const existing = pendingRoomSaves.get(room.id);
  if (existing) {
    clearTimeout(existing.timeout);
    pendingRoomSaves.delete(room.id);
  }

  const executeSave = async (roomData: RoomState) => {
    try {
      const roomRef = doc(firestore, 'rooms', roomData.id);
      const cleanData = sanitizeRoomForPersistence(roomData);

      await setDoc(roomRef, cleanData, { merge: true });
      isQuotaExceeded = false; // reset quota flag on success
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota limit exceeded') || errMsg.includes('Quota exceeded')) {
        isQuotaExceeded = true;
        if (Date.now() - quotaExceededLoggedTime > 5 * 60 * 1000) {
          quotaExceededLoggedTime = Date.now();
          console.warn('ℹ️ Firestore daily write quota limit reached. Falling back gracefully to in-memory persistence for active rooms.');
        }
      } else {
        console.error(`⚠️ Error saving room ${roomData.id} to Firestore:`, err);
      }
    }
  };

  if (immediate) {
    executeSave(room);
  } else {
    // Debounce writes to at most once every 5 seconds per room
    const timeout = setTimeout(() => {
      pendingRoomSaves.delete(room.id);
      executeSave(room);
    }, 5000);
    pendingRoomSaves.set(room.id, { timeout, room });
  }
}

export async function loadRoomFromFirestore(roomId: string): Promise<RoomState | null> {
  const firestore = initFirestore();
  if (!firestore) return null;

  try {
    const roomRef = doc(firestore, 'rooms', roomId);
    const snap = await getDoc(roomRef);
    if (snap.exists()) {
      const data = snap.data() as RoomState;
      const now = Date.now();
      const expireAtMs = data.expireAtMs || (data.lastUpdatedTimestamp ? data.lastUpdatedTimestamp + ROOM_TTL_MS : null);
      if (expireAtMs && expireAtMs < now) {
        console.log(`[Lifecycle] Room ${roomId} has expired (TTL passed). Purging from Firestore.`);
        deleteRoomFromFirestore(roomId).catch(() => {});
        return null;
      }
      return data;
    }
  } catch (err: any) {
    const errMsg = err?.message || String(err);
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

  // Check short-term cache (30s) to avoid read spikes on repeated modal opens
  const cached = userCreatedRoomsCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const roomsCol = collection(firestore, 'rooms');
    // Fetch with limit to prevent oversized read queries
    const q1 = query(roomsCol, where('hostId', '==', userId), limit(15));
    const snap1 = await getDocs(q1);

    const map = new Map<string, RoomState>();
    snap1.forEach(docSnap => map.set(docSnap.id, docSnap.data() as RoomState));

    // If needed and few results found, check hostGoogleUid if different
    if (map.size < 10) {
      const q2 = query(roomsCol, where('hostGoogleUid', '==', userId), limit(15));
      const snap2 = await getDocs(q2);
      snap2.forEach(docSnap => map.set(docSnap.id, docSnap.data() as RoomState));
    }

    const now = Date.now();
    const summaries: CreatedRoomSummary[] = Array.from(map.values())
      .filter(room => {
        const expireAtMs = room.expireAtMs || (room.lastUpdatedTimestamp ? room.lastUpdatedTimestamp + ROOM_TTL_MS : null);
        return !expireAtMs || expireAtMs > now;
      })
      .map(room => ({
        roomId: room.id,
        roomName: room.name || `Salle ${room.id}`,
        createdTimestamp: room.createdTimestamp || Date.now(),
        expireAtMs: room.expireAtMs || (room.lastUpdatedTimestamp ? room.lastUpdatedTimestamp + ROOM_TTL_MS : (room.createdTimestamp || Date.now()) + ROOM_TTL_MS),
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

  try {
    const roomRef = doc(firestore, 'rooms', roomId);
    await deleteDoc(roomRef);
    console.log(`✅ Room ${roomId} successfully deleted from Firestore`);
  } catch (err) {
    console.error(`⚠️ Error deleting room ${roomId} from Firestore:`, err);
  }
}

