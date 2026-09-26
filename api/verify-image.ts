import type { IncomingMessage, ServerResponse } from 'http';
import { verifyImageWithLevel3AI } from '../src/lib/ai/backendModelEngine.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  try {
    if (typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'application/json');
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end(JSON.stringify({
        error: 'Method not allowed',
        message: 'Only POST requests are supported on this endpoint.',
        verified: false,
        wasteDetected: false,
      }));
      return;
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }

    if ((!body || typeof body !== 'object') && typeof req.on === 'function') {
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        req.on('data', (c: any) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        req.on('end', resolve);
        req.on('error', reject);
      });
      const raw = Buffer.concat(chunks).toString('utf-8');
      try {
        body = JSON.parse(raw || '{}');
      } catch {}
    }

    const { image, context = 'CITIZEN_BEFORE', issueType } = body || {};

    if (!image || typeof image !== 'string') {
      res.statusCode = 400;
      res.end(JSON.stringify({
        error: 'Image data payload is required.',
        message: 'Image data payload is required.',
        verified: false,
        wasteDetected: false,
      }));
      return;
    }

    const result = await verifyImageWithLevel3AI(image, context, issueType);
    res.statusCode = 200;
    res.end(JSON.stringify(result));
  } catch (err: any) {
    console.error('[Vercel AI Verification Error]:', err?.stack || err);
    if (typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'application/json');
    }
    res.statusCode = 500;
    res.end(JSON.stringify({
      error: 'AI Verification engine error',
      message: err?.message || 'AI verification failed',
      details: String(err?.message || err),
      verified: false,
      wasteDetected: false,
    }));
  }
}
