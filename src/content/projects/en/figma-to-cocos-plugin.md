---
title: "From Figma to Cocos: Turning Art Handoff into a Plugin"
summary: To let artists sync their Figma designs into Cocos Creator scenes with one click, I built a plugin that collapsed a 30-minute manual workflow of slicing, naming, and coordinate-fixing into a single button press.
year: '2025'
role: Lead Engineer
company: Newdigit Co., Ltd.
stack:
  - Figma Plugin API
  - TypeScript
  - Cocos Creator 3.x
  - Node.js
  - WebSocket
tags:
  - Tooling
  - Automation
  - Figma
  - Cocos Creator
featured: true
order: 1
lang: en
slug: figma-to-cocos-plugin
---

## The starting point: a pain that kept coming back

Every time a new version hit the UI integration phase, the team's workflow looked exactly the same — artists finished a screen in Figma, then either sent over a .fig file or just told the engineer "move that button 4 px to the left."

We did a rough estimate: handling a medium-complexity page with around 30 components (say a lobby settings page), from artist handoff to engineer placing it in a Cocos Creator scene with all values aligned, took about 30 to 60 minutes. Multiply that by a dozen pages and a dozen resolutions per project, and the cost stops being negligible.

More importantly, the cost was *recurring*. Every UI revision, every new feature, every artist tweak meant the engineer had to re-align everything.

## Challenges

This plugin wasn't something I could solve with a quick script. To actually replace the manual workflow, several structural problems had to be solved at the same time:

**1. Figma and Cocos use different coordinate systems.** Figma uses screen coordinates (top-left origin, Y goes down); Cocos uses world coordinates (center origin, Y goes up). For the plugin to work on real-world layouts, this conversion has to handle nested Auto Layout, Constraints, and Group structures correctly — otherwise it's only useful for the simplest flat pages.

**2. There's no shared "component identity."** What the artist calls `button_play` in Figma, the engineer calls `BtnPlay` in Cocos, with some code that injects the texture. For two-way sync to be possible, you need a stable mapping rule so the tool knows which Figma node maps to which Cocos node.

**3. The existing scene must not be destroyed.** Engineers attach logic, animations, and event bindings to scene nodes. When the plugin syncs coordinates in, all this "non-art" setup must be preserved intact. If a sync ever wrecks the scene, the tool will never be trusted again.

**4. Artists aren't engineers.** The plugin UI has to let an artist finish a sync in two or three clicks. Anything like "please enter an IP address" or "pick an endpoint" kills adoption.

## Architecture

The flow splits into three pieces: the Figma plugin collects data, a local bridge server relays it, and a Cocos Creator extension receives and applies the updates.

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

The Figma plugin uses `figma.currentPage.selection` to grab the selected nodes, then a recursive function serializes the entire subtree into a neutral format (coordinates, sizes, names, fills, strokes, effects). Coordinates are converted at this layer — Figma's top-left origin becomes an offset relative to the parent's center.

The bridge server is a tiny Node.js localhost WebSocket server that does two things: receive payloads from Figma and broadcast them to any connected Cocos extension. It exists as a separate process because Figma plugins can't touch the filesystem directly and can't talk to the Cocos Creator process either.

The Cocos extension receives the payload, uses a "Figma node name → Cocos node UUID" table to find the corresponding nodes in the scene tree, then diffs: which nodes need creating, which need coordinate updates, which no longer exist in Figma and should be flagged as orphans. All "non-art" components (Scripts, Animations, Button behavior) are left untouched.

## Trade-offs

**Why WebSocket instead of file polling?**
The first prototype had Figma write a JSON to the Downloads folder and the Cocos extension polled for changes. It worked, but the experience was bad — a 1-2 second lag after pressing sync. Switching to WebSocket made it feel instant, and artists started feeling like "the button actually does something." That perception matters a lot.

**Why naming conventions instead of component-ID binding?**
Ideally Figma nodes and Cocos nodes would have UUID-level mappings, freeing names to be arbitrary. In practice Figma's node IDs don't survive copy-paste or cross-file moves. So I picked a looser but practical rule: path-based naming as the mapping key (`Lobby/Setting/btn_play` ↔ `Lobby/Setting/btn_play`). The cost is that artists have to follow a naming convention, but that's already enforced in code review — so it's a zero-cost ask.

**Why not two-way sync?**
The original plan included "engineer-side coordinate changes sync back to Figma," but I dropped it. Figma is the artist's source of truth; engineer-side coordinate edits in Cocos are 99% hot-fix in nature and shouldn't pollute the design file. Two-way sync would introduce a lot of conflict-resolution logic for very little real benefit.

**Why not a built-in Cocos Creator importer?**
Cocos Creator's extension system supports importers, but importers are "offline file conversion" by nature — they can't do "live sync that preserves existing scene contents." Our core need was the latter, so importer was the wrong tool.

## What happened afterward

After the plugin shipped, UI integration time for each new version dropped from hours to minutes. The more interesting side effect was that artists started voluntarily producing fully responsive variants of each page (mobile, tablet, desktop) in Figma — because they knew "I can see the real thing with one click." The feedback loop shortened, and they were willing to invest more.

That's what I think the best tools look like — they don't just save time, they change behavior.
