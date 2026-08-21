// Lightweight Alpha identity — Stage 2 "save progress" of the §4 onboarding
// architecture.
//
// The spec (§4.3 Stage 2, §4.4) requires a *lightweight, reversible* lead
// identity that is created without KYC and can later bind to a formal ReFi
// user via the handoff. This module owns the client side of that identity:
// a stable `alpha_player_id` persisted locally, plus the player.* funnel
// events (§52/§59) that let the marketing funnel measure save-progress.
//
// Persistence note: this identity lives in localStorage until an account
// exists. There used to be a "best-effort" durable insert here too, which
// could never succeed: the row is owner-scoped to an authenticated user and
// nothing in the game authenticates. It has been removed rather than left to
// fail quietly, because a write that always fails is not persistence, it is
// noise in the console. When the ReFi API owns accounts, the player id is
// adopted there through the handoff. Game identity stays separate from any
// formal advisory data either way (rule 11).

import { emitEvent, getFunnelAttribution } from './events';

const PLAYER_KEY = 'refi_alpha_player_id';

function mkPlayerId(): string {
  return `alp_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

export function getAlphaPlayerId(): string | null {
  try {
    return localStorage.getItem(PLAYER_KEY);
  } catch {
    return null;
  }
}

export function isProgressSaved(): boolean {
  return getAlphaPlayerId() !== null;
}

// Ensure a lightweight Alpha identity exists. First creation emits
// `player.created` (once) with acquisition attribution so the funnel can
// credit the source. Returns the stable id.
export function ensureAlphaPlayer(): string {
  const existing = getAlphaPlayerId();
  if (existing) return existing;

  const id = mkPlayerId();
  try {
    localStorage.setItem(PLAYER_KEY, id);
  } catch {
    // localStorage unavailable — identity is best-effort this session.
  }

  emitEvent('player.created', { attribution: getFunnelAttribution() }, { alphaPlayerId: id });

  return id;
}

// Record that the player's progress was saved (Stage 2). Idempotent per
// session via the caller's guard; emits `player.progress_saved`.
export function markProgressSaved(): void {
  const id = ensureAlphaPlayer();
  emitEvent('player.progress_saved', {}, { alphaPlayerId: id });
}
