import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { emitEvent, captureFunnelAttribution, getFunnelAttribution } from '../lib/events';

// Arcade-style attract screen — the customized first step into the game.
//
// Modelled on a 90s console title screen: a cycling attract loop of three
// cards (TITLE → STORY → HOW TO PLAY) with a persistent "PRESS START".
// Kept aligned to the CLAUDE.md spec + USA Build Integration Spec:
// - Product arc (§1, core loop) and regime progression are the story.
// - "The machine never sees the future" (rule 5), HOLD is scored (rule 9),
//   trading more is not rewarded (rule 8) appear in HOW TO PLAY.
// - Reduced-motion (rule 16) disables auto-advance and blinking; every
//   panel is reachable with keyboard AND pointer/touch (rule 17, §66).
// - U.S.-equities-only scope + 18+ + a SIMULATION integrity note (§62).
// - No fabricated performance/benchmark numerals (rule 14 / §3.4).

interface Props {
  onEnter: () => void;
}

const PANELS = ['title', 'story', 'howto'] as const;
type Panel = (typeof PANELS)[number];
const PANEL_LABEL: Record<Panel, string> = {
  title: 'TITLE',
  story: 'THE MISSION',
  howto: 'HOW TO PLAY',
};

const TICKER = [
  { symbol: 'SPX', value: '-4.2%', neg: true },
  { symbol: 'VIX', value: '+18.7', neg: false },
  { symbol: 'OIL', value: '-8.1%', neg: true },
  { symbol: '10Y', value: '-21bp', neg: true },
  { symbol: 'DAL', value: '-11.3%', neg: true },
  { symbol: 'MSFT', value: '-2.1%', neg: true },
];

// The canonical product arc (CLAUDE.md §1), told as arcade objectives.
const ARC = [
  'FACE THE MACHINE',
  'DIAGNOSE YOUR GAPS',
  'BUILD RULES',
  'BUILD YOUR MACHINE',
  'STRESS TEST',
  'GO TO PAPER',
];

// Economic-event progression (spec: preserve this order).
const REGIMES = ['COVID', 'RECOVERY', 'INFLATION', 'BANKING STRESS', 'TACO'];

// Core loop (CLAUDE.md core loop / §55 run state machine).
const LOOP = [
  { n: '1', title: 'READ THE TAPE', body: 'Signals, news, and your portfolio at one point in history.' },
  { n: '2', title: 'INVESTIGATE', body: 'Open modules to see the risk the market is hiding.' },
  { n: '3', title: 'DECIDE', body: 'Choose one move. Doing nothing counts.' },
  { n: '4', title: 'COMMIT', body: 'Lock a thesis and a confidence level.' },
  { n: '5', title: 'COMPARE', body: 'See what the machine did with the same data.' },
];

const MOVES = ['HOLD', 'REDUCE', 'RAISE CASH', 'ADD RISK', 'ROTATE DEFENSIVE'];

const RULES = [
  ['HOLD IS A MOVE', 'Doing nothing is an explicit, scored decision.'],
  ['MORE ≠ BETTER', 'You are not rewarded for trading more.'],
  ['SURVIVE THE DRAWDOWN', 'Blow past the risk limit and the run ends.'],
  ['RISK, NOT JUST RETURN', 'Scored vs the machine on drawdown, volatility & turnover too.'],
];

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

export default function TitleScreen({ onEnter }: Props) {
  const [panel, setPanel] = useState<Panel>('title');
  const reduced = usePrefersReducedMotion();

  const step = useCallback((dir: 1 | -1) => {
    setPanel(p => PANELS[(PANELS.indexOf(p) + dir + PANELS.length) % PANELS.length]);
  }, []);

  // Top of the alpha onboarding funnel: capture first-touch marketing
  // attribution from the ReFi funnel and log the attract view (§7 / §63).
  useEffect(() => {
    const attribution = captureFunnelAttribution();
    emitEvent('onboarding.attract_viewed', { attribution, entry: 'title' });
  }, []);

  // Funnel-entry action. Emits onboarding.entered (with attribution) so the
  // ReFi marketing funnel can tie this session to its acquisition source,
  // then hands off to the game flow.
  const start = useCallback(() => {
    emitEvent('onboarding.entered', { attribution: getFunnelAttribution(), from: panel });
    onEnter();
  }, [onEnter, panel]);

  // Attract loop: auto-advance unless the player prefers reduced motion.
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => step(1), 7000);
    return () => clearInterval(id);
  }, [reduced, step, panel]);

  // Keyboard parity: Enter/Space starts; arrows browse the attract cards.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        start();
      } else if (e.key === 'ArrowRight') {
        step(1);
      } else if (e.key === 'ArrowLeft') {
        step(-1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [start, step]);

  const blink = reduced ? '' : 'animate-[cursorBlink_1.1s_steps(1,end)_infinite]';

  return (
    <div className="terminal-screen min-h-screen flex flex-col select-none">
      {/* Arcade marquee ticker */}
      <div className="border-b border-phosphor/20 overflow-hidden">
        <div className="flex items-center gap-8 px-4 py-1.5 whitespace-nowrap">
          <span className="font-mono text-xs text-phosphor-dim tracking-widest flex-shrink-0">
            MARCH 2020 // LIVE TAPE
          </span>
          {TICKER.map(t => (
            <span key={t.symbol} className="font-mono text-xs flex-shrink-0">
              <span className="text-phosphor-mid">{t.symbol} </span>
              <span className={t.neg ? 'negative-value' : 'positive-value'}>{t.value}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Attract body — clicking/tapping the card starts the game. */}
      <button
        type="button"
        onClick={start}
        aria-label="Press start: enter the market"
        className="flex-1 w-full flex items-center justify-center px-5 py-8 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-phosphor/50"
      >
        <div className="w-full max-w-3xl mx-auto">
          {panel === 'title' && <TitlePanel blink={blink} />}
          {panel === 'story' && <StoryPanel />}
          {panel === 'howto' && <HowToPanel />}
        </div>
      </button>

      {/* Persistent control bar — pointer + keyboard, does not bubble to start */}
      <div
        className="border-t border-phosphor/20 px-4 py-3"
        onClick={e => e.stopPropagation()}
      >
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Panel dots + prev/next */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous card"
              className="font-mono text-xs text-phosphor-dim hover:text-phosphor px-2 py-1 border border-phosphor/20 rounded-terminal"
            >
              ◄
            </button>
            <div className="flex items-center gap-2" role="tablist" aria-label="Attract screens">
              {PANELS.map(p => (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={panel === p}
                  aria-label={PANEL_LABEL[p]}
                  onClick={() => setPanel(p)}
                  className={`h-2 rounded-full transition-all ${
                    panel === p ? 'w-6 bg-phosphor shadow-phosphor' : 'w-2 bg-phosphor/25 hover:bg-phosphor/50'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next card"
              className="font-mono text-xs text-phosphor-dim hover:text-phosphor px-2 py-1 border border-phosphor/20 rounded-terminal"
            >
              ►
            </button>
          </div>

          {/* Start CTA */}
          <div className="sm:ml-auto flex items-center gap-4">
            <div className="font-mono text-phosphor-dim leading-tight" style={{ fontSize: '10px' }}>
              <div>NO ACCOUNT NEEDED · 3 FREE DECISIONS · 18+</div>
              <div className="text-phosphor-dim/70">SIMULATION · U.S. EQUITIES · HISTORICAL DATA</div>
            </div>
            <button
              type="button"
              onClick={start}
              className="cmd-button cmd-button-primary font-mono text-sm tracking-widest px-6 py-3 flex-shrink-0"
            >
              [ ENTER THE MARKET ]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Panels ────────────────────────────────────────────────────────────────

function TitlePanel({ blink }: { blink: string }) {
  return (
    <div className="text-center space-y-6 animate-fade-in">
      <div className="font-mono text-xs text-phosphor-dim tracking-[0.35em]">
        REFI.TRADING PRESENTS
      </div>
      <div>
        <h1
          className="font-mono font-bold tracking-tight terminal-glow-strong leading-none"
          style={{ color: '#79FFD7', fontSize: 'clamp(3rem, 12vw, 7rem)' }}
        >
          REFI ALPHA
        </h1>
        <div className="mt-3 font-mono tracking-[0.3em] text-phosphor terminal-glow"
             style={{ fontSize: 'clamp(0.9rem, 3vw, 1.6rem)' }}>
          ★ MAN vs MACHINE ★
        </div>
      </div>
      <div className="w-24 border-t border-phosphor/40 mx-auto" />
      <div className="font-mono text-phosphor-mid leading-7 space-y-1"
           style={{ fontSize: 'clamp(0.8rem, 2.5vw, 1rem)' }}>
        <div>THE MARKET ALREADY HAPPENED.</div>
        <div>YOU STILL DON&apos;T KNOW WHAT COMES NEXT.</div>
      </div>
      <div className={`font-mono text-phosphor-hot tracking-[0.3em] pt-2 ${blink}`}
           style={{ fontSize: 'clamp(0.9rem, 3vw, 1.25rem)' }}>
        ▶ PRESS ENTER TO START ◀
      </div>
      <div className="font-mono text-xs text-phosphor-dim">OR TAP ANYWHERE</div>

      {/* Funnel connection to the ReFi SEC-facing product (§1.1 one-way
          bridge): the game is the front door — free play leads to paper,
          paper leads to the ReFi.Trading product. */}
      <div className="pt-4 font-mono text-xs tracking-[0.2em] text-phosphor-dim">
        FREE PLAY <span className="text-phosphor-mid">→</span> PAPER TRADING <span className="text-phosphor-mid">→</span> <span className="text-phosphor">REFI.TRADING</span>
      </div>
    </div>
  );
}

function StoryPanel() {
  return (
    <div className="space-y-7 animate-fade-in">
      <PanelHeading>THE MISSION</PanelHeading>

      <div className="font-mono text-phosphor-mid leading-8 space-y-2"
           style={{ fontSize: 'clamp(0.85rem, 2.4vw, 1.05rem)' }}>
        <div><span className="text-phosphor-hot">MARCH 2020.</span> HISTORY&apos;S FASTEST CRASH.</div>
        <div>YOU GET <span className="text-phosphor">$100,000</span> AND THE SAME DATA AS THE MACHINE.</div>
        <div className="text-phosphor">THE MACHINE NEVER SEES THE FUTURE. NEITHER DO YOU.</div>
      </div>

      {/* Product arc as arcade objectives */}
      <div>
        <div className="font-mono text-xs text-phosphor-dim tracking-widest mb-3">YOUR PATH</div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          {ARC.map((step, i) => (
            <span key={step} className="flex items-center gap-2">
              <span className="font-mono text-xs px-2.5 py-1 border border-phosphor/30 rounded-terminal text-phosphor-mid">
                {step}
              </span>
              {i < ARC.length - 1 && <span className="text-phosphor-dim">→</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Regime progression */}
      <div>
        <div className="font-mono text-xs text-phosphor-dim tracking-widest mb-2">THE ARENAS</div>
        <div className="font-mono text-sm text-phosphor-mid tracking-wide">
          {REGIMES.join('  ·  ')}
        </div>
      </div>
    </div>
  );
}

function HowToPanel() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PanelHeading>HOW TO PLAY</PanelHeading>

      {/* The loop */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {LOOP.map(s => (
          <div key={s.n} className="terminal-panel-deep p-3 space-y-1.5">
            <div className="font-mono text-xs text-phosphor-hot terminal-glow">{s.n}</div>
            <div className="font-mono text-xs text-phosphor tracking-wide">{s.title}</div>
            <div className="font-mono text-phosphor-dim leading-4" style={{ fontSize: '10px' }}>{s.body}</div>
          </div>
        ))}
      </div>

      {/* Moves */}
      <div>
        <div className="font-mono text-xs text-phosphor-dim tracking-widest mb-2">YOUR MOVES</div>
        <div className="flex flex-wrap gap-2">
          {MOVES.map(m => (
            <span key={m} className="font-mono text-xs px-2.5 py-1 border border-phosphor/30 rounded-terminal text-phosphor-mid">
              {m}
            </span>
          ))}
        </div>
      </div>

      {/* Rules of the game */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {RULES.map(([title, body]) => (
          <div key={title} className="flex gap-2 font-mono text-xs leading-5">
            <span className="text-phosphor-hot flex-shrink-0">▸</span>
            <span>
              <span className="text-phosphor">{title}. </span>
              <span className="text-phosphor-dim">{body}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="font-mono text-xs text-phosphor-dim tracking-wide pt-1">
        <span className="nav-key">ENTER</span> ACT ·
        <span className="nav-key ml-2">◄ ►</span> BROWSE · CLICK OR TAP ANYWHERE TO ACT
      </div>
    </div>
  );
}

function PanelHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono tracking-[0.25em] text-phosphor-hot terminal-glow"
            style={{ fontSize: 'clamp(1.1rem, 4vw, 1.8rem)' }}>
        {children}
      </span>
      <span className="flex-1 border-t border-phosphor/25" />
    </div>
  );
}
