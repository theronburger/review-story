export async function reserveStock(order, stock, reviews) {
  const reserved = await stock.reserve(order.items);
  if (reserved) return { status: 'reserved' };
  await reviews.enqueue({ orderId: order.id });
  return { status: 'review' };
}

export async function createShipment(order, carrier, retries) {
  try {
    const label = await carrier.book(order);
    return { status: 'booked', label };
  } catch {
    await retries.enqueue({ key: `shipment:${order.id}`, order });
    return { status: 'queued' };
  }
}
