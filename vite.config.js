import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const DEFAULT_BASE = '/ATDU/'

function normalizeBase(basePath) {
  if (!basePath) return DEFAULT_BASE
  const withLeadingSlash = basePath.startsWith('/') ? basePath : `/${basePath}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

export default defineConfig(() => {
  const base = normalizeBase(process.env.VITE_BASE_PATH)

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'icons/icon-192.png',
          'icons/icon-512.png',
          'icons/icon-192-maskable.png',
          'icons/icon-512-maskable.png'
        ],
        manifest: false,
        workbox: { globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'] }
      })
    ]
  }
})
