const { test } = require("node:test");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const assert = require("node:assert/strict");
const scope = { innerHeight: 1000, innerWidth: 1800 };
vm.createContext(scope);
for (const file of ["geometry", "visibility", "proximity"])
  vm.runInContext(
    fs.readFileSync(
      path.join(__dirname, "../skills/review-story/assets", file + ".js"),
      "utf8",
    ),
    scope,
  );
const {
  ellipseDestination,
  pointerPath,
  pointerDirection,
  pointerWiggle,
  fitDelta,
  revealWhole,
} = scope;

test("cursor sits on the boundary ellipse and aims inward across target shapes", () => {
  const headings = new Set();
  for (const [width, height] of [
    [80, 20],
    [400, 24],
    [300, 250],
    [30, 30],
  ])
    for (let i = 0; i < 8; i++) {
      const destination = ellipseDestination(
        { left: 300, top: 200, width, height },
        { left: 20, top: 20, right: 1500, bottom: 1000 },
        "target" + i,
      );
      const direction = scope.evalDirection(destination.angle);
      const dx = destination.cx - destination.x,
        dy = destination.cy - destination.y;
      assert(Math.abs(direction.x * dy - direction.y * dx) < 1e-8);
      assert(direction.x * dx + direction.y * dy > 0);
      assert(
        Math.abs(
          ((destination.x - destination.cx) / destination.rx) ** 2 +
            ((destination.y - destination.cy) / destination.ry) ** 2 -
            1,
        ) < 1e-8,
      );
      headings.add(Math.round(destination.angle));
    }
  assert(headings.size > 8);
});
vm.runInContext("this.evalDirection = pointerDirection;", scope);

test("nearby targets slide with steady orientation and at most a four-pixel hop", () => {
  const box = (left, top) => ({ left, top, width: 35, height: 18 }),
    bounds = { left: 10, top: 10, right: 900, bottom: 900 };
  for (const boxes of [
    [box(250, 200), box(250, 240), box(250, 280)],
    [box(250, 200), box(320, 200), box(400, 200)],
  ]) {
    const destinations = boxes.map((box) =>
      scope.groupedDestination(box, bounds, boxes),
    );
    for (let i = 1; i < boxes.length; i++) {
      assert(scope.nearbyTargets(boxes[i - 1], boxes[i]));
      const from = destinations[i - 1],
        to = destinations[i],
        points = scope.localPointerPath(from, to),
        dx = to.x - from.x,
        dy = to.y - from.y,
        distance = Math.hypot(dx, dy);
      assert.equal(from.angle, to.angle);
      let previous = -1;
      for (const point of points) {
        const progress =
          ((point.x - from.x) * dx + (point.y - from.y) * dy) / distance ** 2;
        assert(progress >= previous - 1e-9 && progress <= 1 + 1e-9);
        assert(
          Math.abs((point.x - from.x) * dy - (point.y - from.y) * dx) /
            distance <=
            4.001,
        );
        assert.equal(point.angle, to.angle);
        previous = progress;
      }
      assert(Math.hypot(points.at(-1).x - to.x, points.at(-1).y - to.y) < 1e-8);
    }
  }
  assert(!scope.nearbyTargets(box(0, 0), box(0, 400)));
  assert(!scope.nearbyTargets(box(0, 0), null));
  const reverse = scope.localPointerPath(
    { x: 100, y: 100, angle: 765 },
    { x: 50, y: 100, angle: 45 },
  );
  assert(reverse.every((p) => Math.abs(p.angle - 765) < 1e-8));
  assert(
    scope.pointerTravelDuration({ x: 0, y: 0 }, { x: 0, y: 50 }, true, 0.2) <
      0.2,
  );
});

test("precise token pointing stays close to the text without covering it", () => {
  for (const width of [7, 42, 100]) {
    const box = { left: 500, top: 300, width, height: 18 },
      target = ellipseDestination(
        box,
        { left: 400, top: 200, right: 900, bottom: 600 },
        "token",
        { gap: 4, clearance: 3 },
      ),
      distance = Math.hypot(
        Math.max(box.left - target.x, 0, target.x - box.left - width),
        Math.max(box.top - target.y, 0, target.y - box.top - box.height),
      ),
      direction = scope.evalDirection(target.angle);
    assert(distance >= 3 && distance <= 6);
    assert(
      Math.abs(
        direction.x * (target.cy - target.y) -
          direction.y * (target.cx - target.x),
      ) < 1e-8,
    );
  }
});

test("travel stays nose-first for 144 heading pairs; reversal loops before moving back", () => {
  for (let first = 0; first < 360; first += 30)
    for (let last = 0; last < 360; last += 30) {
      const from = { x: 500, y: 400, angle: first },
        to = { x: 850, y: 460, angle: last };
      const points = pointerPath(from, to);
      assert(Math.hypot(points[0].x - from.x, points[0].y - from.y) < 1e-6);
      assert(Math.hypot(points.at(-1).x - to.x, points.at(-1).y - to.y) < 1e-6);
      for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x,
          dy = points[i].y - points[i - 1].y;
        const facing = scope.evalDirection(
          (points[i].angle + points[i - 1].angle) / 2,
        );
        assert(dx * facing.x + dy * facing.y > 0);
      }
    }
  const reverse = pointerPath(
    { x: 500, y: 400, angle: 315 },
    { x: 800, y: 400, angle: 135 },
  );
  assert(reverse[1].x < 500);
  assert(reverse.some((point) => Math.abs(point.y - 400) > 20));
  assert(Math.abs(pointerWiggle(0.15)) > 0);
  assert.equal(pointerWiggle(2), 0);
});

test("whole-block scrolling fits available space and settles without repeated movement", () => {
  for (const size of [10, 50, 150, 350])
    for (let start = -500; start < 1000; start += 17) {
      const delta = fitDelta(start, start + size, 100, 500);
      assert(start - delta >= 100 - 1e-9);
      assert(start + size - delta <= 500 + 1e-9);
      assert.equal(fitDelta(start - delta, start + size - delta, 100, 500), 0);
    }
  assert.equal(fitDelta(200, 850, 100, 500), 100);
  const container = {
    scrollTop: 0,
    scrollLeft: 0,
    getBoundingClientRect: () => ({
      left: 20,
      right: 920,
      top: 300,
      bottom: 900,
    }),
  };
  const group = { left: 35, right: 850, top: 950, bottom: 1300 };
  revealWhole(container, group, 100, 14);
  assert.equal(container.scrollTop, 414);
  revealWhole(
    container,
    { ...group, top: group.top - 414, bottom: group.bottom - 414 },
    100,
    14,
  );
  assert.equal(container.scrollTop, 414);
});
