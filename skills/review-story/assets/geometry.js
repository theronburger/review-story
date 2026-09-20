// Cursor artwork points northwest at rotation 0. Its tip is the transform origin.
const pointerRadians = (degrees) => (degrees * Math.PI) / 180;
const pointerDirection = (angle) => ({
  x: Math.cos(pointerRadians(angle - 135)),
  y: Math.sin(pointerRadians(angle - 135)),
});
const pointerHash = (text) =>
  Array.from(text).reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
function ellipseDestination(box, bounds, salt) {
  const cx = box.left + box.width / 2,
    cy = box.top + box.height / 2;
  const gap = Math.max(
    25,
    Math.min(52, Math.sqrt(Math.max(1, box.width * box.height)) * 0.16),
  );
  const rx = box.width / 2 + gap,
    ry = box.height / 2 + gap;
  const preferred = [
    -Math.PI * 0.72,
    -Math.PI * 0.28,
    Math.PI * 0.23,
    Math.PI * 0.77,
  ][pointerHash(salt) % 4];
  let best = null;
  for (let i = 0; i < 64; i++) {
    const theta = (i * Math.PI) / 32,
      x = cx + Math.cos(theta) * rx,
      y = cy + Math.sin(theta) * ry;
    // The cursor remains outside the rectangular target, even on a wide, shallow ellipse.
    const dx = Math.max(box.left - x, 0, x - box.left - box.width),
      dy = Math.max(box.top - y, 0, y - box.top - box.height);
    if (Math.hypot(dx, dy) < 19) continue;
    const overflow =
      Math.max(0, bounds.left - x) +
      Math.max(0, x - bounds.right) +
      Math.max(0, bounds.top - y) +
      Math.max(0, y - bounds.bottom);
    const delta = Math.abs(
      Math.atan2(Math.sin(theta - preferred), Math.cos(theta - preferred)),
    );
    const score =
      overflow * 100 + delta * 12 + (Math.abs(Math.sin(theta)) < 0.25 ? 15 : 0);
    if (!best || score < best.score)
      best = {
        x,
        y,
        angle: (Math.atan2(cy - y, cx - x) * 180) / Math.PI + 135,
        score,
        cx,
        cy,
        rx,
        ry,
      };
  }
  return best || { x: cx, y: box.top - gap, angle: 225, cx, cy, rx, ry };
}
function pointerDestination(boxes, width, salt) {
  const left = Math.min(...boxes.map((b) => b.left)),
    top = Math.min(...boxes.map((b) => b.top));
  const box = {
    left,
    top,
    width: Math.max(...boxes.map((b) => b.left + b.width)) - left,
    height: Math.max(...boxes.map((b) => b.top + b.height)) - top,
  };
  return ellipseDestination(
    box,
    { left: 24, top: 24, right: width - 24, bottom: review.map.height - 20 },
    salt,
  );
}
function pointerPath(from, to, bounds) {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    d = Math.hypot(dx, dy),
    f0 = pointerDirection(from.angle),
    f1 = pointerDirection(to.angle);
  const u = d > 0.01 ? { x: dx / d, y: dy / d } : f0,
    n = { x: -u.y, y: u.x };
  const angleDelta = Math.abs(
    Math.atan2(
      Math.sin(pointerRadians(to.angle - from.angle)),
      Math.cos(pointerRadians(to.angle - from.angle)),
    ),
  );
  if (d < 0.1 && angleDelta < 0.001)
    return Array.from({ length: 121 }, () => ({ ...to }));
  const room = (p, v) => {
    if (!bounds) return Infinity;
    return Math.max(
      5,
      Math.min(
        v.x > 0
          ? (bounds.right - p.x) / v.x
          : v.x < 0
            ? (bounds.left - p.x) / v.x
            : Infinity,
        v.y > 0
          ? (bounds.bottom - p.y) / v.y
          : v.y < 0
            ? (bounds.top - p.y) / v.y
            : Infinity,
      ),
    );
  };
  const h = Math.max(22, Math.min(150, d * 0.35)),
    h0 = Math.min(h, room(from, f0) * 0.8),
    h1 = Math.min(h, room(to, { x: -f1.x, y: -f1.y }) * 0.8);
  let curves = [];
  if (
    d > 0.1 &&
    f0.x * u.x + f0.y * u.y > 0.2 &&
    f1.x * u.x + f1.y * u.y > 0.2
  ) {
    curves = [
      [
        from,
        { x: from.x + f0.x * h0, y: from.y + f0.y * h0 },
        { x: to.x - f1.x * h1, y: to.y - f1.y * h1 },
        to,
      ],
    ];
  } else {
    // A side waypoint provides room for a turn when the destination is behind the nose.
    // Both Beziers leave and arrive along the cursor's facing direction.
    const cross = u.x * f0.y - u.y * f0.x,
      sign = Math.abs(cross) > 0.15 ? Math.sign(cross) : 1;
    const bend = Math.max(38, Math.min(140, d * 0.24));
    let mid = {
      x: (from.x + to.x) / 2 + n.x * bend * sign,
      y: (from.y + to.y) / 2 + n.y * bend * sign,
    };
    if (bounds) {
      const other = {
        x: (from.x + to.x) / 2 - n.x * bend * sign,
        y: (from.y + to.y) / 2 - n.y * bend * sign,
      };
      const outside = (p) =>
        Math.max(0, bounds.left - p.x, p.x - bounds.right) +
        Math.max(0, bounds.top - p.y, p.y - bounds.bottom);
      if (outside(other) < outside(mid)) mid = other;
    }
    const mh = Math.max(16, Math.min(90, d * 0.22));
    curves = [
      [
        from,
        { x: from.x + f0.x * h0, y: from.y + f0.y * h0 },
        { x: mid.x - u.x * mh, y: mid.y - u.y * mh },
        mid,
      ],
      [
        mid,
        { x: mid.x + u.x * mh, y: mid.y + u.y * mh },
        { x: to.x - f1.x * h1, y: to.y - f1.y * h1 },
        to,
      ],
    ];
  }
  const raw = [];
  let lastAngle = from.angle,
    length = 0;
  for (const [p0, p1, p2, p3] of curves) {
    for (let i = raw.length ? 1 : 0; i <= 240; i++) {
      const t = i / 240,
        v = 1 - t,
        x =
          v * v * v * p0.x +
          3 * v * v * t * p1.x +
          3 * v * t * t * p2.x +
          t * t * t * p3.x,
        y =
          v * v * v * p0.y +
          3 * v * v * t * p1.y +
          3 * v * t * t * p2.y +
          t * t * t * p3.y;
      const vx =
          3 * v * v * (p1.x - p0.x) +
          6 * v * t * (p2.x - p1.x) +
          3 * t * t * (p3.x - p2.x),
        vy =
          3 * v * v * (p1.y - p0.y) +
          6 * v * t * (p2.y - p1.y) +
          3 * t * t * (p3.y - p2.y);
      let angle = (Math.atan2(vy, vx) * 180) / Math.PI + 135;
      while (angle - lastAngle > 180) angle -= 360;
      while (angle - lastAngle < -180) angle += 360;
      lastAngle = angle;
      if (raw.length) length += Math.hypot(x - raw.at(-1).x, y - raw.at(-1).y);
      raw.push({ x, y, angle, length });
    }
  }
  let cursor = 0;
  return Array.from({ length: 121 }, (_, i) => {
    const t = i / 120,
      wanted = length * t * t * (3 - 2 * t);
    while (cursor < raw.length - 2 && raw[cursor + 1].length < wanted) cursor++;
    const a = raw[cursor],
      b = raw[cursor + 1] || a,
      q = (wanted - a.length) / (b.length - a.length || 1);
    return {
      x: a.x + (b.x - a.x) * q,
      y: a.y + (b.y - a.y) * q,
      angle: a.angle + (b.angle - a.angle) * q,
    };
  });
}
function pointerWiggle(elapsed) {
  return elapsed > 0 && elapsed < 1.4
    ? Math.sin(elapsed * Math.PI * 5) * 2.6 * Math.exp(-elapsed * 2.8)
    : 0;
}
