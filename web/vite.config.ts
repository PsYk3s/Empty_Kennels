import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', includeAssets: ['catalogues/sample.pdf'], manifest: { name: 'PB App Lead Capture', short_name: 'PB App', display: 'standalone', theme_color: '#0b1320', background_color: '#ffffff' } })]
});
