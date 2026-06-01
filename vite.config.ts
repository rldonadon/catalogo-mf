import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'icons/*.png'],
      manifest: {
        name: 'Catálogo Digital MF',
        short_name: 'Catálogo MF',
        description: 'Catálogo Digital MF Sistemas Automotivos — Divisão Freios a Ar',
        theme_color: '#0056b3',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/catalogo-mf/',
        scope: '/catalogo-mf/',
        lang: 'pt-BR',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'github-catalogo',
              expiration: { maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
    }),
  ],
  base: '/catalogo-mf/',
})
