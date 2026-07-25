import { useState } from 'react';
import { claimHandoff, type IntendedDestination } from '../lib/handoff';

interface Props {
  destination?: IntendedDestination;
  label?: string;
}

/**
 * CTA that mints the handoff token and redirects the player into the investor
 * shell's onboarding funnel. On success the browser navigates away; on failure
 * it surfaces a terminal-styled error and lets the player retry.
 */
export default function ClaimHandoffButton({
  destination = 'ELIGIBILITY',
  label = '[ CLAIM YOUR PROGRESS ON REFI ]',
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
        {minting ? 'CLAIMING…' : label}
      </button>
      {error && (
        <div className="font-mono text-xs text-red-400" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
