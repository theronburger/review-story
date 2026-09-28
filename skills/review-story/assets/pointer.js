function destination(beat, phase) {
  if (activePage === "map") {
    const n = nodes.find((n) => n.id === beat.target),
      box = { left: n.x, top: n.y, width: n.w, height: n.h },
      group = mapPointerGroup(beat);
    if (group)
      return {
        ...groupedDestination(
          box,
          {
            left: 24,
            top: 24,
            right: review.map.width - 24,
            bottom: review.map.height - 20,
          },
          group.boxes,
        ),
        group: group.id,
      };
    return pointerDestination([box], review.map.width, beat.target);
  }
  const spec = sequenceSpecs.find((s) => s.id === beat.diagram),
    g = messageGeometry(spec, beat.row, phase.message);
  const center = g.m.kind === "local" ? g.x1 + 35 : (g.x1 + g.x2) / 2;
  return {
    x: Math.max(35, Math.min(845, center - 120)),
    y: g.y - 26,
    angle: 135,
  };
}
function preparePointer(beat, phase, time) {
  const to = destination(beat, phase);
  let from;
  if (activePage === "map")
    from =
      tourIndex > 0
        ? destination(tourData.beats[tourIndex - 1], null)
        : { ...to, x: to.x - 36, y: to.y + 18 };
  else {
    const pi = phaseAt(beat, time);
    const prev =
      pi > 0
        ? { beat, phase: beat.phases[pi - 1] }
        : tourIndex > 0 &&
            tourData.beats[tourIndex - 1].diagram === beat.diagram
          ? {
              beat: tourData.beats[tourIndex - 1],
              phase: tourData.beats[tourIndex - 1].phases.at(-1),
            }
          : null;
    from = prev
      ? destination(prev.beat, prev.phase)
      : { ...to, x: to.x - 36, y: to.y + 18 };
  }
  const local = Boolean(to.group && from.group === to.group);
  pointerGrouped = Boolean(to.group);
  pointerPathNow = local ? localPointerPath(from, to) : pointerPath(from, to);
  pointerDuration = pointerTravelDuration(
    from,
    to,
    local,
    (tourData.beats[tourIndex + 1]?.start || tourDuration) - beat.start,
  );
  pointerStart = activePage === "map" ? beat.start : phase.start;
}
function samplePointer(time) {
  if (activePage === "sequences") {
    tourPointer.style.opacity = "0";
    sampleCrossPointer(time);
    return;
  }
  crossCursor.style.opacity = "0";
  if (!tourFollowing || !pointerPathNow) return;
  const path = pointerPathNow,
    p = reducedMotion.matches
      ? 1
      : Math.max(0, Math.min(1, (time - pointerStart) / pointerDuration)),
    index = p * (path.length - 1),
    a = path[Math.floor(index)],
    b = path[Math.min(path.length - 1, Math.floor(index) + 1)],
    t = index - Math.floor(index);
  tourPointer.setAttribute(
    "transform",
    `translate(${a.x + (b.x - a.x) * t} ${a.y + (b.y - a.y) * t}) rotate(${a.angle + (b.angle - a.angle) * t + (reducedMotion.matches || pointerGrouped ? 0 : pointerWiggle(time - pointerStart - pointerDuration))}) scale(1.45)`,
  );
  tourPointer.style.opacity = "1";
}
// The narration clock remains the only motion clock, including visits to code.
const crossCursor = document.getElementById("cross-pane-cursor"),
  crossArrow = document.getElementById("cross-pane-arrow");
let crossPath = null,
  crossStart = 0,
  crossKey = "",
  crossPosition = null,
  crossGroup = "",
  crossLocal = false,
  crossDuration = 0.62,
  crossInstant = false;
function visibleCodeTarget() {
  const pane = document.getElementById("code-cards").getBoundingClientRect(),
    header = document
      .querySelector(".code-card.active header")
      ?.getBoundingClientRect(),
    visibleTop = Math.max(pane.top, header?.bottom || 0, 0),
    blocks = [];
  for (const line of cueElements().code) {
    const row = line.getBoundingClientRect();
    if (
      row.bottom <= visibleTop ||
      row.top >= Math.min(pane.bottom, innerHeight)
    )
      continue;
    const code = line.querySelector("code");
    let rects = [];
    // Use rendered text extents rather than the full-width background of the line.
    try {
      const range = document.createRange();
      range.selectNodeContents(code);
      if (range.getClientRects)
        rects = [...range.getClientRects()].filter(
          (b) => b.width > 1 && b.height > 1,
        );
    } catch {}
    if (!rects.length)
      rects = [
        {
          left: row.left + 45,
          right: Math.min(
            row.right - 10,
            row.left + 45 + Math.max(30, code.textContent.trimEnd().length * 7),
          ),
          top: row.top,
          bottom: row.bottom,
        },
      ];
    for (const r of rects) {
      const left = Math.max(r.left, pane.left),
        right = Math.min(r.right, pane.right),
        top = Math.max(r.top, visibleTop),
        bottom = Math.min(r.bottom, pane.bottom, innerHeight);
      if (right > left && bottom > top)
        blocks.push({ left, right, top, bottom });
    }
  }
  if (!blocks.length) return null;
  const left = Math.min(...blocks.map((b) => b.left)),
    right = Math.max(...blocks.map((b) => b.right)),
    top = Math.min(...blocks.map((b) => b.top)),
    bottom = Math.max(...blocks.map((b) => b.bottom));
  return {
    box: { left, top, width: right - left, height: bottom - top },
    bounds: {
      left: Math.max(30, pane.left - 22),
      right: Math.min(innerWidth - 30, pane.right + 12),
      top: Math.max(30, visibleTop + 12),
      bottom: Math.min(innerHeight - 30, pane.bottom - 12),
    },
  };
}
function visibleTokenTarget() {
  const pane = document.getElementById("code-cards").getBoundingClientRect(),
    header = document
      .querySelector(".code-card.active header")
      ?.getBoundingClientRect(),
    top = Math.max(pane.top, header?.bottom || 0, 0),
    bottom = Math.min(pane.bottom, innerHeight),
    rects = codeTargetRects();
  // Aim at a real text fragment, never the empty space between wrapped fragments.
  for (const rect of rects) {
    const left = Math.max(rect.left, pane.left, 0),
      right = Math.min(rect.right, pane.right, innerWidth),
      visibleTop = Math.max(rect.top, top),
      visibleBottom = Math.min(rect.bottom, bottom);
    if (right > left && visibleBottom > visibleTop)
      return {
        box: {
          left,
          top: visibleTop,
          width: right - left,
          height: visibleBottom - visibleTop,
        },
        bounds: {
          left: Math.max(30, pane.left + 12),
          right: Math.min(innerWidth - 30, pane.right - 12),
          top: Math.max(30, top + 12),
          bottom: Math.min(innerHeight - 30, bottom - 12),
        },
      };
  }
  return null;
}
function crossTarget(beat, phase) {
  if (phase.point === "code") {
    const target = phase.codeTarget
      ? visibleTokenTarget()
      : visibleCodeTarget();
    if (target) {
      const group = phase.codeTarget ? codePointerGroup(beat, phase) : null;
      return {
        ...(group
          ? groupedDestination(target.box, target.bounds, group.boxes)
          : ellipseDestination(
              target.box,
              target.bounds,
              beat.target + phase.phrase,
              phase.codeTarget ? { gap: 4, clearance: 3 } : {},
            )),
        side: "code",
        text: phase.codeTarget?.text || "",
        group: group?.id || "",
      };
    }
    return null;
  }
  const message = cueElements().message;
  const el =
    message?.querySelector("text:not(.seq-number)") ||
    message?.querySelector(".seq-line");
  if (!el) return { x: 30, y: 30, angle: 180, side: "diagram" };
  const b = el.getBoundingClientRect(),
    canvas = document.querySelector(".sequence-canvas").getBoundingClientRect(),
    sticky = document
      .querySelector(".sequence-participants svg")
      .getBoundingClientRect();
  if (
    b.bottom <= canvas.top + sticky.height ||
    b.top >= Math.min(canvas.bottom, innerHeight) ||
    b.right <= canvas.left ||
    b.left >= canvas.right
  )
    return null;
  const box = {
    left: b.left,
    top: b.top,
    width: Math.max(8, b.width),
    height: Math.max(16, b.height),
  };
  const bounds = {
    left: Math.max(30, canvas.left + 24),
    right: Math.min(innerWidth - 30, canvas.right - 24),
    top: Math.max(30, canvas.top + sticky.height + 12),
    bottom: Math.min(innerHeight - 30, canvas.bottom - 20),
  };
  return {
    ...ellipseDestination(box, bounds, beat.target + phase.phrase),
    side: "diagram",
  };
}

function crossTravel(from, target) {
  return crossLocal
    ? localPointerPath(from, target)
    : pointerPath(from, target, {
        left: 18,
        top: 18,
        right: innerWidth - 18,
        bottom: innerHeight - 18,
      });
}
function sampleCrossPointer(time, force = false) {
  if (activePage !== "sequences" || !tourFollowing) {
    crossCursor.style.opacity = "0";
    return;
  }
  const beat = tourData.beats[tourIndex],
    pi = phaseAt(beat, time),
    phase = beat.phases[pi],
    key = beat.target + ":" + pi;
  const target = crossTarget(beat, phase);
  if (!target) {
    crossCursor.style.opacity = "0";
    delete crossCursor.dataset.codeTarget;
    crossGroup = "";
    return;
  }
  if (key !== crossKey || force) {
    const from = crossPosition || {
      ...target,
      x: target.x - 36,
      y: target.y + 18,
    };
    crossLocal = Boolean(
      target.group &&
      target.group === crossGroup &&
      !crossInstant &&
      !force &&
      Math.hypot(target.x - from.x, target.y - from.y) <= 200,
    );
    const nextStart =
      beat.phases[pi + 1]?.start ||
      tourData.beats[tourIndex + 1]?.start ||
      tourDuration;
    crossDuration = pointerTravelDuration(
      from,
      target,
      crossLocal,
      nextStart - phase.start,
    );
    crossPath = crossTravel(from, target);
    crossStart = phase.start;
    crossKey = key;
    crossGroup = target.group || "";
  }
  if (!crossPath) return;
  // DOM geometry changes on internal scrolling; update the endpoint without starting a new clock.
  const end = crossPath.at(-1);
  if (
    Math.abs(end.x - target.x) > 1 ||
    Math.abs(end.y - target.y) > 1 ||
    Math.abs(Math.sin(((end.angle - target.angle) * Math.PI) / 180)) > 0.01
  )
    crossPath = crossTravel(crossPath[0], target);
  const progress =
      crossInstant || reducedMotion.matches
        ? 1
        : Math.max(0, Math.min(1, (time - crossStart) / crossDuration)),
    step = progress * (crossPath.length - 1),
    a = crossPath[Math.floor(step)],
    b = crossPath[Math.min(crossPath.length - 1, Math.floor(step) + 1)],
    t = step - Math.floor(step);
  crossPosition = {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    angle: a.angle + (b.angle - a.angle) * t,
  };
  crossArrow.setAttribute(
    "transform",
    `translate(${crossPosition.x} ${crossPosition.y}) rotate(${crossPosition.angle + (reducedMotion.matches || target.group ? 0 : pointerWiggle(time - crossStart - crossDuration))}) scale(1.45)`,
  );
  crossCursor.dataset.target = target.side;
  crossCursor.dataset.codeTarget = target.text || "";
  crossCursor.dataset.motion = crossLocal ? "slide" : "curve";
  crossCursor.style.opacity = "1";
  crossInstant = false;
}
function refreshCrossPointer() {
  if (!focusLayoutBusy && activePage === "sequences" && tourFollowing)
    sampleCrossPointer(tourAudio.currentTime);
}
window.addEventListener("resize", refreshFocusLayout);
document.addEventListener("scroll", refreshCrossPointer, true);
if (typeof ResizeObserver !== "undefined") {
  const observer = new ResizeObserver(refreshFocusLayout);
  observer.observe(document.querySelector(".sequence-canvas"));
  observer.observe(document.getElementById("code-cards"));
}
if (document.fonts?.ready) document.fonts.ready.then(refreshFocusLayout);
