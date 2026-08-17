import { useEffect, useState } from 'react';

interface Props {
  onComplete: () => void;
}

/**
 * How much slower than the authored timings the boot sequence runs.
 *
 * The delays below are the original beats; this stretches all of them by one
 * factor so their spacing stays intact. The sequence is the game's first
 * sentence — FUTURE DATA BLOCKED and PLAYER EGO UNVERIFIED are the thesis in
 * miniature — and at the authored pace it was gone before it could be read.
 *
 * Tune here, not in the table.
 */
export const BOOT_PACE = 1.25;

/** Beats in milliseconds, before BOOT_PACE is applied. */
const BOOT_LINES = [
  { text: 'REFI NETWORK BIOS v0.9.2', delay: 0 },
  { text: '', delay: 200 },
  { text: 'MEMORY CHECK........................PASS', delay: 400 },
  { text: 'MARKET ARCHIVE......................ONLINE', delay: 700 },
  { text: 'HISTORICAL FEED.....................MOUNTED', delay: 1000 },
  { text: 'FUTURE DATA.........................BLOCKED', delay: 1300 },
  { text: 'MACHINE BENCHMARK...................READY', delay: 1600 },
  { text: 'PLAYER EGO..........................UNVERIFIED', delay: 1900 },
  { text: '', delay: 2100 },
  { text: '> INITIALIZING REFI ALPHA', delay: 2200 },
];

/** The title card and the hand-off, on the same clock as the lines. */
const TITLE_AT = 2500;
const CURSOR_AT = 2600;
const COMPLETE_AT = 4200;

const paced = (ms: number) => Math.round(ms * BOOT_PACE);

/**
 * Every beat of the boot sequence, after pacing.
 *
 * Exported so the schedule can be asserted directly. Timing this in a browser
 * measures the dev server's compile jitter as much as the sequence, and the
 * property that matters is arithmetic: one factor, applied to every beat, with
 * the authored spacing intact.
 */
export function bootSchedule(): {
  lines: number[];
  title: number;
  cursor: number;
  complete: number;
} {
  return {
    lines: BOOT_LINES.map(l => paced(l.delay)),
    title: paced(TITLE_AT),
    cursor: paced(CURSOR_AT),
    complete: paced(COMPLETE_AT),
  };
}

export default function BootScreen({ onComplete }: Props) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [showTitle, setShowTitle] = useState(false);
  const [showCursor, setShowCursor] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    BOOT_LINES.forEach((line, i) => {
      timers.push(setTimeout(() => setVisibleLines(i + 1), paced(line.delay)));
    });

    timers.push(setTimeout(() => setShowTitle(true), paced(TITLE_AT)));
    timers.push(setTimeout(() => setShowCursor(true), paced(CURSOR_AT)));
    timers.push(setTimeout(() => onComplete(), paced(COMPLETE_AT)));

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div className="terminal-screen flex items-center justify-center min-h-screen">
      <div className="w-full max-w-2xl px-8 py-16">
        <div className="space-y-0">
          {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
            <div
              key={i}
              className="font-mono text-sm leading-6 animate-fade-in"
              style={{
                color: line.text.includes('PASS') || line.text.includes('ONLINE') || line.text.includes('MOUNTED') || line.text.includes('READY')
                  ? '#0CD4A0'
                  : line.text.includes('BLOCKED') || line.text.includes('UNVERIFIED')
                  ? '#D6A647'
                  : line.text.includes('>')
                  ? '#79FFD7'
                  : '#0A8F68',
              }}
            >
              {line.text || '\u00A0'}
            </div>
          ))}
        </div>

        {showTitle && (
          <div className="mt-12 animate-fade-in">
            <div
              className="font-mono text-4xl tracking-widest terminal-glow-strong"
              style={{ color: '#79FFD7' }}
            >
              MAN VS MACHINE
            </div>
            {showCursor && (
              <div className="mt-4 font-mono text-lg" style={{ color: '#0CD4A0' }}>
                <span className="animate-[cursorBlink_1s_steps(1,end)_infinite]">_</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
