import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 自訂 generateId：用「lang/slug」當 id，避免中英文同 slug 衝突
const generateId = ({ data }: { data: Record<string, unknown> }) =>
  `${data.lang}/${data.slug}`;

const projects = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/projects',
    generateId,
  }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    year: z.string(),
    role: z.string(),
    company: z.string().optional(),
    stack: z.array(z.string()),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    accent: z.string().optional(),
    featured: z.boolean().default(false),
    order: z.number().default(99),
    lang: z.enum(['zh-TW', 'en']),
    slug: z.string(),
  }),
});

const blog = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/blog',
    generateId,
  }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    series: z.string().optional(),
    readTime: z.number().optional(),
    draft: z.boolean().default(false),
    lang: z.enum(['zh-TW', 'en']),
    slug: z.string(),
  }),
});

export const collections = { projects, blog };
