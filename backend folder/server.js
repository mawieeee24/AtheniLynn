require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);

// ── CORS: allow Netlify frontend + local dev ──────────────────────────────────
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,         // e.g. https://your-site.netlify.app
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
].filter(Boolean);

const io = socketIo(server, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] }
});

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-admin-token');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname)));  // serve index.html, style.css, script.js from root

// ── Multer ────────────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || 50) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  }
});

// ── Admin password ────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
if (!process.env.ADMIN_PASSWORD) {
  console.warn('⚠️  ADMIN_PASSWORD not set in .env — using insecure default "admin123"!');
}

// ── Neon PostgreSQL ───────────────────────────────────────────────────────────
let pool = null;
let useDatabase = false;

async function initDatabase() {
  if (!process.env.DATABASE_URL) {
    console.log('⚠️  DATABASE_URL not set — falling back to local listings.json');
    return;
  }
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }  // Neon requires SSL
    });
    await pool.query('SELECT NOW()');
    console.log('✅ Connected to Neon PostgreSQL');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS listings (
        id          TEXT PRIMARY KEY,
        data        JSONB NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✅ Listings table ready');
    useDatabase = true;
  } catch (err) {
    console.error('❌ DB connection failed:', err.message);
    console.log('   Falling back to local JSON storage');
  }
}

// ── Local JSON fallback ───────────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, 'listings.json');

function loadListingsLocal() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) { console.error('Local load error:', e); }
  return [];
}

function saveListingsLocal(listings) {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(listings, null, 2), 'utf8'); }
  catch (e) { console.error('Local save error:', e); }
}

// ── DB operations ─────────────────────────────────────────────────────────────
async function getAllListings() {
  if (!useDatabase) return loadListingsLocal();
  try {
    const res = await pool.query('SELECT data FROM listings ORDER BY created_at DESC');
    return res.rows.map(r => r.data);
  } catch (err) {
    console.error('DB read error:', err.message);
    return loadListingsLocal();
  }
}

async function upsertListing(listing) {
  if (!useDatabase) {
    const all = loadListingsLocal();
    const idx = all.findIndex(l => l.id === listing.id);
    if (idx === -1) all.unshift(listing); else all[idx] = listing;
    saveListingsLocal(all);
    return;
  }
  try {
    await pool.query(
      `INSERT INTO listings (id, data, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET data = $2::jsonb, updated_at = NOW()`,
      [listing.id, JSON.stringify(listing)]
    );
  } catch (err) {
    console.error('DB upsert error:', err.message);
  }
}

async function removeListing(id) {
  if (!useDatabase) {
    saveListingsLocal(loadListingsLocal().filter(l => l.id !== id));
    return;
  }
  try {
    await pool.query('DELETE FROM listings WHERE id = $1', [id]);
  } catch (err) {
    console.error('DB delete error:', err.message);
  }
}

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token && token === ADMIN_PASSWORD) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password && password === ADMIN_PASSWORD) return res.json({ ok: true });
  res.status(401).json({ error: 'Incorrect password' });
});

app.get('/api/listings', async (req, res) => {
  res.json(await getAllListings());
});

app.post('/api/listings', requireAdmin, async (req, res) => {
  const listing = req.body;
  if (!listing || !listing.id) return res.status(400).json({ error: 'Invalid listing' });
  await upsertListing(listing);
  io.emit('update-listings', { action: 'added', listing, timestamp: new Date() });
  res.json({ ok: true, listing });
});

app.put('/api/listings/:id', requireAdmin, async (req, res) => {
  const listing = { ...req.body, id: req.params.id };
  await upsertListing(listing);
  io.emit('update-listings', { action: 'updated', listing, timestamp: new Date() });
  res.json({ ok: true, listing });
});

app.delete('/api/listings/:id', requireAdmin, async (req, res) => {
  await removeListing(req.params.id);
  io.emit('update-listings', { action: 'deleted', listingId: req.params.id, timestamp: new Date() });
  res.json({ ok: true });
});

app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  const token = req.headers['x-admin-token'];
  if (!token || token !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  res.json({ success: true, url, filename: req.file.originalname });
});

// ── WebSocket ─────────────────────────────────────────────────────────────────
const clients = new Set();

io.on('connection', async (socket) => {
  clients.add(socket.id);
  io.emit('users-count', clients.size);
  socket.emit('sync-all-listings', await getAllListings());

  socket.on('listing-added', async (l) => {
    if (!l || !l.id) return;
    await upsertListing(l);
    io.emit('update-listings', { action: 'added', listing: l, timestamp: new Date() });
  });

  socket.on('listing-updated', async (l) => {
    await upsertListing(l);
    io.emit('update-listings', { action: 'updated', listing: l, timestamp: new Date() });
  });

  socket.on('listing-deleted', async (id) => {
    await removeListing(id);
    io.emit('update-listings', { action: 'deleted', listingId: id, timestamp: new Date() });
  });

  socket.on('sync-listings', async (clientListings) => {
    const existing = await getAllListings();
    const existingIds = new Set(existing.map(l => l.id));
    const toAdd = (clientListings || []).filter(l => l?.id && !existingIds.has(l.id));
    for (const l of toAdd) await upsertListing(l);
    io.emit('sync-all-listings', await getAllListings());
  });

  socket.on('disconnect', () => {
    clients.delete(socket.id);
    io.emit('users-count', clients.size);
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
initDatabase().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server → http://localhost:${PORT}`);
    console.log(`🗄️  DB: ${useDatabase ? 'Neon PostgreSQL ✅' : 'Local JSON'}`);
    console.log(`🔒 Password: ${ADMIN_PASSWORD === 'admin123' ? '⚠️  DEFAULT — change this!' : '✅ Custom'}`);
  });
});
