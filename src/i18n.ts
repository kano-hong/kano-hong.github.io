/**
 * i18n — 站內固定文案翻譯字典。
 * 內容（blog/projects）由 content collections 雙語檔案處理，這裡只放 UI 字串。
 */

export const languages = {
  'zh-TW': '繁體中文',
  en: 'English',
} as const;

export type Lang = keyof typeof languages;

export const defaultLang: Lang = 'zh-TW';

export const ui = {
  'zh-TW': {
    'nav.work': '作品',
    'nav.writing': '寫作',
    'nav.about': '關於',
    'nav.contact': '聯絡',

    'hero.eyebrow': 'Front-end Tech Lead / 遊戲開發',
    'hero.title.line1': '為遊戲',
    'hero.title.line2': '寫一行行',
    'hero.title.line3': '結構與秩序',
    'hero.subtitle':
      '十一年遊戲產業工程經驗，2020 年起擔任前端 Lead。專注於 Cocos Creator、TypeScript、狀態機架構，以及把混亂的開發流程改造成可重複的系統。',
    'hero.cta.work': '看作品',
    'hero.cta.writing': '看文章',

    'home.work.eyebrow': '精選案例',
    'home.work.title': '幾個我親手解過的問題',
    'home.work.viewAll': '看全部作品 →',

    'home.writing.eyebrow': '近期文章',
    'home.writing.title': '從日報長出來的技術筆記',
    'home.writing.viewAll': '看全部文章 →',

    'home.about.eyebrow': '關於',
    'home.about.title': '一個把 10 秒以上手動流程都寫成腳本的人',
    'home.about.body':
      '我是 Kano（洪嘉濃），住在新北板橋。過去十一年我在四家公司做遊戲，從拉霸、德州撲克、麻將、輪盤到捕魚機，全都動手寫過。現在是新數字有限公司（XGaming）的 Front-end Tech Lead。',
    'home.about.more': '更多關於我 →',

    'project.challenges': '面對的挑戰',
    'project.architecture': '技術架構',
    'project.tradeoffs': '取捨與決策',
    'project.stack': '技術棧',
    'project.role': '角色',
    'project.year': '年份',
    'project.back': '← 回作品集',

    'blog.readTime': '分鐘閱讀',
    'blog.publishedOn': '發表於',
    'blog.tags': '標籤',
    'blog.back': '← 回文章列表',
    'blog.readNext': '下一篇',

    'footer.tagline': '寫程式，也寫關於寫程式這件事。',
    'footer.elsewhere': '在別處',
    'footer.colophon': '由 Astro 建構，部署於 GitHub Pages。',

    'lang.switch': 'EN',
  },
  en: {
    'nav.work': 'Work',
    'nav.writing': 'Writing',
    'nav.about': 'About',
    'nav.contact': 'Contact',

    'hero.eyebrow': 'Front-end Tech Lead / Games',
    'hero.title.line1': 'Writing structure',
    'hero.title.line2': 'into the chaos',
    'hero.title.line3': 'of game code',
    'hero.subtitle':
      'Eleven years building games, leading front-end teams since 2020. Focused on Cocos Creator, TypeScript, state-machine architecture, and turning messy development pipelines into repeatable systems.',
    'hero.cta.work': 'See work',
    'hero.cta.writing': 'Read writing',

    'home.work.eyebrow': 'Selected work',
    'home.work.title': 'A few problems I solved by hand',
    'home.work.viewAll': 'See all work →',

    'home.writing.eyebrow': 'Recent writing',
    'home.writing.title': 'Notes that grew out of daily logs',
    'home.writing.viewAll': 'See all writing →',

    'home.about.eyebrow': 'About',
    'home.about.title': 'Anything manual over ten seconds becomes a script',
    'home.about.body':
      "I'm Kano Hong, based in Banqiao, New Taipei, Taiwan. Eleven years of shipping games across four companies — slot, Texas Hold'em, mahjong, roulette, fishing. Currently Front-end Tech Lead at Newdigit Co., Ltd. (XGaming).",
    'home.about.more': 'More about me →',

    'project.challenges': 'Challenges',
    'project.architecture': 'Architecture',
    'project.tradeoffs': 'Trade-offs',
    'project.stack': 'Stack',
    'project.role': 'Role',
    'project.year': 'Year',
    'project.back': '← Back to work',

    'blog.readTime': 'min read',
    'blog.publishedOn': 'Published',
    'blog.tags': 'Tags',
    'blog.back': '← Back to writing',
    'blog.readNext': 'Read next',

    'footer.tagline': 'Code, and writing about code.',
    'footer.elsewhere': 'Elsewhere',
    'footer.colophon': 'Built with Astro, deployed on GitHub Pages.',

    'lang.switch': '中',
  },
} as const;

export function useTranslations(lang: Lang) {
  return function t(key: keyof (typeof ui)['zh-TW']): string {
    return ui[lang][key] || ui[defaultLang][key];
  };
}

/**
 * 從 URL 路徑判斷當前語言。
 * /en/* → en，其餘 → zh-TW
 */
export function getLangFromUrl(url: URL): Lang {
  const [, first] = url.pathname.split('/');
  if (first === 'en') return 'en';
  return 'zh-TW';
}

/**
 * 取得對應語言的路徑前綴。
 */
export function getLangPath(lang: Lang): string {
  return lang === 'zh-TW' ? '' : `/${lang}`;
}

/**
 * 給定目前路徑與目標語言，回傳切換後的路徑。
 */
export function switchLangPath(currentPath: string, targetLang: Lang): string {
  const segments = currentPath.split('/').filter(Boolean);
  const [first, ...rest] = segments;

  // 目前是英文
  if (first === 'en') {
    if (targetLang === 'en') return currentPath;
    return '/' + rest.join('/');
  }

  // 目前是中文
  if (targetLang === 'zh-TW') return currentPath;
  return '/en/' + segments.join('/');
}
