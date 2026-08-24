import {
  useCallback, useEffect, useRef, useState, useSyncExternalStore,
} from 'react';
import {
  claimFloor, releaseFloor, lastSpeechId, subscribeFloor,
} from '../../lib/floor';
import {
  MOOD_CLASS, describeSpeech, type VoiceMood,
} from '../../lib/terminalVoice';

// ─── TalkingWindow ────────────────────────────────────────────────────────────
//
// A window that takes the floor like a retro dialog box: wakes in chunky
// steps, runs a thin zigzag outline at cursor cadence while it speaks, types
// its lines teletype-style, then settles back to a hairline. Policy (moods,
// gating, exclusivity) lives in lib/terminalVoice.ts and lib/floor.ts; this
// component is only the body. CSS: the `twin-*` block in index.css.
//
// One cursor, ever: the blinking cursor renders only in the window that was
// the most recent speech (lastSpeechId), so the player's eye always has
// exactly one place to be.
//
// Reduced motion (§62): the full text lands instantly, whole; the border
// holds still. The words are the content, the animation is not.

const CHAR_MS = 9;
const LINE_BREAK_MS = 140;
const WAKE_MS = 260;

interface Props {
  /** Floor identity. Also decides who owns the single blinking cursor. */
  id: string;
  title: string;
  /** Small right-aligned context label in the title bar. */
  sig?: string;
  mood?: VoiceMood;
  /** Optional bold first line (an action code); typed before the body. */
  headline?: string;
  headlineClassName?: string;
  /** Player-facing copy. Each entry is one line; empty string = blank beat. */
  lines: string[];
  /** True: claim the floor and teletype. False: render finished, no floor. */
  speak?: boolean;
  reducedMotion?: boolean;
  /** Fires once the speech has finished and released the floor. */
  onDone?: () => void;
  className?: string;
}

function useFloorVersion(): number {
  const version = useRef(0);
  const subscribe = useCallback((notify: () => void) => subscribeFloor(() => {
    version.current += 1;
    notify();
  }), []);
  return useSyncExternalStore(subscribe, () => version.current, () => 0);
}

export default function TalkingWindow({
  id, title, sig, mood = 'CALM', headline, headlineClassName = 'text-phosphor-hot',
  lines, speak = false, reducedMotion = false, onDone, className = '',
}: Props) {
  const fullBody = lines.join('\n');
  const fullText = headline ? `${headline}\n${fullBody}` : fullBody;

  // idle → waking → talking → done
  const [phase, setPhase] = useState<'idle' | 'waking' | 'talking' | 'done'>(
    speak && !reducedMotion ? 'idle' : 'done',
  );
  const [typed, setTyped] = useState(speak && !reducedMotion ? '' : fullText);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(false);
  const floorVersion = useFloorVersion();

  const owner = { kind: 'SPEECH' as const, id };

  // Take the floor when asked to speak; wait our turn if it is held. The
  // floor subscription re-renders us on release, so a denied claim retries
  // without polling.
  useEffect(() => {
    if (!speak || doneRef.current) return;
    if (reducedMotion) {
      // Instant, whole; still registers as the most recent speech so the
      // cursor lands here, then yields the floor immediately.
      if (claimFloor(owner)) {
        releaseFloor(owner);
        doneRef.current = true;
        setTyped(fullText);
        setPhase('done');
        onDone?.();
      }
      return;
    }
    if (phase !== 'idle') return;
    if (!claimFloor(owner)) return; // floor busy; retry on next floor change
    setPhase('waking');
    timerRef.current = setTimeout(() => setPhase('talking'), WAKE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak, phase, reducedMotion, floorVersion]);

  // The teletype. Presentation-only timing; game state never depends on it.
  useEffect(() => {
    if (phase !== 'talking') return;
    let i = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (i < fullText.length) {
        const ch = fullText.charAt(i);
        i += 1;
        setTyped(fullText.slice(0, i));
        timerRef.current = setTimeout(tick, ch === '\n' ? LINE_BREAK_MS : CHAR_MS);
      } else {
        setPhase('done');
        doneRef.current = true;
        releaseFloor(owner);
        onDone?.();
      }
    };
    tick();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, fullText]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    releaseFloor(owner);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One cursor on the page: only the most recent speech shows it.
  const showCursor = speak && lastSpeechId() === id && phase !== 'idle' && phase !== 'waking';

  const typedHeadline = headline
    ? typed.split('\n')[0] ?? ''
    : null;
  const typedBody = headline
    ? typed.includes('\n') ? typed.slice(typed.indexOf('\n') + 1) : ''
    : typed;
  const headlineComplete = headline !== undefined && typedHeadline === headline;

  return (
    <div
      className={`twin ${MOOD_CLASS[mood]} ${phase === 'waking' ? 'twin-enter' : ''} ${phase === 'talking' ? 'twin-talking' : ''} ${className}`}
      role="status"
      aria-label={describeSpeech(title, headline ? [headline, ...lines] : lines)}
    >
      <span className="twin-tooth twin-tooth-t" aria-hidden="true" />
      <span className="twin-tooth twin-tooth-b" aria-hidden="true" />
      <span className="twin-tooth twin-tooth-l" aria-hidden="true" />
      <span className="twin-tooth twin-tooth-r" aria-hidden="true" />
      <div className="twin-bar" aria-hidden="true">
        <span className="twin-title">{title}</span>
        {sig && <span className="twin-sig">{sig}</span>}
      </div>
      <div className="twin-bod" aria-hidden="true">
        {headline !== null && headline !== undefined && (
          <div className={`twin-headline ${headlineComplete ? headlineClassName : 'text-phosphor-dim'}`}>
            {typedHeadline}
            {showCursor && !headlineComplete && <span className="twin-cur" />}
          </div>
        )}
        <pre className="twin-talk">
          {typedBody}
          {showCursor && (headline === undefined || headlineComplete) && <span className="twin-cur" />}
        </pre>
      </div>
    </div>
  );
}
