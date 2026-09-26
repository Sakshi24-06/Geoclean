import type { IncomingMessage, ServerResponse } from 'http';
import { verifyImageWithLevel3AI } from '../src/lib/ai/backendModelEngine';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
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
      body = JSON.parse(raw || '{}');
    }

    const { image, context = 'CITIZEN_BEFORE', issueType } = body || {};

    if (!image) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Image data payload is required.' }));
      return;
    }

    const result = await verifyImageWithLevel3AI(image, context, issueType);
    res.statusCode = 200;
    res.end(JSON.stringify(result));
  } catch (err: any) {
    console.error('[Vercel AI Verification Error]:', err?.stack || err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'AI Verification engine error', details: String(err?.message || err) }));
  }
}
