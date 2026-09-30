function createTutorialPointer(messages) {
  const cursor = document.getElementById('cross-pane-cursor'), arrow = document.getElementById('cross-pane-arrow'),
    selectors = ['#tour-play', '#tour-caption', '#sequences-tab', '.node[data-id="paid"] .surface'];
  let path, key = '', travel = 0;

  function destination(index) {
    const rect = document.querySelector(selectors[index]).getBoundingClientRect();
    const box = {left: rect.left, top: rect.top, width: rect.width, height: rect.height};
    if (index === 1) {
      box.width = Math.min(box.width, 240);
      box.height = Math.min(box.height, 23);
    }
    return ellipseDestination(box, {left: 24, top: 24, right: innerWidth - 24, bottom: innerHeight - 24},
      `tutorial-${index}`, {gap: 10, clearance: 8});
  }

  return {
    render(index, time) {
      const to = destination(index), from = index ? destination(index - 1) : {...to, x: to.x - 30, y: to.y + 16},
        nextKey = JSON.stringify([index, from, to]),
        local = Math.hypot(to.x - from.x, to.y - from.y) <= 180;
      if (key !== nextKey) {
        key = nextKey;
        path = local ? localPointerPath(from, to) : pointerPath(from, to,
          {left: 18, top: 18, right: innerWidth - 18, bottom: innerHeight - 18});
        travel = pointerTravelDuration(from, to, local, 1);
      }
      const elapsed = time - messages[index].startMs / 1000,
        progress = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : Math.max(0, Math.min(1, elapsed / travel)),
        position = progress * (path.length - 1), a = path[Math.floor(position)], b = path[Math.ceil(position)], fraction = position % 1;
      arrow.setAttribute('transform', `translate(${a.x + (b.x - a.x) * fraction} ${a.y + (b.y - a.y) * fraction}) rotate(${a.angle + (b.angle - a.angle) * fraction}) scale(1.45)`);
      cursor.dataset.tutorialTarget = selectors[index];
      cursor.style.opacity = '1';
    },
    stop() { cursor.style.opacity = '0'; delete cursor.dataset.tutorialTarget; key = ''; },
  };
}
