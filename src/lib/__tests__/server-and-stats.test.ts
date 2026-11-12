import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { AddressInfo } from 'node:net';
import { io as createClient, Socket as ClientSocket } from 'socket.io-client';
import { calculateValueStats, findNearestDeckValue, getActiveDeckValues } from '../stats';
import {
  verifyFirebaseIdToken,
  generateSecureHostToken,
  verifyHostTokenHash,
  VerifiedGoogleUser
} from '../firebaseAuthServer';
import { createPokerServer, PokerServerInstance } from '../../../server';
import { ParticipantVote, RoomState } from '../../types';

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeVote(overrides: Partial<ParticipantVote> & { userId: string }): ParticipantVote {
  return {
    userName: overrides.userName || overrides.userId,
    hasVoted: true,
    ...overrides
  };
}

function waitForEvent<T>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for socket event "${event}"`));
    }, timeoutMs);
    const handler = (data: T) => {
      clearTimeout(timer);
      resolve(data);
    };
    socket.once(event, handler);
  });
}

describe('Vote statistics & deck helpers (stats.ts)', () => {
  it('computes numeric average, mode, distribution and unanimity accurately', () => {
    const votes: ParticipantVote[] = [
      makeVote({ userId: 'u1', value: 5 }),
      makeVote({ userId: 'u2', value: 5 }),
      makeVote({ userId: 'u3', value: 8 }),
      makeVote({ userId: 'spec', value: 21, isSpectator: true })
    ];

    const res = calculateValueStats(votes, p => p.value);
    expect(res.totalVotes).toBe(3);
    expect(res.average).toBe(6);
    expect(res.mode).toBe(5);
    expect(res.isUnanimous).toBe(false);
    expect(res.distribution).toEqual({ '5': 2, '8': 1 });
  });

  it('detects unanimity and handles ties and non-consensus tokens (? / ☕)', () => {
    const unanimous = calculateValueStats(
      [makeVote({ userId: 'u1', value: 8 }), makeVote({ userId: 'u2', value: 8 })],
      p => p.value
    );
    expect(unanimous.isUnanimous).toBe(true);
    expect(unanimous.mode).toBe(8);

    const tie = calculateValueStats(
      [makeVote({ userId: 'u1', value: 3 }), makeVote({ userId: 'u2', value: 5 })],
      p => p.value
    );
    expect(tie.mode).toBeNull();
    expect(tie.average).toBe(4);

    const withQuestion = calculateValueStats(
      [makeVote({ userId: 'u1', value: 5 }), makeVote({ userId: 'u2', value: '?' })],
      p => p.value
    );
    expect(withQuestion.average).toBe(5);
    expect(withQuestion.isUnanimous).toBe(false);
  });

  it('supports T-Shirt and custom decks in getActiveDeckValues & findNearestDeckValue', () => {
    const tshirtVotes = calculateValueStats(
      [makeVote({ userId: 'u1', value: 'XL' }), makeVote({ userId: 'u2', value: 'XL' })],
      p => p.value
    );
    expect(tshirtVotes.mode).toBe('XL');
    expect(tshirtVotes.average).toBeNull();
    expect(tshirtVotes.isUnanimous).toBe(true);

    expect(findNearestDeckValue(6, 'fibonacci')).toBe(5);
    expect(findNearestDeckValue(7, 'fibonacci')).toBe(8);
    expect(findNearestDeckValue(10, 'powers_of_2')).toBe(8);
    expect(findNearestDeckValue(10, 'custom', [1, 4, 9, 16])).toBe(9);
    expect(getActiveDeckValues('custom', ['A', 'B'])).toEqual(['A', 'B']);
  });
});

describe('Cryptographic Firebase ID Token & Host Token verification (firebaseAuthServer.ts)', () => {
  const projectId = 'test-scrum-poker-proj';
  const kid = 'test-key-1';
  let privateKeyPem = '';
  let publicKeyPem = '';

  beforeAll(() => {
    const pair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    privateKeyPem = pair.privateKey;
    publicKeyPem = pair.publicKey;
  });

  function signTestJwt(
    payloadOverrides: Record<string, unknown> = {},
    headerOverrides: Record<string, unknown> = {}
  ): string {
    const nowSec = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT', kid, ...headerOverrides };
    const payload = {
      iss: `https://securetoken.google.com/${projectId}`,
      aud: projectId,
      sub: 'uid-alice-123',
      iat: nowSec - 10,
      exp: nowSec + 3600,
      email: 'alice@example.com',
      name: 'Alice Scrum',
      ...payloadOverrides
    };

    const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signingInput);
    signer.end();
    const signature = signer.sign(privateKeyPem);
    return `${signingInput}.${base64UrlEncode(signature)}`;
  }

  it('verifies a valid RS256 Firebase ID Token and rejects forged/expired tokens', async () => {
    const resolver = async () => ({ [kid]: publicKeyPem });

    const validToken = signTestJwt();
    const verified = await verifyFirebaseIdToken(validToken, projectId, resolver);
    expect(verified).toEqual({
      uid: 'google-uid-alice-123',
      rawUid: 'uid-alice-123',
      email: 'alice@example.com',
      name: 'Alice Scrum',
      picture: undefined
    });

    // Tampered payload
    const parts = validToken.split('.');
    const tamperedPayload = base64UrlEncode(
      JSON.stringify({
        iss: `https://securetoken.google.com/${projectId}`,
        aud: projectId,
        sub: 'admin-root',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      })
    );
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    expect(await verifyFirebaseIdToken(tamperedToken, projectId, resolver)).toBeNull();

    // Expired token
    const expiredToken = signTestJwt({
      iat: Math.floor(Date.now() / 1000) - 7200,
      exp: Math.floor(Date.now() / 1000) - 3600
    });
    expect(await verifyFirebaseIdToken(expiredToken, projectId, resolver)).toBeNull();

    // Wrong audience
    const wrongAudToken = signTestJwt({ aud: 'other-project' });
    expect(await verifyFirebaseIdToken(wrongAudToken, projectId, resolver)).toBeNull();
  });

  it('generates high-entropy host tokens and verifies SHA-256 hashes in constant time', () => {
    const { token, tokenHash } = generateSecureHostToken();
    expect(token.startsWith('htok_')).toBe(true);
    expect(tokenHash).toHaveLength(64);
    expect(verifyHostTokenHash(token, tokenHash)).toBe(true);
    expect(verifyHostTokenHash(`${token}x`, tokenHash)).toBe(false);
    expect(verifyHostTokenHash(undefined, tokenHash)).toBe(false);
  });
});

describe('Poker Server Socket.IO & REST Security Integration (server.ts)', () => {
  let serverInstance: PokerServerInstance;
  let baseUrl = '';
  const openSockets: ClientSocket[] = [];

  const mockTokens: Record<string, VerifiedGoogleUser> = {
    'valid-host-token': {
      uid: 'google-host-1',
      rawUid: 'host-1',
      email: 'host@example.com',
      name: 'Host Alice'
    },
    'valid-other-google-token': {
      uid: 'google-other-2',
      rawUid: 'other-2',
      email: 'bob@example.com',
      name: 'Other Bob'
    }
  };

  beforeAll(async () => {
    serverInstance = createPokerServer({
      skipFirestore: true,
      tokenVerifier: async (token) => (token && mockTokens[token]) || null
    });

    await new Promise<void>((resolve) => {
      serverInstance.httpServer.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = serverInstance.httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    for (const s of openSockets) {
      if (s.connected) s.disconnect();
    }
    await serverInstance.close();
  });

  function connectClient(): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const client = createClient(baseUrl, {
        transports: ['websocket'],
        forceNew: true,
        reconnection: false
      });
      openSockets.push(client);
      client.once('connect', () => resolve(client));
      client.once('connect_error', reject);
    });
  }

  it('blocks room creation without verified Google Auth and emits room:not_found for unknown rooms', async () => {
    const guestSocket = await connectClient();

    // 1. Attempt to join non-existent room without isCreate -> room:not_found
    const notFoundPromise = waitForEvent<{ roomId: string }>(guestSocket, 'room:not_found');
    guestSocket.emit('room:join', {
      roomId: 'scrum-ghost1',
      user: { id: 'usr-guest-1', name: 'Guest', isGoogleAuth: false }
    });
    const notFound = await notFoundPromise;
    expect(notFound.roomId).toBe('scrum-ghost1');
    expect(serverInstance.rooms['scrum-ghost1']).toBeUndefined();

    // 2. Guest attempts to create a room without Google Auth -> error:toast
    const guestCreateToastPromise = waitForEvent<{ message: string }>(guestSocket, 'error:toast');
    guestSocket.emit('room:join', {
      roomId: 'scrum-guest-create',
      isCreate: true,
      user: { id: 'usr-guest-1', name: 'Guest Creator', isGoogleAuth: false }
    });
    const guestCreateToast = await guestCreateToastPromise;
    expect(guestCreateToast.message).toMatch(/connexion Google est obligatoire/i);
    expect(serverInstance.rooms['scrum-guest-create']).toBeUndefined();

    // 3. Attempt to create a room with spoofed google-* ID & no valid idToken -> error:toast
    const errToastPromise = waitForEvent<{ message: string }>(guestSocket, 'error:toast');
    guestSocket.emit('room:join', {
      roomId: 'scrum-forged',
      isCreate: true,
      user: { id: 'google-host-1', name: 'Spoofer', isGoogleAuth: true }
    });
    const errToast = await errToastPromise;
    expect(errToast.message).toMatch(/session Google a expiré ou est invalide/i);
    expect(serverInstance.rooms['scrum-forged']).toBeUndefined();

    guestSocket.disconnect();
  });

  it('enforces vote secrecy before reveal, blocks host privilege escalation, and restricts story/backlog edits to host', async () => {
    const hostSocket = await connectClient();
    const guestSocket = await connectClient();
    const roomId = 'scrum-sec01';

    // Host creates the room with verified Google idToken
    const hostTokenPromise = waitForEvent<{ roomId: string; hostToken: string }>(hostSocket, 'room:host_token');
    const initialHostStatePromise = waitForEvent<RoomState>(hostSocket, 'room:state');

    hostSocket.emit('room:join', {
      roomId,
      isCreate: true,
      idToken: 'valid-host-token',
      user: { id: 'google-host-1', name: 'Host Alice', isGoogleAuth: true }
    });

    const [{ hostToken }, initialHostState] = await Promise.all([hostTokenPromise, initialHostStatePromise]);
    expect(hostToken.startsWith('htok_')).toBe(true);
    expect(initialHostState.hostId).toBe('google-host-1');
    // Sensitive fields must never leak in broadcasted state
    expect(initialHostState.hostToken).toBeUndefined();
    expect(initialHostState.hostTokenHash).toBeUndefined();
    expect(initialHostState.hostGoogleUid).toBeUndefined();

    // Guest attempting to spoof host's google-* ID on existing room is strictly rejected
    const spoofErrPromise = waitForEvent<{ message: string }>(guestSocket, 'error:toast');
    guestSocket.emit('room:join', {
      roomId,
      user: { id: 'google-host-1', name: 'Mallory Spoof', isGoogleAuth: true }
    });
    const spoofErr = await spoofErrPromise;
    expect(spoofErr.message).toMatch(/session Google a expiré ou est invalide/i);

    // Guest joins existing room with usr-* ID while claiming { isGoogleAuth: true, isHost: true } -> flags stripped
    const guestJoinStatePromise = waitForEvent<RoomState>(guestSocket, 'room:state');
    guestSocket.emit('room:join', {
      roomId,
      user: { id: 'usr-mallory-1', name: 'Mallory', isGoogleAuth: true, isHost: true } as unknown as {
        id: string;
        name: string;
        isGoogleAuth: boolean;
      }
    });
    const guestJoinedState = await guestJoinStatePromise;
    const malloryEntry = guestJoinedState.participants['usr-mallory-1'];
    expect(malloryEntry).toBeDefined();
    expect(malloryEntry.isHost).toBe(false);
    expect(malloryEntry.isGoogleAuth).toBe(false);

    // Guest attempts Mass Assignment via user:update ({ isHost: true })
    const afterUpdatePromise = waitForEvent<RoomState>(guestSocket, 'room:state');
    guestSocket.emit('user:update', {
      roomId,
      userId: malloryEntry.userId,
      updates: { name: 'Mallory Renamed', isHost: true, isGoogleAuth: true }
    });
    const afterUpdateState = await afterUpdatePromise;
    expect(afterUpdateState.participants[malloryEntry.userId].userName).toBe('Mallory Renamed');
    expect(afterUpdateState.participants[malloryEntry.userId].isHost).toBe(false);
    expect(afterUpdateState.participants[malloryEntry.userId].isGoogleAuth).toBe(false);

    // Guest attempts host-only story:update and backlog:update -> rejected
    const storyErrPromise = waitForEvent<{ message: string }>(guestSocket, 'error:toast');
    guestSocket.emit('story:update', { roomId, storyTitle: 'Hacked Story' });
    await storyErrPromise;
    expect(serverInstance.rooms[roomId].currentStory).not.toBe('Hacked Story');

    const backlogErrPromise = waitForEvent<{ message: string }>(guestSocket, 'error:toast');
    guestSocket.emit('backlog:update', { roomId, backlog: [{ id: '1', title: 'Injected US' }] });
    await backlogErrPromise;
    expect(serverInstance.rooms[roomId].backlog).toEqual([]);

    // Host updates story & backlog -> succeeds
    const hostStoryUpdatePromise = waitForEvent<RoomState>(guestSocket, 'room:state');
    hostSocket.emit('story:update', { roomId, storyTitle: 'US-42: Paiement Sécurisé', hostToken });
    const updatedStoryState = await hostStoryUpdatePromise;
    expect(updatedStoryState.currentStory).toBe('US-42: Paiement Sécurisé');

    // Guest submits secret vote (13); Host must see hasVoted=true but value=undefined while unrevealed!
    const hostSeesGuestVotePromise = waitForEvent<RoomState>(hostSocket, 'room:state');
    const guestSeesOwnVotePromise = waitForEvent<RoomState>(guestSocket, 'room:state');
    guestSocket.emit('vote:submit', {
      roomId,
      userId: malloryEntry!.userId,
      value: 13
    });
    const [hostViewBeforeReveal, guestViewBeforeReveal] = await Promise.all([
      hostSeesGuestVotePromise,
      guestSeesOwnVotePromise
    ]);

    expect(hostViewBeforeReveal.participants[malloryEntry!.userId].hasVoted).toBe(true);
    expect(hostViewBeforeReveal.participants[malloryEntry!.userId].value).toBeUndefined();
    expect(guestViewBeforeReveal.participants[malloryEntry!.userId].value).toBe(13);

    // Host submits vote (8) -> guest sees hasVoted=true & value=undefined before reveal
    const hostVoteHostViewPromise = waitForEvent<RoomState>(hostSocket, 'room:state');
    const hostVoteGuestViewPromise = waitForEvent<RoomState>(guestSocket, 'room:state');
    hostSocket.emit('vote:submit', { roomId, userId: 'google-host-1', value: 8 });
    const [, guestViewAfterHostVote] = await Promise.all([hostVoteHostViewPromise, hostVoteGuestViewPromise]);
    expect(guestViewAfterHostVote.participants['google-host-1'].hasVoted).toBe(true);
    expect(guestViewAfterHostVote.participants['google-host-1'].value).toBeUndefined();

    // Host reveals -> everyone sees all votes + history item
    const revealedGuestViewPromise = waitForEvent<RoomState>(guestSocket, 'room:state');
    hostSocket.emit('vote:reveal', { roomId, hostToken });
    const revealedState = await revealedGuestViewPromise;

    expect(revealedState.isRevealed).toBe(true);
    expect(revealedState.participants[malloryEntry.userId].value).toBe(13);
    expect(revealedState.participants['google-host-1'].value).toBe(8);
    expect(revealedState.history[0].average).toBe(10.5);

    hostSocket.disconnect();
    guestSocket.disconnect();
  });

  it('protects GET and DELETE /api/users/:userId/created-rooms with Bearer token & ownership', async () => {
    // 1. Unauthenticated GET -> 401
    const unauthRes = await fetch(`${baseUrl}/api/users/google-host-1/created-rooms`);
    expect(unauthRes.status).toBe(401);

    // 2. Authenticated as Bob trying to read Alice's rooms -> 403
    const forbiddenRes = await fetch(`${baseUrl}/api/users/google-host-1/created-rooms`, {
      headers: { Authorization: 'Bearer valid-other-google-token' }
    });
    expect(forbiddenRes.status).toBe(403);

    // 3. Authenticated as Alice reading own rooms -> 200 and includes scrum-sec01
    const okRes = await fetch(`${baseUrl}/api/users/google-host-1/created-rooms`, {
      headers: { Authorization: 'Bearer valid-host-token' }
    });
    expect(okRes.status).toBe(200);
    const okData = (await okRes.json()) as { createdRooms: Array<{ roomId: string }> };
    expect(okData.createdRooms.some(r => r.roomId === 'scrum-sec01')).toBe(true);

    // 4. Bob tries to delete Alice's room via his own endpoint -> room must survive!
    const bobDeleteAttempt = await fetch(`${baseUrl}/api/users/google-other-2/created-rooms`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-other-google-token'
      },
      body: JSON.stringify({ roomIds: ['scrum-sec01'] })
    });
    expect(bobDeleteAttempt.status).toBe(200);
    expect(serverInstance.rooms['scrum-sec01']).toBeDefined();

    // 5. Alice deletes her own room -> deleted from memory
    const aliceDeleteRes = await fetch(`${baseUrl}/api/users/google-host-1/created-rooms`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-host-token'
      },
      body: JSON.stringify({ roomIds: ['scrum-sec01'] })
    });
    expect(aliceDeleteRes.status).toBe(200);
    expect(serverInstance.rooms['scrum-sec01']).toBeUndefined();
  });
});
