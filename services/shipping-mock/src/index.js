// Local sandbox implementation of the ShipStream Shipments API.
// Behaviour mirrors https://docs.shipstream.example/api as of v2.3.
const fs = require('fs');
const path = require('path');
const express = require('express');

const PORT = Number(process.env.PORT || 8004);
const API_KEY = process.env.SHIPSTREAM_API_KEY;
const SEED_DIR = process.env.SEED_DATA_DIR || '/seed';
const RATE_LIMIT = 30;
const WINDOW_MS = 60 * 1000;

const shipments = JSON.parse(
  fs.readFileSync(path.join(SEED_DIR, 'shipments.json'), 'utf8')
).sort((a, b) => (a.id < b.id ? -1 : 1));

const app = express();
const startedAt = Date.now();
let windowIndex = 0;
let windowCount = 0;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'shipstream-sandbox' });
});

app.use((req, res, next) => {
  if (req.get('x-shipstream-key') === API_KEY) return next();

  res.status(401).json({
    error: {
      type: 'authentication_error',
      message: 'Invalid or missing API key. Pass it in the X-ShipStream-Key header.',
      doc_url: 'https://docs.shipstream.example/errors#authentication_error',
    },
  });
});

app.use((req, res, next) => {
  const elapsed = Date.now() - startedAt;
  const current = Math.floor(elapsed / WINDOW_MS);

  if (current !== windowIndex) {
    windowIndex = current;
    windowCount = 0;
  }

  windowCount += 1;

  if (windowCount > RATE_LIMIT) {
    const resetsIn = Math.ceil((WINDOW_MS - (elapsed % WINDOW_MS)) / 1000);
    res.set('Retry-After', String(resetsIn));
    res.set('X-RateLimit-Limit', String(RATE_LIMIT));
    res.set('X-RateLimit-Remaining', '0');
    return res.status(429).json({
      error: {
        type: 'rate_limit_error',
        message: `Rate limit of ${RATE_LIMIT} requests per minute exceeded.`,
        doc_url: 'https://docs.shipstream.example/errors#rate_limit_error',
      },
    });
  }

  res.set('X-RateLimit-Limit', String(RATE_LIMIT));
  res.set('X-RateLimit-Remaining', String(RATE_LIMIT - windowCount));
  next();
});

app.get('/api/shipments', (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const cursor = req.query.cursor ? String(req.query.cursor) : null;

  let matching = shipments;
  if (req.query.order_id) {
    matching = matching.filter((s) => s.order_id === String(req.query.order_id));
  }

  const start = cursor ? matching.findIndex((s) => s.id > cursor) : 0;
  const from = start === -1 ? matching.length : start;
  const page = matching.slice(from, from + limit);
  const hasMore = from + limit < matching.length;

  const links = [];
  if (hasMore) {
    const next = new URL(`http://${req.get('host')}${req.path}`);
    if (req.query.order_id) next.searchParams.set('order_id', String(req.query.order_id));
    next.searchParams.set('limit', String(limit));
    next.searchParams.set('cursor', page[page.length - 1].id);
    links.push(`<${next.toString()}>; rel="next"`);
  }
  const first = new URL(`http://${req.get('host')}${req.path}`);
  if (req.query.order_id) first.searchParams.set('order_id', String(req.query.order_id));
  first.searchParams.set('limit', String(limit));
  links.push(`<${first.toString()}>; rel="first"`);

  res.set('Link', links.join(', '));
  res.json({ shipments: page });
});

app.get('/api/shipments/:id', (req, res) => {
  const shipment = shipments.find((s) => s.id === req.params.id);

  if (!shipment) {
    return res.status(404).json({
      error: {
        type: 'not_found',
        message: `No shipment with id ${req.params.id}.`,
        doc_url: 'https://docs.shipstream.example/errors#not_found',
      },
    });
  }

  res.json({ shipment });
});

app.listen(PORT, () => console.log(`shipstream sandbox listening on ${PORT}`));
