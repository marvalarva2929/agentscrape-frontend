import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves a project site from /<repo>/, so assets need that prefix.
// Set BASE_PATH in CI; local dev stays at "/".
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
})
