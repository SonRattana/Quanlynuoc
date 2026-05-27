import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',
  plugins: [react()],
  // THÊM CỤC NÀY VÀO ĐỂ ÉP NÓ KHÔNG NGỐN RAM TẠO SOURCEMAP:
  build: {
    sourcemap: false,
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true
      }
    }
  }
});