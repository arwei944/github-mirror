import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../static',
    emptyOutDir: true,
    // 添加版本戳到 chunk 文件名，强制 CDN 刷新
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash]-v7.6.0.js',
        chunkFileNames: 'assets/[name]-[hash]-v7.6.0.js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.')
          const ext = info[info.length - 1]
          return `assets/[name]-[hash][extname]`
        },
        manualChunks: {
          // React 核心（几乎每个页面都需要）
          'vendor-react': ['react', 'react-dom'],
          // Markdown 渲染（Issue/PR 详情页需要）
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'react-syntax-highlighter'],
          // Diff 查看器（PR 页面需要）
          'vendor-diff': ['react-diff-viewer-continued'],
          // 图表库（Analytics 页面需要）
          'vendor-charts': ['recharts'],
        },
      },
    },
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 压缩配置
    minify: 'esbuild',
    // chunk 大小警告阈值 (KB)
    chunkSizeWarningLimit: 300,
    // 目标浏览器
    target: 'es2020',
  },
  server: {
    proxy: {
      '/api': 'http://localhost:7860',
      '/mcp': 'http://localhost:7860',
      '/ws': {
        target: 'http://localhost:7860',
        ws: true,
      },
    },
  },
  // 依赖预构建优化
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-markdown', 'recharts'],
  },
})
