import { useState, useEffect, type ReactNode } from 'react';
import { useReveal } from '../components/landing/useReveal';

interface Props {
  onEnter: () => void;
}

const TICKER_ITEMS = [
  { symbol: 'SPX', value: '-4.2%', neg: true },
  { symbol: 'VIX', value: '+18.7', neg: false },
  { symbol: 'GOLD', value: '+1.8%', neg: false },
  { symbol: 'OIL', value: '-8.1%', neg: true },
  { symbol: '10Y', value: '-21bp', neg: true },
  { symbol: 'USD', value: '+0.4%', neg: false },
];

// Man-vs-machine equity path shown as an auto-cycling scoreboard. Clearly a
// HISTORICAL-DATA SIMULATION — labeled in the UI (spec §62); never live results.
const COMPARISON_DAYS = [
  { day: '00', human: '$100,000', machine: '$100,000', hs: 'STANDING BY', ms: 'READY', panic: false },
  { day: '03', human: '$98,420', machine: '$99,100', hs: 'HOLDS', ms: 'REDUCES RISK', panic: false },
  { day: '07', human: '$91,820', machine: '$95,440', hs: 'PANICS', ms: 'HOLDS POLICY', panic: true },
  { day: '14', human: '$87,200', machine: '$93,100', hs: 'SELLS', ms: 'STAGES RE-ENTRY', panic: true },
];

// figlet "REFI ALPHA" — shown on md+; small screens get the stacked wordmark.
const ASCII_BANNER = String.raw`
 ____  _____ _____ ___     _    _     ____  _   _    _
|  _ \| ____|  ___|_ _|   / \  | |   |  _ \| | | |  / \
| |_) |  _| | |_   | |   / _ \ | |   | |_) | |_| | / _ \
|  _ <| |___|  _|  | |  / ___ \| |___|  __/|  _  |/ ___ \
|_| \_\_____|_|   |___|/_/   \_\_____|_|   |_| |_/_/   \_\
`;

const STAGES = [
  { id: '01', name: 'COVID BLACK SWAN', status: 'OPEN', note: 'Feb-Apr 2020 · 22 checkpoints' },
  { id: '02', name: 'RECOVERY', status: 'OPEN', note: 'The bounce nobody trusted' },
  { id: '03', name: 'INFLATION', status: 'LOCKED', note: '2021-22 regime shift' },
  { id: '04', name: 'BANKING STRESS', status: 'LOCKED', note: 'Mar 2023' },
  { id: '05', name: 'TACO', status: 'LOCKED', note: 'Policy reflexivity · exhibition' },
];

const FAQ = [
  { q: 'IS THIS REAL MONEY?', a: 'No. Every arena is a historical-data simulation. Nothing here is investment advice.' },
  { q: 'DO I NEED AN ACCOUNT?', a: 'No. Your first three decisions are free - no signup, no wallet, no coin.' },
  { q: 'WHAT IS "THE MACHINE"?', a: 'A transparent, rules-based policy. You play the same regime it faced - and see who kept their head.' },
  { q: 'WHAT IF I BEAT IT?', a: 'Carry your progress into ReFi and continue to the real product. Your in-game behavioral scores stay in the game.' },
];

function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none ${
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      } ${className}`}
    >
      {children}
    </div>
  );
}

function SimLabel() {
  return (
    <span className="inline-block font-mono text-[10px] tracking-widest text-alert-amber border border-alert-amber/40 px-2 py-0.5">
      HISTORICAL MARKET DATA · SIMULATION · NOT INVESTMENT ADVICE
    </span>
  );
}

export default function LandingScreen({ onEnter }: Props) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % COMPARISON_DAYS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const current = COMPARISON_DAYS[frame] ?? COMPARISON_DAYS[0]!;

  return (
    <div className="terminal-screen min-h-screen">
      {/* Scanline overlay - pure retro, decorative, motion-safe. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.06] motion-safe:animate-scan"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, #0CD4A0 0px, #0CD4A0 1px, transparent 1px, transparent 3px)',
        }}
      />

      {/* Ticker bar */}
      <div className="border-b border-phosphor/20 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-y-1">
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-phosphor-mid tracking-widest">REFI ALPHA</span>
          <span className="font-mono text-xs text-phosphor-dim">v0.9.2-BETA</span>
        </div>
        <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto">
          {TICKER_ITEMS.map((item) => (
            <span key={item.symbol} className="font-mono text-xs whitespace-nowrap">
              <span className="text-phosphor-mid">{item.symbol} </span>
              <span className={item.neg ? 'negative-value' : 'positive-value'}>{item.value}</span>
            </span>
          ))}
        </div>
      </div>

      {/* HERO */}
      <section className="px-6 lg:px-16 pt-16 pb-20 max-w-5xl mx-auto text-center">
        <div className="font-mono text-xs text-phosphor-dim tracking-[0.3em] mb-6">
          REFI.TRADING // MAN vs MACHINE
        </div>
        <pre className="hidden md:block font-mono text-phosphor-hot terminal-glow-strong text-[10px] leading-[1.15] mb-2 overflow-x-auto">
          {ASCII_BANNER}
        </pre>
        <h1 className="md:hidden font-mono text-4xl font-bold text-phosphor-hot terminal-glow-strong mb-2">
          REFI ALPHA
        </h1>
        <div className="font-mono text-lg sm:text-2xl text-phosphor mb-6">
          CAN YOU BEAT THE MACHINE THROUGH A MARKET CRASH?
          <span className="motion-safe:animate-cursor">_</span>
        </div>
        <p className="font-mono text-sm text-phosphor-mid max-w-2xl mx-auto leading-6 mb-10">
          Drop into a real historical regime. Make the calls a portfolio manager
          faced - day by day, panic by panic - against a transparent rules
          machine playing the same tape. See who kept their head.
        </p>
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onEnter}
            className="cmd-button cmd-button-primary tracking-[0.3em] text-base px-10 py-3 motion-safe:animate-fade-in"
          >
            [ PRESS START ]
          </button>
          <div className="font-mono text-[11px] text-phosphor-dim tracking-widest">
            NO ACCOUNT · 3 FREE DECISIONS · INSERT NO COIN
          </div>
        </div>
      </section>

      {/* HOW IT WORKS - level select */}
      <section className="px-6 lg:px-16 py-14 max-w-5xl mx-auto">
        <Reveal>
          <div className="font-mono text-xs text-phosphor-dim tracking-[0.3em] mb-8 text-center">
            - LEVEL SELECT -
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { n: '1', t: 'PICK A REGIME', d: 'Choose a historical crisis. The clock starts the day before it broke.' },
              { n: '2', t: 'MAKE THE CALL', d: 'Hold, cut, or re-enter at each checkpoint. Every decision is journaled.' },
              { n: '3', t: 'FACE THE MACHINE', d: "Your equity curve vs the machine's. Autopsy every divergence." },
            ].map((s) => (
              <div key={s.n} className="terminal-panel p-5 space-y-3">
                <div className="font-mono text-3xl font-bold text-phosphor-hot terminal-glow">{s.n}</div>
                <div className="font-mono text-sm text-phosphor tracking-widest">{s.t}</div>
                <div className="font-mono text-xs text-phosphor-mid leading-6">{s.d}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* MAN vs MACHINE demo */}
      <section className="px-6 lg:px-16 py-14 max-w-4xl mx-auto">
        <Reveal>
          <div className="terminal-panel-deep p-6 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="font-mono text-xs text-phosphor-dim tracking-[0.3em]">
                LIVE ARENA PREVIEW · DAY {current.day}
              </div>
              <SimLabel />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="font-mono text-xs text-phosphor-dim tracking-widest">HUMAN</div>
                <div className="font-mono text-2xl sm:text-3xl font-bold text-terminal-white tabular-nums">{current.human}</div>
                <div className={`font-mono text-xs ${current.panic ? 'text-risk-red' : 'text-phosphor-mid'}`}>{current.hs}</div>
              </div>
              <div className="space-y-2 text-right">
                <div className="font-mono text-xs text-phosphor-dim tracking-widest">MACHINE</div>
                <div className="font-mono text-2xl sm:text-3xl font-bold text-phosphor-hot terminal-glow tabular-nums">{current.machine}</div>
                <div className="font-mono text-xs text-phosphor">{current.ms}</div>
              </div>
            </div>
            <div className="flex gap-1">
              {COMPARISON_DAYS.map((d, i) => (
                <div key={d.day} className={`h-1 flex-1 ${i <= frame ? 'bg-phosphor' : 'bg-phosphor/15'}`} />
              ))}
            </div>
            <div className="font-mono text-[11px] text-phosphor-dim leading-5">
              Illustrative reconstruction from historical market data. Not a
              prediction, not advice, not a live or client result.
            </div>
          </div>
        </Reveal>
      </section>

      {/* STAGES / high-score board */}
      <section className="px-6 lg:px-16 py-14 max-w-4xl mx-auto">
        <Reveal>
          <div className="font-mono text-xs text-phosphor-dim tracking-[0.3em] mb-6 text-center">- STAGES -</div>
          <div className="terminal-panel divide-y divide-phosphor/10">
            {STAGES.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm text-phosphor-dim tabular-nums">{s.id}</span>
                  <div>
                    <div className="font-mono text-sm text-phosphor">{s.name}</div>
                    <div className="font-mono text-[11px] text-phosphor-dim">{s.note}</div>
                  </div>
                </div>
                <span
                  className={`font-mono text-[10px] tracking-widest px-2 py-0.5 border ${
                    s.status === 'OPEN'
                      ? 'text-phosphor border-phosphor/40'
                      : 'text-phosphor-dim border-phosphor-dim/40'
                  }`}
                >
                  {s.status}
                </span>
              </div>
            ))}
          </div>
          <div className="font-mono text-[11px] text-phosphor-dim text-center mt-4">
            Game progression stats. Not a track record.
          </div>
        </Reveal>
      </section>

      {/* BRIDGE to the product */}
      <section className="px-6 lg:px-16 py-16 max-w-3xl mx-auto text-center">
        <Reveal>
          <div className="font-mono text-xl sm:text-2xl text-phosphor-hot terminal-glow mb-4">
            BEAT THE MACHINE? TAKE YOUR ALPHA TO THE REAL DESK.
          </div>
          <p className="font-mono text-sm text-phosphor-mid leading-6 mb-8">
            Prove yourself across the regimes, then carry your progress into ReFi
            and continue to onboarding. The game teaches the idea; the product is
            where it goes to work.
          </p>
          <button onClick={onEnter} className="cmd-button cmd-button-primary tracking-[0.3em] px-8 py-2.5">
            [ ENTER THE ARENA ]
          </button>
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="px-6 lg:px-16 py-14 max-w-3xl mx-auto">
        <Reveal>
          <div className="font-mono text-xs text-phosphor-dim tracking-[0.3em] mb-6 text-center">- FAQ -</div>
          <div className="space-y-4">
            {FAQ.map((f) => (
              <div key={f.q} className="terminal-panel p-5">
                <div className="font-mono text-sm text-phosphor mb-2">&gt; {f.q}</div>
                <div className="font-mono text-xs text-phosphor-mid leading-6">{f.a}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* FOOTER + compliance */}
      <footer className="border-t border-phosphor/20 px-6 lg:px-16 py-10 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between gap-6">
          <div className="space-y-2">
            <div className="font-mono text-sm text-phosphor tracking-widest">REFI ALPHA</div>
            <div className="font-mono text-[11px] text-phosphor-dim">MAN vs MACHINE · v0.9.2-BETA</div>
          </div>
          <div className="flex gap-6 font-mono text-xs text-phosphor-mid">
            <a href="https://refi.trading" className="hover:text-phosphor">REFI.TRADING</a>
            <button onClick={onEnter} className="hover:text-phosphor">PLAY</button>
          </div>
        </div>
        <p className="font-mono text-[10px] text-phosphor-dim leading-5 mt-8 max-w-3xl">
          ReFi Alpha is an educational game. It is not investment advice, an offer,
          or a solicitation. All arenas are simulations built from historical
          market data; outcomes are hypothetical and do not represent live or
          client results. Behavioral data generated in the game stays in the game.
        </p>
        <div className="font-mono text-[10px] text-phosphor-dim mt-3">
          © {new Date().getFullYear()} ReFi. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
