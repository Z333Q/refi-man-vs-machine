import { useEffect, type ReactNode } from 'react';

/**
 * Primary action zone.
 *
 * Design-system rule: the action that advances game state appears immediately
 * after the active interaction or result, centred within the main game column.
 * Its position stays visually stable from state to state. Secondary actions
 * never share equal emphasis or occupy the same zone.
 *
 *   EVENT / CONTEXT        what is happening
 *        ↓
 *   PLAYER DECISION        stance / thesis / conviction
 *        ↓
 *   [ PRIMARY ACTION ]     what commits it
 *
 * The label changes across the journey — ENTER THE MARKET, LOCK DECISION,
 * COMMIT, NEXT SIGNAL — but its relationship to the decision above it does
 * not. After two or three checkpoints the player stops scanning for the next
 * step. The invariant is structural, not an absolute screen coordinate: see
 * `.action-zone` in index.css for how the spacing resolves.
 *
 * Hierarchy:
 *   PRIMARY     advances game state          this zone, one per screen
 *   DECISION    changes the current decision the content above it
 *   SECONDARY   optional info / settings     this zone's edges, quieter
 *   NAVIGATION  exit, back, menu             screen corners (header)
 */

export interface PrimaryActionSpec {
  label: string;
  onClick: () => void;
  /** Disabled actions stay VISIBLE — a hidden button restarts the search. */
  disabled?: boolean;
  /** Why it is unavailable, shown under the button in its disabled state. */
  disabledHint?: string;
  /** Keyboard equivalent shown on the button. ENTER is bound by default. */
  keyHint?: string;
  /** Bind ENTER to this action. Off when the screen owns its own ENTER. */
  bindEnter?: boolean;
}

interface ActionZoneProps {
  primary: PrimaryActionSpec;
  /** One line above the button: what committing does. */
  note?: string;
  /** Optional information / settings actions. Pushed to the zone edges. */
  secondaryLeft?: ReactNode;
  secondaryRight?: ReactNode;
  /**
   * 'page'   sticky band at the foot of a scrolling screen (default)
   * 'inline' non-sticky band for a fixed-height pane that owns its own scroll
   */
  variant?: 'page' | 'inline';
  className?: string;
}

/** Optional action that must never compete with the primary. */
export function SecondaryAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="action-secondary">
      {label}
    </button>
  );
}

export default function ActionZone({
  primary,
  note,
  secondaryLeft,
  secondaryRight,
  variant = 'page',
  className = '',
}: ActionZoneProps) {
  const { label, onClick, disabled = false, disabledHint, keyHint, bindEnter = true } = primary;

  // A click that navigated here leaves focus on a control from the previous
  // screen, which would swallow ENTER. Clear that stale focus once, on mount,
  // so the keyboard equivalent of the primary action works immediately.
  useEffect(() => {
    const el = document.activeElement;
    if (el instanceof HTMLElement && el !== document.body && el.tagName === 'BUTTON') {
      el.blur();
    }
  }, []);

  useEffect(() => {
    if (!bindEnter || disabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      // Never steal ENTER from a field the player is typing into, or from a
      // control they have deliberately focused.
      // A coaching or help overlay owns the keyboard while it is open.
      if (document.querySelector('[data-blocking-overlay], [role="dialog"]')) return;
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLButtonElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      onClick();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [bindEnter, disabled, onClick]);

  return (
    <div
      data-action-zone={variant}
      className={`action-zone ${variant === 'page' ? 'action-zone-page' : 'action-zone-inline'} ${className}`}
    >
      <div className="action-zone-edge action-zone-edge-left">{secondaryLeft}</div>

      <div className="action-zone-core">
        {note && <div className="action-zone-note">{note}</div>}
        <button
          onClick={onClick}
          disabled={disabled}
          aria-disabled={disabled}
          className="action-primary"
        >
          {label}
          {keyHint && !disabled && <span className="action-primary-key">{keyHint}</span>}
        </button>
        {/* The disabled reason carries the state in text, never colour alone. */}
        <div className="action-zone-hint">{disabled ? disabledHint ?? 'UNAVAILABLE' : ' '}</div>
      </div>

      <div className="action-zone-edge action-zone-edge-right">{secondaryRight}</div>
    </div>
  );
}
