import {
  createContext, useContext, useState, useCallback, useEffect,
  useRef, type ReactNode,
} from 'react';
import {
  getTipsByTrigger, isVisibleInMode,
  type TipDef, type TipState, type GuidanceMode, type TipTriggerEvent, type TipAction,
} from '../lib/tipDefinitions';
import { getSessionId } from '../lib/identity';
import { persistence } from '../lib/persistence';
import { isTipGateOpen, type TipGameState } from './tipGate';
import { claimFloor, releaseFloor, subscribeFloor } from '../lib/floor';

// ─── Context types ────────────────────────────────────────────────────────────

interface TipContextValue {
  activeTip: TipDef | null;
  guidanceMode: GuidanceMode;
  seenCodes: Set<string>;
  /** What the loop is currently showing. Decides whether a tip may open. */
  gameState: TipGameState;
  triggerEvent: (event: TipTriggerEvent) => void;
  handleTipAction: (action: TipAction['action']) => void;
  /**
   * Told by the screen that owns the loop, because only it knows whether an
   * animation is mid-flight or a timed prompt is open. Screens must report
   * IDLE on unmount, or the gate would stay shut after the run screen closes.
   */
  reportGameState: (state: TipGameState) => void;
  setGuidanceMode: (mode: GuidanceMode) => void;
  resetTips: () => void;
}

export type { TipGameState } from './tipGate';

const TipContext = createContext<TipContextValue | null>(null);

export function useTips(): TipContextValue {
  const ctx = useContext(TipContext);
  if (!ctx) throw new Error('useTips must be used within TipProvider');
  return ctx;
}

// ─── Local storage helpers ────────────────────────────────────────────────────

const LS_SEEN_KEY = 'refi_seen_tips';
const LS_MODE_KEY = 'refi_guidance_mode';

function loadSeenFromStorage(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_SEEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeenToStorage(codes: Set<string>) {
  try {
    localStorage.setItem(LS_SEEN_KEY, JSON.stringify([...codes]));
  } catch {
    // localStorage unavailable (private mode / quota) — seen-state is
    // best-effort, so a failed write is intentionally ignored.
  }
}

function loadModeFromStorage(): GuidanceMode {
  return (localStorage.getItem(LS_MODE_KEY) as GuidanceMode | null) ?? 'FULL';
}

// ─── Remote sync (fire-and-forget) ───────────────────────────────────────────
//
// Seen-state is authoritative in local storage; these calls are a copy for
// whatever store the port resolves to. They are deliberately not awaited: a
// tip must appear at the speed of the interaction, not the network.

function syncTipShown(code: string) {
  void persistence.saveTipState(getSessionId(), {
    tipCode: code,
    state: 'SHOWN',
    lastShownAt: new Date().toISOString(),
  });
}

function syncTipCompleted(code: string, state: TipState) {
  void persistence.saveTipState(getSessionId(), {
    tipCode: code,
    state,
    completedAt: new Date().toISOString(),
  });
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TipProvider({ children }: { children: ReactNode }) {
  const [seenCodes, setSeenCodes] = useState<Set<string>>(loadSeenFromStorage);
  const [guidanceMode, setGuidanceModeState] = useState<GuidanceMode>(loadModeFromStorage);
  const [activeTip, setActiveTip] = useState<TipDef | null>(null);
  // Reported by whichever screen owns the loop. Kept here rather than read from
  // the game context so the tip system stays mountable on its own.
  const [gameState, setGameState] = useState<TipGameState>('IDLE');

  // Queue of eligible tips waiting to be shown (one at a time)
  const pendingQueue = useRef<TipDef[]>([]);

  // Attempt to show the next queued tip
  const showNextQueued = useCallback(() => {
    if (activeTip) return;
    if (!isTipGateOpen(gameState)) return;

    const queue = pendingQueue.current;
    if (queue.length === 0) return;

    // Sort by priority descending
    queue.sort((a, b) => b.priority - a.priority);
    const next = queue[0];
    if (next) {
      // One voice at a time (§11): a talking window and a tip share the same
      // floor. A denied claim leaves the tip queued; the floor subscription
      // below retries when the speech finishes.
      if (!claimFloor({ kind: 'TIP', id: next.code })) return;
      queue.shift();
      setActiveTip(next);
      syncTipShown(next.code);
    }
  }, [activeTip, gameState]);

  // Trigger a game event — finds eligible tips and queues them
  const triggerEvent = useCallback((event: TipTriggerEvent) => {
    const candidates = getTipsByTrigger(event).filter(tip => {
      if (!isVisibleInMode(tip, guidanceMode)) return false;
      if (seenCodes.has(tip.code)) return false;
      if (pendingQueue.current.find(t => t.code === tip.code)) return false;
      return true;
    });

    if (candidates.length > 0) {
      pendingQueue.current = [...pendingQueue.current, ...candidates];
      // Defer to next tick so activeTip state is current
      setTimeout(showNextQueued, 50);
    }
  }, [guidanceMode, seenCodes, showNextQueued]);

  // Handle a tip action button
  const handleTipAction = useCallback((action: TipAction['action']) => {
    if (!activeTip) return;
    const code = activeTip.code;

    const newSeen = new Set(seenCodes);
    newSeen.add(code);
    setSeenCodes(newSeen);
    saveSeenToStorage(newSeen);

    let state: TipState = 'DISMISSED';
    if (action === 'COMPLETE' || action === 'OPEN_PORTFOLIO' || action === 'OPEN_RISK' ||
        action === 'OPEN_DECIDE' || action === 'OPEN_SIGNAL' || action === 'TRY_HOLD') {
      state = 'COMPLETED';
    } else if (action === 'SNOOZE') {
      state = 'SNOOZED';
      // Put back in queue with reduced priority after a delay
      const tip = activeTip;
      setTimeout(() => {
        if (!seenCodes.has(tip.code)) {
          pendingQueue.current.push({ ...tip, priority: tip.priority - 20 });
        }
      }, 30000);
    }

    syncTipCompleted(code, state);
    setActiveTip(null);
    releaseFloor({ kind: 'TIP', id: code });

    // Show next in queue after a short gap
    setTimeout(showNextQueued, 300);
  }, [activeTip, seenCodes, showNextQueued]);

  const setGuidanceMode = useCallback((mode: GuidanceMode) => {
    setGuidanceModeState(mode);
    localStorage.setItem(LS_MODE_KEY, mode);

    void persistence.saveGuidanceMode(getSessionId(), mode);
  }, []);

  const resetTips = useCallback(() => {
    const newSeen = new Set<string>();
    setSeenCodes(newSeen);
    saveSeenToStorage(newSeen);
    if (activeTip) releaseFloor({ kind: 'TIP', id: activeTip.code });
    setActiveTip(null);
    pendingQueue.current = [];
  }, [activeTip]);

  // Retry queued tips when the floor frees up (a talking window finished).
  useEffect(() => subscribeFloor(() => {
    setTimeout(showNextQueued, 300);
  }), [showNextQueued]);

  // Show next queued tip when the active one clears, and again when the gate
  // lifts. Gating only delays a tip; a tip triggered mid-animation waits in the
  // queue and arrives when the moment is readable. Without the gameState
  // dependency the block would be indistinguishable from a drop, because
  // nothing else re-runs once the animation ends.
  useEffect(() => {
    if (!activeTip && pendingQueue.current.length > 0) {
      const t = setTimeout(showNextQueued, 300);
      return () => clearTimeout(t);
    }
  }, [activeTip, gameState, showNextQueued]);

  return (
    <TipContext.Provider value={{
      activeTip,
      guidanceMode,
      seenCodes,
      gameState,
      triggerEvent,
      handleTipAction,
      reportGameState: setGameState,
      setGuidanceMode,
      resetTips,
    }}>
      {children}
    </TipContext.Provider>
  );
}
