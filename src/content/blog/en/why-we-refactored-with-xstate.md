---
title: One state machine, running in the game, unit tests and k6 load tests
summary: The login, lobby and reconnect logic of a Texas Hold'em platform used to be scattered across scenes. I moved the flow into xstate machines and split definition from implementation, so the same machine runs in three environments, Cocos, Vitest and k6. This post covers how, and the pitfalls I actually hit.
date: 2026-11-15
tags:
  - XState
  - State machines
  - k6
  - Testing
  - Cocos Creator
series: Game architecture notes
readTime: 8
lang: en
slug: why-we-refactored-with-xstate
---

This is the technical companion to "[Sub-game framework](/en/work/subgame-state-machines/)". The case study covers the decisions and results; this post covers how the code is written and how it runs inside k6.

## Where it started: three problems

From late 2025 into early 2026, our Texas Hold'em platform needed several sub-games on the same WebSocket connection. There were three problems:

- **Reconnecting was a mess**: players got stuck when a reconnect failed; coming back from the background triggered duplicate reconnects; after reconnecting, the screen and the data sometimes disagreed.
- **Sub-games had to share the flow**: login, lobby and reconnect couldn't be written again for every game.
- **Load tests had to run the real flow**: if the k6 script kept its own copy of the flow, it would drift away from the game and end up testing a path no player takes.

The third one is why I decided to separate definition from implementation.

## Approach 1: a machine only declares what it needs

The lobby machine needs "send the enter-table request", but it doesn't know, and shouldn't know, how that request is sent. So the definition holds only a typed slot:

```ts
export const lobbyMachine = setup({
    types: { /* context, events, output, input */ },
    actors: {
        // types only, no implementation
        sendEnterTableRequest: {} as PromiseActorLogic<boolean, { tableId: string }>,
        loadLobbyScene: {} as PromiseActorLogic<void, void>,
    },
    guards: { /* checks that read only context and event */ },
}).createMachine({ /* states and transitions */ });
```

The real implementation lives in another file and is injected when the actor is created:

```ts
// LobbyMachine.impl.ts: the game's implementation
export const lobbyMachineImplementations = {
    sendEnterTableRequest: fromPromise<boolean, { tableId: string }>(async ({ input }) =>
        GameHandler.sendEnterTableRequest(input.tableId),
    ),
};

// When creating the top-level actor, plug each scene's implementation into its child machine
pokerMasterActor = createActor(
    pokerMasterMachine.provide({
        actors: {
            loginMachine: loginMachine.provide({ actors: implementations.login }),
            lobbyMachine: lobbyMachine.provide({ actors: implementations.lobby }),
            texasMachine,
        },
    }),
    browserInspector ? { inspect: browserInspector } : {},
);
```

That keeps Cocos code out of the definition files entirely, and the types guarantee that every environment provides implementations of the same shape. The `inspect` at the end loads Stately's live state chart dynamically, and only when the URL has `?inspect` and we're not running in the editor, so players never download it.

## Approach 2: running Cocos code inside k6

k6 is neither a browser nor Node: there is no `cc`, no `window`, and some syntax isn't supported. I bundle the load-test script with vite and use aliases to swap out what the game code depends on, one piece at a time:

```ts
alias: [
    // WebSocket goes through dependency injection: production, unit tests and k6 each have a factory
    { find: "@/base/websocket/IWebSocketFactory", replacement: "src/mocks/handlers/K6WebSocketFactory.ts" },
    // swap the engine for a stand-in (cc/env must come before cc, or cc matches first)
    { find: "cc/env", replacement: "src/polyfills/cc-env.ts" },
    { find: "cc", replacement: "src/polyfills/cc.ts" },
    // k6 doesn't support for await, so use a utility module that doesn't depend on axios
    { find: "cocos-root/dist/utils-crypto.mjs", replacement: "…/cocos-root/dist/utils-crypto.mjs" },
]
```

The WebSocket layer was designed as a factory from the start, so k6 only needs a different factory. The packet parsing, data models and state machines above it are used as they are.

When a load-test bot starts, it registers exactly the same sub-game modules as the game does:

```ts
gameRegistry.register({
    gameId: GameId.RouletteAG5,
    machine: Ag5Machine,
    handlerFactory: (model) => new Ag5MessageHandler(model as Ag5GameDataModel),
    modelFactory: () => new Ag5GameDataModel({}),
});
```

So the bot in k6 runs the game's own roulette machine. In a real run on UAT with one bot, it connected, entered the game, sat at a table, bet, received the payout and left, with all 7 checks passing. The recording is in "[Sub-game framework](/en/work/subgame-state-machines/)".

## Approach 3: unit tests only test "what happens next"

With no side effects in the definitions, Vitest can send events straight to a machine and check which state it lands in, without starting the engine. Reconnecting, the flow most likely to break, has dedicated test files (for example `GameMachine.reconnect.test.ts` and `LobbyMachine.reconnect.test.ts`). The platform and sub-game machines have 132 tests between them.

## Pitfalls

**There is no top-level actor in k6.** A load-test run prints this warning:

```
WARN [PokerMasterActor] send called before actor creation { type: "game.startGame" }
```

After entering a table, a sub-game notifies the top-level app machine. But k6 only creates its own flow machine, not the app one, so the event is dropped. It doesn't affect the results in k6, but it shows something: the sub-games implicitly depend on "a top-level actor always exists". The price of shared code is knowing exactly which dependencies don't exist in other environments.

**The k6 bundle reads a config the editor generates.** The project's `tsconfig.json` extends `temp/tsconfig.cocos.json`, which Cocos Creator generates when it opens the project, and which isn't in git. On a clone that has never been opened in the editor, the k6 bundle simply fails.

**Load-test tooling breaks too.** The load test's member-login URL and the UAT gateway URL were hard-coded in its config, and after a stretch with nobody running it they went stale: login returned 404, 313 requests in 30 seconds all failed, and yet k6 exited normally. I added an option to pass the userId and token in through environment variables, skipping the member-site login, and only then could it run on UAT again. The lesson: when k6 has no `checks` at all, an "all checks pass" threshold still holds, so look at how many checks actually ran.

## Takeaways

- **Definitions only describe what happens next**; every side effect is injected with `provide`.
- **Dependencies go through factories or aliases**, so a new environment only swaps the edges, not the middle.
- **Once code is shared, run it in every environment regularly**, or the first thing to break will be the one fewest people run.
