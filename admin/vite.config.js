import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8000';
  return {
    plugins: [react()],
    server: { port: Number(env.PORT) || 5173, strictPort: true, proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    } },
    build: { outDir: 'dist', sourcemap: mode !== 'production' },
    // jsdom gives the tests localStorage and DOM globals, which the api
    // module's tokenStore needs.
    test: { environment: 'jsdom', include: ['src/**/*.test.{js,jsx}'] },
  };
});
