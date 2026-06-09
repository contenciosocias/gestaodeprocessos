import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base` precisa apontar para o subdiretório do GitHub Pages (ex.: /contencioso-cias/).
// O workflow de deploy injeta VITE_BASE = /<nome-do-repo>/ automaticamente.
// Em desenvolvimento (npm run dev) fica '/'. Veja o README.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
})
