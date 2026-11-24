import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  sassOptions: {
    implementation: 'sass-embedded',
  },
  reactStrictMode: true,
  async rewrites() {
    return {
      beforeFiles: [
        {
          // Proxy dp-server API calls to the Next origin. Browsers (and
          // server-side fetches resolved against this server) call `/v1/*`
          // same-origin; in production the k8s Gateway serves browser
          // `/v1/*` traffic before it ever reaches Next, so this rewrite
          // only ever carries traffic that arrived at dp-web itself.
          // Target defaults to local dev; deployments set `DP_SERVER_URL`
          // to the cluster-internal dp-server address.
          source: '/v1/:path*',
          destination: `${process.env['DP_SERVER_URL'] ?? 'http://localhost:3001'}/v1/:path*`,
        },
      ],
    }
  },
}

export default nextConfig
