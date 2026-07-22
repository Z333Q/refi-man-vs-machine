import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth';

/**
 * Firebase Auth (GCP-native) for a real, verifiable player identity. Anonymous
 * sign-in gives every player a durable `uid` immediately (no email); a magic-
 * link upgrade can bind an email later. The mint-handoff service verifies the
 * resulting ID token and uses the uid as the handoff `sub` — replacing the
 * spoofable localStorage session id.
 *
 * Fully guarded: if the VITE_FIREBASE_* env isn't set, this no-ops and the game
 * runs on the legacy session-id identity, so nothing breaks pre-provisioning.
 */
let app: FirebaseApp | null = null;
let auth: Auth | null = null;

function readConfig() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  if (!apiKey || !projectId) return null;
  const authDomain =
    (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) ??
    `${projectId}.firebaseapp.com`;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;
  return { apiKey, projectId, authDomain, ...(appId ? { appId } : {}) };
}

export function firebaseEnabled(): boolean {
  return readConfig() !== null;
}

function ensureAuth(): Auth | null {
  if (auth) return auth;
  const cfg = readConfig();
  if (!cfg) return null;
  app = initializeApp(cfg);
  auth = getAuth(app);
  return auth;
}

/**
 * Ensure the player has a Firebase identity (anonymous if needed) and return a
 * fresh ID token — or null when Firebase isn't configured (legacy path).
 */
export async function getFirebaseIdToken(): Promise<string | null> {
  const a = ensureAuth();
  if (!a) return null;
  if (!a.currentUser) {
    await signInAnonymously(a);
  }
  return a.currentUser ? a.currentUser.getIdToken() : null;
}
