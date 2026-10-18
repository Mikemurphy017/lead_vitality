// Lead Vitality™ server: serves the site, stores form submissions and powers the admin page.
// No dependencies; requires Node 20+.

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'mike@bluestonepartnersllc.com').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_HOURS = 12;
const SESSION_COOKIE = 'lv_admin';

const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'];
const SOURCES = ['territory-check', 'exit-intent-15-free-leads'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

// ---------- Storage ----------
// Leads are kept in memory and written to a JSON file on every change.
// Writes are serialized and atomic (temp file + rename).
let leads = [];
let writeChain = Promise.resolve();

function loadLeads() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
    if (!Array.isArray(leads)) leads = [];
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Could not read leads file:', err.message);
    leads = [];
  }
  console.log(`Loaded ${leads.length} leads from ${LEADS_FILE}`);
}

function saveLeads() {
  const snapshot = JSON.stringify(leads, null, 2);
  writeChain = writeChain.then(async () => {
    const tmp = `${LEADS_FILE}.${process.pid}.tmp`;
    await fsp.writeFile(tmp, snapshot);
    await fsp.rename(tmp, LEADS_FILE);
  }).catch((err) => console.error('Could not save leads:', err));
  return writeChain;
}

// ---------- Helpers ----------
function send(res, status, body, headers = {}) {
  const isString = typeof body === 'string' || Buffer.isBuffer(body);
  res.writeHead(status, {
    'Content-Type': isString ? 'text/plain; charset=utf-8' : 'application/json',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(isString ? body : JSON.stringify(body));
}

function readJson(req, limit = 20_000) {
  return new Promise((resolve, reject) => {
    if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) {
      reject(Object.assign(new Error('Expected JSON'), { status: 415 }));
      return;
    }
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function clean(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map((c) => {
    const i = c.indexOf('=');
    return i < 0 ? [c.trim(), ''] : [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1).trim())];
  }));
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Simple fixed-window rate limiter keyed by IP.
function rateLimiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now > entry.reset) {
      hits.set(key, { count: 1, reset: now + windowMs });
      if (hits.size > 10_000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
      return true;
    }
    entry.count += 1;
    return entry.count <= max;
  };
}
const leadLimit = rateLimiter(10, 60 * 60 * 1000);
const loginLimit = rateLimiter(8, 15 * 60 * 1000);

// ---------- Sessions (signed, stateless) ----------
function sign(data) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
}

function createSession(email) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + SESSION_HOURS * 3600e3 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp < Date.now() || data.email !== ADMIN_EMAIL) return null;
    return data;
  } catch {
    return null;
  }
}

function sessionCookie(req, value, maxAgeSeconds) {
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`;
}

// ---------- API handlers ----------
async function createLead(req, res) {
  if (!leadLimit(clientIp(req))) return send(res, 429, { error: 'Too many submissions. Please try again later.' });
  const body = await readJson(req);

  // Honeypot: real visitors never fill this hidden field.
  if (clean(body.website)) return send(res, 201, { ok: true });

  const lead = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    source: SOURCES.includes(body.source) ? body.source : 'other',
    status: 'new',
    notes: '',
    firstName: clean(body.first_name, 80),
    lastName: clean(body.last_name, 80),
    business: clean(body.business, 160),
    email: clean(body.email, 160).toLowerCase(),
    phone: clean(body.phone, 40),
    industry: clean(body.industry, 80),
    zip: clean(body.zip, 10),
    plan: clean(body.plan, 40),
    consent: body.consent === 'on' || body.consent === true,
    page: clean(body.page, 300),
    referrer: clean(body.referrer, 300),
    utm: Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
      .map((k) => [k, clean(body[k], 120)]).filter(([, v]) => v)),
    userAgent: clean(req.headers['user-agent'], 300),
  };

  const missing = ['firstName', 'email', 'phone', 'industry', 'zip'].filter((k) => !lead[k]);
  if (missing.length || !lead.consent) return send(res, 400, { error: 'Missing required fields.', missing });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) return send(res, 400, { error: 'Invalid email.' });

  leads.unshift(lead);
  await saveLeads();
  console.log(`New lead ${lead.id} (${lead.source}, ${lead.industry}, ${lead.zip})`);
  return send(res, 201, { ok: true });
}

async function login(req, res) {
  if (!loginLimit(clientIp(req))) return send(res, 429, { error: 'Too many attempts. Try again in 15 minutes.' });
  if (!ADMIN_PASSWORD) return send(res, 503, { error: 'Admin login is not configured. Set ADMIN_PASSWORD on the server.' });
  const body = await readJson(req, 2_000);
  const email = clean(body.email, 200).toLowerCase();
  const ok = safeEqual(email, ADMIN_EMAIL) & safeEqual(String(body.password || ''), ADMIN_PASSWORD);
  if (!ok) return send(res, 401, { error: 'Incorrect email or password.' });
  return send(res, 200, { email: ADMIN_EMAIL }, {
    'Set-Cookie': sessionCookie(req, createSession(ADMIN_EMAIL), SESSION_HOURS * 3600),
  });
}

function logout(req, res) {
  return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, '', 0) });
}

async function updateLead(req, res, id) {
  const lead = leads.find((l) => l.id === id);
  if (!lead) return send(res, 404, { error: 'Lead not found.' });
  const body = await readJson(req);
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return send(res, 400, { error: 'Invalid status.' });
    lead.status = body.status;
  }
  if (body.notes !== undefined) lead.notes = clean(body.notes, 5000);
  lead.updatedAt = new Date().toISOString();
  await saveLeads();
  return send(res, 200, lead);
}

async function deleteLead(req, res, id) {
  const index = leads.findIndex((l) => l.id === id);
  if (index < 0) return send(res, 404, { error: 'Lead not found.' });
  leads.splice(index, 1);
  await saveLeads();
  return send(res, 200, { ok: true });
}

function csvCell(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // keep spreadsheets from running cell formulas
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(req, res) {
  const cols = ['createdAt', 'source', 'status', 'firstName', 'lastName', 'business', 'email', 'phone',
    'industry', 'zip', 'plan', 'notes', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign'];
  const rows = leads.map((l) => cols.map((c) => csvCell(c.startsWith('utm_') ? l.utm?.[c] : l[c])).join(','));
  const stamp = new Date().toISOString().slice(0, 10);
  return send(res, 200, [cols.join(','), ...rows].join('\n'), {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="lead-vitality-leads-${stamp}.csv"`,
  });
}

// ---------- Static files ----------
async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/admin') {
    res.writeHead(301, { Location: '/admin/' });
    return res.end();
  }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Forbidden');

  try {
    const data = await fsp.readFile(file);
    const ext = path.extname(file);
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
    };
    if (rel.startsWith('/admin/')) {
      headers['X-Robots-Tag'] = 'noindex, nofollow';
      headers['X-Frame-Options'] = 'DENY';
      headers['Cache-Control'] = 'no-store';
    }
    res.writeHead(200, headers);
    return res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    return send(res, 404, 'Not found');
  }
}

// ---------- Router ----------
const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const method = req.method;

  try {
    if (pathname === '/healthz') return send(res, 200, 'ok');
    if (pathname === '/api/leads' && method === 'POST') return await createLead(req, res);
    if (pathname === '/api/admin/login' && method === 'POST') return await login(req, res);
    if (pathname === '/api/admin/logout' && method === 'POST') return logout(req, res);

    if (pathname.startsWith('/api/admin/')) {
      const session = readSession(req);
      if (!session) return send(res, 401, { error: 'Not signed in.' });
      res.setHeader('Cache-Control', 'no-store');

      if (pathname === '/api/admin/me' && method === 'GET') return send(res, 200, { email: session.email });
      if (pathname === '/api/admin/leads' && method === 'GET') return send(res, 200, { leads, statuses: STATUSES });
      if (pathname === '/api/admin/leads.csv' && method === 'GET') return exportCsv(req, res);
      const match = pathname.match(/^\/api\/admin\/leads\/([0-9a-f-]{36})$/);
      if (match && method === 'PATCH') return await updateLead(req, res, match[1]);
      if (match && method === 'DELETE') return await deleteLead(req, res, match[1]);
      return send(res, 404, { error: 'Not found.' });
    }

    if (pathname.startsWith('/api/')) return send(res, 404, { error: 'Not found.' });
    if (method === 'GET' || method === 'HEAD') return await serveStatic(req, res, pathname);
    return send(res, 405, 'Method not allowed');
  } catch (err) {
    if (err.status) return send(res, err.status, { error: err.message });
    console.error(err);
    return send(res, 500, { error: 'Server error.' });
  }
});

loadLeads();
if (!ADMIN_PASSWORD) console.warn('ADMIN_PASSWORD is not set: the admin page will refuse logins.');
if (!process.env.SESSION_SECRET) console.warn('SESSION_SECRET is not set: admin sessions reset on every restart.');
server.listen(PORT, () => console.log(`Lead Vitality listening on port ${PORT}`));
