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
  // The machine's call is information, not a warning. Adds read hot
  // phosphor; everything else reads plain. A sell is not an alarm.
  const headlineClassName =
    action.includes('ADD') || action.includes('DEPLOY') || action.includes('BUY')
      ? 'text-phosphor-hot'
      : 'text-phosphor';

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
