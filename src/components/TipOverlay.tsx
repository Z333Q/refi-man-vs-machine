import { useEffect } from 'react';
import { useTips } from '../context/TipContext';
import type { TipType } from '../lib/tipDefinitions';

const TYPE_LABEL: Record<TipType, string> = {
  SPOTLIGHT: 'SPOTLIGHT TIP',
  FIRST_EVENT: 'FIRST EVENT',
  DECISION: 'DECISION TIP',
  CONCEPT: 'CONCEPT',
  PROGRESSION: 'MODULE UNLOCK',
};

export default function TipOverlay() {
  const { activeTip, handleTipAction } = useTips();

  // ESC key to dismiss non-blocking tips
  useEffect(() => {
    if (!activeTip) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !activeTip.blocking) {
        handleTipAction('DISMISS');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTip, handleTipAction]);

  if (!activeTip) return null;

  const tip = activeTip;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-terminal-black/55 font-mono"
        onClick={!tip.blocking ? () => handleTipAction('DISMISS') : undefined}
      />

      {/* Overlay box — centered, terminal aesthetic */}
      <div className="fixed z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md pointer-events-none">
        <div
          className="border border-phosphor/60 bg-terminal-deep pointer-events-auto mx-4 animate-boot-fade"
          style={{ boxShadow: '0 0 40px rgba(57,255,20,0.08)' }}
        >
          {/* Header bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-phosphor/20 bg-phosphor/5">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-phosphor animate-pulse" />
              <span className="text-phosphor-dim text-xs tracking-widest">
                {TYPE_LABEL[tip.type]}
              </span>
            </div>
            {!tip.blocking && (
              <button
                onClick={() => handleTipAction('DISMISS')}
                className="text-phosphor-dim text-xs hover:text-phosphor transition-colors"
              >
                ESC
              </button>
            )}
          </div>

          {/* Content */}
          <div className="px-5 py-5">
            {/* Title */}
            <div className="text-phosphor text-sm font-bold tracking-widest mb-4 leading-snug">
              {tip.title}
            </div>

            {/* Body lines */}
            <div className="space-y-3 mb-5">
              {tip.body.map((line, i) => (
                <p key={i} className="text-phosphor-mid text-xs leading-relaxed tracking-wide">
                  {line}
                </p>
              ))}
            </div>

            {/* Spotlight indicator */}
            {tip.spotlight && (
              <div className="flex items-center gap-2 mb-4 border border-phosphor/25 px-3 py-2">
                <div className="w-1.5 h-1.5 bg-alert-amber" />
                <span className="text-alert-amber text-xs tracking-widest">
                  LOOK FOR: {tip.spotlight}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              {tip.actions.map((act, i) => (
                <button
                  key={i}
                  onClick={() => handleTipAction(act.action)}
                  className={`text-xs tracking-widest px-4 py-2 border transition-colors ${
                    i === 0
                      ? 'border-phosphor text-phosphor hover:bg-phosphor/15 bg-phosphor/5'
                      : 'border-phosphor/30 text-phosphor-dim hover:border-phosphor/50 hover:text-phosphor-mid'
                  }`}
                >
                  {act.label}
                </button>
              ))}
            </div>
          </div>

          {/* Footer.

              The ESC hint used to render on every tip, including blocking ones
              where the key handler deliberately ignores it. A modal that tells
              the player to press a key that does nothing is worse than one that
              offers no way out at all: they press it, nothing happens, and the
              interface has just taught them not to trust its own instructions.
              A blocking tip states what it actually wants instead. */}
          <div className="px-5 py-2 border-t border-phosphor/10 text-phosphor-dim text-xs tracking-widest">
            GUIDANCE: FULL · {tip.blocking ? 'CHOOSE AN OPTION TO CONTINUE' : 'ESC TO DISMISS'}
          </div>
        </div>
      </div>
    </>
  );
}
