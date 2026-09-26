import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { verifyImageWithLevel3AI } from './src/lib/ai/backendModelEngine';

function handleVerifyImageRequest(req: IncomingMessage, res: ServerResponse) {
  const reqStart = Date.now();
  console.log(`[AI Verification Backend] Incoming request: ${req.method} ${req.url} (Content-Length: ${req.headers['content-length']})`);

  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    console.warn(`[AI Verification Backend] Rejected method: ${req.method}`);
    return;
  }

  const chunks: Buffer[] = [];
  req.on('data', (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });

  req.on('error', (err) => {
    console.error('[AI Verification Backend Request Stream Error]:', err);
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Request stream error', details: String(err) }));
  });

  req.on('end', async () => {
    try {
      const body = Buffer.concat(chunks).toString('utf-8');
      console.log(`[AI Verification Backend] Request body received, size: ${body.length} chars. Parsing JSON...`);
      const parsed = JSON.parse(body || '{}');
      const { image, context = 'CITIZEN_BEFORE', issueType } = parsed;

      if (!image) {
        console.warn('[AI Verification Backend] Missing image property in request payload');
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Image data payload is required.' }));
        return;
      }

      console.log(`[AI Verification Backend] Invoking Level 3 AI verification (context: ${context}, issueType: ${issueType})...`);
      // Real Level 3 AI Model Execution
      const modelResult = await verifyImageWithLevel3AI(image, context, issueType);

      const duration = Date.now() - reqStart;
      console.log(`[AI Verification Backend] Verification completed in ${duration}ms:`, {
        verified: modelResult.verified,
        wasteDetected: modelResult.wasteDetected,
        confidence: modelResult.confidence,
        category: modelResult.category,
      });

      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify(modelResult));
    } catch (err: any) {
      console.error('[AI Verification Backend Error]:', err?.stack || err);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'AI Verification engine error', details: String(err?.message || err) }));
    }
  });
}

/**
 * Backend AI Verification Middleware Plugin
 * Connects the /api/verify-image endpoint directly to the Level 3 AI Model Engine in both dev and preview.
 */
function aiVerificationBackendPlugin(): Plugin {
  return {
    name: 'geoclean-ai-verification-backend',
    configureServer(server) {
      server.middlewares.use('/api/verify-image', (req, res) => {
        handleVerifyImageRequest(req, res);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/verify-image', (req, res) => {
        handleVerifyImageRequest(req, res);
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables so backend engine can access GEMINI_API_KEY, etc.
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return {
    plugins: [react(), aiVerificationBackendPlugin()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
