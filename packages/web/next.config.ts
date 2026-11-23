import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  sassOptions: {
    implementation: 'sass-embedded',
  },
  reactStrictMode: true,
}

export default nextConfig
