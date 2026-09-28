import { orderPaid, dispatch } from './events.mjs';
import { sendReceipt } from './receipt.mjs';
import { reserveStock, createShipment } from './fulfillment.mjs';

const order = {
  id: 'order-1042', email: 'sam@example.test', items: ['mug'],
  subtotal: 5000, shipping: 500, discount: 1000,
};
const retryJobs = new Map();
const retries = { enqueue: async job => retryJobs.set(job.key, job) };

const outcomes = await dispatch(orderPaid(order), {
  inventory: order => reserveStock(order,
    { reserve: async () => true }, { enqueue: async () => {} }),
  receipts: order => sendReceipt(order,
    { send: async () => { throw new Error('Email temporarily unavailable'); } }, retries),
  shipping: order => createShipment(order,
    { book: async () => 'label-1042' }, retries),
});

console.log(JSON.stringify({ outcomes, retryJobs: [...retryJobs.values()] }, null, 2));
