import type { ReactNode } from 'react';
import { useState } from 'react';
import { useViewport } from '../../lib/useViewport';

/**
 * Landscape notice for the dense terminal screens.
 *
 * The run terminal is a three-pane market workstation: signal, decision and
 * portfolio state have to be legible at the same time. In portrait on a phone
 * the columns collapse below a readable width, so the player is told to rotate
 * BEFORE they commit a decision they cannot fully see.
 *
 * It never traps them (§4.1) — "continue anyway" is always available, and the
 * notice does not return for that screen once dismissed.
 */
export default function OrientationGate({
  children,
  screenLabel,
}: {
  children: ReactNode;
  screenLabel: string;
}) {
  const { needsRotate } = useViewport();
  const [dismissed, setDismissed] = useState(false);

  if (!needsRotate || dismissed) return <>{children}</>;

  return (
    <div className="terminal-screen min-h-screen flex flex-col items-center justify-center px-6 font-mono text-center gap-6">
      <div className="flex items-center gap-3 text-phosphor" aria-hidden="true">
        <span className="border border-phosphor/70 rounded-sm" style={{ width: 26, height: 42 }} />
        <span className="text-lg">⟶</span>
        <span className="border border-phosphor rounded-sm" style={{ width: 42, height: 26 }} />
      </div>

      <div className="space-y-2">
        <div className="text-phosphor-dim text-xs tracking-widest">{screenLabel}</div>
        <h1 className="text-phosphor text-lg tracking-widest">ROTATE YOUR DEVICE</h1>
      </div>

      <p className="text-phosphor-mid text-xs leading-6 max-w-xs">
        THIS SCREEN SHOWS THE SIGNAL, YOUR PORTFOLIO AND YOUR RISK STATE AT THE
        SAME TIME. IN PORTRAIT THEY DO NOT FIT AT A READABLE SIZE.
      </p>

      <p className="text-phosphor-dim text-xs leading-5 max-w-xs">
        COMMITTING A DECISION YOU CANNOT FULLY SEE IS NOT THE GAME.
      </p>

      <button
        onClick={() => setDismissed(true)}
        className="action-secondary mt-2"
      >
        Continue in portrait anyway
      </button>
    </div>
  );
}
