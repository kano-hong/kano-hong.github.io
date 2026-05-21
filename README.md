# Kano Hong — Portfolio Site

個人作品集 + 技術 blog，使用 Astro 5 建構，部署於 GitHub Pages。

## 技術選型

- **Astro 5** — 內容導向 SSG，islands architecture
- **MDX** — 文章可內嵌互動式元件
- **i18n** — 繁中（預設）/ 英文雙語
- **Shiki** — 程式碼語法上色
- **Fontsource** — 自架字型（Fraunces / JetBrains Mono / Noto Sans TC）

## 設計系統

- **調性**：technical chronicle — editorial + technical
- **背景**：紙感米白 `#f5f1ea`
- **文字**：深炭灰 `#1a1814`
- **強調色**：橘紅 `#d94e1f`（單一 accent，用得克制）
- **字體**：Fraunces（顯示/襯線）+ JetBrains Mono（程式碼/小字）+ Noto Sans TC（中文）

## 目錄結構

```
src/
├── content/
│   ├── projects/        # 作品 case study
│   │   ├── zh-TW/
│   │   └── en/
│   └── blog/            # blog 文章
│       ├── zh-TW/
│       └── en/
├── pages/               # 路由
│   ├── index.astro      # 中文首頁
│   ├── work/
│   ├── writing/
│   ├── about/
│   └── en/              # 英文版整組
├── components/
├── layouts/
├── styles/
└── i18n.ts              # 翻譯字典
```

## 本地開發

```bash
# 安裝依賴
pnpm install

# 開發 server (預設 localhost:4321)
pnpm dev

# 建構
pnpm build

# 預覽建構結果
pnpm preview
```

## 部署設定

### 部署到 GitHub Pages

1. 在 GitHub 建立 repo
2. 在 `astro.config.mjs` 修改 `SITE` 和 `BASE`：
   - 若 repo 名稱是 `username.github.io`，`BASE = '/'`
   - 若 repo 名稱是 `portfolio`，`BASE = '/portfolio'`
3. 在 GitHub repo 設定中：Settings → Pages → Source → GitHub Actions
4. push 到 main branch 觸發部署

### GitHub Actions

`.github/workflows/deploy.yml` 已設定好，使用 pnpm 自動 build + deploy。

## 新增內容

### 新增一個 case study

在 `src/content/projects/zh-TW/` 與 `src/content/projects/en/` 各放一個 `.md`（slug 要一致）：

```yaml
---
title: 標題
summary: 一句話描述
year: '2025'
role: Lead Engineer
company: 公司名稱
stack: [TypeScript, Cocos Creator]
tags: [自動化, 工具鏈]
featured: true   # 顯示在首頁
order: 1         # 排序
lang: zh-TW
slug: my-project # 用來配對雙語版本
---

文章內容（Markdown）
```

### 新增一篇 blog

在 `src/content/blog/zh-TW/` 與 `src/content/blog/en/` 各放一個 `.md`：

```yaml
---
title: 標題
summary: 摘要
date: 2026-04-12
tags: [XState, 狀態機]
series: 遊戲架構筆記   # 可選，會自動分群
readTime: 14         # 預估閱讀分鐘
lang: zh-TW
slug: my-post
---

文章內容
```

## TODO（後續優先順序）

- [ ] 真的 OG image（目前是預設 fallback）
- [ ] RSS feed
- [ ] 增加更多 case study：XState 重構、Registry Pattern 子遊戲、MobX-Keystone 資料層、Jenkins CI/CD
- [ ] 增加更多 blog 文章（系列計畫見下方）
- [ ] dark mode（已預留 CSS variable 切換點）
- [ ] 搜尋功能（pagefind）

## Blog 系列規劃

**遊戲架構筆記**
- [x] 為什麼我們用 XState 重構遊戲狀態管理
- [ ] 從 Cocos 子遊戲混亂到 Registry Pattern：架構演進的取捨
- [ ] MobX-Keystone vs MobX：在大型遊戲專案的選型實戰

**工具與自動化**
- [ ] Figma to Cocos：用 plugin 自動化美術交付流程
- [ ] Jenkins CI/CD 跨 10+ 專案的多分支策略

## License

Code: MIT
Content (blog posts, case studies): CC BY-NC 4.0
