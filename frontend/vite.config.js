import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The API base URL is injected at BUILD time, not read at runtime. That is a
// deliberate constraint: it means the container image is immutable and the same
// artifact can be promoted from staging to production. Baking secrets or
// per-environment endpoints into a runtime-read config is how "works in staging"
// bugs happen.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8000';

  return {
    plugins: [react()],
    server: {
      port: Number(env.PORT) || 3000,
      strictPort: true,
      // Dev-only proxy so the browser sees a single origin and CORS never
      // enters the picture during local development. Production is served by
      // nginx with an equivalent /api location block.
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/health': { target: apiTarget, changeOrigin: true },
        '/ready': { target: apiTarget, changeOrigin: true },
      },
    },
    preview: { port: Number(env.PORT) || 3000, strictPort: true },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
    },
  };
});
