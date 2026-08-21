import { useState } from 'react';
import { claimHandoff, HANDOFF_MODE, type IntendedDestination } from '../lib/handoff';

interface Props {
  destination?: IntendedDestination;
  label?: string;
}

/**
 * CTA that mints the handoff token and redirects the player into the investor
 * shell's onboarding funnel. On success the browser navigates away; on failure
 * it surfaces a terminal-styled error and lets the player retry.
 */
// Claiming progress is what the minted token does. Without it this control
// still opens ReFi, so it says that instead (see HANDOFF_MODE).
const DEFAULT_LABEL = HANDOFF_MODE === 'MINTED'
  ? '[ CLAIM YOUR PROGRESS ON REFI ]'
  : '[ CONTINUE TO REFI ]';

export default function ClaimHandoffButton({
  destination = 'ELIGIBILITY',
  label = DEFAULT_LABEL,
}: Props) {
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setMinting(true);
    setError(null);
    try {
      await claimHandoff(destination);
      // claimHandoff redirects on success; nothing else to do here.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Handoff failed. Try again.');
      setMinting(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => void go()}
        disabled={minting}
        className="cmd-button cmd-button-primary w-full tracking-widest"
      >
        {minting ? (HANDOFF_MODE === 'MINTED' ? 'CLAIMING…' : 'OPENING…') : label}
      </button>
      {error && (
        <div className="font-mono text-xs text-red-400" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
