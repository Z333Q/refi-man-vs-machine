import { useState } from 'react';
import { claimedProfile, type ClaimedProfile } from '../../lib/claimedIdentity';
import { authAvailability } from '../../lib/auth/provider';
import { ClaimProfileModal } from './ClaimProfileModal';
import { claimHandoff, HANDOFF_MODE, type IntendedDestination } from '../../lib/handoff';
import { track } from '../../lib/growth';

// Never-trap onboarding bridge (§4.1) — a persistent, unobtrusive surface
// that lets the player (a) save their run into a lightweight Alpha identity
// (§4.3 Stage 2) and (b) leave for formal ReFi onboarding at any milestone,
// without ever being forced. The exit is user-initiated only, so it does
// not leak top-of-funnel traffic; it is intentionally absent from the
// attract screen and hidden during an active checkpoint decision.

// The note under each exit states what this build can actually do.
//
// "Your game progress is preserved" is a promise only the minted handoff can
// keep: the token is what binds this player's progress to a formal account
// (§4.4). In link mode there is no token, so the copy says where the progress
// stays instead of claiming it travels. Telling a player their run carried
// over when it did not is the kind of small lie that costs the whole record's
// credibility (§57).
const EXITS: { dest: IntendedDestination; label: string; note: string }[] = [
  {
    dest: 'PAPER',
    label: 'RUN IN PAPER MODE',
    note: 'History is closed. The live market is not.',
  },
  {
    dest: 'ELIGIBILITY',
    label: 'ENTER REFI ONBOARDING',
    note: HANDOFF_MODE === 'MINTED'
      ? 'Your game progress is preserved.'
      : 'Your run stays saved on this device.',
  },
];

export function OnboardingBridge() {
  // The local alp_... id that used to sit behind "SAVE YOUR RUN" is gone from
  // this surface. It was never an account: nothing authorised it, no server
  // knew it, and calling local storage "saved progress" next to a real
  // sign-in would leave the player with two ideas of what having an account
  // means. It still exists for telemetry continuity and it is no longer
  // spoken about here. One concept of an account, and it is the claimed
  // profile.
  const [claimed, setClaimed] = useState<ClaimedProfile | null>(() => claimedProfile());
  const [claiming, setClaiming] = useState(false);
  const canClaim = authAvailability().kind === 'READY';
  const [open, setOpen] = useState(false);
  const [handoffPending, setHandoffPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openMenu = () => {
    setOpen(o => {
      const next = !o;
      if (next) track('conversion.paper_cta_viewed', { surface: 'onboarding_bridge' });
      return next;
    });
  };

  const startHandoff = async (dest: IntendedDestination) => {
    if (handoffPending) return;

    if (dest === 'PAPER') track('conversion.paper_started', { surface: 'onboarding_bridge' });
    // Which door was taken matters to the funnel: a minted handoff and a
    // marketing link convert at different rates and mean different things.
    track('conversion.refi_handoff_started', {
      surface: 'onboarding_bridge',
      destination: dest,
      mode: HANDOFF_MODE,
    });

    setHandoffPending(true);
    setError(null);

    try {
      // User-initiated exit into the formal product. The token is minted
      // server-side and opaque, and claimHandoff redirects on success, so
      // there is no success path to reset.
      await claimHandoff(dest);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Handoff failed. Try again.');
      setHandoffPending(false);
    }
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
                onClick={() => void startHandoff(x.dest)}
                disabled={handoffPending}
                className="w-full text-left border border-phosphor/25 rounded-terminal px-3 py-2 hover:border-phosphor/50 hover:bg-phosphor/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="text-phosphor text-xs tracking-wide">{x.label} ▸</div>
                <div className="text-phosphor-dim text-xs mt-0.5 leading-snug">{x.note}</div>
              </button>
            ))}
          </div>
          {error && (
            <div className="text-red-400 text-xs mt-2 leading-snug" role="alert">
              {error}
            </div>
          )}
          <div className="text-phosphor-dim/70 text-xs mt-2 leading-snug" style={{ fontSize: '10px' }}>
            {HANDOFF_MODE === 'MINTED'
              ? 'OPTIONAL · YOUR FORMAL PROFILE IS COLLECTED SEPARATELY'
              : 'OPTIONAL · OPENS THE REFI SITE · YOUR FORMAL PROFILE IS COLLECTED SEPARATELY'}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        {claimed ? (
          <span className="text-paper-green text-xs tracking-widest border border-paper-green/30 bg-paper-green/5 rounded-terminal px-2.5 py-1.5">
            ✓ @{claimed.handle}
          </span>
        ) : canClaim ? (
          <button
            onClick={() => { setClaiming(true); }}
            className="text-phosphor-mid text-xs tracking-widest border border-phosphor/30 rounded-terminal px-2.5 py-1.5 hover:text-phosphor hover:border-phosphor/50 transition-colors"
          >
            ◇ CLAIM YOUR TRADER PROFILE
          </button>
        ) : (
          // No identity provider in this build. The truthful version of the
          // old claim: the run is on this device, and that is all.
          <span
            className="text-phosphor-dim text-xs tracking-widest border border-phosphor-dim/25 rounded-terminal px-2.5 py-1.5"
            title="Anonymous progress lives in this browser"
          >
            ◇ SAVED ON THIS DEVICE
          </span>
        )}
        <button
          onClick={openMenu}
          aria-expanded={open}
          className="cmd-button text-xs tracking-widest px-3 py-1.5"
        >
          ENTER REFI ▸
        </button>
      </div>

      {claiming && (
        <ClaimProfileModal
          onClose={() => { setClaiming(false); }}
          onClaimed={profile => { setClaimed(profile); setClaiming(false); }}
        />
      )}
    </div>
  );
}
