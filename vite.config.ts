import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path';

export default defineConfig({
      plugins: [react(), tailwindcss()],
      resolve: {
            alias: {
                  '@' : path.resolve(import.meta.dirname, './src/frontend'),
                  '@core' : path.resolve(import.meta.dirname, './src/core'),
                  '@data' : path.resolve(import.meta.dirname, './src/data'),
            },
      }
})
