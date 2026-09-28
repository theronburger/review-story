export function orderPaid(order) {
  return { type: 'order.paid', data: order };
}

export async function dispatch(event, consumers) {
  const { inventory, receipts, shipping } = consumers;
  return Promise.allSettled([
    inventory(event.data),
    receipts(event.data),
    shipping(event.data),
  ]);
}
