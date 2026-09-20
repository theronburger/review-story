const trailOverlay = document.getElementById("cursor-trail-debug"),
  trailActual = document.getElementById("cursor-trail-actual"),
  trailPlanned = document.getElementById("cursor-trail-planned");
const cursorPathToggle = document.getElementById("show-cursor-path");
let trailBeat = "",
  trailPoints = [];
cursorPathToggle.addEventListener("change", () => {
  trailOverlay.style.opacity =
    cursorPathToggle.checked &&
    (trailActual.getAttribute("d") || trailPlanned.getAttribute("d"))
      ? "1"
      : "0";
});
function resetCursorTrail(key = "") {
  trailBeat = key;
  trailPoints = [];
  trailActual.setAttribute("d", "");
  trailPlanned.setAttribute("d", "");
  trailOverlay.style.opacity = "0";
}
function trailBeatCheck(key) {
  if (key !== trailBeat) resetCursorTrail(key);
}
function recordCursorTrail(point, planned, screenSpace = true) {
  const convert = (p) => {
    if (screenSpace) return p;
    const svg = document.querySelector("#page-map svg"),
      r = svg.getBoundingClientRect(),
      scale = r.width / review.map.width;
    return { x: r.left + p.x * scale, y: r.top + p.y * scale };
  };
  const p = convert(point);
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
  const last = trailPoints.at(-1);
  if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.65)
    trailPoints.push(p);
  const path = (points) =>
    points
      .map((v, i) => `${i ? "L" : "M"}${v.x.toFixed(1)} ${v.y.toFixed(1)}`)
      .join(" ");
  trailActual.setAttribute("d", path(trailPoints));
  trailPlanned.setAttribute("d", path(planned.map(convert)));
  trailOverlay.style.opacity = cursorPathToggle.checked ? "1" : "0";
}
window.addEventListener("resize", () => resetCursorTrail(trailBeat));
