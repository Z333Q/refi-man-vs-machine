// "You are here" arc rail (P0 IA system).
//
// A persistent, slim progress spine that draws the product arc (§1.3) so a
// player always knows where this screen sits in the larger journey — the
// missing "why am I here" orientation. Stages collapse the full arc
// (Human → Human vs Machine → Diagnose → Build Rules → Build Machine →
// Stress Test → Machine vs ReFi → Paper) into five legible beats.

export const ARC_STAGES = ['PLAY', 'DIAGNOSE', 'BUILD', 'STRESS-TEST', 'PAPER'] as const;
export type ArcStage = (typeof ARC_STAGES)[number];

export function ArcRail({ current }: { current: ArcStage }) {
  const currentIdx = ARC_STAGES.indexOf(current);
  return (
    <div
      className="flex items-center gap-2 font-mono text-xs tracking-widest overflow-x-auto scrollbar-hide"
      aria-label={`Journey progress: ${current}`}
    >
      {ARC_STAGES.map((stage, i) => (
        <span key={stage} className="flex items-center gap-2 flex-shrink-0">
          <span
            className={
              i < currentIdx ? 'text-paper-green' :
              i === currentIdx ? 'text-phosphor terminal-glow' :
              'text-phosphor-dim/60'
            }
            aria-current={i === currentIdx ? 'step' : undefined}
          >
            {i === currentIdx ? `▸ ${stage}` : stage}
          </span>
          {i < ARC_STAGES.length - 1 && <span className="text-phosphor-dim/40">→</span>}
        </span>
      ))}
    </div>
  );
}
