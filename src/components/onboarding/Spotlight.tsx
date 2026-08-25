import { useState, useLayoutEffect, type ReactNode } from 'react';

// Spotlight coaching primitive (P0 IA system).
//
// Dims the whole screen except one element (the thing being discussed),
// draws a pulsing focus ring around it, and anchors a callout — the
// instruction — right next to it, with an arrow pointing at the element.
// This replaces the old split-attention pattern (instruction in a side
// rail, control on the far side of the screen).
//
// Aligned to the spec: teach the control before use, one overlay at a
// time (§14); reduced-motion swaps the pulse for a static ring, and the
// callout is keyboard-operable with a visible focus state (§66). The
// scrim is pointer-events:none so the highlighted control stays usable.

const PAD = 8; // breathing room around the highlighted element

// Measures a target element's viewport rect, re-measuring on layout
// changes so the spotlight tracks tab switches, scrolls, and resizes.
function useElementRect(selector: string | null, deps: unknown[]): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(selector);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    raf = requestAnimationFrame(measure); // catch post-layout settle
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selector, ...deps]);
  return rect;
}

interface SpotlightProps {
  /** CSS selector for the element to highlight; null renders a centered callout. */
  targetSelector: string | null;
  /** Re-measure triggers (e.g. [stepIdx, activePanel]). */
  watch: unknown[];
  title: string;
  body: ReactNode;
  hint?: string;
  step: { current: number; total: number };
  nextLabel: string;
  onNext: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  reducedMotion?: boolean;
}

export function Spotlight({
  targetSelector,
  watch,
  title,
  body,
  hint,
  step,
  nextLabel,
  onNext,
  onBack,
  onSkip,
  reducedMotion = false,
}: SpotlightProps) {
  const rect = useElementRect(targetSelector, watch);

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const CALLOUT_W = Math.min(400, vw - 32);

  // Placement: prefer below the target; flip above if there isn't room.
  const below = !rect || rect.bottom + 240 < vh || rect.top < 240;
  const calloutLeft = rect
    ? Math.max(16, Math.min(rect.left, vw - CALLOUT_W - 16))
    : 0;
  const calloutTop = rect ? (below ? rect.bottom + PAD + 14 : rect.top - PAD - 14) : 0;
  const caretLeft = rect ? Math.max(12, Math.min(rect.left + rect.width / 2 - calloutLeft, CALLOUT_W - 24)) : 0;

  const holeClass = reducedMotion ? 'spotlight-ring-static' : 'spotlight-ring';

  const callout = (
    <div
      role="dialog"
      aria-label={title}
      className="pointer-events-auto terminal-panel bg-terminal-panel p-4 shadow-phosphor-strong animate-fade-in"
      style={
        rect
          ? {
              position: 'fixed',
              left: calloutLeft,
              top: calloutTop,
              width: CALLOUT_W,
              transform: below ? undefined : 'translateY(-100%)',
              zIndex: 62,
            }
          : { width: CALLOUT_W, zIndex: 62 }
      }
    >
      {/* Caret pointing at the target */}
      {rect && (
        <div
          aria-hidden
          className="absolute w-2.5 h-2.5 bg-terminal-panel border-phosphor/25 rotate-45"
          style={
            below
              ? { top: -5, left: caretLeft, borderLeft: '1px solid', borderTop: '1px solid' }
              : { bottom: -5, left: caretLeft, borderRight: '1px solid', borderBottom: '1px solid' }
          }
        />
      )}

      {/* Step dots */}
      <div className="flex items-center gap-1.5 mb-3">
        {Array.from({ length: step.total }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i < step.current - 1 ? 'w-1.5 bg-paper-green' :
              i === step.current - 1 ? 'w-5 bg-phosphor' :
              'w-1.5 bg-phosphor/20'
            }`}
          />
        ))}
      </div>

      <div className="font-mono text-phosphor-dim text-xs tracking-widest mb-1">
        STEP {step.current} OF {step.total}
      </div>
      <div className="font-mono text-phosphor text-sm font-bold leading-snug mb-2">{title}</div>
      <div className="font-mono text-phosphor-mid text-xs leading-relaxed mb-3">{body}</div>

      {hint && (
        <div className="font-mono text-phosphor-dim text-xs tracking-widest border border-phosphor/20 rounded-terminal px-3 py-2 mb-3 text-center">
          {hint}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={onNext}
          className="cmd-button cmd-button-primary flex-1 py-2.5 text-xs tracking-widest"
        >
          {nextLabel}
        </button>
        {onBack && (
          <button
            onClick={onBack}
            className="font-mono text-phosphor-dim text-xs hover:text-phosphor transition-colors tracking-widest px-2"
          >
            ← BACK
          </button>
        )}
      </div>
      {onSkip && (
        <button
          onClick={onSkip}
          className="w-full text-center font-mono text-phosphor-dim/70 text-xs mt-2 hover:text-phosphor-dim transition-colors tracking-widest"
        >
          SKIP TUTORIAL →
        </button>
      )}
    </div>
  );

  return (
    <div data-blocking-overlay className="fixed inset-0 z-[60]" style={{ pointerEvents: 'none' }}>
      {/* Scrim + focus ring over the target (or a full scrim when centered). */}
      {rect ? (
        <div
          className={`spotlight-hole ${holeClass}`}
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        />
      ) : (
        <div className="spotlight-hole spotlight-scrim-only" style={{ inset: 0, borderRadius: 0 }} />
      )}

      {/* Callout: centered when there's no target, otherwise anchored. */}
      {rect ? (
        callout
      ) : (
        <div className="fixed inset-0 flex items-center justify-center px-4" style={{ zIndex: 62 }}>
          {callout}
        </div>
      )}
    </div>
  );
}
