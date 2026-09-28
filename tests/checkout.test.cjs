const { test } = require("node:test");
const assert = require("node:assert/strict");

test("the showcase starts every consumer before waiting and isolates a rejected call", async () => {
  const { orderPaid, dispatch } =
    await import("../examples/checkout/source/events.mjs");
  const calls = [],
    order = { id: "order-1" };
  let release;
  const pending = dispatch(orderPaid(order), {
    inventory: async (value) => {
      calls.push(["inventory", value]);
      await new Promise((resolve) => {
        release = resolve;
      });
      return "reserved";
    },
    receipts: async (value) => {
      calls.push(["receipts", value]);
      throw new Error("mail offline");
    },
    shipping: async (value) => {
      calls.push(["shipping", value]);
      return "booked";
    },
  });
  assert.deepEqual(
    calls.map(([name]) => name),
    ["inventory", "receipts", "shipping"],
  );
  assert(calls.every(([, value]) => value === order));
  release();
  const outcomes = await pending;
  assert.deepEqual(
    outcomes.map((result) => result.status),
    ["fulfilled", "rejected", "fulfilled"],
  );
  assert.equal(outcomes[2].value, "booked");
});

test("the receipt totals cents correctly and queues the unchanged payload after failure", async () => {
  const { receiptFor, sendReceipt } =
    await import("../examples/checkout/source/receipt.mjs");
  const order = {
      id: "order-1",
      email: "sam@example.test",
      subtotal: 5000,
      shipping: 500,
      discount: 1000,
    },
    jobs = [];
  const message = receiptFor(order);
  assert.equal(message.text, "Your total is $45.00.");
  assert.equal(message.to, order.email);
  let sent;
  const result = await sendReceipt(
    order,
    {
      send: async (value) => {
        sent = value;
        throw new Error("offline");
      },
    },
    { enqueue: async (job) => jobs.push(job) },
  );
  assert.equal(result.status, "queued");
  assert.equal(jobs[0].message, sent);
  assert.equal(jobs[0].key, "receipt:order-1");
  const success = await sendReceipt(
    order,
    { send: async () => {} },
    { enqueue: async () => assert.fail("successful delivery must not queue") },
  );
  assert.equal(success.status, "sent");
});
