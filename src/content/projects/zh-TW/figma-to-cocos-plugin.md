---
title: 從 Figma 到 Cocos：把美術交付流程寫成 Plugin
summary: 為了讓美術只要按一個按鈕就能把畫好的 UI 同步到 Cocos Creator 場景，我寫了一個 Figma plugin，把過去要 30 分鐘的手動切圖、命名、貼座標流程縮短到一次點擊。
year: '2025'
role: Lead Engineer
company: 新數字有限公司
stack:
  - Figma Plugin API
  - TypeScript
  - Cocos Creator 3.x
  - Node.js
  - WebSocket
tags:
  - 工具鏈
  - 自動化
  - Figma
  - Cocos Creator
featured: true
order: 1
lang: zh-TW
slug: figma-to-cocos-plugin
---

## 起點：一個會反覆出現的痛點

每次新版本進入 UI 整合階段，遊戲團隊的工作流都長一樣——美術在 Figma 上把畫面做完，然後寄一份 .fig 檔給工程師，或者直接口頭說「按鈕往左移 4 px」。

我們做過粗略的估算，光是處理一個有 30 個元件的中等複雜頁面（例如大廳的設定頁），從美術交件到工程師擺到 Cocos Creator 場景裡並校正完數值，大概要花掉 30 分鐘到 1 小時。乘上一個專案大概十幾個頁面、十幾種解析度，這個成本就變得不能忽視了。

更重要的是，這個成本是「會反覆出現」的——每次 UI 改版、每次新功能、每次美術微調，工程師都要重新對齊一次。

## 面對的挑戰

這個 plugin 不是隨手寫一個就能解決問題的腳本。要真的能取代手動流程，需要同時解掉幾個結構性難題：

**1. Figma 與 Cocos 的座標系不一致。** Figma 是螢幕座標（左上原點、Y 向下），Cocos 是世界座標（中心原點、Y 向上）。如果要 plugin 在大量場景上能用，這個轉換必須能正確處理巢狀的 Auto Layout、Constraint、Group 結構，否則只能處理最簡單的扁平頁面。

**2. 沒有共通的「元件身份」。** 美術在 Figma 上叫「button_play」的物件，工程師在 Cocos 上叫「BtnPlay」，再用一段程式碼把貼圖塞進去。要做雙向同步，必須有一個穩定的對應規則，讓工具知道哪個 Figma node 對應到哪個 Cocos node。

**3. 既存場景不能被毀掉。** 工程師在 Cocos 場景裡會掛上邏輯、動畫、事件 binding。Plugin 同步座標進去的時候，這些「非美術」的設定必須完整保留下來。如果同步一次就把場景搞爛，這個工具就永遠不會被信任。

**4. 美術不是工程師。** Plugin 的 UI 必須讓美術點兩三下就能完成同步，不能有任何「請輸入 IP」「請選擇 endpoint」這種讓人退縮的步驟。

## 技術架構

整體流程分成三段：Figma 端的 plugin 收集資料、本地的 bridge server 中轉、Cocos Creator 端的 extension 收件並更新場景。

```
┌─────────────┐   1.Extract    ┌──────────────┐   2.WebSocket   ┌──────────────────┐
│   Figma     │ ─────────────▶ │ Bridge Server│ ──────────────▶ │ Cocos Creator    │
│   Plugin    │   JSON payload │  (localhost) │   structured    │ Extension        │
│             │                │              │   diff          │                  │
└─────────────┘                └──────────────┘                 └──────────────────┘
      ▲                                                                  │
      │                          3. ack / errors                         │
      └──────────────────────────────────────────────────────────────────┘
```

Figma plugin 端用 `figma.currentPage.selection` 拿到使用者選擇的節點，再用一個遞迴函式把整棵子樹序列化成中性格式（包含座標、尺寸、命名、fill、stroke、effect 等資訊）。座標在這一層就先轉好——把 Figma 的左上原點換算成相對父節點中心的偏移。

Bridge server 是一支用 Node.js 寫的 localhost WebSocket server，只做兩件事：接收 Figma 推來的 payload、把它廣播給連線中的 Cocos extension。寫成獨立 server 的原因是 Figma plugin 沒辦法直接連 file system 也不容易直接連 Cocos Creator process。

Cocos extension 端收到 payload 之後，用「Figma node name → Cocos node UUID」的對應表去場景樹裡找對應節點，再做 diff：哪些節點要新增、哪些要更新座標、哪些已經不存在於 Figma 應該標記為孤兒。所有「非美術」的 component（Script、Animation、Button 行為）都不會被動到。

## 取捨與決策

**為什麼選 WebSocket 而不是檔案輪詢？**
最早原型用的是「Figma 寫一個 JSON 到 Downloads 資料夾，Cocos extension 輪詢檔案變更」。可以動，但體驗很差——按下同步之後要等 1～2 秒才會看到場景動。換成 WebSocket 之後變成即時，美術會覺得「按鈕真的有反應」，這個感受差很多。

**為什麼用「命名約定」而不是「元件 ID 綁定」？**
理想上應該是 Figma node 跟 Cocos node 有 UUID 級別的對應，這樣命名可以亂改也沒關係。但實際上 Figma 的 node ID 在複製貼上、跨檔案搬移時不會保留，所以我選擇用一個比較鬆但實際運作的規則：以路徑命名作為對應（`Lobby/Setting/btn_play` ↔ `Lobby/Setting/btn_play`）。代價是美術要遵守命名規則，但這個規則本來在 code review 也會 enforce，所以等於沒有額外成本。

**為什麼沒做雙向同步？**
最初規劃裡有想過「工程師在 Cocos 動了座標也要同步回 Figma」，但思考過後砍掉了。原因是 Figma 是美術的權威來源，工程師在 Cocos 改的座標 99% 是 hot fix 性質，不應該污染設計檔。雙向同步會引入大量的衝突處理邏輯，性價比不划算。

**為什麼不做成 Cocos Creator 內建的 importer？**
Cocos Creator 的 extension 機制可以做 importer，但 importer 是「離線轉換檔案」的概念，不能做「即時同步、保留場景現有內容」這件事。我們的核心需求是後者，所以 importer 不是對的工具。

## 後來發生了什麼

Plugin 推出之後，每個新版本的 UI 整合時間從原本的數小時級降到分鐘級。更有趣的副作用是：美術開始主動在 Figma 上把同一頁的 RWD 版本（手機/平板/桌面）做完整，因為他們知道「按一下就能看到實際效果」，回饋循環變短了，他們也願意投入更多。

我覺得這是工具最理想的樣子——它不只省了時間，還改變了人的行為模式。
