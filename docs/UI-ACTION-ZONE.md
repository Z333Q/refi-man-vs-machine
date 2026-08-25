# UI/UX — Primary Action Zone

Design-system rule for ReFi Alpha screens. Companion to CLAUDE.md §56
(every active screen must answer the five questions) and §62 (accessibility).

## The rule

> The action that advances game state appears immediately after the active
> interaction or result, centred within the main game column. Its position
> remains visually stable from state to state. Secondary actions never share
> equal emphasis or occupy the same zone.

```
EVENT / CONTEXT      what is happening
       ↓
PLAYER DECISION      stance / thesis / conviction
       ↓
[ PRIMARY ACTION ]   what commits it
```

The label changes across the journey — `ENTER THE MARKET`, `START RUN`,
`REVIEW & COMMIT`, `COMMIT DECISION`, `NEXT SIGNAL`, `VIEW AUTOPSY` — the
relationship to the decision above it does not.

## Hierarchy

| Level | Purpose | Where |
|---|---|---|
| Primary | Advances game state | Action zone, one per screen |
| Decision | Changes the current decision | Screen content, above the zone |
| Secondary | Optional information / settings | Action-zone edges, materially quieter |
| Navigation | Exit, back, menu | Screen corners (header) |

## Why it is structural, not a coordinate

Screens have different content heights; pinning every button to a fixed
percentage of viewport height produces bad spacing. `.action-zone-page` uses
`margin-top: auto`, which only claims leftover space:

- tall content → the zone sits directly under the decision block (proximity);
- short content → it settles into the lower region (stable placement, motor
  memory).

Page-variant zones are also `position: sticky; bottom: 0`, so on a page taller
than the viewport the action stays reachable without changing document order.

## Responsive behaviour

Desktop and mobile share the hierarchy, not the geometry.

- **Mobile (<640px)** — one column; the primary is full width and first in the
  zone's reading order, secondary actions stack beneath it. Bottom padding adds
  `env(safe-area-inset-bottom)` so the action clears browser chrome.
- **Tablet (640–1023px)** — dense side rails collapse; their content stays
  reachable through the centre column's panel tabs.
- **Desktop (≥1024px)** — full terminal layout, zone lower-centre.
- **Short landscape (≤500px tall)** — reduced padding so the zone never eats
  the decision block.

Viewport class, orientation and pointer type come from `useViewport()`
(`src/lib/useViewport.ts`).

## Landscape requirement

The run terminal, tutorial, Machine Builder and Basket Writer show the signal,
the portfolio and the risk state at once. In portrait under 900px they cannot
be read, so `OrientationGate` shows a rotate notice *before* the player commits
a decision they cannot fully see. Per CLAUDE.md §4.1 it never traps them:
"continue in portrait anyway" is always available and is remembered for that
screen.

## Usage

```tsx
<ActionZone
  note="THIS DECISION BECOMES PART OF YOUR RUN RECORD."
  primary={{
    label: 'COMMIT DECISION',
    onClick: commit,
    disabled: !hasDraft,
    disabledHint: 'DRAFT AN ORDER OR SELECT HOLD',
    keyHint: '[ENTER]',
  }}
  secondaryLeft={<SecondaryAction label="Revise decision" onClick={revise} />}
/>
```

- `variant="page"` (default) for screens that scroll; `variant="inline"` for a
  pane that owns its own scrolling (the run terminal, Machine Builder).
- Disabled actions stay **visible** — a hidden button restarts the search. The
  reason renders as text under the button, and the disabled state is carried by
  a dashed border as well as colour (§62: never colour alone).
- ENTER is bound to the primary by default. It stands down for form fields and
  while a coaching or help overlay is open (`[data-blocking-overlay]`), and can
  be disabled with `bindEnter: false` when a screen owns its own ENTER.
