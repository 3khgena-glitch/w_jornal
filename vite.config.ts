import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/w_jornal/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'W_Jornal',
        short_name: 'WJ',
        theme_color: '#000000',
        display: 'standalone',
        start_url: '/w_jornal/',
        scope: '/w_jornal/'
      }
    })
  ]
})
