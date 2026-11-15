import type { Lang } from '~/i18n';

// 聯絡方式集中在這裡，換帳號只改一處。
// TODO(P2-9): Email 與 GitHub 之後要換成名字型帳號。
export const EMAIL = 'az198071123@gmail.com';
export const GITHUB_URL = 'https://github.com/az198071123';
export const LINKEDIN_URL = 'https://www.linkedin.com/in/kano-hong';

// 履歷 PDF（公開版，不含電話）。原稿在 resume/*.html，改完跑 npm run resume 重印。null 時不顯示按鈕。
export const RESUME_PDF: Record<Lang, string | null> = {
  'zh-TW': '/resume/kano-hong-zh.pdf',
  en: '/resume/kano-hong-en.pdf',
};
