import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(process.cwd()),
      '@focuz': resolve(process.cwd(), 'src/focuz'),
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        app: resolve(process.cwd(), 'app.html'),
        status: resolve(process.cwd(), 'status.html'),
        features: resolve(process.cwd(), 'features.html'),
        login: resolve(process.cwd(), 'login.html'),
        signin: resolve(process.cwd(), 'signin.html'),
        signup: resolve(process.cwd(), 'signup.html'),
        dashboard: resolve(process.cwd(), 'dashboard.html'),
        terms: resolve(process.cwd(), 'terms.html'),
        privacy: resolve(process.cwd(), 'privacy.html'),
        billing: resolve(process.cwd(), 'billing.html'),
        notFound: resolve(process.cwd(), '404.html'),
      },
    },
  },
  optimizeDeps: {
    include: ['zustand', 'framer-motion', 'lucide-react', 'date-fns'],
  },
});
