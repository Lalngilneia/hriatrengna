require('dotenv').config();
const crypto = require('crypto');
const express   = require('express');
const helmet    = require('helmet');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes      = require('./routes/auth.routes');
const albumRoutes     = require('./routes/album.routes');
const mediaRoutes     = require('./routes/media.routes');
const paymentRoutes   = require('./routes/payment.routes');
const publicRoutes    = require('./routes/public.routes');
const adminRoutes     = require('./routes/admin.routes');
const affiliateRoutes = require('./routes/affiliate.routes');
const chatRoutes      = require('./routes/chat.routes');
const webhookRoutes   = require('./routes/webhook.routes');
const subscriptionRoutes = require('./routes/subscription.routes');

const app = express();

// ── TRUST PROXY ───────────────────────────────────────────────
// MUST be set before rate limiters — rate-limit and express use req.ip
// which reads X-Forwarded-For only when trust proxy is enabled.
// Without this, all users share the same IP and rate limits fire immediately.
app.set('trust proxy', 1);

// ── REQUEST ID FOR TRACING ───────────────────────────────────────
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
});

// ── SECURITY HEADERS ─────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", 'https://checkout.razorpay.com', 'https://cdn.razorpay.com', 'https://cdn.jsdelivr.net'],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:      ["'self'", 'data:', 'https:'],
      connectSrc:  ["'self'", 'https://api.razorpay.com'],
      frameSrc:    ['https://api.razorpay.com'],
      objectSrc:   ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // needed for Razorpay iframe
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

app.disable('x-powered-by');

// ── CORS ─────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // server-to-server / health checks
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(Object.assign(new Error('Not allowed by CORS'), { status: 403 }));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-studio-id'],
}));

// ── BODY PARSING ─────────────────────────────────────────────
// CRITICAL: Razorpay webhook needs raw bytes for HMAC verification.
// This MUST be registered before express.json() or express.json() will
// consume the body stream first, making raw body always empty and
// causing webhook signature verification to always fail.
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use('/webhooks/razorpay', express.raw({ type: 'application/json' }));
app.use('/webhooks/resend', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── RATE LIMITING ─────────────────────────────────────────────
const makeLimit = (max, windowMs = 15 * 60 * 1000, msg = 'Too many requests.') =>
  rateLimit({
    windowMs, max,
    standardHeaders: true, legacyHeaders: false,
    message: { error: msg },
  });

// General
app.use('/api/', makeLimit(100));

// Demo registration — 3 per hour per IP (prevent abuse)
app.use('/api/auth/demo', makeLimit(3, 60 * 60 * 1000, 'Too many demo accounts created. Try again in 1 hour.'));

// User auth — 10 per 15 min, skip successful (good logins don't count)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
});

// Admin login — stricter: 5 per 15 min
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5,
  standardHeaders: true, legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many admin login attempts. Try again in 15 minutes.' },
});

// Public album views — prevent view-count bombing
app.use('/api/public/', makeLimit(60, 60 * 1000, 'Too many requests.'));

// Album password verify ONLY — strict brute-force protection (5 attempts per 15 min per IP)
// NOTE: Only targets the password POST endpoint, not normal album GET views
app.use('/api/public/album/:slug/verify', makeLimit(5, 15 * 60 * 1000, 'Too many password attempts. Try again in 15 minutes.'));

// Auth routes
app.use('/api/auth/login',               authLimiter);
app.use('/api/auth/register',            authLimiter);
app.use('/api/auth/forgot-password',     authLimiter);
app.use('/api/auth/resend-verification', authLimiter);

// Affiliate auth — same limits as regular auth
app.use('/api/affiliates/auth/login',                authLimiter);
app.use('/api/affiliates/auth/register',             authLimiter);
app.use('/api/affiliates/auth/forgot-password',      authLimiter);
app.use('/api/affiliates/auth/resend-verification',  authLimiter);

// CRITICAL FIX: Admin login was missing rate limiting
app.use('/api/admin/auth/login',         adminLoginLimiter);

// ── ROUTES ────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/albums',     albumRoutes);
app.use('/api/media',      mediaRoutes);
app.use('/api/payments',   paymentRoutes);
app.use('/api/public',     publicRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/affiliates', affiliateRoutes);
app.use('/api/push',    require('./routes/push.routes'));    // User push subscriptions
app.use('/api/chat',       makeLimit(30, 60 * 1000, 'Too many messages. Please wait a moment.'), chatRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
// Studio routes (photographer dashboard + public claim/invite)
// Claim and invite endpoints have their own rate limits
app.use('/api/studio/claim',         makeLimit(10, 60 * 60 * 1000, 'Too many claim attempts.'));
app.use('/api/studio/studio-invite', makeLimit(20, 60 * 60 * 1000, 'Too many invite attempts.'));
app.use('/api/studio',               require('./routes/studio.routes'));
app.use('/webhooks', webhookRoutes);

// ── HEALTH CHECK ─────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString(), requestId: req.id }));

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));

// ── GLOBAL ERROR HANDLER ─────────────────────────────────────
app.use((err, req, res, _next) => {
  // Normalise non-Error objects (e.g. Razorpay throws plain objects)
  const message = err.message || err?.error?.description || JSON.stringify(err);
  const missingSupportSchema =
    err?.code === '42P01' &&
    /relation "(support_inbox|support_messages|support_replies|resend_webhook_events)"/i.test(message);
  console.error(`[ERROR] [${req.id}] ${req.method} ${req.path}:`, message);
  const status  = err.status || err.statusCode || (missingSupportSchema ? 503 : 500);
  const clientMsg = missingSupportSchema
    ? 'Support inbox is not initialized. Run the latest database migrations.'
    : (process.env.NODE_ENV === 'production' && status === 500)
    ? 'An unexpected error occurred.'
    : message;
  res.status(status).json({ error: clientMsg, requestId: req.id });
});

// Start cron jobs (anniversary reminders, expiry warnings)
if (process.env.NODE_ENV !== 'test') {
  const { startCronJobs } = require('./services/cron.service');
  startCronJobs();
}

module.exports = app;
