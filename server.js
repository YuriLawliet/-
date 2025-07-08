const fs = require('fs');
const path = require('path');
const express = require('express');
const { verifyIdToken } = require('apple-signin-auth');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(express.static(path.join(__dirname, 'public')));
app.enable('trust proxy');

app.use((req, res, next) => {
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  if (proto === 'https') {
    return next();
  }
  const host = req.headers.host;
  res.redirect('https://' + host + req.originalUrl);
});

app.use(express.json());

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

async function verifyToken(idToken, userId) {
  try {
    const payload = await verifyIdToken(idToken, {
      audience: 'com.example.web',
      ignoreExpiration: false,
    });
    return payload.sub === userId;
  } catch (err) {
    return false;
  }
}

async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const userId = req.params.userId;
  if (!token || !userId) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (await verifyToken(token, userId)) {
    return next();
  }
  res.status(403).json({ error: 'forbidden' });
}

app.get('/data/:userId', authMiddleware, (req, res) => {
  const data = readData();
  const userData = data[req.params.userId] || { totals: {}, records: [] };
  res.json(userData);
});

app.post('/data/:userId', authMiddleware, (req, res) => {
  const data = readData();
  const body = req.body || {};
  if (Array.isArray(body.records) && body.records.length > 100) {
    body.records = body.records.slice(-100);
  }
  data[req.params.userId] = {
    totals: body.totals || {},
    records: body.records || []
  };
  writeData(data);
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
