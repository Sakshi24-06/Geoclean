import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { verifyImageWithLevel3AI } from './src/lib/ai/backendModelEngine';

/**
 * Backend AI Verification Middleware Plugin
 * Connects the /api/verify-image endpoint directly to the Level 3 AI Model Engine.
 */
function aiVerificationBackendPlugin(): Plugin {
  return {
    name: 'geoclean-ai-verification-backend',
    configureServer(server) {
      server.middlewares.use('/api/verify-image', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });

        req.on('end', async () => {
          try {
            const parsed = JSON.parse(body || '{}');
            const { image, context = 'CITIZEN_BEFORE', issueType } = parsed;

            if (!image) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Image data payload is required.' }));
              return;
            }

            // Real Level 3 AI Model Execution
            const modelResult = await verifyImageWithLevel3AI(image, context, issueType);

            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify(modelResult));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'AI Verification engine error', details: String(err) }));
          }
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), aiVerificationBackendPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
