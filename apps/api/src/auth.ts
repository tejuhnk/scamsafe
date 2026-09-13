import { Router, type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from './models/User.js';

export const authRouter = Router();

const jwtSecret = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET env var is not set');
  return s;
};

const SALT_ROUNDS = 12;
const TOKEN_TTL = '7d';

// ── Validation schemas ────────────────────────────────────────────────────────
const registerSchema = z.object({
  email:       z.string().trim().email('Invalid email address.'),
  password:    z.string().min(8, 'Password must be at least 8 characters.').max(128),
  displayName: z.string().trim().min(1, 'Display name is required.').max(64),
});

const loginSchema = z.object({
  email:    z.string().trim().email('Invalid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function signToken(userId: string, email: string, displayName: string) {
  return jwt.sign({ sub: userId, email, displayName }, jwtSecret(), { expiresIn: TOKEN_TTL });
}

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// ── POST /auth/register ───────────────────────────────────────────────────────
authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' });
      return;
    }

    const { email, password, displayName } = parsed.data;

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ error: 'An account with that email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({ email, passwordHash, displayName });

    const token = signToken(String(user._id), user.email, user.displayName);
    res.status(201).json({ token, user });
  }),
);

// ── POST /auth/login ──────────────────────────────────────────────────────────
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' });
      return;
    }

    const { email, password } = parsed.data;

    const user = await User.findOne({ email }).select('+passwordHash');
    // Constant-time compare even on missing user to avoid user enumeration
    const hash = user?.passwordHash ?? '$2a$12$invalidhashpadding000000000000000000000000000000000000000';
    const match = await bcrypt.compare(password, hash);

    if (!user || !match) {
      res.status(401).json({ error: 'Incorrect email or password.' });
      return;
    }

    const token = signToken(String(user._id), user.email, user.displayName);
    res.json({ token, user });
  }),
);

// ── GET /auth/me ──────────────────────────────────────────────────────────────
authRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const token = authHeader.slice(7);
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, jwtSecret()) as jwt.JwtPayload;
    } catch {
      res.status(401).json({ error: 'Invalid or expired token.' });
      return;
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      res.status(401).json({ error: 'User not found.' });
      return;
    }

    res.json({ user });
  }),
);
