import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { z } from 'zod';
import { score, type MlResult } from './risk.js';
import { authRouter } from './auth.js';

const app = express();
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(s => s.trim())
    : true,
  credentials: true,
}));
app.use(express.json({ limit: '20kb' }));

// ── Auth routes ───────────────────────────────────────────────────────────────
app.use('/auth', authRouter);

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ status: 'ok', service: 'api', db: dbState });
});

// ── Analyze ───────────────────────────────────────────────────────────────────
const input = z.object({ message: z.string().trim().min(1, 'Paste a message to analyze.').max(5000) });
const mlUrl = process.env.ML_SERVICE_URL ?? 'http://localhost:8000';

app.post('/api/v1/analyze', async (req, res, next) => {
  try {
    const { message } = input.parse(req.body);
    const response = await fetch(`${mlUrl}/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new Error('Detection service unavailable');
    const result = await response.json() as MlResult;
    const verdict = score(result);
    res.json({
      ...verdict,
      language: result.language,
      languageCombination: result.languageCombination,
      transliteratedWords: result.normalizedMessage,
      scamIntent: result.signals.map(s => s.category),
      suspiciousPhrases: result.signals,
      suspiciousLinks: result.urls,
      suspiciousPhoneNumbers: result.phones,
      recommendations: verdict.classification === 'SCAM'
        ? ['Do not click links or share OTPs.', 'Verify through the organization\'s official app or number.']
        : ['Check the sender independently before responding.'],
      modelVersion: result.modelVersion,
      analysisId: crypto.randomUUID(),
    });
  } catch (error) { next(error); }
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: error.issues[0]?.message ?? 'Invalid input.' });
    return;
  }
  const isAuthRoute = req.path.startsWith('/auth');
  const message = isAuthRoute ? 'Something went wrong. Please try again.' : 'Unable to analyze this message.';
  console.error('Unhandled error:', error);
  res.status(503).json({ error: message });
});

// ── MongoDB + server start ────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 4000);
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/scamsafe';

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`API listening on :${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err.message);
    // Still start the server so /api/v1/analyze works; auth routes will fail gracefully
    app.listen(PORT, () => console.log(`API listening on :${PORT} (no DB)`));
  });
