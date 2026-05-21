---
title: 為什麼我們用 XState 重構遊戲狀態管理
summary: 一個拉霸機台的 spin 流程裡有十幾個非同步狀態：等下注、扣餘額、發牌、播動畫、結算、領獎。我們最早用 boolean flag 管，後來用 enum，最後用 XState——這篇是中間的轉折過程。
date: 2026-04-12
updated: 2026-04-15
tags:
  - XState
  - 狀態機
  - 遊戲架構
  - Cocos Creator
series: 遊戲架構筆記
readTime: 14
lang: zh-TW
slug: why-we-refactored-with-xstate
---

## 一切都從一個 bug 開始

那是某個版本快上線前一週的事。QA 回報了一個 bug：在拉霸遊戲裡，如果在 free spin 動畫播到一半時切到背景再切回來，下一次 spin 會跳過扣款步驟，直接送伺服器一個沒帶餘額的請求。

我接手 debug 的時候，第一個動作是打開那支處理 spin 流程的檔案。然後就看到了這個：

```typescript
class SpinController {
  private _isSpinning = false;
  private _isAnimating = false;
  private _isFreeSpin = false;
  private _isPaused = false;
  private _hasResult = false;
  private _isCollecting = false;
  // ... 還有八個 flag
}
```

十四個 boolean。

而且這些 boolean 不是平行的——`isPaused` 只在 `isAnimating` 為 true 的時候有意義；`hasResult` 為 true 的時候 `isSpinning` 應該已經是 false 了。它們之間有大量隱性的合法/非法組合，但這些組合從來沒有被寫下來。

那個 bug 的根因，是某個地方在還原背景的時候，沒有同時還原 `isCollecting`，於是一個本該被擋下來的請求過了 guard。

## 第一階段：enum 化

我那時還不認識 XState，但已經知道 boolean flag 不對。第一次嘗試是改寫成 enum：

```typescript
enum SpinState {
  Idle,
  WaitingBet,
  Deducting,
  Spinning,
  Animating,
  Showing Result,
  Collecting,
}
```

立刻好了很多——至少我能保證遊戲在任何瞬間只處在一個狀態。

但很快又遇到新問題。Free spin 不是「狀態」，是「模式」——它跟正常 spin 走同一套狀態，但每個狀態的行為要稍微不同（不扣款、自動再轉、有不同動畫）。如果用 enum 表達，要嘛變成兩倍的 enum 數量（FreeSpinAnimating、NormalAnimating ...），要嘛要在每個狀態裡判斷 `mode === 'free'`。前者爆炸，後者又退回 boolean flag 的世界，只是穿了 enum 外衣。

更難解的是「平行狀態」——音效是獨立播放的，UI 也是獨立的，這些東西不該被綁進 spin 主流程的 enum 裡。但目前的設計沒有「平行」這個概念。

## 第二階段：發現 XState

XState 對我來說最關鍵的兩個概念是 **hierarchical states**（巢狀狀態）跟 **parallel states**（平行狀態）。

巢狀狀態解決 mode 問題：

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

平行狀態解決 UI/音效獨立性問題——把它們放在獨立的 region 裡，互不干擾，但共享同一個 event bus。

更重要的是 XState 強迫我把所有的「合法 transition」寫下來。原本散落在十幾個 method 裡的「if isXXX && !isYYY」邏輯，現在都被收斂到一個地方：state machine 的 `on` block。看不到的合法性變成看得到的。

## 重構過程的真實樣貌

實際做下去之後，第一個發現是「重構」這個詞太美化了，實際上是「重寫」。整支 SpinController 超過 800 行，幾乎沒有 unit test（因為原本的設計極難測——boolean flag 的笛卡爾積太大），所以我能依靠的只有 QA 的整合測試 case。

策略是分兩段：

1. **先把 state machine 寫出來，但放在原本的 code 旁邊跑空轉。** 每當原本的 code 觸發某個動作（例如 `startSpin()`），我同時 send 一個對應 event 給 state machine。然後加 log，比對 state machine 認為「現在應該在什麼狀態」跟原本的 boolean flag 組合是否一致。

2. **驗證一個流程一致之後，才把那段流程的實際行為（呼叫 server、播動畫）搬到 state machine 的 `actions` 或 `services` 裡，並把原本 code 刪掉。**

這個策略花了大概兩週，比一開始預估的長一倍。但好處是任何一個 commit 都能上線——我從來沒有讓 main branch 處在「重構到一半、不能正常運作」的狀態。

## 結果：那個 bug 解掉了嗎

解掉了，但更重要的是它變得「不可能再發生」。

原本的 bug 是「狀態被部分還原」——切到背景時保存了一部分 flag，回前景時沒全部還原。在 XState 裡，整個 machine 的狀態是一個 atomic snapshot，序列化跟反序列化都是一行 code，沒辦法只還原一半。

更普遍地說，過去 QA 找到的 bug 有一大類是「在 X 狀態下不應該能做 Y」。在 boolean flag 的世界裡，這種 bug 是隨機散落的，因為合法性沒有集中表達。在 state machine 裡，這種 bug 只可能來自「我忘了在 state X 上加上 `on: { Y: ... }`」，而 X 跟 Y 都是有限的、可窮舉的，所以這類 bug 變成可以系統性消滅的東西。

## 我會推薦每個遊戲專案都用 XState 嗎？

不會。

XState 的學習曲線不平，actor model 跟 services 對沒看過函數式狀態機的人來說很燒腦。如果你的遊戲狀態真的只有「Idle / Playing / GameOver」三個，引入 XState 是大砲打小鳥。

但如果你的某個 controller 已經出現超過五個互相耦合的 boolean flag——尤其是這些 flag 之間有時序關係——那它幾乎一定要重構成狀態機。語法不一定要用 XState，可能是手寫一個小型的 state machine 也行。但「合法狀態必須被顯式列舉」這件事，是無論用什麼工具都該堅持的。

## 後續

那次重構之後大半年，我們在另外兩個專案（一個輪盤、一個德州撲克）開始的時候就直接用 XState。第二個專案有趣的地方是，因為一開始就用狀態機建模，整個 spin 流程的設計討論變得異常順暢——產品端在白板上畫的狀態圖，幾乎可以直接 1:1 翻成 code。

我把這個現象理解成：好的工具會反向影響上游的工作流。當大家都知道「最終會被建模成狀態機」，設計階段就會自動往可建模的方向收斂。

---

*下一篇我會寫 MobX-Keystone 怎麼跟 XState 搭配——一個管狀態流轉、一個管狀態資料，這兩件事其實是可以乾淨分開的。*
