function ensureVisible(container, el, padding = 35) {
  if (!el) return;
  const parent = container.getBoundingClientRect(),
    box = el.getBoundingClientRect();
  if (box.top < parent.top + padding)
    container.scrollTop += box.top - parent.top - padding;
  else if (box.bottom > parent.bottom - padding)
    container.scrollTop += box.bottom - parent.bottom + padding;
}
let focusLayoutBusy = false;
function unionRects(rects) {
  const valid = rects.filter((r) => r && r.width > 0 && r.height > 0);
  if (!valid.length) return null;
  const left = Math.min(...valid.map((r) => r.left)),
    top = Math.min(...valid.map((r) => r.top)),
    right = Math.max(...valid.map((r) => r.right)),
    bottom = Math.max(...valid.map((r) => r.bottom));
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}
function cueElements() {
  return {
    code: [
      ...document.querySelectorAll(".code-card.active .code-line.is-current"),
    ],
    message: document.querySelector(".seq-row.active"),
    beat: [...document.querySelectorAll(".seq-row.in-beat")],
  };
}
function fitDelta(start, end, visibleStart, visibleEnd) {
  const size = end - start,
    available = visibleEnd - visibleStart;
  if (available <= 0) return 0;
  if (size > available) return start - visibleStart;
  if (start < visibleStart) return start - visibleStart;
  if (end > visibleEnd) return end - visibleEnd;
  return 0;
}
function revealWhole(container, box, topInset = 12, bottomInset = 12) {
  if (!box) return;
  const v = container.getBoundingClientRect();
  const top = Math.max(v.top, 0) + topInset,
    bottom = Math.min(v.bottom, innerHeight) - bottomInset;
  const dx = fitDelta(
      box.left,
      box.right,
      Math.max(v.left, 0) + 12,
      Math.min(v.right, innerWidth) - 12,
    ),
    dy = fitDelta(box.top, box.bottom, top, bottom);
  if (Math.abs(dy) > 0.5) container.scrollTop += dy;
  if (Math.abs(dx) > 0.5) container.scrollLeft += dx;
}
function manageCueVisibility() {
  if (activePage !== "sequences" || focusLayoutBusy) return;
  focusLayoutBusy = true;
  try {
    const targets = cueElements(),
      canvas = document.querySelector(".sequence-canvas"),
      pane = document.getElementById("code-cards");
    const sticky = document
      .querySelector(".sequence-participants svg")
      .getBoundingClientRect().height;
    const view = canvas.getBoundingClientRect(),
      available =
        Math.min(view.bottom, innerHeight) -
        Math.max(view.top, 0) -
        sticky -
        28;
    const beatBox = unionRects(
        targets.beat.map((el) => el.getBoundingClientRect()),
      ),
      messageBox = targets.message?.getBoundingClientRect();
    // Reveal the complete local sequence when it fits. Otherwise keep the current message whole.
    revealWhole(
      canvas,
      beatBox && beatBox.height <= available ? beatBox : messageBox,
      sticky + 14,
      14,
    );
    const card = pane.querySelector(".code-card.active");
    if (!card) return;
    const pre = card.querySelector("pre"),
      header = card.querySelector("header");
    pre.style.removeProperty("font-size");
    const visible = pane.getBoundingClientRect(),
      headerHeight = header.getBoundingClientRect().height;
    const usable =
      Math.min(innerHeight, visible.bottom) -
      Math.max(0, visible.top) -
      headerHeight -
      26;
    let block = unionRects(
      targets.code.map((el) => el.getBoundingClientRect()),
    );
    // A modest reduction can fit a long block without turning the rest of the source into tiny text.
    if (block && usable > 100 && block.height > usable) {
      const normal = parseFloat(getComputedStyle(pre).fontSize) || 12;
      const fitted = Math.max(
        11.5,
        Math.min(normal, (normal * usable) / block.height),
      );
      if (fitted < normal - 0.1) pre.style.fontSize = fitted.toFixed(2) + "px";
      block = unionRects(targets.code.map((el) => el.getBoundingClientRect()));
    }
    if (block) {
      const withHeader = unionRects([header.getBoundingClientRect(), block]);
      const fullHeight =
        Math.min(innerHeight, visible.bottom) - Math.max(0, visible.top) - 24;
      if (withHeader && withHeader.height <= fullHeight)
        revealWhole(pane, withHeader, 12, 12);
      else revealWhole(pane, block, headerHeight + 14, 12);
    }
  } finally {
    focusLayoutBusy = false;
  }
}
function refreshFocusLayout() {
  if (activePage !== "sequences") return;
  manageCueVisibility();
  if (tourFollowing) sampleCrossPointer(tourAudio.currentTime);
}
