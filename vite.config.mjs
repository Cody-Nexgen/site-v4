import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
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
});
