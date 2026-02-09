import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
      },
    },
    build: {
      // Use esbuild for faster builds and better CSP compatibility
      minify: 'esbuild' as const,
      // Ensure proper chunking for production
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor libraries
            'vendor-react': ['react', 'react-dom'],
            'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tabs'],
            'vendor-charts': ['recharts'],
            'vendor-utils': ['zustand', 'date-fns', 'lucide-react'],
            // App chunks
            'charts': [
              './src/components/charts/CategoryPieChart.tsx',
              './src/components/charts/ExpenseTrendChart.tsx',
              './src/components/charts/YearlyTrendChart.tsx'
            ]
          },
        },
      },
      // Increase chunk size warning limit since we're optimizing
      chunkSizeWarningLimit: 1000,
    },
    // Configure for production deployment
    base: '/',
  }
})
