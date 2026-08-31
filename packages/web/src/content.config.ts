import { glob } from 'astro/loaders'
import { z } from 'astro/zod'
import { defineCollection } from 'astro:content'

const github = z.object({
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
    z
      .object({
        version: z.number(),
        redirect: z.number().int().positive(),
      })
      .passthrough(),
    z
      .object({
        version: z.number(),
        name: z.string(),
        github: github.optional(),
        npm: z.object({ name: z.string() }).optional(),
        versions: z.array(
          z
            .object({
              packageVersion: z.string(),
              dshVersion: z.string(),
            })
            .passthrough(),
        ),
      })
      .passthrough(),
  ]),
})

export const collections = {
  plugin,
}
