function nearbyTargets(first, second) {
  if (!first || !second) return false;
  const distance = Math.hypot(
    first.left + first.width / 2 - second.left - second.width / 2,
    first.top + first.height / 2 - second.top - second.height / 2,
  );
  return (
    distance <=
    Math.min(180, Math.max(96, Math.max(first.height, second.height) * 8))
  );
}
function codePointerGroup(beat, phase) {
  const cues = sequenceTourData.beats.flatMap((beat) =>
    beat.phases.map((phase) => ({ beat, phase })),
  );
  const index = cues.findIndex((cue) => cue.phase === phase);
  const measure = (cue) =>
    cue?.beat.diagram === beat.diagram &&
    cue.phase.card === phase.card &&
    cue.phase.point === "code" &&
    cue.phase.codeTarget
      ? codeTargetRects(cue.phase.codeTarget)[0]
      : null;
  const boxes = [measure(cues[index])];
  if (!boxes[0]) return null;
  let first = index,
    last = index;
  for (const direction of [-1, 1]) {
    let previous = index;
    while (cues[previous + direction]) {
      const next = previous + direction,
        box = measure(cues[next]);
      if (
        Math.abs(cues[next].phase.start - cues[previous].phase.start) > 6 ||
        !nearbyTargets(direction < 0 ? boxes[0] : boxes.at(-1), box)
      )
        break;
      if (direction < 0) {
        boxes.unshift(box);
        first = next;
      } else {
        boxes.push(box);
        last = next;
      }
      previous = next;
    }
  }
  return first === last ? null : { id: `${first}:${last}`, boxes };
}
function groupedDestination(box, bounds, boxes) {
  const centers = boxes.map((box) => ({
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
  }));
  const width =
      Math.max(...centers.map((p) => p.x)) -
      Math.min(...centers.map((p) => p.x)),
    height =
      Math.max(...centers.map((p) => p.y)) -
      Math.min(...centers.map((p) => p.y));
  if (height > width) {
    const left = boxes.every((box) => box.left - 28 >= bounds.left);
    return {
      x: left ? box.left - 4 : box.left + box.width + 4,
      y: box.top + box.height / 2,
      angle: left ? 135 : 315,
    };
  }
  const below = boxes.every(
    (box) => box.top + box.height + 28 <= bounds.bottom,
  );
  return {
    x: box.left + box.width / 2,
    y: below ? box.top + box.height + 4 : box.top - 4,
    angle: below ? 45 : 225,
  };
}
function mapPointerGroup(beat) {
  const beats = mapTourData.beats,
    index = beats.indexOf(beat),
    boxAt = (i) => {
      const node = nodes.find((node) => node.id === beats[i]?.target);
      return node
        ? { left: node.x, top: node.y, width: node.w, height: node.h }
        : null;
    },
    nearby = (a, b) => {
      if (
        !a ||
        !b ||
        Math.max(a.width, b.width) > Math.min(a.width, b.width) * 2
      )
        return false;
      const dx = Math.abs(a.left + a.width / 2 - b.left - b.width / 2),
        dy = Math.abs(a.top + a.height / 2 - b.top - b.height / 2);
      return (
        (dy < Math.min(a.height, b.height) / 2 &&
          dx < Math.max(a.width, b.width) * 1.7) ||
        (dx < Math.min(a.width, b.width) / 2 &&
          dy < Math.max(a.height, b.height) * 2.5)
      );
    };
  const boxes = [boxAt(index)];
  if (!boxes[0]) return null;
  let first = index,
    last = index;
  for (const direction of [-1, 1]) {
    let previous = index;
    while (beats[previous + direction]) {
      const next = previous + direction,
        box = boxAt(next);
      if (
        Math.abs(beats[next].start - beats[previous].start) > 6 ||
        !nearby(direction < 0 ? boxes[0] : boxes.at(-1), box)
      )
        break;
      if (direction < 0) {
        boxes.unshift(box);
        first = next;
      } else {
        boxes.push(box);
        last = next;
      }
      previous = next;
    }
  }
  return first === last ? null : { id: `${first}:${last}`, boxes };
}
function localPointerPath(from, to) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y),
    direction = pointerDirection(to.angle),
    angle =
      (Math.atan2(
        Math.sin(pointerRadians(to.angle - from.angle)),
        Math.cos(pointerRadians(to.angle - from.angle)),
      ) *
        180) /
      Math.PI;
  return Array.from({ length: 121 }, (_, i) => {
    const t = i / 120,
      ease = t * t * (3 - 2 * t),
      hop = Math.sin(Math.PI * ease) * Math.min(4, distance * 0.05);
    return {
      x: from.x + (to.x - from.x) * ease - direction.x * hop,
      y: from.y + (to.y - from.y) * ease - direction.y * hop,
      angle: from.angle + angle * ease,
    };
  });
}
function pointerTravelDuration(from, to, local, available) {
  const duration = local
    ? Math.min(
        0.3,
        Math.max(0.16, Math.hypot(to.x - from.x, to.y - from.y) / 500),
      )
    : 0.62;
  return Math.min(duration, Math.max(0.06, available * 0.7));
}
