import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  sassOptions: {
    implementation: 'sass-embedded',
  },
  reactStrictMode: true,
}

export default nextConfig
