import { glob } from 'astro/loaders'
import { z } from 'astro/zod'
import { defineCollection } from 'astro:content'

const github = z.strictObject({
  owner: z.string(),
  repo: z.string(),
  path: z.string().optional(),
  language: z.string().optional(),
  license: z.string().optional(),
  stars: z.number().optional(),
  forks: z.number().optional(),
  openIssues: z.number().optional(),
})

const plugin = defineCollection({
  loader: glob({ base: './src/plugins', pattern: '*/index.yml' }),
  schema: z.union([
    z.strictObject({
      version: z.number(),
      redirect: z.number().int().positive(),
    }),
    z.strictObject({
      version: z.number(),
      name: z.string(),
      github: github.optional(),
      npm: z.strictObject({ name: z.string() }).optional(),
      versions: z.array(
        z.looseObject({
          packageVersion: z.string(),
          dshVersion: z.string(),
        }),
      ),
    }),
  ]),
})

const posts = defineCollection({
  loader: glob({ base: './src/posts', pattern: '**/*.{md,mdx}' }),
  schema: z.strictObject({
    title: z.string(),
    plugin: z.number().int().positive().optional(),
    description: z.string().optional(),
    publishedAt: z.string().optional(),
    updatedAt: z.string().optional(),
    author: z.string().optional(),
  }),
})

export const collections = {
  plugin,
  posts,
}
