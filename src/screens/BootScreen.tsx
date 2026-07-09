import { useEffect, useState } from 'react';

interface Props {
  onComplete: () => void;
}

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

export default function BootScreen({ onComplete }: Props) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [showTitle, setShowTitle] = useState(false);
  const [showCursor, setShowCursor] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    BOOT_LINES.forEach((line, i) => {
      timers.push(setTimeout(() => setVisibleLines(i + 1), line.delay));
    });

    timers.push(setTimeout(() => setShowTitle(true), 2500));
    timers.push(setTimeout(() => setShowCursor(true), 2600));
    timers.push(setTimeout(() => onComplete(), 4200));

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
