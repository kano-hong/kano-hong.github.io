import type { Lang } from '~/i18n';

// 聯絡方式集中在這裡，換帳號只改一處。
// TODO(P2-9): Email 與 GitHub 之後要換成名字型帳號。
export const EMAIL = 'az198071123@gmail.com';
export const GITHUB_URL = 'https://github.com/az198071123';
export const LINKEDIN_URL = 'https://www.linkedin.com/in/kano-hong';

// TODO: 履歷 PDF 放進 public/ 後填路徑（例如 '/resume/kano-hong-zh.pdf'）。null 時正式站不顯示按鈕。
export const RESUME_PDF: Record<Lang, string | null> = { 'zh-TW': null, en: null };
