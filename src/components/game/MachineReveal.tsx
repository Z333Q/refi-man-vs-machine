import TalkingWindow from '../ui/TalkingWindow';

// ─── Machine reveal ───────────────────────────────────────────────────────────
//
// The machine's window takes the floor and states its call. This used to be a
// random-noise decrypt; it is now the terminal voice (docs/PLAN-terminal-voice.md):
// the window wakes, a thin zigzag ticks around it in the machine's measured
// amber register while the call teletypes out, then the border settles and the
// cursor holds at the end of what was said.
//
// The words are the run record's: the action code the machine committed and
// the policy reason the content authored for it (§57). Nothing is rewritten
// here; the machine cites, it does not perform.

interface Props {
  action: string;
  reasoning?: string;
  machineName?: string;
  /** Kept for call-site compatibility; the teletype paces itself. */
  durationMs?: number;
  reducedMotion?: boolean;
  onComplete?: () => void;
}

export default function MachineReveal({
  action,
  reasoning,
  machineName = 'MACHINE',
  reducedMotion = false,
  onComplete,
}: Props) {
  // Direction colouring preserved from the decrypt version: defensive calls
  // read amber, sells read red, adds read hot phosphor.
  const headlineClassName =
    action.startsWith('HOLD') || action.startsWith('WAIT')
      ? 'text-alert-amber'
      : action.includes('REDUCE') || action.includes('EXIT') || action.includes('SELL')
        ? 'text-risk-red'
        : 'text-phosphor-hot';

  return (
    <TalkingWindow
      id="MACHINE_REVEAL"
      title={`${machineName} DECISION`}
      sig="SAME TAPE"
      mood="MEASURED"
      headline={action}
      headlineClassName={headlineClassName}
      lines={reasoning ? [reasoning] : []}
      speak
      reducedMotion={reducedMotion}
      onDone={onComplete}
    />
  );
}
