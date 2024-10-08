const fs = require('fs');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PORT = Number(process.env.PORT || 50051);
const SEED_DIR = process.env.SEED_DATA_DIR || '/seed';
const PROTO_PATH = path.join(__dirname, '..', 'proto', 'billing.proto');

const definition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  defaults: true,
});
const billing = grpc.loadPackageDefinition(definition).meridian.billing.v1;

const invoices = JSON.parse(
  fs.readFileSync(path.join(SEED_DIR, 'invoices.json'), 'utf8')
);

function getInvoice(call, callback) {
  const invoice = invoices.find((i) => i.invoice_id === call.request.invoice_id);

  if (!invoice) {
    return callback({
      code: grpc.status.NOT_FOUND,
      details: `no invoice ${call.request.invoice_id}`,
    });
  }

  callback(null, invoice);
}

function listInvoicesForCustomer(call, callback) {
  callback(null, {
    invoices: invoices.filter((i) => i.customer_id === call.request.customer_id),
  });
}

const server = new grpc.Server();
server.addService(billing.BillingService.service, {
  GetInvoice: getInvoice,
  ListInvoicesForCustomer: listInvoicesForCustomer,
});

server.bindAsync(
  `0.0.0.0:${PORT}`,
  grpc.ServerCredentials.createInsecure(),
  (err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`legacy-billing listening on ${PORT}`);
  }
);
