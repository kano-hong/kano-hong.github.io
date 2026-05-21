---
title: Why We Refactored Game State Management with XState
summary: A single slot machine spin flow has a dozen async states — wait for bet, deduct balance, deal, animate, settle, collect. We started with boolean flags, moved to enums, then to XState. This is the story of what pushed us each step.
date: 2026-04-12
updated: 2026-04-15
tags:
  - XState
  - State Machines
  - Game Architecture
  - Cocos Creator
series: Game Architecture Notes
readTime: 14
lang: en
slug: why-we-refactored-with-xstate
---

## It all started with one bug

About a week before a release, QA filed a bug: in the slot game, if you backgrounded the app halfway through a free-spin animation, the next spin would skip the balance-deduction step and send the server a request without paying for it.

When I picked up the bug, the first thing I did was open the file handling the spin flow. And then I saw this:

```typescript
class SpinController {
  private _isSpinning = false;
  private _isAnimating = false;
  private _isFreeSpin = false;
  private _isPaused = false;
  private _hasResult = false;
  private _isCollecting = false;
  // ... eight more flags
}
```

Fourteen booleans.

And these booleans weren't independent — `isPaused` only made sense when `isAnimating` was true; when `hasResult` was true, `isSpinning` should already be false. They had a tangle of implicit valid/invalid combinations that had never been written down anywhere.

The root cause of that bug was that somewhere in the foreground-restore code, `isCollecting` wasn't restored along with the other flags. A request that should have been blocked by a guard slipped through.

## Stage 1: enum-ifying

I didn't know XState then, but I knew the boolean-flag setup was wrong. My first attempt was to convert it to an enum:

```typescript
enum SpinState {
  Idle,
  WaitingBet,
  Deducting,
  Spinning,
  Animating,
  ShowingResult,
  Collecting,
}
```

Immediately better — at least the game was guaranteed to be in exactly one state at any moment.

But new problems came fast. Free spin isn't a *state*, it's a *mode* — it goes through the same states as a normal spin, but each state behaves a little differently (no deduction, auto-trigger, different animation). Expressing this with an enum meant either doubling the enum count (`FreeSpinAnimating`, `NormalAnimating`, ...), which exploded, or checking `mode === 'free'` inside each state — which is just boolean flags in an enum costume.

Harder still was "parallel state." Sound effects play independently; UI is independent; these shouldn't be entangled with the main spin enum. But there was no concept of "parallel" in the current design.

## Stage 2: finding XState

The two concepts in XState that really clicked for me were **hierarchical states** and **parallel states**.

Hierarchical states solved the mode problem:

```typescript
const spinMachine = createMachine({
  initial: 'idle',
  states: {
    idle: { /* ... */ },
    spinning: {
      initial: 'normal',
      states: {
        normal: { /* ... */ },
        free: { /* ... */ },
      },
      states: {
        deducting: { /* ... */ },
        animating: { /* ... */ },
        showingResult: { /* ... */ },
      },
    },
  },
});
```

Parallel states solved the UI/sound independence problem — put them in their own regions, no interference between them, but they share the same event bus.

More importantly, XState forced me to write down every legal transition. The "if isXXX && !isYYY" logic that had been scattered across a dozen methods got pulled into one place: the state machine's `on` block. What was previously invisible became visible.

## What the refactor actually looked like

Once I started doing it, my first realization was that "refactor" was too kind a word — it was really a rewrite. The whole `SpinController` was over 800 lines with almost no unit tests (the original design was nearly impossible to test — the Cartesian product of boolean flags was too large), so the only safety net I had was QA's integration test cases.

The strategy was two-phase:

1. **Write the state machine alongside the existing code, running empty.** Every time the original code triggered an action (say `startSpin()`), I would also send a corresponding event to the state machine. Then I added logs comparing what the state machine *thought* the state should be against the actual boolean flag combination — they should match.

2. **Once a flow was verified consistent, move its real behavior (server calls, animation triggers) into the state machine's `actions` and `services`, and delete the original code.**

This took about two weeks, double my initial estimate. The upside was that any single commit was shippable — I never left main in a "half-refactored, doesn't work" state.

## Did the original bug get fixed?

Yes, but more importantly, it became *impossible to recur*.

The original bug was "partial state restore" — backgrounding saved part of the flags, foregrounding only restored part of them. In XState, the entire machine's state is an atomic snapshot; serialization and deserialization are one-liners — there's no way to half-restore.

More generally, a large class of QA bugs took the shape "shouldn't be able to do Y while in state X." In the boolean-flag world, these bugs were scattered randomly because legality wasn't expressed in one place. In the state machine world, this class of bug can only come from "I forgot to add `on: { Y: ... }` to state X" — and X and Y are finite and enumerable, so this class of bug becomes systematically eliminable.

## Would I recommend XState for every game project?

No.

XState has a non-trivial learning curve; the actor model and services can be mentally taxing if you haven't worked with functional state machines before. If your game's state really is just "Idle / Playing / GameOver" — three nodes — pulling in XState is using artillery on a sparrow.

But if you have a controller with more than five mutually coupled boolean flags — especially with temporal relationships between them — you almost certainly should refactor to a state machine. The syntax doesn't have to be XState; you can hand-roll a small one. But the principle "legal states must be explicitly enumerated" is worth keeping regardless of tools.

## Aftermath

Over the half-year after that refactor, we started two new projects (one roulette, one Texas Hold'em) with XState from day one. The interesting thing about the second one was that, because the design used state machines from the start, the spin-flow design discussions became unusually smooth — the state diagrams product drew on the whiteboard translated almost 1:1 to code.

I read this as: good tools influence upstream workflows in reverse. When everyone knows "this will end up modeled as a state machine," the design phase naturally converges toward modelable shapes.

---

*Next post: how MobX-Keystone pairs with XState — one manages state transitions, the other manages state data. They can be cleanly separated, and the result is more maintainable than either alone.*
