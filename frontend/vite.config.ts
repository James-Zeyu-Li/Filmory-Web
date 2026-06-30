/// <reference types="vitest" />
import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo.png'],
      manifest: {
        name: 'Filmory Web',
        short_name: 'Filmory',
        description: 'Professional Film & Digital Photography Ledger',
        theme_color: '#000000',
        background_color: '#121212',
        display: 'standalone',
        icons: [
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        maximumFileSizeToCacheInBytes: 5000000 // 5MB limit
      }
    })
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
    exclude: [...configDefaults.exclude, 'e2e/*']
  }
})
