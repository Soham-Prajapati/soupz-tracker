import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { VitePWA } from 'vite-plugin-pwa'

// Two build targets share this config:
//   vite build                    -> single-file bundle in dist/     (Tauri / Campaign.html)
//   BUILD_TARGET=web vite build   -> multi-file PWA in dist-web/      (Vercel)
// singlefile inlines every asset into one index.html, which is incompatible
// with a service worker (needs separate hashed files + a stable SW url), so
// the two plugins never run in the same build.
const web = process.env.BUILD_TARGET === 'web'

export default defineConfig({
  base: web ? '/' : './',
  plugins: [
    react(),
    ...(web
      ? [VitePWA({
          registerType: 'autoUpdate',
          injectRegister: 'auto',
          includeAssets: ['apple-touch-icon.png'],
          manifest: {
            name: 'Soup Tracker',
            short_name: 'Soup Tracker',
            description: 'Your study plan, maintained.',
            theme_color: '#F3EADA',
            background_color: '#F2E7D3',
            display: 'standalone',
            start_url: '/',
            scope: '/',
            icons: [
              { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
              { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
              { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
              { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
            navigateFallback: 'index.html',
            cleanupOutdatedCaches: true,
            clientsClaim: true,
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-stylesheets',
                  expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-webfonts',
                  expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
              {
                // Supabase progress reads — last-synced state stays available offline.
                urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/rest\/v1\/.*/i,
                handler: 'NetworkFirst',
                method: 'GET',
                options: {
                  cacheName: 'supabase-progress',
                  networkTimeoutSeconds: 5,
                  expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
            ],
          },
          devOptions: { enabled: false },
        })]
      : [viteSingleFile()]),
  ],
  build: web
    ? { outDir: 'dist-web' }
    : { outDir: 'dist', assetsInlineLimit: 100000000, cssCodeSplit: false },
})
