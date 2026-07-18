# CLAUDE.md — ReFi Alpha / Man vs Machine
## Authoritative Game, Onboarding, UX, Visual, Benchmark, Data, and Engineering Specification

> **Repository target:** `refi-man-vs-machine`
>
> **Parent product:** ReFi.Trading
>
> **Purpose:** This document is the primary source of truth for product intent, game design, onboarding architecture, screens, controls, tutorial overlays, economic-event arenas, Machine Builder, machine benchmarks, scoring, state machines, event contracts, data models, visual language, programmatic animation, analytics, and conversion into the ReFi.Trading investor product.
>
> **Operating principle:** Do not implement isolated features that contradict the progression described here. ReFi Alpha is one coherent journey:
>
> `Human → Human vs Machine → Diagnose → Build Rules → Build Machine → Stress Test → Machine vs ReFi → Paper → ReFi Client`

> **Revision 2026-07-17:** Reorganized authoritative spec. The optional onboarding architecture is promoted to a first-class section (§4). Section numbering supersedes the prior (pre-2026-07-17) revision — cross-references in code comments and commit messages authored before this date may cite the old numbers.
>
> **Companion spec / precedence:** A companion document, the **ReFi Alpha (Man vs Machine) USA Build and Integration Specification**, governs the surfaces this file leaves open. Where this document and the USA Build Integration Spec conflict on **integration, compliance, security, data contracts, or build order, the USA Build Integration Spec governs.** Where the concern is game-design intent, this document governs.

---

# 0. Instructions to Claude Code

When working in this repository:

1. Read this file before proposing product, UX, data-model, or game-loop changes.
2. Preserve the U.S. equities-only gameplay constraint.
3. Preserve the distinction between:
   - historical market data;
   - player simulation;
   - game-rule machine benchmarks;
   - historical walk-forward ReFi simulations;
   - actual documented RF/RL benchmark snapshots;
   - paper trading;
   - live client product activity.
4. Never fabricate historical ReFi benchmark results for periods where no valid point-in-time ReFi benchmark has been produced.
5. Never imply that the machine knows future data.
6. Never design gameplay that rewards trade frequency.
7. Treat `HOLD` as an explicit decision.
8. Treat the overlay tutorial system as core infrastructure, not optional polish.
9. Treat programmatic animations as data-driven explanations, not decorative cinema.
10. The game is an optional onboarding path into ReFi.Trading, not the only path.
11. Do not merge game behavioral data into the formal advisory profile without an explicit, approved product and compliance decision.
12. Do not build a second, incompatible ReFi identity system. Anonymous game progress must be transferable into the formal ReFi onboarding flow through a controlled handoff.
13. Do not use per-trade investor approval language for ReFi Managed mode.
14. Do not hard-code benchmark claims in UI copy. Render benchmark data from versioned `BenchmarkSnapshot` records.
15. Do not replace the economic-event progression with generic arcade levels. COVID, Recovery, Inflation, Banking Stress, and TACO are the game world.
16. Do not turn the product into a casino. Avoid confetti, slot-machine audio, fake urgency, order-count rewards, random loot, or "trade streaks."
17. Preserve accessibility: every animation requires a reduced-motion equivalent and every keyboard action requires a mouse/touch equivalent.
18. Prefer deterministic simulation, replayability, auditability, explicit versioning, and inspectable rules.
19. Before changing benchmark logic, review the benchmark reconciliation section in this document.
20. Before changing conversion flows, review the optional onboarding architecture section.

---

# 1. Product Definition

## 1.1 One-sentence definition

**ReFi Alpha is a historical U.S. equity strategy game where players first compete against machines, then build their own machine to protect and manage a portfolio through major economic regimes, and finally move from historical simulation into paper trading and the ReFi.Trading product.**

## 1.2 Core fantasy

The player should not fantasize about becoming the world's best stock picker.

The fantasy is:

> **Build a U.S. equity machine robust enough to survive history.**

## 1.3 Core thesis

The player begins believing:

```text
I CAN BEAT THE MACHINE.
```

The game demonstrates:

```text
I CAN SOMETIMES BEAT THE MACHINE.

I CANNOT EASILY REPEAT IT ACROSS REGIMES.

MY PROBLEM IS NOT ONLY STOCK SELECTION.

POSITION SIZE MATTERS.
CONCENTRATION MATTERS.
TIMING MATTERS.
TURNOVER MATTERS.
RE-ENTRY MATTERS.
DISCIPLINE MATTERS.

I NEED A PROCESS.

I CAN BUILD A MACHINE AROUND THAT PROCESS.
```

The game then becomes:

```text
MY MACHINE
VS
HISTORY
```

and later:

```text
MY MACHINE
VS
REFI
```

## 1.4 Marketing thesis

Use:

```text
THE MACHINE DOES NOT WIN
BECAUSE IT KNOWS THE FUTURE.

IT MONITORS MORE.
IT UPDATES CONSISTENTLY.
IT FOLLOWS A PROCESS.
IT MANAGES RISK.
IT DOES NOT PANIC.
```

Never use:

```text
AI ALWAYS BEATS HUMANS.
```

Use:

```text
BEATING A MACHINE ONCE IS POSSIBLE.

DOING IT REPEATEDLY,
ACROSS DIFFERENT MARKET REGIMES,
UNDER THE SAME RISK LIMITS,
IS HARD.
```

The ultimate ReFi message is:

```text
YOU DO NOT NEED TO BECOME THE MACHINE.

YOU NEED TO BUILD A PROCESS
THAT CAN OPERATE LIKE ONE.
```

---

# 2. Hard Product Scope

## 2.1 Playable asset scope

ReFi Alpha gameplay is about:

- U.S.-listed common equities;
- cash as unallocated buying power.

Do not make the following tradable in the base game:

- bonds;
- Treasuries;
- gold;
- commodities;
- currencies;
- crypto;
- options;
- futures;
- leveraged products;
- inverse products;
- international securities.

## 2.2 Contextual indicators

The following may appear as information because they affect U.S. equity decisions:

- Federal Funds Rate;
- 10-Year Treasury Yield;
- VIX;
- WTI Crude;
- U.S. Dollar Index;
- credit spreads;
- inflation;
- unemployment;
- PMI;
- consumer sentiment;
- market breadth;
- sector performance;
- volume;
- liquidity;
- earnings revisions;
- policy events;
- tariff actions;
- supply-chain indicators.

The distinction must remain clear:

```text
CONTEXT
INFORMS THE DECISION.

U.S. EQUITIES
ARE THE PLAYABLE PORTFOLIO.
```

---

# 3. Relationship to ReFi.Trading

ReFi Alpha is an acquisition, education, trust, and onboarding surface.

It is not a disconnected marketing mini-game.

The game should prepare the player to understand the real ReFi product abstractions:

| ReFi Alpha | ReFi.Trading Product Concept |
|---|---|
| Alpha Profile | Advisory Profile |
| Basket Builder | Strategy Review |
| Machine Builder | Strategy + execution-policy concepts |
| Guardrails | Execution Policy |
| Stress Test | Simulation / historical evaluation |
| Machine Record | Decision Record |
| Arena Autopsy | Activity / Records |
| Pause Rule | Pause Managed |
| Rule Conflict | Exception Review concept |
| Live Paper Machine | Paper broker environment |
| Product Handoff | Eligibility / Auth / KYC |
| Strategy Lock | Strategy Review |
| Machine Activation | Managed Execution Activation |

Important boundary:

- The Alpha Profile is an educational behavioral profile.
- The formal Advisory Profile is explicit user-supplied data.
- Do not silently infer suitability from gameplay.
- Do not write game behavior directly into formal advisory fields.
- Gameplay may be shown back to the user as self-reflection.
- Any future use of game behavior in advisory personalization requires explicit product, legal, and compliance approval.

---

# 4. Optional Onboarding Architecture

## 4.1 Principle

The game is **an onboarding path, not the onboarding path.**

ReFi must support at least two top-level journeys.

**Path A — Direct onboarding.** For users who already understand the product or were referred by a trusted source:

```text
REFI LANDING
    ↓
ELIGIBILITY
    ↓
AUTH
    ↓
KYC
    ↓
ADVISORY PROFILE
    ↓
BROKER CONNECTION
    ↓
STRATEGY REVIEW
    ↓
MODE / POLICY
    ↓
ACTIVATION
```

**Path B — Game-led experiential onboarding.** For users who need education, proof, or engagement before becoming a client:

```text
REFI ALPHA LANDING
    ↓
ANONYMOUS TUTORIAL
    ↓
FIRST MAN VS MACHINE RUN
    ↓
SAVE PROGRESS
    ↓
ALPHA ACCOUNT / PROGRESS RECORD
    ↓
HISTORICAL ARENAS
    ↓
ALPHA PROFILE
    ↓
MACHINE BUILDER
    ↓
MACHINE STRESS TEST
    ↓
PAPER INVITE
    ↓
FORMAL REFI HANDOFF
    ↓
ELIGIBILITY
    ↓
AUTH
    ↓
KYC
    ↓
FORMAL ADVISORY PROFILE
    ↓
BROKER PAPER CONNECTION
    ↓
STRATEGY REVIEW
    ↓
SIGNAL OR MANAGED PATH
```

The game-led path must never trap the user.

A player can enter formal ReFi onboarding at several moments:

- after tutorial;
- after first arena;
- after Alpha Profile;
- after Machine Builder;
- after first machine stress test;
- after TACO;
- from persistent "Paper" transition surfaces.

The conversion pressure should increase only as the user demonstrates intent.

## 4.2 Why the game-led path exists

The game-led path serves six purposes:

1. **Education** — Teach what ReFi means by portfolio process, guardrails, systematic execution, risk, and machine discipline.
2. **Trust formation** — Show machine decisions, data cutoffs, model versions, benchmark methods, and limitations.
3. **Behavioral self-awareness** — Let the user observe their own action bias, concentration, re-entry behavior, and consistency.
4. **Product comprehension** — Make the real ReFi onboarding concepts familiar before formal onboarding begins.
5. **Paper-trading readiness** — Move the user from historical simulation into current-market simulation.
6. **Lead qualification** — Distinguish curiosity from real intent without forcing regulated onboarding before value is demonstrated.

## 4.3 Recommended conversion stages

**Stage 0 — Visitor.** No account required. CTA:

```text
THINK YOU CAN BEAT THE MACHINE?
```

**Stage 1 — Anonymous player.** User completes tutorial and first 3–5 decisions. No formal ReFi onboarding yet.

**Stage 2 — Progress save.** Prompt:

```text
SAVE YOUR RUN

TRACK MACHINE BEAT RATE
BUILD YOUR ALPHA PROFILE
UNLOCK MACHINE BUILDER
```

This should create or bind a lightweight Alpha progress identity, not trigger all formal client onboarding immediately.

**Stage 3 — Engaged Alpha user.** User: completes arenas; reviews autopsies; builds machine versions; enters Daily Tape; joins Desks or tournaments.

**Stage 4 — Paper-curious.** Trigger after: first Machine Builder version; first historical machine stress test; or repeated arena engagement. CTA:

```text
HISTORY IS CLOSED.

THE LIVE MARKET IS NOT.

RUN YOUR PROCESS IN PAPER MODE.
```

**Stage 5 — Formal ReFi handoff.** The user crosses from game education into product onboarding. The product should clearly say:

```text
YOU ARE LEAVING THE HISTORICAL GAME
AND ENTERING REFI PRODUCT ONBOARDING.

YOUR GAME PROGRESS WILL BE PRESERVED.

YOUR FORMAL INVESTMENT PROFILE
WILL BE COLLECTED SEPARATELY.
```

**Stage 6 — Paper broker connection.** Where supported, default first-time setup toward paper environment.

**Stage 7 — Strategy review.** The player's game experience should make this screen easier to understand. The UI may reference educational continuity:

```text
IN ALPHA, YOU BUILT AND TESTED RULES.

HERE, REVIEW THE REFI STRATEGY
GENERATED FOR YOUR FORMAL PROFILE.
```

Do not claim the formal strategy was generated from gameplay unless that is actually approved and implemented.

**Stage 8 — Signal or Managed.** Game transition copy:

```text
YOU HAVE SEEN HOW A MACHINE
MAKES AND RECORDS DECISIONS.

CHOOSE HOW YOU WANT TO USE REFI.
```

Signal:

```text
THE MACHINE RECOMMENDS.

YOU REVIEW THE SOFTWARE-GENERATED SIGNAL.
EXECUTION REMAINS OUTSIDE THE REFI MANAGED PATH.
```

Managed:

```text
YOU APPROVE THE PROGRAM
AND ITS EXECUTION POLICY.

ELIGIBLE ACTIONS FLOW
INSIDE THE GUARDRAILS YOU APPROVED.
```

## 4.4 Game-to-product handoff architecture

Do not create duplicate identity systems that cannot be reconciled.

Recommended model:

- **Anonymous game session:** `alpha_session_id`, `device_id_hash`, `anonymous_progress_id`.
- **Save-progress identity:** prefer a lightweight, reversible lead identity: `alpha_player_id`, `email_or_existing_identity_reference`, `progress_state`, `consent_state`. Do not require full KYC merely to save a game.

Handoff token:

```ts
interface AlphaHandoffToken {
  handoffId: string;
  alphaPlayerId: string;
  expiresAt: string;
  progressSnapshotId: string;
  campaignSource?: string;
  intendedDestination:
    | "ELIGIBILITY"
    | "PAPER"
    | "SIGNAL_INFO"
    | "MANAGED_INFO";
}
```

Suggested flow:

```text
GAME
  POST /api/alpha/handoff
        ↓
OPAQUE HANDOFF TOKEN
        ↓
REDIRECT TO REFI PRODUCT
        ↓
ELIGIBILITY
        ↓
AUTH
        ↓
BIND alpha_player_id TO formal user_id
        ↓
PRESERVE GAME PROGRESS
```

The game token must not carry sensitive profile fields in the URL. The formal product should import only approved Alpha metadata.

Recommended initial imported metadata: Alpha player ID; completed arenas; Machine Builder unlocked; current machine version count; machine beat rate; acquisition source; onboarding attribution.

Do not initially import: inferred risk tolerance; inferred suitability; simulated investment goals; simulated financial capacity.

## 4.5 Route strategy

Recommended game routes:

```text
/alpha
/alpha/tutorial
/alpha/arenas
/alpha/arena/[arenaId]
/alpha/run/[runId]
/alpha/profile
/alpha/machine
/alpha/machine/[versionId]
/alpha/stress-test/[runId]
/alpha/daily-tape
/alpha/leaderboard
/alpha/desks
/alpha/records
/alpha/help
/alpha/handoff
```

The formal ReFi product remains separate. The game should not impersonate regulated product routes.

## 4.6 Conversion CTAs by game maturity

- **Before first full arena** — no hard product sell. Use: `SAVE YOUR RUN.`
- **After first machine loss** — no product sell. Use: `SEE WHERE THE GAP CAME FROM.`
- **After first machine win** — no product sell. Use: `ONE WIN. NEXT REGIME.`
- **After 3 arenas** — soft paper CTA: `RUN A REFI MACHINE BESIDE YOUR PAPER PORTFOLIO.`
- **After Machine Builder** — stronger CTA: `YOU BUILT THE RULES. NOW TEST A PROCESS AGAINST THE CURRENT MARKET.`
- **After TACO** — primary handoff: `HISTORY TESTED YOUR MACHINE. ENTER PAPER MODE.`

---

# 5. Full Player Journey

```text
BOOT
  ↓
LANDING
  ↓
ANONYMOUS CONTROL TUTORIAL
  ↓
FIRST MICRO RUN
  ↓
SAVE PROGRESS
  ↓
ARENA MAP
  ↓
COVID MANUAL
  ↓
AUTOPSY
  ↓
RECOVERY MANUAL
  ↓
ALPHA PROFILE
  ↓
MACHINE BUILDER UNLOCK
  ↓
MACHINE v0.1
  ↓
COVID MACHINE STRESS TEST
  ↓
MACHINE v0.2
  ↓
RECOVERY MACHINE TEST
  ↓
INFLATION MACHINE TEST
  ↓
BANKING STRESS MACHINE TEST
  ↓
YOUR MACHINE VS REFI
  ↓
BLIND GAUNTLET
  ↓
TACO PROTOCOL
  ↓
PAPER HANDOFF
  ↓
FORMAL REFI ONBOARDING
  ↓
SIGNAL OR MANAGED
```

The exact unlock ordering may be calibrated through testing, but the conceptual arc must remain intact.

---

# 6. Nested Retention Loops

## 6.1 Core loop — 10 to 45 seconds

```text
SIGNAL
  ↓
INVESTIGATE
  ↓
DECIDE
  ↓
COMMIT
  ↓
RESOLVE
  ↓
COMPARE TO MACHINE
  ↓
SCORE DELTA
  ↓
LEARN
  ↓
NEXT SIGNAL
```

The core loop must be satisfying without rewarding trade frequency. HOLD is an explicit decision with a scored outcome.

## 6.2 Session loop — 10 to 30 minutes

```text
PLAY ARENA
  ↓
COMPLETE CHECKPOINTS
  ↓
AUTOPSY
  ↓
IDENTIFY WEAKNESS
  ↓
MODIFY MACHINE
  ↓
RETEST
  ↓
IMPROVE SCORE
```

## 6.3 Daily loop — Daily Market Tape

One 3–5 minute hidden historical U.S. equity decision.

```text
DAILY TAPE 042

PORTFOLIO

NVDA      12%
MSFT      10%
AMZN       9%
META       8%
JPM        8%
CAT        7%
JNJ        7%
PG         7%
CASH      32%

MARKET SIGNALS

SEMICONDUCTOR VOLATILITY RISING
CREDIT CONDITIONS STABLE
MARKET BREADTH WEAKENING
DEFENSIVE SECTORS OUTPERFORMING

DECISION?

[HOLD]
[REDUCE TECH]
[ADD DEFENSIVES]
[ADD CYCLICALS]
[RAISE CASH]
[DEPLOY CASH]
```

After commit:

```text
YOU
REDUCE TECH

HUMAN CONSENSUS
42% REDUCE

REFI MACHINE
ROTATE

RESULT
REVEALED TOMORROW
```

Next day:

```text
YESTERDAY'S TAPE

YOU          +3
MACHINE      +7
CROWD        +1

WHY

THE MACHINE REDUCED CONCENTRATION
WITHOUT EXITING THE STRONGEST
EARNINGS EXPOSURE.
```

## 6.4 Meta loop — weeks and months

```text
COMPLETE CAMPAIGNS
  ↓
CLIMB MACHINE LADDER
  ↓
BUILD ALPHA IDENTITY
  ↓
VERSION YOUR MACHINE
  ↓
ENTER TOURNAMENTS
  ↓
COMPETE WITH A DESK
  ↓
FACE SEASON BOSS
  ↓
IMPROVE MACHINE BEAT RATE
  ↓
MOVE TO PAPER
```

---

# 7. Game Modes

## 7.1 Tutorial Mode
- guided;
- dates may be visible;
- controls taught explicitly;
- overlay completion driven by actions.

## 7.2 Training Mode
- historical dates visible;
- educational context available;
- full help available;
- score recorded but not ranked.

## 7.3 Challenge Mode
- exact dates hidden;
- future data blocked;
- historical event family may be known;
- score ranked.

## 7.4 Iron Mode
- dates hidden;
- limited action budget;
- fixed risk budget;
- no restart during run;
- prestige mode.

## 7.5 Blind Gauntlet
- several regimes in sequence;
- machine locked across the sequence;
- no mid-series structural change unless Adaptive Gauntlet mode.

## 7.6 Adaptive Gauntlet
- scheduled machine modification checkpoints;
- tests ability to update rules from evidence.

## 7.7 Daily Tape
- one short decision;
- next-day reveal;
- crowd comparison;
- machine comparison.

---

# 8. Player Controls

The player controls: Buy; Add; Reduce; Exit; Hold; Rotate; Raise Cash; Deploy Cash; Stage Order where unlocked.

```text
BUY JNJ        $5,000
ADD MSFT       +$3,000
REDUCE JPM     -$4,000
EXIT DAL       100%
HOLD           MAKE NO PORTFOLIO CHANGE AT THIS CHECKPOINT.
ROTATE         SELL DAL -$4,000, MAR -$3,000 / BUY JNJ +$4,000, PG +$3,000
```

Holding must be scored.

---

# 9. Keyboard and Mouse Controls

Global:

```text
F1      ARENA MAP
F2      ACTIVE RUN
F3      PORTFOLIO
F4      JOURNAL
F5      MACHINE CARD
F6      MACHINE BUILDER
F7      ALPHA PROFILE
F8      RECORDS
F9      LEADERBOARD
F10     HELP
```

Active run:

```text
M       MARKET OVERVIEW
P       PORTFOLIO
R       RISK PANEL
S       SECTOR EXPOSURE
C       CORRELATION MAP
N       NEWS
J       DECISION JOURNAL
O       ORDER TICKET
H       HOLD
TAB     NEXT PANEL
ENTER   REVIEW / CONFIRM / CONTINUE
ESC     CLOSE / BACK
?       HELP
CMD+K   COMMAND TERMINAL
CTRL+K  COMMAND TERMINAL ON WINDOWS
```

Every keyboard control requires a visible button or clickable equivalent.

Persistent game action bar:

```text
[O] ORDER
[H] HOLD
[R] RISK
[N] NEWS
[J] JOURNAL
[ENTER] REVIEW
[?] HELP
```

---

# 10. Exact Checkpoint Loop

Every checkpoint follows:

```text
1. READ
2. INSPECT
3. DECIDE
4. REVIEW
5. COMMIT
6. ADVANCE
7. MACHINE REVEAL
8. SCORE
9. LEARN
10. NEXT
```

**Read**

```text
MARKET SIGNAL

TRAVEL DEMAND WEAKENING
CREDIT CONDITIONS DETERIORATING
VOLATILITY RISING
```

**Inspect**

```text
[M] MARKET
[P] PORTFOLIO
[R] RISK
[S] SECTORS
[C] CORRELATION
[N] NEWS
[J] JOURNAL
```

**Decide**

```text
DECISION DRAFT

REDUCE DAL      -$5,000
REDUCE MAR      -$3,000
ADD JNJ         +$4,000
ADD PG          +$2,000

NET CASH CHANGE +$2,000
TURNOVER        14.0%
```

**State reason**

```text
WHY ARE YOU MAKING THIS CHANGE?

[1] RISK REDUCTION
[2] BUSINESS FUNDAMENTALS CHANGED
[3] VALUATION OPPORTUNITY
[4] SECTOR ROTATION
[5] CONCENTRATION REDUCTION
[6] LIQUIDITY PRESERVATION
[7] MOMENTUM
[8] OTHER
```

Confidence: LOW / MEDIUM / HIGH. Advanced mode may use 0–100. Optional: `WHAT WOULD CHANGE YOUR MIND?`

**Review**

```text
PORTFOLIO AFTER DECISION

CASH                21.8%
MAX POSITION        11.4%
MAX SECTOR          28.2%
PORTFOLIO VOL       22.1%
TURNOVER USED       18.3%
CURRENT DRAWDOWN    -8.6%
```

**Commit**

```text
CONFIRM DECISION

4 PORTFOLIO ACTIONS
TURNOVER 14.0%
CASH AFTER 21.8%

THIS DECISION BECOMES
PART OF YOUR RUN RECORD.

[Y] CONFIRM
[N] RETURN
```

**Advance**

```text
DECISION LOCKED

ADVANCING HISTORICAL MARKET...

T+1  ██████████
T+2  ████████████████
T+3  ███████████████████████
```

**Machine reveal**

```text
YOU

REDUCED TRAVEL
ADDED HEALTHCARE
CASH +2%

MACHINE

REDUCED TECHNOLOGY CONCENTRATION
HELD TRAVEL
CASH UNCHANGED
```

Explanation:

```text
YOU RESPONDED TO INDUSTRY RISK.

THE MACHINE RESPONDED
TO PORTFOLIO CORRELATION.
```

Do not reveal future outcome before score state.

**Score**

```text
CHECKPOINT RESULT

                    HUMAN     MACHINE

RETURN              -1.8%      -2.1%
DRAWDOWN             -8.6%      -6.9%
TURNOVER             18.3%      11.2%
ADAPTATION              71         78

CHECKPOINT SCORE         73         79

MACHINE LEADS BY 6
```

One short lesson:

```text
YOUR RETURN WAS BETTER.

THE MACHINE USED LESS RISK.
```

---

# 11. Tutorial Overlay System

The overlay tutorial is core product infrastructure. It evolves across the journey.

```text
LAYER 1  CONTROL TUTORIAL
LAYER 2  CONTEXTUAL MARKET TIPS
LAYER 3  PROCESS DIAGNOSIS
LAYER 4  MACHINE BUILDER GUIDANCE
```

Core rule:

```text
TEACH THE CONTROL BEFORE USE.
TEACH THE CONCEPT WHEN IT MATTERS.
TEACH THE PROCESS AFTER THE RESULT.
```

Never show more than one tip overlay at a time. Never show tips during: market advancement; machine action computation; score computation; final result animation.

---

# 12. First-Run Control Tutorial

The tutorial should take approximately 3–5 minutes. **COVID is not the tutorial.** Use a short separate historical equity sequence.

**Overlay 01 — Objective**

```text
WELCOME TO REFI ALPHA

YOU CONTROL A VIRTUAL
U.S. EQUITY PORTFOLIO.

AT EACH CHECKPOINT:

1. READ WHAT CHANGED.
2. INSPECT THE PORTFOLIO.
3. MAKE A DECISION.
4. COMMIT.
5. WATCH THE MARKET ADVANCE.
6. COMPARE WITH THE MACHINE.

YOUR FIRST GOAL:

LEARN THE CONTROLS.

[BEGIN]
```

**Overlay 02 — Market Signal**

```text
MARKET SIGNAL

THIS IS NEW INFORMATION AVAILABLE
AT THE CURRENT HISTORICAL MOMENT.

THE SIGNAL TELLS YOU WHAT CHANGED.

IT DOES NOT TELL YOU WHAT TO DO.

[CONTINUE]
```

**Overlay 03 — Portfolio**

```text
YOUR PORTFOLIO

SEE:

POSITION WEIGHT
PROFIT OR LOSS
SECTOR
RISK CONTRIBUTION

PRESS [P]
OR CLICK PORTFOLIO.

[OPEN PORTFOLIO]
```

This tip completes only when the player opens the portfolio.

**Overlay 04 — Position Controls**

```text
SELECT A POSITION

EVERY STOCK HAS FOUR ACTIONS:

ADD     INCREASE THE POSITION.
REDUCE  SELL PART OF THE POSITION.
EXIT    SELL THE FULL POSITION.
VIEW    INSPECT MORE INFORMATION.

[SELECT POSITION]
```

**Overlay 05 — First action**

```text
MAKE A PORTFOLIO CHANGE

FOR THIS TUTORIAL:

REDUCE THE POSITION BY $2,000.

THIS CREATES A DRAFT ACTION.

NO TRADE OCCURS UNTIL YOU COMMIT
THE FULL CHECKPOINT DECISION.

[REDUCE POSITION]
```

**Overlay 06 — Decision Draft**

```text
DECISION DRAFT

YOU MAY COMBINE SEVERAL ACTIONS
INTO ONE CHECKPOINT DECISION.

EXAMPLE:

REDUCE AIRLINE
ADD HEALTHCARE
RAISE CASH

YOUR CURRENT ACTION IS STILL EDITABLE.

[VIEW DRAFT]
```

**Overlay 07 — Risk Review**

```text
CHECK THE EFFECT

BEFORE COMMITTING, INSPECT:

CASH
MAX POSITION SIZE
SECTOR EXPOSURE
DRAWDOWN
TURNOVER
PORTFOLIO RISK

PRESS [R]
OR CLICK RISK.

[OPEN RISK]
```

**Overlay 08 — State the reason**

```text
WHY ARE YOU DOING THIS?

SELECT THE REASON BEHIND YOUR DECISION.

THE GAME TRACKS WHETHER
YOUR FUTURE ACTIONS REMAIN CONSISTENT
WITH YOUR STATED THESIS.

[SELECT REASON]
```

**Overlay 09 — Commit**

```text
COMMIT DECISION

ONCE CONFIRMED:

YOUR DECISION IS LOCKED.

THE HISTORICAL MARKET ADVANCES.

THE MACHINE DECISION REMAINS HIDDEN
UNTIL YOUR CHOICE IS FINAL.

[Y] CONFIRM
[N] RETURN
```

**Overlay 10 — Machine Reveal**

```text
MACHINE REVEAL

YOU AND THE MACHINE RECEIVED
THE SAME HISTORICAL INFORMATION CUTOFF.

COMPARE:

WHAT YOU CHANGED
WHAT THE MACHINE CHANGED
WHY EACH PROCESS ACTED

THE RESULT COMES NEXT.

[CONTINUE]
```

**Overlay 11 — ReFi Score**

```text
REFI SCORE

RETURN IS ONLY PART OF THE GAME.

THE SCORE ALSO MEASURES:

DRAWDOWN CONTROL
DOWNSIDE CONTROL
RECOVERY
REGIME ADAPTATION
TURNOVER DISCIPLINE
DECISION CONSISTENCY

A LUCKY TRADE IS NOT
THE SAME AS A GOOD PROCESS.

[VIEW SCORE]
```

**Overlay 12 — Hold**

```text
HOLD IS A DECISION

YOU DO NOT NEED TO TRADE
AT EVERY CHECKPOINT.

CHOOSE HOLD WHEN:

YOUR THESIS REMAINS VALID.
NEW INFORMATION IS INSUFFICIENT.
THE PORTFOLIO IS ALREADY POSITIONED.

A GOOD HOLD CAN BEAT
A BAD TRADE.

[TRY HOLD]
```

**Tutorial complete**

```text
CONTROL TRAINING COMPLETE

YOU CAN NOW:

READ MARKET SIGNALS
INSPECT U.S. EQUITIES
BUY AND ADD
REDUCE AND EXIT
HOLD
REVIEW RISK
COMMIT DECISIONS
COMPARE AGAINST THE MACHINE

NEXT:

COVID BLACK SWAN

THIS TIME THE GAME
WILL NOT TELL YOU WHAT TO DO.

[ENTER ARENA MAP]
```

---

# 13. Contextual Tip Overlay System

Supported tip types: Spotlight Tip; First-Event Tip; Decision Tip; Concept Tip; Progression Tip; Process Diagnosis Tip; Machine Builder Tip.

Priority:

```text
100  REQUIRED CONTROL
95   CRITICAL RISK
90   NEW GAME MECHANIC
80   MACHINE MODULE
70   RISK CONCEPT
60   FIRST EVENT
50   OPTIONAL EDUCATION
```

Tip states: UNSEEN; QUEUED; SHOWN; SNOOZED; DISMISSED; COMPLETED.

Guidance modes: FULL; STANDARD; MINIMAL; OFF. New users default to FULL.

Permanent: `[?] HELP` / `GUIDANCE: FULL`.

---

# 14. Contextual COVID Tips

**Hidden time**

```text
CHALLENGE MODE

YOU KNOW THE EVENT.
YOU DO NOT KNOW THE EXACT DATE.

HIDDEN:

FUTURE PRICES
THE MARKET BOTTOM
POLICY ACTIONS NOT YET ANNOUNCED
RECOVERY TIMING

THE MACHINE FACES THE SAME CUTOFF.

[ENTER COVID]
```

**Correlation**

```text
CORRELATION IS RISING

YOU OWN MULTIPLE STOCKS.

THEY MAY STILL REPRESENT
THE SAME ECONOMIC RISK.

[C] OPEN CORRELATION MAP
[LATER]
```

**Risk contribution**

```text
WEIGHT IS NOT RISK

THIS POSITION IS:
7% OF CAPITAL

BUT
14% OF ESTIMATED PORTFOLIO RISK

[R] VIEW RISK CONTRIBUTION
```

**Large emotional action**

```text
LARGE EXPOSURE CHANGE

YOU ARE PROPOSING A MAJOR REDUCTION
AFTER A LARGE MARKET DECLINE.

CHECK:

DID THE COMPANY THESIS CHANGE?
DID PORTFOLIO RISK CHANGE?
ARE YOU RESPONDING TO INFORMATION
OR TO THE PAIN OF LOSS?

YOUR DECISION REMAINS YOURS.

[REVIEW THESIS]
[CONTINUE]
```

**Cash**

```text
YOU RAISED CASH

THIS REDUCES EQUITY EXPOSURE.

YOU SOLVED ONE PROBLEM:
HOW MUCH RISK TO TAKE NOW.

YOU CREATED ANOTHER:
WHEN TO RE-ENTER.

[GOT IT]
```

**Staged re-entry**

```text
MODULE UNLOCKED

STAGED RE-ENTRY

YOU NO LONGER NEED TO CHOOSE BETWEEN:
BUY EVERYTHING NOW
OR
WAIT FOR CERTAINTY

YOU MAY DEPLOY CAPITAL
ACROSS MULTIPLE CHECKPOINTS.

[TRY STAGED ORDER]
[LATER]
```

---

# 15. Process Diagnosis System

The game must detect behavioral patterns.

**Overtrading**

```text
PATTERN DETECTED

HIGH ACTIVITY
LOW VALUE ADD

YOU MADE 9 PORTFOLIO CHANGES.
4 WERE REVERSED WITHIN THREE CHECKPOINTS.
THE MACHINE MADE 3 CHANGES.

CURRENT SCORE GAP -8

[OPEN AUTOPSY]
```

**Position sizing**

```text
PATTERN DETECTED

YOUR STOCK SELECTION WAS STRONG.
YOUR POSITION SIZING WAS NOT.

3 OF YOUR BEST IDEAS OUTPERFORMED.
ONE OVERSIZED POSITION
ERASED MOST OF THE ADVANTAGE.

THE MACHINE CHOSE WORSE STOCKS
AND BUILT A BETTER PORTFOLIO.

[VIEW POSITION ANALYSIS]
```

**Re-entry failure**

```text
PATTERN DETECTED

YOU PROTECTED CAPITAL.
YOU DID NOT RESTORE EXPOSURE.

PRIMARY GAP
RE-ENTRY DISCIPLINE

[VIEW TIMELINE]
```

**Hidden concentration**

```text
PATTERN DETECTED

12 STOCKS
3 EFFECTIVE RISK CLUSTERS

YOUR PORTFOLIO LOOKED DIVERSIFIED.
ITS ECONOMIC EXPOSURE WAS NOT.

[OPEN RISK CLUSTERS]
```

---

# 16. Transition to Machine Builder

Trigger after sufficient manual experience.

```text
YOU HAVE SEEN THE PATTERN

YOU SOMETIMES CHOOSE BETTER STOCKS.

THE MACHINE IS MORE CONSISTENT AT:

POSITION SIZE
CONCENTRATION
REBALANCING
RISK LIMITS
RE-ENTRY
FOLLOWING RULES

NEXT PHASE

BUILD YOUR OWN MACHINE.

[MACHINE BUILDER]
```

This should feel earned.

---

# 17. Machine Builder

Machine Builder is the central progression system.

## 17.1 Builder architecture

```text
01 UNIVERSE
02 ELIGIBILITY FILTER
03 SIGNAL / REGIME LOGIC
04 BASKET
05 WEIGHTING
06 GUARDRAILS
07 REBALANCE
08 PAUSE RULES
09 RE-ENTRY RULES
10 EXECUTION TIMELINESS
11 MONITORING
12 VERSION HISTORY
13 STRESS TEST
```

## 17.2 Universe
Define where the machine is allowed to look. Examples: U.S. large cap; U.S. mid cap; liquidity threshold; market-cap threshold; minimum history; selected sectors; exclusions.

## 17.3 Eligibility filter
Conceptual controls may include: minimum history; minimum market cap; liquidity threshold; profitability; operational efficiency; user-defined sector restrictions. The game should teach selection as a process, not a ticker-picking contest.

## 17.4 Selection / regime logic
Player chooses conceptual factors or modules: momentum; quality; earnings stability; valuation; low volatility; regime state; trend persistence. MVP should use controlled building blocks, not free-form code.

## 17.5 Basket
Choose: equities; target weight; min weight; max weight; cash target.

## 17.6 Guardrails
Possible controls: max position size; max sector exposure; minimum cash reserve; max single order; daily order limit; daily loss pause; drawdown pause; max open orders; restricted sectors; stale-data pause.

## 17.7 Rebalance logic
Examples: scheduled; drift threshold; risk threshold; regime change; position limit breach.

## 17.8 Pause rules
Examples: daily loss threshold; drawdown threshold; stale data; stale profile in formal product context; policy conflict; risk breach.

## 17.9 Re-entry logic
Examples: staged deployment; breadth improvement; volatility decline; regime confirmation; drift-triggered rebalance; maximum defensive cash duration.

## 17.10 Execution timeliness
Teach that signal quality and implementation timing are different. Player may stress: immediate; mild lag; medium lag; severe lag. This is a stress-test mechanic, not a promise that game latency equals production execution.

---

# 18. Machine Builder Overlay Tutorial

**Architecture**

```text
MACHINE BUILDER

YOUR MACHINE HAS CORE PARTS:

UNIVERSE
FILTER
SIGNAL LOGIC
BASKET
WEIGHTING
GUARDRAILS
REBALANCE
PAUSE
RE-ENTRY

YOU WILL BUILD THEM
ONE MODULE AT A TIME.

[BEGIN]
```

**Universe**

```text
UNIVERSE

DEFINE WHICH U.S. EQUITIES
YOUR MACHINE MAY CONSIDER.

THE UNIVERSE DEFINES
WHERE THE MACHINE IS ALLOWED TO LOOK.

[SET UNIVERSE]
```

**Basket**

```text
BASKET

CHOOSE THE EQUITIES
YOUR MACHINE WILL MANAGE.

SET:
TARGET WEIGHT
MINIMUM WEIGHT
MAXIMUM WEIGHT
CASH TARGET

[BUILD BASKET]
```

**Selection logic**

```text
SELECTION LOGIC

DEFINE WHAT THE MACHINE VALUES.

EXAMPLE FACTORS:
MOMENTUM
QUALITY
EARNINGS STABILITY
VALUATION
LOW VOLATILITY

THE MACHINE NEEDS
A CONSISTENT PROCESS.

[SET LOGIC]
```

**Guardrails**

```text
GUARDRAILS

DEFINE WHAT THE MACHINE
IS NOT ALLOWED TO DO.

MAX POSITION
MAX SECTOR
MIN CASH
ORDER LIMIT
LOSS PAUSE
DRAWDOWN PAUSE

[SET GUARDRAILS]
```

**Rebalance**

```text
REBALANCE RULES

A MACHINE NEEDS A REASON
TO CHANGE THE PORTFOLIO.

MORE ACTIVITY IS NOT
THE SAME AS BETTER ACTIVITY.

[SET REBALANCE RULE]
```

**Pause**

```text
PAUSE RULES

DEFINE WHEN THE MACHINE
SHOULD STOP NEW ACTION.

A MACHINE SHOULD KNOW
WHEN NOT TO ACT.

[ADD PAUSE RULE]
```

**Re-entry**

```text
RE-ENTRY RULES

PROTECTION IS ONLY HALF
OF PORTFOLIO MANAGEMENT.

DEFINE HOW THE MACHINE
RESTORES EXPOSURE.

[ADD RE-ENTRY RULE]
```

**Versioning**

```text
VERSION READY

Z333Q MACHINE v0.1

EVERY CHANGE CREATES
A NEW TESTABLE VERSION.

BUILD.
TEST.
DIAGNOSE.
REVISE.

[LOCK v0.1]
```

---

# 19. Machine Evolution

Example progression:

**Human mode**

```text
Z333Q

MANUAL DECISIONS
NO SYSTEM RULES
NO PORTFOLIO GUARDS
NO AUTOMATIC REBALANCE
```

**Machine v0.1 — after COVID lessons**

```text
MAX POSITION            10%
MAX SECTOR              30%
MIN CASH                 5%
DRAWDOWN WARNING         8%
STAGED ENTRY             ON
```

**Machine v0.2 — after Recovery**

```text
MAX POSITION            10%
MAX SECTOR              30%
MIN CASH                 5%
DRAWDOWN WARNING         8%
STAGED ENTRY             ON
STAGED RE-ENTRY          ON
DRIFT REBALANCE          20%
MAX DEFENSIVE CASH DAYS  20
```

**Machine v0.3 — after Inflation**

```text
REGIME FILTER            ON
QUALITY SCORE            30%
MOMENTUM SCORE           25%
EARNINGS STABILITY       25%
LOW VOLATILITY           20%

MAX POSITION             8%
MAX SECTOR               25%
MIN CASH                 5%
```

**Machine v0.4 — after Banking Stress**

```text
RISK CLUSTER CAP         35%
INDUSTRY CAP             20%
CORRELATION ALERT        0.75
SYSTEMIC EXPOSURE CAP    25%
```

**Final build**

```text
Z333Q MACHINE v1.0

READY FOR TACO PROTOCOL
```

These values are illustrative game defaults and must not be presented as ReFi production settings unless sourced from an approved product configuration.

---

# 20. Economic Arena Progression

```text
[00] TUTORIAL
  ↓
[01] COVID BLACK SWAN
  ↓
[02] RECOVERY TRAP
  ↓
[03] INFLATION / RATE SHOCK
  ↓
[04] BANKING STRESS
  ↓
[05] MACHINE LAB
  ↓
[06] MAN VS MACHINE SEASON
  ↓
[07] BLIND GAUNTLET
  ↓
[08] TACO PROTOCOL
  ↓
[09] LIVE PAPER
```

---

# 21. COVID Black Swan Arena

## 21.1 Purpose
Teach: uncertainty; correlation; drawdown; action bias; panic selling; position sizing; cash; re-entry.

## 21.2 Rules
- U.S. equities + cash only;
- historical information cutoff;
- future prices hidden;
- exact date hidden in Challenge Mode;
- machine action hidden until player commit;
- no restart within Iron Mode;
- transaction-cost model applied consistently;
- risk limits explicit.

## 21.3 22-checkpoint structure

**Phase 1 — Background Noise**

- CP01 — `LOCALIZED HEALTH EVENT / GLOBAL MARKET RESPONSE MUTED`. Flags: patience; premature broad reduction; targeted caution; contrarian overconfidence.
- CP02 — `SUPPLY CHAIN DISRUPTION REPORTS INCREASE / SELECT INDUSTRIES SHOW WEAKNESS`. Lesson: portfolio-specific risk can change before the entire market reacts.
- CP03 — `INTERNATIONAL CASE GROWTH ACCELERATES / TRAVEL SECTOR WEAKENS`. Branch flags: `COVID_EARLY_IGNORE`, `COVID_TARGETED_REDUCE`, `COVID_BROAD_PANIC_EARLY`, `COVID_CASH_EARLY`, `COVID_CONTRARIAN_EARLY`.

**Phase 2 — Regime Recognition**

- CP04 — `MARKET BREADTH DETERIORATES / VOLATILITY RISES / CORRELATION INCREASES`. Machine lesson: `THE MACHINE DID NOT PREDICT A PANDEMIC. IT DETECTED A CHANGE IN PORTFOLIO RISK.`
- CP05 — `MAJOR INDEX DECLINE / DEFENSIVE EQUITIES OUTPERFORM / CREDIT CONDITIONS TIGHTEN`. Large action-size flags active.
- CP06 — `HEALTH EVENT ESCALATES / ECONOMIC EFFECT UNCERTAIN`. Compare current thesis to prior thesis.

**Phase 3 — Panic**

- CP07 — `VOLATILITY EXTREME / LIQUIDITY CONDITIONS DETERIORATING / MULTIPLE SECTORS FALLING TOGETHER`. Lesson: `LOSS IS AN OUTCOME. RISK IS A STATE. THEY ARE NOT THE SAME.`
- CP08 — `MARKET-WIDE INTERRUPTION / PRICE DISCOVERY PAUSED`. Actions: hold; queue reduction; queue staged buy; cancel pending actions.
- CP09 — `CORRELATION SPIKE / PORTFOLIO DIVERSIFICATION BENEFIT FALLING`. Display: `YOU OWN 12 EQUITIES. EFFECTIVE RISK CLUSTERS: 3`.
- CP10 — Ask: `WHAT IS YOUR PRIMARY OBJECTIVE? STOP FURTHER LOSSES / PRESERVE LONG-TERM THESIS / MAINTAIN LIQUIDITY / BUY DISLOCATION`. Behavioral telemetry.

**Phase 4 — Policy Intervention**

- CP11 — `EMERGENCY POLICY RESPONSE EXPANDS / RATES REDUCED / LIQUIDITY SUPPORT INCREASES`. Message: `NEW DATA ENTERED. THE MACHINE UPDATED. DID YOU?`
- CP12 — `MARKET REACTION REMAINS UNSTABLE / POLICY SUPPORT DOES NOT CREATE IMMEDIATE CERTAINTY`.
- CP13 — `CREDIT STRESS SHOWS EARLY STABILIZATION / EQUITY VOLATILITY REMAINS HIGH`. Machine may begin staged re-entry.

**Phase 5 — Bottoming Process**

- CP14 — `SELLING PRESSURE EXTREME / SENTIMENT DEEPLY NEGATIVE`. No hint that the bottom is near.
- CP15 — `MARKET RALLIES SHARPLY / ONE DATA POINT ONLY`. Tests staged action vs all-in response.
- CP16 — `MARKET HOLDS ABOVE RECENT LOW / BREADTH IMPROVES`. Cash-drag consequences emerge.
- CP17 — `ECONOMIC DATA DETERIORATES / MARKET PRICE ACTION IMPROVES`. Lesson: current economic conditions and market expectations can diverge.

**Phase 6 — Recovery Re-entry**

- CP18 — `SECTOR LEADERSHIP CHANGING / SELECT GROWTH AND STAY-AT-HOME EXPOSURES STRENGTHEN`. Tests chasing.
- CP19 — `BROAD MARKET RECOVERY CONTINUES / VOLATILITY STILL ELEVATED`. Re-entry delay flag may trigger.
- CP20 — `PORTFOLIO RECOVERED 50% OF DRAWDOWN`. Tests rebalance vs chase.
- CP21 — `MARKET STRUCTURE NORMALIZING / REGIME UNCERTAINTY REMAINS`. Return to policy discipline.
- CP22 — Reveal chronology and complete run:

```text
HISTORICAL WINDOW REVEALED

YOU DID NOT KNOW:
THE BOTTOM
THE POLICY PATH
THE RECOVERY SPEED
THE SECTOR LEADERS

NEITHER DID THE MACHINE.
```

---

# 22. Recovery Arena

Purpose: teach that survival logic can become a liability. Tests: elevated cash; delayed re-entry; chasing; changing leadership; drift; over-defensiveness.

Core message:

```text
SURVIVAL LOGIC: STRONG
RE-ENTRY LOGIC: WEAK
```

Possible unlocks: staged deployment; drift rebalance; recovery confirmation; max cash duration.

---

# 23. Inflation / Rate Shock Arena

Purpose: break the simplistic lesson `BUY EVERY DIP.` Tests: regime change; duration-like equity sensitivity; valuation compression; factor concentration; persistent inflation; false mean reversion; rule overfitting.

```text
RULE FAILURE

BUY-DRAWDOWN LOGIC
PERFORMED POORLY

CAUSE
UNDERLYING REGIME CHANGED
```

Possible unlocks: regime filter; valuation sensitivity; earnings resilience; sector exposure rules; momentum-decay check.

---

# 24. Banking Stress Arena

Purpose: teach hidden concentration and contagion.

```text
JPM
BAC
C
WFC
GS
MS

6 TICKERS
1 DOMINANT ECONOMIC RISK CLUSTER
```

Tests: sector concentration; industry concentration; correlated exposure; systemic co-movement; liquidity stress. Possible unlocks: risk cluster map; industry cap; correlation threshold; systemic exposure cap.

---

# 25. TACO Protocol

## 25.1 Purpose

The final boss is not a trivia game about predicting whether a politician reverses policy. It tests whether the player's machine can operate when: tariff announcements alter expectations; equity exposures differ by company; the market expects reversal; crowd behavior changes the setup; the prior pattern may repeat; the prior pattern may fail; policy and market response interact reflexively.

```text
THE MARKET THINKS IT KNOWS THE PATTERN.
DOES YOUR MACHINE?
```

## 25.2 Five-round structure

**Round 1 — Policy Shock**

```text
POLICY ALERT
NEW TARIFF ACTION ANNOUNCED
SCOPE BROAD
IMPLEMENTATION UNCERTAIN
```

The player's machine must interpret U.S. equity exposure.

**Round 2 — Negotiation Signal**

```text
NEGOTIATIONS CONTINUE
IMPLEMENTATION PATH UNRESOLVED
MARKET EXPECTATION
REVERSAL PROBABILITY RISING
```

**Round 3 — Pattern Trap**

```text
PATTERN MEMORY

PRIOR ROUND
BUYING WEAKNESS WORKED

CURRENT MARKET
DIP BUYING ACCELERATING

ARE YOU TRADING THE POLICY
OR
THE MEMORY OF THE LAST POLICY?
```

**Round 4 — Persistence** — the selected episode does not resolve the same way.

```text
PATTERN FAILURE DETECTED

THE MARKET EXPECTED REVERSAL.
POLICY REMAINS ACTIVE.
REASSESS.
```

**Round 5 — Reflexivity**

```text
FINAL ROUND

THE MARKET THINKS
IT KNOWS THE PATTERN.

DIP BUYING      ELEVATED
VOL RESPONSE    MUTED
POSITIONING     CROWDED
POLICY PATH     UNKNOWN

DO YOU KEEP THE RULE?
```

Actions: KEEP RULE; MODIFY RULE; SUSPEND RULE; REDUCE POSITION SIZE.

---

# 26. Machine Benchmark Alignment

This section is critical.

## 26.1 Do not invent a benchmark

All ReFi benchmark comparisons must be tied to a versioned benchmark object. Do not display a claim such as `REFI MACHINE 23.47% CAGR` without: benchmark ID; universe size; period; source type; model version; selection method; cost assumptions; exposure model; timestamp.

## 26.2 Known benchmark families

**Analyze snapshot** — a supplied benchmark screenshot showed a 321-symbol snapshot with:

```text
CAGR                 23.47%
VOLATILITY            3.56%
SHARPE                 4.56
SORTINO                8.69
MAX DRAWDOWN          -1.14%
CALMAR                20.54
WIN DAYS              64.83%
WIN MONTHS            96.77%
ALPHA ANNUALIZED      19.50%
BETA VS SPY            0.05

FIRST TRADING DAY     2023-04-18
LAST TRADING DAY      2025-10-17
BUSINESS DAYS         654
SYMBOLS               321
```

This is a distinct snapshot and must be versioned separately.

**Research paper Good-Fit portfolio:**

```text
SYMBOLS               292
CAGR                  22.47%
VOLATILITY             3.70%
SHARPE                  4.38
MAX DRAWDOWN           -1.08%
OOS WINDOW             2023-04-18 → 2025-10-17
BUSINESS DAYS          654
```

**Research paper Full-Basket portfolio:**

```text
SYMBOLS               355
CAGR                  15.27%
VOLATILITY             3.48%
SHARPE                  2.91
MAX DRAWDOWN           -1.54%
OOS WINDOW             2023-04-18 → 2025-10-17
BUSINESS DAYS          654
```

## 26.3 Benchmark reconciliation requirement

The 321-symbol analyze snapshot, 292-symbol Good-Fit portfolio, and 355-symbol Full-Basket portfolio are not interchangeable.

```text
IDENTIFY THE CANONICAL PRODUCT BENCHMARK.
DO NOT MERGE RESULTS ACROSS DIFFERENT UNIVERSE SNAPSHOTS.
```

## 26.4 Pre-2023 historical arenas

The documented OOS benchmark begins in 2023. Therefore: do not claim it traded COVID 2020; do not claim it traded the 2022 inflation shock; do not claim it traded March 2023 banking stress if the test window predates the benchmark's OOS start.

For those arenas, use either a **Historical walk-forward machine** (a true point-in-time reconstruction with strict training cutoff), e.g.:

```text
COVID BENCHMARK
TYPE            HISTORICAL WALK-FORWARD
TRAINING CUTOFF 2019-12-31
SIMULATION WINDOW 2020-01-01 → 2020-08-31
FUTURE DATA     BLOCKED
```

or a **Transparent game rules machine**:

```text
REFI RULES MACHINE
NO AI
NO FORECAST
ONLY EXPLICIT RULES
```

Do not label the transparent rules machine as historical RF/RL performance.

## 26.5 Action-set fairness

The research process includes directional exposure logic that can differ from the long/cash human game. Maintain two comparison modes.

**Fair Match** (same constraints): same universe; same long-only rule; same cash rule; same capital; same costs; same decision windows; same risk limits. Use Fair Match for arena advancement.

**Exhibition Match** — `YOUR MACHINE VS FULL REFI RF/RL BENCHMARK`. If capabilities differ, say so:

```text
CAPABILITY DIFFERENCE

YOUR MACHINE
LONG / CASH

REFI RF/RL
DIRECTIONAL REGIME EXPOSURE

THIS IS AN EXHIBITION COMPARISON,
NOT A CONSTRAINT-MATCHED CONTEST.
```

---

# 27. Benchmark Data Contract

```ts
interface BenchmarkSnapshot {
  benchmarkId: string;
  displayName: string;
  generatedAt: string;

  sourceType:
    | "ANALYZE_API"
    | "RESEARCH_PAPER"
    | "HISTORICAL_WALK_FORWARD"
    | "GAME_RULES_ENGINE";

  sourceRunId?: string;

  universe: {
    type: string;
    symbolCount: number;
    symbolsHash: string;
  };

  period: {
    requestedStart?: string;
    requestedEnd?: string;
    firstTradingDay: string;
    lastTradingDay: string;
    businessDays: number;
  };

  exposureModel: {
    longAllowed: boolean;
    shortAllowed: boolean;
    cashAllowed: boolean;
  };

  methodology: {
    modelVersion: string;
    selectorVersion?: string;
    costModelVersion: string;
    riskFreeRate?: number;
  };

  stats: {
    cagr: number;
    volatility: number;
    sharpe: number;
    sortino?: number;
    maxDrawdown: number;
    calmar?: number;
    alphaAnnualized?: number;
    betaVsSpy?: number;
  };
}
```

UI numbers must render from a `BenchmarkSnapshot`.

---

# 28. Machine Ladder

Recommended progression:

- **Level 0 — SPY benchmark** — `CAN YOU BEAT PASSIVE U.S. EQUITY EXPOSURE?`
- **Level 1 — ReFi Rules** — `TRANSPARENT / LONG-ONLY / SAME CONSTRAINTS`
- **Level 2 — Your Machine** — `YOUR UNIVERSE / YOUR RULES / YOUR GUARDRAILS`
- **Level 3 — ReFi Full Basket** — `355-SYMBOL RESEARCH BASELINE`
- **Level 4 — ReFi Good-Fit** — `ROBUSTNESS-FILTERED RF/RL PROCESS`
- **Level 5 — Versioned benchmark snapshot** — `VERSIONED REFI RF/RL BENCHMARK`
- **Final — TACO Protocol** — `YOUR MACHINE VS POLICY REFLEXIVITY`

---

# 29. ReFi Score

Raw return alone does not determine progression.

## 29.1 Standard arena score

```text
ReFi Score =
0.25 × Risk-Adjusted Excess Return
+ 0.20 × Drawdown Control
+ 0.10 × Downside Capture
+ 0.10 × Recovery Efficiency
+ 0.15 × Regime Adaptation
+ 0.10 × Turnover Discipline
+ 0.10 × Decision Consistency
```

All components normalize to 0–100.

## 29.2 Pass condition

```text
PASS =
PLAYER REFI SCORE > MACHINE REFI SCORE
AND
NO CRITICAL RISK FAILURE
```

For progression calibration, consider: BRONZE (survive risk budget); SILVER (beat passive benchmark); GOLD (beat machine ReFi score). Unlock next arena at Silver if tests show that Gold-only progression causes excessive churn. Gold remains prestige mastery.

## 29.3 TACO score

```text
0.20 × Return vs Machine
0.20 × Drawdown Control
0.25 × Regime Adaptation
0.10 × Decision Consistency
0.15 × Position Sizing
0.10 × Turnover Discipline
```

Additional: Pattern Overfitting Penalty; Reflexivity Bonus.

---

# 30. Alpha Profile

The Alpha Profile is based on observed game decisions.

Dimensions: STOCK SELECTION; POSITION SIZING; LOSS CONTROL; RE-ENTRY DISCIPLINE; TURNOVER DISCIPLINE; REGIME ADAPTATION; RULE ADHERENCE; ACTION BIAS; CONCENTRATION BIAS; RECENCY BIAS; ANCHORING.

```text
ALPHA PROFILE
BASED ON 47 DECISIONS

STOCK SELECTION        ████████░░  81
POSITION SIZING        ████░░░░░░  43
LOSS CONTROL           ███████░░░  76
RE-ENTRY DISCIPLINE    ███░░░░░░░  38
TURNOVER DISCIPLINE    █████░░░░░  54
REGIME ADAPTATION      ████████░░  84
RULE ADHERENCE         ████░░░░░░  47

PATTERN DETECTED

YOU IDENTIFY REGIME CHANGE WELL.
YOU OVERSIZE HIGH-CONVICTION DECISIONS.
```

Then:

```text
BUILD A MACHINE
AROUND YOUR STRENGTHS.

WRITE RULES
AROUND YOUR WEAKNESSES.
```

---

# 31. Social and Meta Systems

## 31.1 Machine Beat Rate

Prestige metric:

```text
MACHINE BEAT RATE
3 WINS
14 ARENAS
21.4%
```

## 31.2 Alpha identity archetypes

Behavior-derived, not personality quiz: Regime Hunter; Defensive Allocator; Momentum Rider; Contrarian; Risk Architect; Patient Compounder; Tactical Rotator; Policy Builder.

## 31.3 Desks

Small groups of 3–8 players. Examples: KIU QUANT DESK; CALGARY FOUNDERS; NEXT AI DESK; FAMILY OFFICE LAB; PROFESSORS VS STUDENTS. Compete on: average ReFi Score; machine beat rate; critical risk breaches; basket robustness; regime adaptation. Do not rank only on raw return.

## 31.4 Seasonal campaigns

Examples: SEASON 1 BLACK SWAN; SEASON 2 RECOVERY MACHINE; SEASON 3 INFLATION IS TRANSITORY?; SEASON 4 BANK RUN; SEASON 5 TACO PROTOCOL.

---

# 32. Visual Design System

## 32.1 Art direction

The game should feel like: *a classified financial market terminal from 1987 that somehow contains future market history.*

Influences: green phosphor CRT; Bloomberg-terminal density; ASCII systems; 1980s monochrome computing; early network topology; professional market workstation; retro strategy-game progression.

Avoid: generic cyberpunk; neon nightclub; crypto casino; meme-token aesthetic; children's game; Matrix cosplay; constant glitch effects.

## 32.2 Palette

```json
{
  "terminalBlack": "#050806",
  "terminalDeep": "#08110D",
  "terminalPanel": "#0C1712",
  "phosphorDim": "#27634E",
  "phosphorMid": "#0A8F68",
  "phosphor": "#0CD4A0",
  "phosphorHot": "#79FFD7",
  "paperGreen": "#B8FFD9",
  "terminalWhite": "#D8EEE5",
  "riskRed": "#D94C4C",
  "alertAmber": "#D6A647"
}
```

Red is rare and reserved for critical risk failure.

## 32.3 CRT treatment

Use: subtle scanlines; low-intensity bloom; event-only interference; rare line displacement during shocks; reduced motion support. Do not bloom dense tables heavily.

## 32.4 Typography

Primary: JetBrains Mono; IBM Plex Mono; monospace fallback. Secondary: Inter for longer educational copy.

---

# 33. Game Voice

Voice: concise; dry; intelligent; challenging; precise; skeptical of player confidence; skeptical of machine certainty; never insulting.

Use:

```text
IDEAS ARE EASY.
CONSISTENCY IS HARD.

YOU WERE RIGHT.
YOUR POSITION SIZE WAS WRONG.

YOU BEAT THE MACHINE.
NOW REPEAT IT.

THE MACHINE LOST THIS ROUND.
ITS PROCESS REMAINS INTACT.
DOES YOURS?

TRUST THE RECORD.
NOT THE CLAIM.
```

Avoid: `AWESOME!`; `YOU'RE CRUSHING IT!`; `OUR AI IS SMARTER THAN YOU.`; `GUARANTEED ALPHA.`

---

# 34. Programmatic Animation System

Animations explain state. They do not exist as decoration.

Every major animation should communicate one of: THE MARKET CHANGED; THE PORTFOLIO CHANGED; RISK CHANGED; THE MACHINE RESPONDED; THE PLAYER MACHINE EVOLVED.

Preferred implementation: SVG; CSS keyframes; React state; Recharts for series; Canvas only when necessary; ASCII / text layers. Avoid heavy animation dependencies unless a measured need exists.

---

# 35. Visual Event Architecture

```ts
type GameVisualEventType =
  | "MARKET_SHOCK"
  | "CORRELATION_COLLAPSE"
  | "VOLATILITY_SPIKE"
  | "DRAWDOWN_WARNING"
  | "RISK_LIMIT_BREACH"
  | "SECTOR_ROTATION"
  | "CASH_RAISED"
  | "CAPITAL_DEPLOYED"
  | "MACHINE_ACTION_REVEAL"
  | "MACHINE_ADVANTAGE"
  | "HUMAN_ADVANTAGE"
  | "REGIME_SHIFT"
  | "POLICY_SHOCK"
  | "POLICY_REVERSAL"
  | "PATTERN_FAILURE"
  | "BANK_CONTAGION"
  | "INFLATION_PRESSURE"
  | "SUPPLY_CHAIN_STRESS"
  | "MACHINE_MODULE_INSTALLED"
  | "MACHINE_VERSION_COMPILED"
  | "ARENA_UNLOCKED"
  | "BOSS_UNLOCKED"
  | "AUTOPSY_REPLAY";
```

```ts
interface GameVisualEvent {
  id: string;
  type: GameVisualEventType;
  intensity: number;
  durationMs: number;
  blocking: boolean;
  affectedSymbols?: string[];
  affectedSectors?: string[];
  payload: Record<string, unknown>;
  createdAt: string;
}
```

---

# 36. Signature Animation — Portfolio Constellation

Each equity is a node.

```text
                  MSFT ●
                       \
                        \
              AAPL ●────● NVDA


       JPM ●────● BAC
          \      /
           \    /
            ● GS


   JNJ ●              ● PG
```

Properties: NODE SIZE = portfolio weight; NODE BRIGHTNESS = risk contribution; LINE THICKNESS = correlation strength; NODE PULSE = volatility; NODE DISTANCE = risk-cluster difference. This is a core signature visual.

---

# 37. Signature Animation — Correlation Collapse

As correlation rises: connection lines appear; nodes move toward clusters; lines brighten; clusters collapse; risk labels replace sector labels.

```text
CORRELATION EVENT

11 EQUITIES
5 RISK CLUSTERS
          ↓
11 EQUITIES
2 RISK CLUSTERS
```

Message: `MORE TICKERS DO NOT AUTOMATICALLY MEAN MORE DIVERSIFICATION.`

---

# 38. Signature Animation — Human vs Machine Pipeline

```text
HUMAN                          MACHINE

BUY                            DATA
SELL                           ↓
BUY                            FILTER
SELL                           ↓
HOLD                           RISK CHECK
SELL                           ↓
BUY                            POLICY
                               ↓
                               ACTION
```

Then:

```text
DECISIONS
HUMAN      17
MACHINE     6
```

This visually explains the thesis.

---

# 39. Cash Reservoir Animation

```text
CASH RESERVE
████████░░░░░░░░░░
42%
```

When equity is sold, capital flows into the reservoir. When redeployed, capital flows from cash into equity nodes.

Lesson: `CASH IS LATENT EQUITY CAPACITY. RAISING CASH CREATES A FUTURE RE-ENTRY DECISION.`

---

# 40. Recovery Animation

Visual language: breadth expands; clusters separate; more equity nodes illuminate; cash reservoir becomes increasingly prominent if the player remains defensive.

```text
MARKET BREADTH        YOUR CASH
19%                   72%
27%                   72%
38%                   69%
52%                   67%
67%
```

The player sees missed recovery rather than merely reading about it.

---

# 41. Inflation Compression Animation

Metaphor: compression.

```text
Before:
NVDA  ███████████████
CRM   ████████████
TSLA  █████████████
JNJ   ███████
PG    ███████

INFLATION PRESSURE >>>>>>>>>>>>

After:
NVDA  █████████
CRM   ███████
TSLA  ███████
JNJ   ██████
PG    ██████
```

Message: `SAME COMPANY. DIFFERENT DISCOUNT RATE.`

---

# 42. Banking Contagion Animation

```text
              JPM
             /   \
            /     \
          BAC─────C
           │       │
           │       │
          WFC─────GS
```

Node liquidity bars:

```text
JPM  ████████
BAC  ██████░░
C    █████░░░
WFC  ███████░
```

As stress spreads: `CONTAGION PATHS DETECTED`. Lines pulse outward.

---

# 43. Machine Assembly Animation

```text
Z333Q MACHINE
[ EMPTY ]

UNIVERSE
    ↓
FILTER
    ↓
SIGNAL
    ↓
WEIGHTING
    ↓
GUARDRAILS
    ↓
REBALANCE
    ↓
PAUSE
    ↓
RE-ENTRY
    ↓
ACTION
```

Each module lights up when installed.

---

# 44. Machine Compile Animation

```text
COMPILING Z333Q MACHINE v0.4

UNIVERSE..............PASS
FILTER................PASS
SELECTION.............PASS
WEIGHTING.............PASS
POSITION LIMIT........PASS
SECTOR LIMIT..........PASS
CORRELATION GUARD.....PASS
REBALANCE RULE........PASS
PAUSE LOGIC...........PASS
RE-ENTRY LOGIC........PASS

BUILD HASH
9F2A:31D8:77C1

STATUS
READY FOR STRESS TEST
```

No confetti. The reward is system readiness.

---

# 45. Guardrail Barrier Animation

```text
PROPOSED POSITION
NVDA
7.2%
8.1%
9.4%

MAX POSITION
8.0%

────── 8.0% GUARDRAIL ──────

ACTION BLOCKED
MAX POSITION LIMIT
```

---

# 46. Machine vs Machine Animation

Do not depict robots fighting. Show pipelines.

```text
YOUR MACHINE                REFI MACHINE

DATA                        DATA
 ↓                           ↓
FILTER                      REGIME
 ↓                           ↓
RANK                        PORTFOLIO
 ↓                           ↓
WEIGHT                      RISK
 ↓                           ↓
GUARD                       POLICY
 ↓                           ↓
ACTION                      ACTION
```

During run:

```text
YOUR MACHINE      78
REFI MACHINE      84

REFI ADVANTAGE
RE-ENTRY LOGIC      +4
TURNOVER            +2
```

---

# 47. Signal-Lag Animation

Benchmark research indicates execution-timing sensitivity is a meaningful conceptual lesson.

```text
SIGNAL GENERATED

T+0H
████████████████████
T+3H
████████████░░░░░░░░
T+7H
████████░░░░░░░░░░░░
T+14H
██░░░░░░░░░░░░░░░░░░
```

Message: `THE MACHINE EDGE IS NOT ONLY WHAT IT DECIDES. TIMING MATTERS.` Use benchmark-specific values only from a versioned source record.

---

# 48. TACO Visual System

**Policy printer**

```text
POLICY WIRE
TARIFF ACTION DETECTED

SECTORS EXPOSED
AUTOS
RETAIL
INDUSTRIALS
SEMICONDUCTORS

IMPLEMENTATION
UNCERTAIN
```

**Supply-chain graph**

```text
TARIFF
  ↓
INPUT COST
  ↓
MARGIN RISK
  ↓
EARNINGS REVISION
  ↓
EQUITY PRICE
```

**Public-figure ASCII treatment.** The final boss may use a neutral green monochrome ASCII/dither treatment of Donald Trump as a public figure. Use: neutral expression; no campaign slogans; no partisan endorsement; no flag animation; no caricature body; no comic chicken body. The humor should come from the market term and mechanic.

Title:

```text
FINAL BOSS
TACO PROTOCOL
TRUMP ALWAYS CHICKENS OUT?
```

The question mark matters.

Reveal progression: Round 1 partial hair silhouette; Round 2 30% portrait; Round 3 60% portrait plus policy tape; Round 4 full portrait with controlled scanline displacement; Final three terminal channels: THREAT / NEGOTIATION / OUTCOME.

**Reflexivity animation**

```text
       POLICY
      ↙      ↖
 MARKET ← EXPECTATION
```

Message: `EXPECTED RESPONSE IS NOW PART OF THE MARKET STATE.`

---

# 49. Application State Machine

```ts
type AppState =
  | "BOOT"
  | "PUBLIC"
  | "ANONYMOUS_RUN"
  | "SAVE_PROGRESS_REQUIRED"
  | "PLAYER_READY"
  | "ARENA_SELECTED"
  | "RUN_ACTIVE"
  | "DECISION_OPEN"
  | "DECISION_COMMITTED"
  | "MARKET_ADVANCING"
  | "MACHINE_REVEAL"
  | "CHECKPOINT_REVIEW"
  | "RUN_FAILED"
  | "RUN_PASSED"
  | "RUN_BEAT_MACHINE"
  | "POST_RUN_ANALYSIS"
  | "MACHINE_BUILD"
  | "MACHINE_LOCKED"
  | "STRESS_TEST_ACTIVE"
  | "TACO_UNLOCKED"
  | "TACO_ACTIVE"
  | "PAPER_TRANSITION"
  | "REFI_HANDOFF"
  | "REFI_SIGNAL_TRANSITION"
  | "REFI_MANAGED_TRANSITION";
```

---

# 50. Arena Run State Machine

```ts
type ArenaRunState =
  | "INITIALIZING"
  | "BRIEFING"
  | "PORTFOLIO_READY"
  | "CHECKPOINT_LOADING"
  | "INFORMATION_OPEN"
  | "DECISION_REQUIRED"
  | "DECISION_DRAFT"
  | "DECISION_CONFIRMATION"
  | "DECISION_LOCKED"
  | "SIMULATING"
  | "MACHINE_ACTION_PENDING"
  | "MACHINE_ACTION_REVEALED"
  | "SCORING"
  | "CHECKPOINT_COMPLETE"
  | "RISK_WARNING"
  | "CRITICAL_FAILURE"
  | "OBSERVATION_MODE"
  | "EPISODE_COMPLETE"
  | "RESULT_COMPUTING"
  | "RESULT_READY";
```

---

# 51. Core Event Envelope

```json
{
  "event_id": "evt_01JXYZ...",
  "event_type": "decision.committed",
  "event_version": 1,
  "occurred_at": "2026-07-08T21:45:12.381Z",
  "user_id": "usr_01J...",
  "alpha_player_id": "alp_01J...",
  "session_id": "ses_01J...",
  "arena_id": "arena_covid_v1",
  "run_id": "run_01J...",
  "checkpoint_id": "cp_covid_007",
  "simulation_timestamp": "2020-03-12T10:15:00-05:00",
  "correlation_id": "cor_01J...",
  "causation_id": "evt_01J_prev...",
  "payload": {}
}
```

---

# 52. Event Types

**Session:** `session.started`, `session.resumed`, `session.ended`

**Player:** `player.created`, `player.progress_saved`, `player.rank_changed`, `player.alpha_profile_updated`

**Arena:** `arena.viewed`, `arena.selected`, `arena.unlocked`, `arena.started`, `arena.failed`, `arena.passed`, `arena.machine_beaten`

**Checkpoint:** `checkpoint.loaded`, `checkpoint.information_opened`, `checkpoint.decision_required`, `checkpoint.completed`

**Decision:** `decision.draft_created`, `decision.order_added`, `decision.order_removed`, `decision.thesis_set`, `decision.confidence_set`, `decision.committed`, `decision.invalidated`, `decision.hold_committed`

**Machine:** `machine.action_computed`, `machine.action_revealed`, `machine.score_computed`, `machine.version_created`, `machine.version_locked`, `machine.module_installed`

**Risk:** `risk.warning`, `risk.limit_near`, `risk.limit_breached`, `risk.critical_failure`

**Scoring:** `score.component_computed`, `score.checkpoint_computed`, `score.run_computed`, `score.machine_comparison_computed`

**TACO:** `taco.unlocked`, `taco.round_started`, `taco.policy_shock_delivered`, `taco.negotiation_signal_delivered`, `taco.pattern_memory_triggered`, `taco.player_rule_modified`, `taco.round_completed`, `taco.final_completed`

**Onboarding handoff:** `conversion.paper_cta_viewed`, `conversion.paper_started`, `conversion.refi_handoff_started`, `conversion.eligibility_started`, `conversion.eligibility_completed`, `conversion.auth_completed`, `conversion.kyc_started`, `conversion.kyc_completed`, `conversion.profile_started`, `conversion.profile_completed`, `conversion.broker_started`, `conversion.broker_connected`, `conversion.strategy_reviewed`, `conversion.signal_started`, `conversion.managed_started`

Game analytics events and formal investor actions must remain separate event taxonomies.

---

# 53. Decision Event Payload

```json
{
  "event_type": "decision.committed",
  "payload": {
    "decision_id": "dec_01J...",
    "decision_sequence": 7,
    "orders": [
      {
        "symbol": "XLF",
        "side": "SELL",
        "notional": 5000,
        "weight_before": 0.12,
        "weight_after": 0.07
      },
      {
        "symbol": "JNJ",
        "side": "BUY",
        "notional": 3000,
        "weight_before": 0.04,
        "weight_after": 0.074
      }
    ],
    "thesis_code": "DETERIORATING_FUNDAMENTALS",
    "confidence": 0.7,
    "invalidation_condition": "CREDIT_STRESS_STABILIZES",
    "estimated_turnover": 0.081,
    "estimated_cash_after": 0.238,
    "risk_snapshot_id": "rsk_01J..."
  }
}
```

---

# 54. Core Database Objects

Recommended relational core: PostgreSQL. Separate high-volume market time series from gameplay transaction records.

```sql
create table alpha_players (
  id uuid primary key,
  formal_user_id uuid null,
  email_hash text null,
  handle text null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table alpha_sessions (
  id uuid primary key,
  alpha_player_id uuid null references alpha_players(id),
  anonymous_progress_id uuid not null,
  device_id_hash text null,
  started_at timestamptz not null,
  last_seen_at timestamptz not null
);

create table alpha_handoffs (
  id uuid primary key,
  alpha_player_id uuid not null references alpha_players(id),
  progress_snapshot_id uuid not null,
  destination text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  formal_user_id uuid null,
  created_at timestamptz not null
);

create table arenas (
  id uuid primary key,
  code text unique not null,
  name text not null,
  version integer not null,
  difficulty integer not null,
  minimum_rank text null,
  status text not null,
  critical_drawdown numeric(8,6),
  max_position_weight numeric(8,6),
  max_sector_weight numeric(8,6),
  checkpoint_count integer not null,
  created_at timestamptz not null
);

create table arena_checkpoints (
  id uuid primary key,
  arena_id uuid references arenas(id),
  sequence integer not null,
  simulation_start timestamptz not null,
  simulation_end timestamptz not null,
  event_packet_id uuid not null,
  decision_required boolean not null,
  adaptation_window integer null,
  unique(arena_id, sequence)
);

create table arena_runs (
  id uuid primary key,
  alpha_player_id uuid references alpha_players(id),
  arena_id uuid references arenas(id),
  machine_benchmark_id uuid null,
  state text not null,
  mode text not null,
  started_at timestamptz not null,
  completed_at timestamptz null,
  current_checkpoint integer default 0,
  critical_failure boolean default false,
  player_final_score numeric(6,2),
  machine_final_score numeric(6,2),
  result text null,
  seed bigint not null
);

create table portfolio_snapshots (
  id uuid primary key,
  run_id uuid references arena_runs(id),
  checkpoint_id uuid references arena_checkpoints(id),
  owner_type text not null,
  owner_id uuid null,
  simulation_timestamp timestamptz not null,
  portfolio_value numeric(18,4) not null,
  cash_value numeric(18,4) not null,
  drawdown numeric(10,8),
  volatility numeric(10,8),
  turnover_to_date numeric(10,8),
  created_at timestamptz not null
);

create table player_decisions (
  id uuid primary key,
  run_id uuid references arena_runs(id),
  checkpoint_id uuid references arena_checkpoints(id),
  sequence integer not null,
  thesis_code text null,
  thesis_text text null,
  confidence numeric(5,4) null,
  invalidation_condition text null,
  state text not null,
  committed_at timestamptz null,
  unique(run_id, sequence)
);

create table machine_benchmarks (
  id uuid primary key,
  benchmark_id text unique not null,
  display_name text not null,
  source_type text not null,
  generated_at timestamptz not null,
  source_run_id text null,
  universe_type text not null,
  symbol_count integer not null,
  symbols_hash text not null,
  first_trading_day date not null,
  last_trading_day date not null,
  business_days integer not null,
  long_allowed boolean not null,
  short_allowed boolean not null,
  cash_allowed boolean not null,
  model_version text not null,
  selector_version text null,
  cost_model_version text not null,
  stats_json jsonb not null
);

create table player_machine_versions (
  id uuid primary key,
  alpha_player_id uuid references alpha_players(id),
  machine_name text not null,
  version integer not null,
  configuration_json jsonb not null,
  build_hash text not null,
  locked_at timestamptz null,
  created_at timestamptz not null,
  unique(alpha_player_id, machine_name, version)
);

create table user_tip_states (
  id uuid primary key,
  alpha_player_id uuid references alpha_players(id),
  tip_code text not null,
  tip_state text not null,
  first_shown_at timestamptz null,
  last_shown_at timestamptz null,
  completed_at timestamptz null,
  show_count integer default 0,
  unique(alpha_player_id, tip_code)
);

create table game_events (
  event_id uuid primary key,
  event_type text not null,
  event_version integer not null,
  occurred_at timestamptz not null,
  alpha_player_id uuid null,
  formal_user_id uuid null,
  session_id uuid null,
  arena_id uuid null,
  run_id uuid null,
  checkpoint_id uuid null,
  simulation_timestamp timestamptz null,
  correlation_id uuid null,
  causation_id uuid null,
  payload jsonb not null
);
```

> **Implementation note (security floor):** Per the USA Build Integration Spec §3.1, all player-owned tables carry an `owner_id uuid` with owner-scoped RLS; reference tables are SELECT-only to authenticated; `game_events` is an append-only sink. The shipped migration types `game_events` id-reference columns as `text` to hold the §51 envelope's string ids verbatim; the other tables keep the uuid keys above.

---

# 55. Screen Inventory

**Public:** `/alpha`, `/alpha/tutorial`, `/alpha/about`, `/alpha/how-it-works`

**Progression:** `/alpha/arenas`, `/alpha/profile`, `/alpha/leaderboard`, `/alpha/desks`

**Active run:** `/alpha/arena/[arenaId]/briefing`, `/alpha/run/[runId]`, `/alpha/run/[runId]/portfolio`, `/alpha/run/[runId]/risk`, `/alpha/run/[runId]/news`, `/alpha/run/[runId]/journal`, `/alpha/run/[runId]/results`, `/alpha/run/[runId]/autopsy`

**Machine Builder:** `/alpha/machine`, `/alpha/machine/new`, `/alpha/machine/[versionId]`, `/alpha/machine/[versionId]/stress-test`, `/alpha/machine/[versionId]/compare`

**Daily / Social:** `/alpha/daily-tape`, `/alpha/leaderboard`, `/alpha/desks`, `/alpha/tournaments`

**Conversion:** `/alpha/paper`, `/alpha/handoff`

---

# 56. Screen-Level UX Requirement

Every active game screen must answer five questions without requiring Help:

```text
1. WHAT IS HAPPENING?
2. WHAT INFORMATION DO I HAVE?
3. WHAT CAN I DO?
4. WHAT HAPPENS WHEN I COMMIT?
5. HOW AM I DOING AGAINST THE MACHINE?
```

If a screen does not answer these, it is incomplete.

---

# 57. Trust Mechanics

Every machine opponent gets a Machine Card.

```text
REFI HISTORICAL MACHINE

MODEL VERSION       CRISIS-1.4
TRAINING CUTOFF     BEFORE ARENA PERIOD
MARKET DATA CUTOFF  CURRENT SIMULATION TIMESTAMP
STARTING CAPITAL    $100,000
TRANSACTION COSTS   ENABLED
MAX POSITION        15%
LEVERAGE            NONE
FUTURE DATA         BLOCKED
AUDIT ID            RFA-MCH-CRISIS-014
```

Every finished run gets a Run Record: run ID; arena ID; player decisions; machine decisions; simulation timestamps; benchmark ID; scoring version; machine version; result; data cutoff.

---

# 58. Marketing Integrity

Separate result types. **Never merge these into one unlabeled chart.**

```text
HISTORICAL MARKET DATA

SIMULATION RESULT
BASED ON PLAYER DECISIONS

HISTORICAL MODEL SIMULATION
NOT LIVE CLIENT PERFORMANCE

PAPER TRADING RESULT
NO CAPITAL AT RISK
```

---

# 59. Conversion Funnel Metrics

**Game acquisition:** `alpha_landing_to_start`, `tutorial_start_rate`, `tutorial_completion_rate`, `first_decision_completion`, `first_run_completion`, `save_progress_rate`

**Engagement:** `arena_start_rate`, `arena_completion_rate`, `retry_after_loss_rate`, `autopsy_view_rate`, `machine_card_view_rate`, `average_checkpoints_per_session`, `daily_tape_return_rate`

**Learning:** `repeated_error_reduction`, `decision_consistency_improvement`, `turnover_reduction`, `risk_breach_reduction`, `regime_adaptation_improvement`

**Machine Builder:** `machine_builder_unlock_rate`, `machine_version_created`, `machine_version_locked`, `stress_test_start_rate`, `stress_test_completion_rate`, `machine_rebuild_rate`

**Handoff:** `paper_cta_view`, `paper_cta_start`, `refi_handoff_start`, `eligibility_completion`, `auth_completion`, `kyc_completion`, `formal_profile_completion`, `broker_connection`, `strategy_review`, `signal_start`, `managed_start`

The attribution chain must preserve: `campaign`, `source`, `alpha_player_id`, `handoff_id`, `formal_user_id` — without exposing sensitive values in query strings.

---

# 60. Recommended Onboarding Experiments

Do not assume the game-led path always converts better.

- **Test A — direct vs game-led hero CTA:** A `GET STARTED WITH REFI` vs B `CHALLENGE THE MACHINE`.
- **Test B — save point timing:** after 3 decisions; after first checkpoint score; after first mini-run.
- **Test C — paper CTA timing:** after first machine loss; after Alpha Profile; after Machine Builder; after first stress test. Preferred default: after Machine Builder or repeated high-intent engagement, **not immediately after first loss.**
- **Test D — product handoff copy:** V1 `TAKE YOUR MACHINE INTO PAPER MODE.` vs V2 `COMPARE A REFI MACHINE WITH YOUR PAPER PORTFOLIO.`
- **Test E — formal profile bridge:** `YOUR GAME PROFILE IS EDUCATIONAL. NOW COMPLETE YOUR FORMAL INVESTMENT PROFILE.` versus a shorter transition.

---

# 61. Anti-Patterns

Do not build: mandatory gameplay before formal onboarding; game-only client access; fake live results; fake historical ReFi performance; a raw-return-only leaderboard; trade-count rewards; confetti after buys; gambling sounds; countdown-pressure selling; hard paywalls before the user learns the game; hidden benchmark methodology; an "AI knows the future" narrative; a product handoff that discards game progress; a duplicate identity that cannot bind to formal ReFi identity; gameplay-derived suitability determination without explicit approval; unmanaged cross-over of game events into formal investor-action records.

---

# 62. Accessibility

Every animation must support reduced motion. When reduced motion is enabled, replace the animated correlation collapse with:

```text
CORRELATION CHANGED
0.41 → 0.83

RISK CLUSTERS
5 → 2
```

Replace the machine compile animation with an immediate status list. All controls: keyboard accessible; visible focus states; mouse equivalent; touch equivalent where mobile supports the action. **Never use color alone to indicate pass/fail.**

---

# 63. Performance

Prefer: SVG for network and node visuals; CSS transforms and opacity; Recharts for time series; `requestAnimationFrame` only where needed; static ASCII assets for large portraits; memoized layout for constellation positions; deterministic seeds for replay.

Avoid: heavy 3D engines; large video cutscenes; continuous canvas rendering when not visible; constant glitch effects.

Animation target: smooth at ordinary laptop performance; no blocking interaction unless explicitly marked blocking; no sequence longer than necessary.

---

# 64. Delivery Roadmap

**Phase 0 — Visual and interaction prototype.** Build: Boot; Landing; First-run overlay tutorial; Arena map; COVID briefing; Core market terminal; Order ticket; Machine reveal; Checkpoint score; Autopsy; Alpha Profile; Machine Builder shell; Portfolio Constellation; Correlation Collapse; Machine Pipeline; Machine Compile; TACO unlock visual. Goal: validate game comprehension and emotional coherence.

**Phase 1 — Playable manual COVID.** Build: 22 checkpoints; fixed historical path; player portfolio simulation; transparent constrained machine; transaction costs; scoring; decision journal; tutorial overlays; contextual tips; autopsy; retries; anonymous progress; save progress.

**Phase 2 — Alpha identity and retention.** Build: Alpha Profile; Machine Beat Rate; Daily Tape; ranks; basic leaderboard; progress persistence.

**Phase 3 — Machine Builder.** Build: universe; basket; weights; guardrails; rebalance; pause; re-entry; versioning; machine compile; historical stress test.

**Phase 4 — Multi-regime.** Build: Recovery; Inflation; Banking Stress; Blind Gauntlet.

**Phase 5 — Benchmark layer.** Build: `BenchmarkSnapshot` store; benchmark cards; Fair Match; Exhibition Match; ReFi benchmark comparison; benchmark reconciliation tooling.

**Phase 6 — TACO.** Build: tariff event packets; policy printer; supply-chain graph; public-figure ASCII reveal; pattern memory; rule modification; reflexivity final round.

**Phase 7 — Paper and onboarding handoff.** Build: Alpha handoff token; progress snapshot; redirect to formal ReFi onboarding; identity binding; paper CTA; onboarding attribution; game-return link from ReFi product.

---

# 65. Acceptance Criteria for MVP

A first-time user can: understand the objective without external explanation; complete tutorial using overlays; buy, reduce, exit, and hold; inspect portfolio and risk; commit a decision; see the market advance; compare with machine; understand why score differs; complete a COVID run; receive an autopsy; save progress; understand that the machine does not know the future; understand that ReFi Alpha is a simulation; see a clear optional path toward paper mode without being forced into formal onboarding.

Engineering acceptance: deterministic replay from run seed; benchmark snapshot version attached to every comparison; no future data leakage; no unlabeled performance claims; reduced-motion equivalents; overlay state persisted; game events separate from formal investor-action events; handoff token opaque and expiring; progress preserved across handoff.

---

# 66. Open Decisions

- **Canonical benchmark:** 321-symbol analyze snapshot; 292-symbol Good-Fit; 355-symbol Full Basket; or all three as explicitly separate benchmark families.
- **Historical walk-forward generation:** who owns creation and validation for COVID, 2022 Inflation, and pre-OOS arenas?
- **Anonymous identity:** cookie only; email save; magic link; formal ReFi auth earlier; hybrid.
- **Handoff integration:** shared identity service; BFF import endpoint; event-driven binding.
- **Paper-mode boundary:** game-native paper simulation; formal broker paper environment; both with staged transition.
- **Machine Builder freedom:** controlled blocks only for MVP; advanced expression later.
- **Social:** public leaderboard timing; Desk creation rules; moderation.
- **TACO episode set:** historical episode selection; hidden-date design; policy-event licensing/source.
- **Benchmark action fairness:** long/cash constrained machine; when and how to introduce directional exposure.
- **Progression gating:** Gold-only machine beat; Bronze/Silver/Gold model; retry friction.

---

# 67. Product Copy Library

**Landing**

```text
REFI ALPHA
MAN VS MACHINE

THE MARKET ALREADY HAPPENED.
YOU STILL DO NOT KNOW
WHAT COMES NEXT.

$100,000 VIRTUAL CAPITAL
SAME MARKET
SAME INFORMATION
NO HINDSIGHT

[ENTER THE MARKET]
```

**First loss** — `THE MACHINE WON. SEE WHERE THE GAP CAME FROM.`

**Human win** — `YOU BEAT THE MACHINE. NOW REPEAT IT.`

**Machine Builder transition** — `YOU HAVE SEEN THE GAP. NOW BUILD THE PROCESS.`

**Stress test** — `YOUR MACHINE IS COMPLETE. HISTORY IS NOT FINISHED WITH IT.`

**Paper transition** — `HISTORY IS CLOSED. THE LIVE MARKET IS NOT. ENTER PAPER MODE.`

**Formal onboarding bridge** — `YOU ARE LEAVING THE HISTORICAL GAME. YOUR PROGRESS WILL BE PRESERVED. YOUR FORMAL REFI PROFILE WILL BE COLLECTED SEPARATELY.`

**Final product thesis** — `YOUR THESIS. YOUR GUARDRAILS. SYSTEMATIC EXECUTION.`

---

# 68. Final System Principle

The player should experience this transformation:

```text
AT FIRST      I WAS MOVING STOCKS.
THEN          I SAW THE PORTFOLIO.
THEN          I SAW THE RISK.
THEN          I BUILT RULES.
THEN          I BUILT A MACHINE.
THEN          I TESTED IT AGAINST HISTORY.
THEN          I TESTED IT AGAINST REFI.
THEN          I TOOK THE NEXT STEP INTO PAPER TRADING.
```

The game succeeds when the player does not feel that they were marketed to. They should feel that they learned enough to understand why systematic process, risk controls, execution discipline, and transparent records matter.

ReFi Alpha should make the user curious enough to play, disciplined enough to learn, and informed enough to decide whether to continue into the ReFi.Trading product.

---

# 69. Final Product Statement

ReFi Alpha is not a simulator bolted onto ReFi.Trading. It is an optional experiential onboarding layer.

It should: attract users through competition; teach through historical economic regimes; reveal where human decisions fail; show why machines have structural advantages; let users build and test their own process; compare that process with ReFi benchmarks honestly; move serious users into paper trading; preserve their progress; then hand them into formal ReFi onboarding without confusing game behavior with formal advisory inputs.

The full arc is:

```text
MAN VS MACHINE
        ↓
WHY DID I LOSE?
        ↓
BUILD YOUR MACHINE
        ↓
PROTECT THE PORTFOLIO
        ↓
SURVIVE HISTORY
        ↓
YOUR MACHINE VS REFI
        ↓
TACO PROTOCOL
        ↓
LIVE PAPER MARKET
        ↓
REFI SIGNAL
OR
REFI MANAGED
```

That is the authoritative product direction.
