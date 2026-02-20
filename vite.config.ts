/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
      },
    }),
  ],
  test: {
    environment: 'node',
    server: {
      deps: {
        inline: [/exiftool-vendored/],
        external: ['sharp']
      }
    }
  }
})
