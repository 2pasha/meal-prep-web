import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Source icon is full-bleed with the artwork inset, so no extra padding is needed.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0 },
    apple: { ...minimal2023Preset.apple, padding: 0 },
  },
  images: ['assets-src/icon.svg'],
})
