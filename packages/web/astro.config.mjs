import mdx from '@astrojs/mdx'
import node from '@astrojs/node'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://dsh.ilharper.com',
  trailingSlash: 'never',
  adapter: node({ mode: 'standalone' }),
  integrations: [mdx(), react()],
  vite: {
    plugins: [tailwindcss()],
  },
})
