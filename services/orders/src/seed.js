const fs = require('fs');
const path = require('path');

const SEED_DIR = process.env.SEED_DATA_DIR || '/seed';

async function seed(prisma) {
  const existing = await prisma.order.count();
  if (existing > 0) return;

  const orders = JSON.parse(
    fs.readFileSync(path.join(SEED_DIR, 'orders.json'), 'utf8')
  );

  for (const order of orders) {
    await prisma.order.create({
      data: {
        id: order.id,
        customerRef: order.customerRef,
        status: order.status,
        shippingLine1: order.shippingAddress.line1,
        shippingCity: order.shippingAddress.city,
        shippingRegion: order.shippingAddress.region,
        shippingPostalCode: order.shippingAddress.postalCode,
        shippingCountry: order.shippingAddress.country,
        placedAt: order.placedAt,
        totalCents: order.totalCents,
        items: {
          create: order.items.map((item) => ({
            sku: item.sku,
            productName: item.productName,
            unitPriceCents: item.unitPriceCents,
            quantity: item.quantity,
          })),
        },
      },
    });
  }

  console.log(`seeded ${orders.length} orders`);
}

module.exports = { seed };
