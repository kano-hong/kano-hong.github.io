// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// 部署設定 — Repo: kano-hong/kano-hong.github.io
// 因為是 username.github.io 倉庫，網址掛在根目錄
const SITE = 'https://kano-hong.github.io';
const BASE = '/';

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'ignore',

  // i18n: 預設繁中，英文掛在 /en/
  i18n: {
    defaultLocale: 'zh-TW',
    locales: ['zh-TW', 'en'],
    routing: {
      prefixDefaultLocale: false,
    },
  },

  integrations: [
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: 'zh-TW',
        locales: {
          'zh-TW': 'zh-TW',
          en: 'en',
        },
      },
    }),
  ],

  markdown: {
    shikiConfig: {
      // 雙主題：light 用紙感色，dark 留作未來切換
      themes: {
        light: 'github-light',
        dark: 'github-dark-dimmed',
      },
      wrap: true,
    },
  },

  build: {
    format: 'directory',
  },
});
