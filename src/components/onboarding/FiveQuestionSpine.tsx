// The §60 five-question spine.
//
// The spec: "every active game screen must answer all five [questions] or
// it is incomplete" — what's happening / what info do I have / what can I
// do / what happens when I commit / how am I doing vs the machine. This
// component is the standard, always-visible strip that makes every active
// screen pass that test. Each screen fills in its own answers.

export interface SpineAnswers {
  happening: string;
  info: string;
  canDo: string;
  onCommit: string;
  vsMachine: string;
}

const QUESTIONS: { key: keyof SpineAnswers; q: string }[] = [
  { key: 'happening', q: 'WHAT IS HAPPENING?' },
  { key: 'info', q: 'WHAT INFO DO I HAVE?' },
  { key: 'canDo', q: 'WHAT CAN I DO?' },
  { key: 'onCommit', q: 'WHAT HAPPENS WHEN I COMMIT?' },
  { key: 'vsMachine', q: 'HOW AM I DOING VS MACHINE?' },
];

export function FiveQuestionSpine({ answers }: { answers: SpineAnswers }) {
  return (
    <div
      className="border-t border-phosphor/10 px-6 py-2.5 flex gap-8 overflow-x-auto scrollbar-hide"
      aria-label="Orientation: the five questions"
    >
      {QUESTIONS.map(({ key, q }) => (
        <div key={key} className="flex-shrink-0">
          <div className="font-mono text-phosphor-dim text-xs tracking-widest">{q}</div>
          <div className="font-mono text-phosphor text-xs mt-0.5">{answers[key]}</div>
        </div>
      ))}
    </div>
  );
}
