import { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { isProgressSaved, markProgressSaved } from '../../lib/alphaIdentity';
import {
  requestHandoffToken,
  handoffClaimUrl,
  handoffFallbackUrl,
  type HandoffDestination,
  type HandoffProgress,
} from '../../lib/handoff';
import { emitEvent } from '../../lib/events';

// Never-trap onboarding bridge (§4.1) — a persistent, unobtrusive surface
// that lets the player (a) save their run into a lightweight Alpha identity
// (§4.3 Stage 2) and (b) leave for formal ReFi onboarding at any milestone,
// without ever being forced. The exit is user-initiated only, so it does
// not leak top-of-funnel traffic; it is intentionally absent from the
// attract screen and hidden during an active checkpoint decision.

const EXITS: { dest: HandoffDestination; label: string; note: string }[] = [
  { dest: 'PAPER', label: 'RUN IN PAPER MODE', note: 'History is closed. The live market is not.' },
  { dest: 'ELIGIBILITY', label: 'ENTER REFI ONBOARDING', note: 'Your game progress is preserved.' },
];

export function OnboardingBridge() {
  const { state } = useGame();
  const [saved, setSaved] = useState(() => isProgressSaved());
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Best-effort progress for the handoff token (§4.4 approved metadata only).
  const p = state.profile;
  const progress: HandoffProgress = {
    completedArenas: [], // TODO: track real arena completion (prototype)
    machineBuilderUnlocked: p.unlockedModules.length > 0,
    machineVersionCount: 0,
    machineBeatRate:
      p.machineAttempts > 0 ? Number((p.machineBeats / p.machineAttempts).toFixed(4)) : null,
  };

  const openMenu = () => {
    setOpen(o => {
      const next = !o;
      if (next) emitEvent('conversion.paper_cta_viewed', { surface: 'onboarding_bridge' });
      return next;
    });
  };

  const startHandoff = async (dest: HandoffDestination) => {
    if (leaving) return;
    setLeaving(true);
    if (dest === 'PAPER') emitEvent('conversion.paper_started', { surface: 'onboarding_bridge' });
    const token = await requestHandoffToken(dest, progress);
    // Signed token → same-origin shell claim page; otherwise fall back to the
    // waitlist intake so the path still never traps the player (§4.1).
    window.location.assign(token ? handoffClaimUrl(token) : handoffFallbackUrl());
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 font-mono flex flex-col items-end gap-2">
      {open && (
        <div className="terminal-panel bg-terminal-panel p-3 w-64 animate-fade-in shadow-phosphor">
          <div className="text-phosphor-dim text-xs tracking-widest mb-2 border-b border-phosphor/15 pb-2">
            CONTINUE BEYOND HISTORY
          </div>
          <div className="space-y-2">
            {EXITS.map(x => (
              <button
                key={x.dest}
                onClick={() => { void startHandoff(x.dest); }}
                disabled={leaving}
                className="w-full text-left border border-phosphor/25 rounded-terminal px-3 py-2 hover:border-phosphor/50 hover:bg-phosphor/5 transition-colors disabled:opacity-50"
              >
                <div className="text-phosphor text-xs tracking-wide">{x.label} ▸</div>
                <div className="text-phosphor-dim text-xs mt-0.5 leading-snug">{x.note}</div>
              </button>
            ))}
          </div>
          <div className="text-phosphor-dim/70 text-xs mt-2 leading-snug" style={{ fontSize: '10px' }}>
            OPTIONAL · YOUR FORMAL PROFILE IS COLLECTED SEPARATELY
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        {saved ? (
          <span className="text-paper-green text-xs tracking-widest border border-paper-green/30 bg-paper-green/5 rounded-terminal px-2.5 py-1.5">
            ✓ PROGRESS SAVED
          </span>
        ) : (
          <button
            onClick={() => { markProgressSaved(); setSaved(true); }}
            className="text-phosphor-mid text-xs tracking-widest border border-phosphor/30 rounded-terminal px-2.5 py-1.5 hover:text-phosphor hover:border-phosphor/50 transition-colors"
          >
            ◇ SAVE YOUR RUN
          </button>
        )}
        <button
          onClick={openMenu}
          aria-expanded={open}
          className="cmd-button text-xs tracking-widest px-3 py-1.5"
        >
          ENTER REFI ▸
        </button>
      </div>
    </div>
  );
}
