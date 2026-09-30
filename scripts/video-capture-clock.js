(() => {
  let now = 0, id = 0, frame = 0;
  const callbacks = new Map(), timers = new Map(), media = new Map(), animationStarts = new WeakMap(), log = [];
  const {durations, fps} = __CAPTURE_CONFIG__;
  const state = el => {
    if (!media.has(el)) media.set(el, {position: 0, since: 0, paused: true, ended: false});
    return media.get(el);
  };
  const time = el => { const s = state(el); return Math.min(durations[el.id] ?? Infinity, s.position + (s.paused ? 0 : (now - s.since) / 1000)); };
  Object.defineProperty(performance, 'now', {value: () => now});
  window.requestAnimationFrame = cb => { callbacks.set(++id, cb); return id; };
  window.cancelAnimationFrame = key => callbacks.delete(key);
  window.setTimeout = (cb, ms = 0, ...args) => { timers.set(++id, {at: now + ms, cb, args}); return id; };
  window.clearTimeout = key => timers.delete(key);
  const proto = HTMLMediaElement.prototype;
  Object.defineProperties(proto, {
    currentTime: {get() { return time(this); }, set(value) { const s = state(this); s.position = value; s.since = now; s.ended = false; }},
    paused: {get() { return state(this).paused; }},
    ended: {get() { return state(this).ended; }},
  });
  proto.play = function () {
    const s = state(this);
    if (s.paused) { s.since = now; s.paused = false; s.ended = false; log.push({id: this.id, at: now / 1000, offset: s.position}); }
    return Promise.resolve();
  };
  proto.pause = function () { const s = state(this); s.position = time(this); s.paused = true; };
  const syncAnimations = () => {
    for (const animation of document.getAnimations()) {
      if (!animationStarts.has(animation)) animationStarts.set(animation, now - (Number(animation.currentTime) || 0));
      animation.pause();
      animation.currentTime = now - animationStarts.get(animation);
    }
  };
  async function step() {
    now = ++frame * 1000 / fps;
    for (const [el, s] of media) {
      if (s.paused) continue;
      el.dispatchEvent(new Event('timeupdate'));
      if (time(el) >= durations[el.id]) { s.position = durations[el.id]; s.paused = true; s.ended = true; el.dispatchEvent(new Event('ended')); }
    }
    for (const [key, timer] of [...timers]) if (timer.at <= now) { timers.delete(key); timer.cb(...timer.args); }
    await Promise.resolve();
    const pending = [...callbacks.values()]; callbacks.clear();
    for (const callback of pending) callback(now);
    await Promise.resolve();
    syncAnimations();
    document.documentElement.dataset.captureFrame = String(frame);
    document.documentElement.dataset.captureAudio = JSON.stringify(log);
  }
  document.addEventListener('keydown', async event => {
    if (!['ArrowRight', 'Enter', 'PageDown'].includes(event.key)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.key === 'PageDown') for (let i = 0; i < fps; i++) await step();
    else if (event.key === 'ArrowRight') step();
    else { document.querySelector('.demo-pause').click(); syncAnimations(); }
  }, true);
  window.addEventListener('load', () => {
    syncAnimations();
    document.documentElement.dataset.captureFrame = '0';
  });
})();
