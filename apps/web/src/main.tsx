import { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, CheckCircle2, ShieldCheck, Sparkles, X, LogOut, User as UserIcon } from 'lucide-react';
import './styles.css';

// ── Types ─────────────────────────────────────────────────────────────────────
type Result = {
  classification: string; riskScore: number; confidence: number;
  language: string[]; reasons: string[]; recommendations: string[];
  suspiciousLinks: string[]; scamIntent: string[]; modelVersion: string;
};

type AuthUser = { _id: string; email: string; displayName: string };

// ── API base URL (empty string = same origin in dev, full URL in production) ──
const API_BASE = (import.meta.env.VITE_API_URL as string) ?? '';

// ── Persistent auth helpers ───────────────────────────────────────────────────
const TOKEN_KEY = 'scamsafe_token';
function saveToken(t: string) { localStorage.setItem(TOKEN_KEY, t); }
function loadToken(): string | null { return localStorage.getItem(TOKEN_KEY); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

async function apiFetch(path: string, body: object, token?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers['authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong.');
  return data as { token: string; user: AuthUser };
}

// ── Auth Modal ────────────────────────────────────────────────────────────────
function AuthModal({ onClose, onAuth }: { onClose: () => void; onAuth: (user: AuthUser, token: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const firstInput = useRef<HTMLInputElement>(null);

  useEffect(() => { firstInput.current?.focus(); }, [mode]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register';
      const body = mode === 'login'
        ? { email, password }
        : { email, password, displayName };
      const data = await apiFetch(path, body);
      saveToken(data.token);
      onAuth(data.user, data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode(m => m === 'login' ? 'register' : 'login');
    setError('');
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="modal-close" aria-label="Close" onClick={onClose}><X size={18} /></button>
        <h2 id="modal-title">{mode === 'login' ? 'Sign in to ScamSafe' : 'Create an account'}</h2>

        <form onSubmit={submit} noValidate>
          {mode === 'register' && (
            <div className="field">
              <label htmlFor="displayName">Name</label>
              <input
                id="displayName" type="text" autoComplete="name" required
                placeholder="Your name" value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                ref={mode === 'register' ? firstInput : undefined}
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email" type="email" autoComplete="email" required
              placeholder="you@example.com" value={email}
              onChange={e => setEmail(e.target.value)}
              ref={mode === 'login' ? firstInput : undefined}
            />
          </div>

          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="error" role="alert">{error}</p>}

          <button type="submit" className="primary modal-submit" disabled={loading}>
            {loading ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : (mode === 'login' ? 'Sign in' : 'Create account')}
          </button>
        </form>

        <p className="modal-switch">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button className="link-btn" onClick={switchMode}>
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
const demo = 'URGENT! tumcha bank account aaj block honar aahe. KYC update kara immediately. Link var click kara http://bit.ly/kyc';

function App() {
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auth state
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Restore session on mount
  useEffect(() => {
    const stored = loadToken();
    if (!stored) return;
    fetch(`${API_BASE}/auth/me`, { headers: { authorization: `Bearer ${stored}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: { user: AuthUser }) => { setUser(data.user); setToken(stored); })
      .catch(() => clearToken());
  }, []);

  function handleAuth(u: AuthUser, t: string) {
    setUser(u); setToken(t); setShowModal(false);
  }

  function signOut() {
    clearToken(); setUser(null); setToken(null);
  }

  async function analyze() {
    setError(''); setResult(null);
    if (!message.trim()) { setError('Paste a message to analyze.'); return; }
    setLoading(true);
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (token) headers['authorization'] = `Bearer ${token}`;
      const response = await fetch(`${API_BASE}/api/v1/analyze`, {
        method: 'POST', headers, body: JSON.stringify({ message }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setResult(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to analyze message.');
    } finally {
      setLoading(false);
    }
  }

  const isScam = result?.classification === 'SCAM';

  return (
    <>
      {/* ── Header ── */}
      <header>
        <a className="brand" href="/"><ShieldCheck /> ScamSafe</a>
        <nav>
          <a href="#how">How it works</a>
          <a href="#privacy">Privacy</a>
          {user ? (
            <div className="user-menu">
              <span className="user-name"><UserIcon size={14} /> {user.displayName}</span>
              <button className="ghost sign-out-btn" onClick={signOut} title="Sign out">
                <LogOut size={14} /> Sign out
              </button>
            </div>
          ) : (
            <button className="ghost" onClick={() => setShowModal(true)}>Sign in</button>
          )}
        </nav>
      </header>

      {/* ── Auth Modal ── */}
      {showModal && <AuthModal onClose={() => setShowModal(false)} onAuth={handleAuth} />}

      {/* ── Main content ── */}
      <main>
        <section className="hero">
          <div className="eyebrow"><Sparkles size={15} /> Code-mixed scam analysis</div>
          <h1>Understand suspicious SMS before you respond.</h1>
          <p>Checks English, Hinglish, and Romanized regional-language messages with explainable AI and context-aware signals.</p>
        </section>

        <section className="analyzer" aria-labelledby="analyze-title">
          <div className="section-head">
            <div>
              <h2 id="analyze-title">Analyze a message</h2>
              <p>Your message is sent only for this analysis. It is not saved by this demo.</p>
            </div>
            <button className="demo" onClick={() => setMessage(demo)}>Use example</button>
          </div>

          <label htmlFor="message">Paste an SMS</label>
          <textarea
            id="message" value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Paste a message in English, Hinglish, or Marathi-English…"
            maxLength={5000}
          />
          <div className="action-row">
            <small>{message.length}/5000</small>
            <button className="primary" onClick={analyze} disabled={loading}>
              {loading ? 'Analyzing…' : 'Analyze message'}
            </button>
          </div>
          {error && <p className="error" role="alert">{error}</p>}

          {result && (
            <article className={`result ${result.classification.toLowerCase()}`}>
              <div className="verdict">
                <div className="icon">{isScam ? <AlertTriangle /> : <CheckCircle2 />}</div>
                <div>
                  <span className="label">Assessment</span>
                  <h2>{result.classification}</h2>
                  <p>{result.riskScore}/100 risk score · {Math.round(result.confidence * 100)}% model confidence</p>
                </div>
              </div>
              <div className="reasons">
                <h3>Why this was flagged</h3>
                {result.reasons.length
                  ? <ul>{result.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
                  : <p>No strong scam patterns were found. Still verify unexpected requests independently.</p>
                }
                <h3>Recommended next step</h3>
                {result.recommendations.map(item => <p key={item}>{item}</p>)}
              </div>
              <footer>Languages: {result.language.join(', ')} · Model: {result.modelVersion}</footer>
            </article>
          )}
        </section>

        <section id="how" className="three">
          <div><span>01</span><h3>Normalize</h3><p>Recognizes common Romanized spellings such as "tumcha", "paise", and "jaldi".</p></div>
          <div><span>02</span><h3>Evaluate context</h3><p>Combines a lightweight ML baseline with phrase, intent, link, and phone signals.</p></div>
          <div><span>03</span><h3>Explain</h3><p>Shows the signals that influenced the assessment without claiming certainty.</p></div>
        </section>
      </main>

      <footer className="site-footer" id="privacy">
        ScamSafe provides a risk assessment, not a guarantee. Verify through official channels before acting.
      </footer>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
