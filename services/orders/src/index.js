const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('./auth');
const { seed } = require('./seed');

const prisma = new PrismaClient();
const app = express();
const PORT = Number(process.env.PORT || 8001);

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'orders' });
});

app.use(requireAuth);

function shippingAddress(order) {
  return {
    line1: order.shippingLine1,
    city: order.shippingCity,
    region: order.shippingRegion,
    postalCode: order.shippingPostalCode,
    country: order.shippingCountry,
  };
}

function toV1(order) {
  return {
    id: order.id,
    customerRef: order.customerRef,
    status: order.status,
    shippingAddress: shippingAddress(order),
    placedAt: order.placedAt,
    totalCents: order.totalCents,
  };
}

function toItem(item) {
  return {
    sku: item.sku,
    productName: item.productName,
    unitPriceCents: item.unitPriceCents,
    quantity: item.quantity,
    lineTotalCents: item.unitPriceCents * item.quantity,
  };
}

function notFound(res, id) {
  return res.status(404).json({ error: 'not_found', message: `no order with id ${id}` });
}

app.get('/v1/orders', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const where = req.query.customerRef ? { customerRef: String(req.query.customerRef) } : {};

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { id: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  res.json({ data: orders.map(toV1), page, total });
});

app.get('/v1/orders/:id', async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return notFound(res, req.params.id);
  res.json(toV1(order));
});

app.get('/v1/orders/:id/items', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: { orderBy: { id: 'asc' } } },
  });
  if (!order) return notFound(res, req.params.id);
  res.json({ orderId: order.id, data: order.items.map(toItem) });
});

app.post('/v1/orders', async (req, res) => {
  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : [];

  if (!body.customerRef || items.length === 0) {
    return res.status(400).json({
      error: 'bad_request',
      message: 'customerRef and at least one item are required',
    });
  }

  const last = await prisma.order.findFirst({ orderBy: { id: 'desc' } });
  const nextNumber = last ? Number(last.id.replace('ord_', '')) + 1 : 1001;
  const address = body.shippingAddress || {};

  const order = await prisma.order.create({
    data: {
      id: `ord_${nextNumber}`,
      customerRef: body.customerRef,
      status: 'placed',
      shippingStatus: null,
      shippingLine1: address.line1 || '',
      shippingCity: address.city || '',
      shippingRegion: address.region || '',
      shippingPostalCode: address.postalCode || '',
      shippingCountry: address.country || 'US',
      placedAt: '2025-06-01T00:00:00Z',
      totalCents: items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0),
      items: {
        create: items.map((i) => ({
          sku: i.sku,
          productName: i.productName,
          unitPriceCents: i.unitPriceCents,
          quantity: i.quantity,
        })),
      },
    },
  });

  res.status(201).json(toV1(order));
});

seed(prisma)
  .then(() => {
    app.listen(PORT, () => console.log(`orders listening on ${PORT}`));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
