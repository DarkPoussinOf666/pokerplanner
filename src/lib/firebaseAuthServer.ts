import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface VerifiedGoogleUser {
  uid: string; // Prefixed format: `google-${rawUid}`
  rawUid: string;
  email?: string;
  name?: string;
  picture?: string;
}

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedCerts: Record<string, string> | null = null;
let cachedCertsExpiresAt = 0;

let cachedProjectId: string | null = null;

export function getFirebaseProjectId(): string {
  if (cachedProjectId) return cachedProjectId;
  if (process.env.FIREBASE_PROJECT_ID) {
    cachedProjectId = process.env.FIREBASE_PROJECT_ID;
    return cachedProjectId;
  }
  try {
    const configPath = path.resolve('./firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (parsed.projectId) {
        cachedProjectId = String(parsed.projectId);
        return cachedProjectId;
      }
    }
  } catch {
    // ignore
  }
  return '';
}

function base64UrlDecodeToBuffer(segment: string): Buffer {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

async function getGooglePublicCerts(
  customCertsResolver?: () => Promise<Record<string, string>>
): Promise<Record<string, string>> {
  if (customCertsResolver) {
    return customCertsResolver();
  }

  const now = Date.now();
  if (cachedCerts && cachedCertsExpiresAt > now) {
    return cachedCerts;
  }

  const response = await fetch(GOOGLE_CERTS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Google public certificates: HTTP ${response.status}`);
  }

  const cacheControl = response.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeMs = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) * 1000 : 60 * 60 * 1000;

  const certs = (await response.json()) as Record<string, string>;
  cachedCerts = certs;
  cachedCertsExpiresAt = now + maxAgeMs;
  return certs;
}

/**
 * Cryptographically verifies a Firebase Auth ID Token (RS256) against Google's X.509 certificates.
 */
export async function verifyFirebaseIdToken(
  idToken: string | undefined | null,
  expectedProjectId?: string,
  customCertsResolver?: () => Promise<Record<string, string>>
): Promise<VerifiedGoogleUser | null> {
  if (!idToken || typeof idToken !== 'string') return null;

  const projectId = expectedProjectId ?? getFirebaseProjectId();
  if (!projectId) return null;

  const parts = idToken.split('.');
  if (parts.length !== 3) return null;

  try {
    const headerJson = base64UrlDecodeToBuffer(parts[0]).toString('utf-8');
    const payloadJson = base64UrlDecodeToBuffer(parts[1]).toString('utf-8');
    const signature = base64UrlDecodeToBuffer(parts[2]);

    const header = JSON.parse(headerJson) as { alg?: string; kid?: string };
    const payload = JSON.parse(payloadJson) as {
      iss?: string;
      aud?: string;
      sub?: string;
      exp?: number;
      iat?: number;
      email?: string;
      name?: string;
      picture?: string;
    };

    if (header.alg !== 'RS256' || !header.kid) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    const clockSkewSec = 60;

    if (!payload.exp || payload.exp + clockSkewSec <= nowSec) return null;
    if (!payload.iat || payload.iat - clockSkewSec > nowSec) return null;
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length > 128) return null;

    const certs = await getGooglePublicCerts(customCertsResolver);
    const certPem = certs[header.kid];
    if (!certPem) return null;

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();

    const isValid = verifier.verify(certPem, signature);
    if (!isValid) return null;

    return {
      uid: `google-${payload.sub}`,
      rawUid: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      picture: typeof payload.picture === 'string' ? payload.picture : undefined
    };
  } catch {
    return null;
  }
}

export function hashHostToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateSecureHostToken(): { token: string; tokenHash: string } {
  const token = `htok_${crypto.randomBytes(32).toString('hex')}`;
  return { token, tokenHash: hashHostToken(token) };
}

export function verifyHostTokenHash(candidateToken: string | undefined, expectedHash: string | undefined): boolean {
  if (!candidateToken || !expectedHash) return false;
  try {
    const candidateHash = hashHostToken(candidateToken);
    const a = Buffer.from(candidateHash, 'hex');
    const b = Buffer.from(expectedHash, 'hex');
    if (a.length !== b.length || a.length === 0) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
