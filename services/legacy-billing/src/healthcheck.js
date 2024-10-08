// Used by the compose healthcheck: there is no HTTP endpoint to curl.
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PORT = Number(process.env.PORT || 50051);
const definition = protoLoader.loadSync(
  path.join(__dirname, '..', 'proto', 'billing.proto'),
  { keepCase: true, longs: String, defaults: true }
);
const billing = grpc.loadPackageDefinition(definition).meridian.billing.v1;

const client = new billing.BillingService(
  `127.0.0.1:${PORT}`,
  grpc.credentials.createInsecure()
);

client.GetInvoice({ invoice_id: 'inv_9001' }, (err, invoice) => {
  if (err || !invoice) {
    console.error(err);
    process.exit(1);
  }
  console.log(invoice.invoice_id);
  process.exit(0);
});
