import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ['canvas', 'sharp', '@google-cloud/documentai']
}
export default nextConfig
