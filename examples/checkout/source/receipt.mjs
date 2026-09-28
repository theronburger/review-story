export function receiptFor(order) {
  const { subtotal, shipping, discount } = order;
  const total = subtotal + shipping - discount;
  return {
    to: order.email,
    subject: 'Thanks for your order',
    text: `Your total is $${(total / 100).toFixed(2)}.`,
  };
}

export async function sendReceipt(order, mail, retries) {
  const message = receiptFor(order);
  try {
    await mail.send(message);
    return { status: 'sent' };
  } catch {
    await retries.enqueue({ key: `receipt:${order.id}`, message });
    return { status: 'queued' };
  }
}
