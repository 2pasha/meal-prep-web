import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Smakota',
        short_name: 'Smakota',
        description: 'Плануйте меню на тиждень і складайте список покупок.',
        lang: 'uk',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#3D7BE3',
        background_color: '#F4EFE6',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [
          { src: 'screenshots/wide.jpg', sizes: '1280x720', type: 'image/jpeg', form_factor: 'wide', label: 'Планувальник на сьогодні' },
          { src: 'screenshots/narrow.jpg', sizes: '780x1688', type: 'image/jpeg', form_factor: 'narrow', label: 'Меню на тиждень' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // Only the app shell is precached; Supabase API calls are never cached.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/images/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'dish-photos', expiration: { maxEntries: 60 } },
          },
          {
            // Uploaded recipe photos live on the Supabase origin; <img>/CSS loads are no-cors, hence status 0.
            urlPattern: ({ url }) => url.pathname.startsWith('/storage/v1/object/public/recipe-photos/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'recipe-photos', expiration: { maxEntries: 100 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  base: '/',
})
