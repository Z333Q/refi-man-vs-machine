// The §56 five-question spine, one question at a time.
//
// The spec: "every active game screen must answer all five [questions] or it
// is incomplete". The first build answered all five at once in a horizontally
// scrolling strip under the workspace, which made the answer to "what do I do
// now" one of five equally weighted items. A screen still has to be able to
// answer every question; it shows the one the player is on. The other four are
// answered by the phase they belong to, and by Help.

export interface SpineAnswers {
  happening: string;
  info: string;
  canDo: string;
  onCommit: string;
  vsMachine: string;
}

export type SpineFocus = keyof SpineAnswers;

const QUESTIONS: Record<SpineFocus, string> = {
  happening: 'WHAT IS HAPPENING?',
  info: 'WHAT INFO DO I HAVE?',
  canDo: 'WHAT CAN I DO?',
  onCommit: 'WHAT HAPPENS WHEN I COMMIT?',
  vsMachine: 'HOW AM I DOING VS MACHINE?',
};

export function FiveQuestionSpine({ answers, focus }: { answers: SpineAnswers; focus: SpineFocus }) {
  return (
    <div
      className="border-t border-phosphor/10 px-6 py-2 flex items-baseline gap-3 overflow-hidden"
      aria-label="Orientation"
    >
      <div className="font-mono text-phosphor-dim text-xs tracking-widest whitespace-nowrap">{QUESTIONS[focus]}</div>
      <div className="font-mono text-phosphor text-xs truncate">{answers[focus]}</div>
    </div>
  );
}
