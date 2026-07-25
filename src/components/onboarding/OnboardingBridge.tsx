import { useState } from 'react';
import { isProgressSaved, markProgressSaved } from '../../lib/alphaIdentity';
import { buildHandoffToken, handoffRedirectUrl, type HandoffDestination } from '../../lib/handoff';
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
  const [saved, setSaved] = useState(() => isProgressSaved());
  const [open, setOpen] = useState(false);

  const openMenu = () => {
    setOpen(o => {
      const next = !o;
      if (next) emitEvent('conversion.paper_cta_viewed', { surface: 'onboarding_bridge' });
      return next;
    });
  };

  const startHandoff = (dest: HandoffDestination) => {
    if (dest === 'PAPER') emitEvent('conversion.paper_started', { surface: 'onboarding_bridge' });
    const token = buildHandoffToken(dest);
    // User-initiated exit into the formal product (opaque handoff id only).
    window.location.assign(handoffRedirectUrl(token));
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
                onClick={() => startHandoff(x.dest)}
                className="w-full text-left border border-phosphor/25 rounded-terminal px-3 py-2 hover:border-phosphor/50 hover:bg-phosphor/5 transition-colors"
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
