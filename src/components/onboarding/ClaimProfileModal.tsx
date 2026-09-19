import { useCallback, useEffect, useRef, useState } from 'react';
import { claimProfile, type ClaimedProfile } from '../../lib/claimedIdentity';
import { authAvailability, beginAuthentication } from '../../lib/auth/provider';
import { setCredential, isAuthenticated } from '../../lib/auth/credential';
import { listRunRecords } from '../../lib/runRecord';
import { listMachineVersions } from '../../lib/machineVersions';
import { track } from '../../lib/growth';

// Claiming a trader profile.
//
// What this is, stated plainly because the words matter: a name for the person
// who played these runs. It is not onboarding, not KYC, not an investment
// account, and it asks for nothing a broker would ask for. Country, goals,
// risk tolerance and money are absent by design, and none of them belongs on
// the far side of a game result.
//
// Anonymous play is untouched. Nothing here gates a run, and the surface that
// opens this modal appears only after the player has a result worth keeping.

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

/** Non-sensitive growth context, derived from what this device actually holds. */
function growthContext() {
  const finished = new Set(
    listRunRecords().filter(r => r.result && r.result !== 'ACTIVE').map(r => r.arenaId),
  );
  return {
    arenasCompleted: finished.size,
    machineLocked: listMachineVersions().some(v => v.lockedAt !== null),
  };
}

export function ClaimProfileModal({ onClose, onClaimed }: {
  onClose: () => void;
  onClaimed: (profile: ClaimedProfile) => void;
}) {
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const firstField = useRef<HTMLInputElement>(null);
  const availability = authAvailability();

  useEffect(() => { firstField.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const submit = useCallback(async () => {
    if (busy) return;
    setError(null);
    setNote(null);

    if (!API_URL) { setError('PROFILES ARE UNAVAILABLE IN THIS BUILD'); return; }
    setBusy(true);
    try {
      if (!isAuthenticated()) {
        // Authentication first: the server will not take a handle from a
        // request it cannot attribute to a person.
        setCredential(await beginAuthentication());
      }

      const outcome = await claimProfile(API_URL, handle.trim(), displayName.trim() || undefined);
      switch (outcome.kind) {
        case 'CLAIMED':
        case 'ALREADY_CLAIMED': {
          // Emitted here and nowhere earlier: the account exists now.
          void track('profile.claimed', {
            handle: outcome.profile.handle,
            outcome: outcome.kind,
            ...growthContext(),
          });
          if (outcome.kind === 'ALREADY_CLAIMED' && outcome.requestedOther) {
            setNote(`THIS ACCOUNT ALREADY HOLDS @${outcome.profile.handle}`);
          }
          onClaimed(outcome.profile);
          return;
        }
        case 'HANDLE_UNAVAILABLE': setError('THAT HANDLE IS TAKEN'); return;
        case 'HANDLE_REJECTED': setError(outcome.message.toUpperCase()); return;
        case 'NOT_AUTHENTICATED': setError('SIGN IN DID NOT COMPLETE'); return;
        case 'UNAVAILABLE': setError('PROFILES ARE UNREACHABLE RIGHT NOW'); return;
      }
    } catch {
      setError('SIGN IN IS NOT AVAILABLE IN THIS BUILD');
    } finally {
      setBusy(false);
    }
  }, [busy, handle, displayName, onClaimed]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-terminal-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="claim-title"
    >
      <div className="w-full max-w-md border border-phosphor/30 bg-terminal-panel rounded-terminal p-5">
        <h2 id="claim-title" className="text-phosphor text-sm tracking-widest mb-1">
          CLAIM YOUR TRADER PROFILE
        </h2>
        <p className="text-phosphor-dim text-xs leading-relaxed mb-4">
          SAVE YOUR RANK. KEEP YOUR HISTORY.
          <br />
          YOUR RUNS STAY YOURS ACROSS DEVICES.
        </p>

        {availability.kind === 'NOT_CONFIGURED' ? (
          <p className="text-alert-amber text-xs leading-relaxed" role="status">
            PROFILE CLAIMING IS NOT ENABLED IN THIS BUILD.
            <br />
            YOUR PROGRESS REMAINS SAVED ON THIS DEVICE.
          </p>
        ) : (
          <>
            <label className="block text-phosphor-dim text-xs tracking-widest mb-1" htmlFor="claim-handle">
              HANDLE
            </label>
            <input
              id="claim-handle"
              ref={firstField}
              value={handle}
              onChange={e => { setHandle(e.target.value); }}
              maxLength={20}
              autoComplete="off"
              spellCheck={false}
              className="w-full bg-terminal-deep border border-phosphor/30 rounded-terminal px-2 py-1.5 text-phosphor text-sm mb-1"
            />
            <p className="text-phosphor-dim/70 mb-3" style={{ fontSize: '10px' }}>
              3 TO 20 CHARACTERS · LETTERS, NUMBERS AND UNDERSCORE
            </p>

            <label className="block text-phosphor-dim text-xs tracking-widest mb-1" htmlFor="claim-display">
              DISPLAY NAME <span className="text-phosphor-dim/60">OPTIONAL</span>
            </label>
            <input
              id="claim-display"
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); }}
              maxLength={40}
              className="w-full bg-terminal-deep border border-phosphor/30 rounded-terminal px-2 py-1.5 text-phosphor text-sm mb-4"
            />
          </>
        )}

        {error && <div className="text-risk-red text-xs mb-3" role="alert">{error}</div>}
        {note && <div className="text-alert-amber text-xs mb-3" role="status">{note}</div>}

        <div className="flex items-center justify-between gap-3">
          <button onClick={onClose} className="text-phosphor-dim text-xs tracking-widest px-2 py-1.5">
            NOT NOW
          </button>
          {availability.kind === 'READY' && (
            <button
              onClick={() => { void submit(); }}
              disabled={busy || handle.trim().length < 3}
              className="cmd-button text-xs tracking-widest px-3 py-1.5 disabled:opacity-40"
            >
              {busy ? 'CLAIMING...' : 'CLAIM PROFILE'}
            </button>
          )}
        </div>

        <p className="text-phosphor-dim/60 mt-3 leading-snug" style={{ fontSize: '10px' }}>
          THIS IS A GAME PROFILE. IT IS NOT AN INVESTMENT ACCOUNT, AND IT ASKS
          FOR NOTHING ABOUT YOUR FINANCES.
        </p>
      </div>
    </div>
  );
}
