---
title: 同一份狀態機，跑在遊戲、單元測試和 k6 壓測裡
summary: 德州撲克平台的登入、大廳、斷線重連原本散在各個場景裡。我把流程改成 XState 狀態機，並把「定義」和「實作」拆開，讓同一份狀態機能在 Cocos、Vitest、k6 三個環境裡跑。這篇記錄做法，以及實際踩過的坑。
date: 2026-11-15
tags:
  - XState
  - 狀態機
  - k6
  - 測試
  - Cocos Creator
series: 遊戲架構筆記
readTime: 8
lang: zh-TW
slug: why-we-refactored-with-xstate
---

這篇是〈[子遊戲框架](/work/subgame-state-machines/)〉的技術補充：案例那篇講決策和結果，這篇講程式碼怎麼寫、在 k6 裡怎麼跑起來。

## 起點：三個問題

2025 年底到 2026 年初，我們的德州撲克平台要在同一條 WebSocket 連線裡加入多款子遊戲。當時有三個問題：

- **斷線重連很亂**：重連失敗後玩家會卡住；App 從背景切回來會重複重連；重連回來後，畫面和資料有時對不起來。
- **子遊戲要共用流程**：登入、大廳、斷線重連不能每款遊戲各寫一次。
- **壓測要跑真實流程**：k6 腳本如果自己再寫一套流程，就會和遊戲越差越遠，壓到的不是玩家真正會走的路。

第三點是讓我決定「定義和實作分開」的原因。

## 做法 1：狀態機只宣告它需要什麼

大廳狀態機需要「送出進桌請求」這件事，但它不知道、也不該知道請求怎麼送。所以在定義裡只放一個有型別的空位：

```ts
export const lobbyMachine = setup({
    types: { /* context、events、output、input */ },
    actors: {
        // 只宣告輸入輸出型別，沒有實作
        sendEnterTableRequest: {} as PromiseActorLogic<boolean, { tableId: string }>,
        loadLobbyScene: {} as PromiseActorLogic<void, void>,
    },
    guards: { /* 只讀 context 與 event 的判斷 */ },
}).createMachine({ /* 狀態與轉換 */ });
```

真正的實作放在另一個檔案，建立 actor 的時候才注入：

```ts
// LobbyMachine.impl.ts：遊戲裡的實作
export const lobbyMachineImplementations = {
    sendEnterTableRequest: fromPromise<boolean, { tableId: string }>(async ({ input }) =>
        GameHandler.sendEnterTableRequest(input.tableId),
    ),
};

// 建立頂層 actor 時，把各場景的實作塞進子狀態機
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

這樣定義檔裡沒有任何 Cocos 的程式碼，型別也保證每個環境提供的實作長得一樣。最後那個 `inspect` 只在網址帶 `?inspect`、而且不在編輯器裡時，才動態載入 Stately 的即時狀態圖，平常玩家不會載到它。

## 做法 2：讓 Cocos 的程式碼在 k6 裡跑

k6 不是瀏覽器也不是 Node：沒有 `cc`、沒有 `window`，也不支援某些語法。我用 vite 打包壓測腳本，靠別名把遊戲碼依賴的東西一個個換掉：

```ts
alias: [
    // WebSocket 走依賴注入：正式版、單元測試、k6 各有一個工廠
    { find: "@/base/websocket/IWebSocketFactory", replacement: "src/mocks/handlers/K6WebSocketFactory.ts" },
    // 引擎換成替身（cc/env 要排在 cc 前面，不然會被 cc 先比對到）
    { find: "cc/env", replacement: "src/polyfills/cc-env.ts" },
    { find: "cc", replacement: "src/polyfills/cc.ts" },
    // k6 不支援 for await，改用不依賴 axios 的工具模組
    { find: "cocos-root/dist/utils-crypto.mjs", replacement: "…/cocos-root/dist/utils-crypto.mjs" },
]
```

WebSocket 這一層一開始就設計成工廠，所以 k6 只要換一個工廠，上面的封包解析、資料模型、狀態機全部照用。

壓測機器人啟動時，向註冊表登記的是和遊戲完全相同的子遊戲模組：

```ts
gameRegistry.register({
    gameId: GameId.RouletteAG5,
    machine: Ag5Machine,
    handlerFactory: (model) => new Ag5MessageHandler(model as Ag5GameDataModel),
    modelFactory: () => new Ag5GameDataModel({}),
});
```

所以 k6 裡的機器人跑的就是遊戲本身的輪盤狀態機。實測在 UAT 用 1 個機器人跑一輪：連線、進遊戲、進桌、下注、收到派彩、離桌，7 項檢查全部通過。錄影在〈[子遊戲框架](/work/subgame-state-machines/)〉那篇。

## 做法 3：單元測試只測「下一步是什麼」

因為定義裡沒有副作用，Vitest 可以直接對狀態機送事件、看它停在哪個狀態，不用啟動引擎。斷線重連這種最容易出錯的流程，就各自有專門的測試檔（例如 `GameMachine.reconnect.test.ts`、`LobbyMachine.reconnect.test.ts`）。平台和子遊戲的狀態機加起來有 132 個測試。

## 踩過的坑

**k6 裡沒有頂層 actor。** 跑壓測時會看到這行警告：

```
WARN [PokerMasterActor] send called before actor creation { type: "game.startGame" }
```

子遊戲進桌後會通知頂層的 app 狀態機，但 k6 只建了壓測自己的流程狀態機，沒有建 app 那台，所以事件被丟掉。在 k6 裡不影響結果，但它說明了一件事：子遊戲其實隱含依賴「頂層 actor 一定存在」。共用程式碼的代價，是要清楚知道哪些依賴在別的環境不存在。

**k6 打包要讀編輯器產生的設定。** 專案的 `tsconfig.json` 繼承 `temp/tsconfig.cocos.json`，這個檔案由 Cocos Creator 打開專案時產生，而且不進 git。一份從來沒用編輯器開過的 clone，k6 打包會直接失敗。

**壓測工具也會壞掉。** 壓測的會員登入網址和 UAT 的閘道網址都寫死在設定裡，一段時間沒人跑就過期了：登入回 404，30 秒送出 313 次請求、全部失敗，k6 卻還是正常結束。後來我加上用環境變數直接帶入 userId 和 token 的選項，跳過會員站登入，才能在 UAT 重新跑起來。教訓是：k6 的 `checks` 沒有任何一項時，門檻「全部通過」也會成立，要看實際跑了幾項。

## 小結

- **定義只描述「下一步是什麼」**，副作用全部透過 `provide` 注入。
- **依賴走工廠或別名**，換一個環境只要換掉邊界，不用改中間。
- **共用之後，要定期在每個環境實際跑一次**，不然最先壞掉的會是最少人跑的那個。
