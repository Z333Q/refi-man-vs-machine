import { drawMachine, describeMachine, posture, type MachinePetState } from '../../lib/machinePet';

const POSTURE_NOTE: Record<ReturnType<typeof posture>, string> = {
  BENCH: 'CURLED UP. BUILT, NOT COMPILED — IT HAS NOT STOOD UP YET.',
  STANDING: 'UP AND RUNNING INSIDE ITS LIMITS.',
  BRACED: 'BRACED, EARS UP. RISK BUDGET IS RUNNING HOT — THE WIDER STANCE IS IT WORKING, NOT FAILING.',
  HALTED: 'STOPPED BY ITS OWN GUARDRAIL. THAT IS A SUCCESS CONDITION, NOT A FAULT.',
};

/**
 * Your machine, with a body.
 *
 * It is assembled from the modules actually installed and posed by what the
 * portfolio is currently doing. It has no hunger, no timer, and no decay: walk
 * away for a month and it is exactly where you left it, which is the point
 * rather than an oversight. See machinePet.ts, and the test that fails if this
 * ever starts watching a clock.
 */
export default function MachinePet({
  state, className,
}: { state: MachinePetState; className?: string }) {
  const p = posture(state);
  const colour =
    p === 'HALTED' ? 'text-alert-amber'
      : p === 'BRACED' ? 'text-phosphor'
        : p === 'BENCH' ? 'text-phosphor-dim'
          : 'text-phosphor-hot';

  return (
    <div className={className}>
      <pre
        className={`font-mono ${colour} leading-tight`}
        style={{ fontSize: 'clamp(10px, 1.1vw, 15px)', whiteSpace: 'pre' }}
        role="img"
        aria-label={describeMachine(state)}
      >
        {drawMachine(state).join('\n')}
      </pre>
      {/* §62: never colour alone — the posture is always stated in words. */}
      <div className="font-mono text-xs text-phosphor-dim mt-2 leading-snug max-w-sm">
        {POSTURE_NOTE[p]}
      </div>
    </div>
  );
}
