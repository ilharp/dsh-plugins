import { glob } from 'astro/loaders'
import { z } from 'astro/zod'
import { defineCollection } from 'astro:content'

const blog = defineCollection({
  loader: glob({ base: './src/plugins', pattern: '*/index.yml' }),
  schema: z.object({
    version: z.number(),
    refs: z.array(z.string()),
  }),
})

export const collections = {
  blog,
}
