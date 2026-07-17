import {
  createContext, useContext, useState, useCallback, useEffect,
  useRef, type ReactNode,
} from 'react';
import {
  getTipsByTrigger, isVisibleInMode,
  type TipDef, type TipState, type GuidanceMode, type TipTriggerEvent, type TipAction,
} from '../lib/tipDefinitions';
import { supabase, getSessionId } from '../lib/supabase';

// ─── Context types ────────────────────────────────────────────────────────────

interface TipContextValue {
  activeTip: TipDef | null;
  guidanceMode: GuidanceMode;
  seenCodes: Set<string>;
  triggerEvent: (event: TipTriggerEvent) => void;
  handleTipAction: (action: TipAction['action']) => void;
  setGuidanceMode: (mode: GuidanceMode) => void;
  resetTips: () => void;
}

const TipContext = createContext<TipContextValue | null>(null);

export function useTips(): TipContextValue {
  const ctx = useContext(TipContext);
  if (!ctx) throw new Error('useTips must be used within TipProvider');
  return ctx;
}

// ─── Blocked game states for tip display ─────────────────────────────────────

type GameState = 'IDLE' | 'DECISION_REQUIRED' | 'MARKET_ADVANCING' | 'MACHINE_REVEAL' | 'RESULT_COMPUTING' | 'COMPLETE';

const BLOCKED_GAME_STATES: GameState[] = ['MARKET_ADVANCING', 'MACHINE_REVEAL', 'RESULT_COMPUTING'];

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

// ─── Supabase sync helpers (fire-and-forget) ──────────────────────────────────

function syncTipShown(code: string) {
  const sessionId = getSessionId();
  supabase
    .from('user_tip_states')
    .upsert(
      {
        session_id: sessionId,
        tip_code: code,
        tip_state: 'SHOWN',
        last_shown_at: new Date().toISOString(),
        show_count: 1,
      },
      { onConflict: 'session_id,tip_code', ignoreDuplicates: false }
    )
    .then(() => {});
}

function syncTipCompleted(code: string, state: TipState) {
  const sessionId = getSessionId();
  supabase
    .from('user_tip_states')
    .upsert(
      {
        session_id: sessionId,
        tip_code: code,
        tip_state: state,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,tip_code', ignoreDuplicates: false }
    )
    .then(() => {});
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TipProvider({ children }: { children: ReactNode }) {
  const [seenCodes, setSeenCodes] = useState<Set<string>>(loadSeenFromStorage);
  const [guidanceMode, setGuidanceModeState] = useState<GuidanceMode>(loadModeFromStorage);
  const [activeTip, setActiveTip] = useState<TipDef | null>(null);
  const [gameState] = useState<GameState>('IDLE');

  // Queue of eligible tips waiting to be shown (one at a time)
  const pendingQueue = useRef<TipDef[]>([]);

  // Attempt to show the next queued tip
  const showNextQueued = useCallback(() => {
    if (activeTip) return;
    if (BLOCKED_GAME_STATES.includes(gameState)) return;

    const queue = pendingQueue.current;
    if (queue.length === 0) return;

    // Sort by priority descending
    queue.sort((a, b) => b.priority - a.priority);
    const next = queue.shift();
    if (next) {
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
        action === 'OPEN_DRAFT' || action === 'OPEN_SIGNAL' || action === 'TRY_HOLD') {
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

    // Show next in queue after a short gap
    setTimeout(showNextQueued, 300);
  }, [activeTip, seenCodes, showNextQueued]);

  const setGuidanceMode = useCallback((mode: GuidanceMode) => {
    setGuidanceModeState(mode);
    localStorage.setItem(LS_MODE_KEY, mode);

    // Sync to Supabase guidance_settings
    supabase
      .from('guidance_settings')
      .upsert(
        { session_id: getSessionId(), guidance_mode: mode, updated_at: new Date().toISOString() },
        { onConflict: 'session_id' }
      )
      .then(() => {});
  }, []);

  const resetTips = useCallback(() => {
    const newSeen = new Set<string>();
    setSeenCodes(newSeen);
    saveSeenToStorage(newSeen);
    setActiveTip(null);
    pendingQueue.current = [];
  }, []);

  // Show next queued tip when active clears
  useEffect(() => {
    if (!activeTip && pendingQueue.current.length > 0) {
      const t = setTimeout(showNextQueued, 300);
      return () => clearTimeout(t);
    }
  }, [activeTip, showNextQueued]);

  return (
    <TipContext.Provider value={{
      activeTip,
      guidanceMode,
      seenCodes,
      triggerEvent,
      handleTipAction,
      setGuidanceMode,
      resetTips,
    }}>
      {children}
    </TipContext.Provider>
  );
}
