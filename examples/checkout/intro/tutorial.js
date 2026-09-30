function createDemoTutorial() {
  const narration = __TUTORIAL_NARRATION__, duration = narration.durationMs / 1000,
    review = document.getElementById('operations-map'),
    play = document.getElementById('tour-play'), seek = document.getElementById('tour-seek'),
    caption = document.getElementById('tour-caption'), title = document.getElementById('tour-title'),
    status = document.getElementById('tour-status'), advance = document.getElementById('tour-advance'),
    audio = document.createElement('audio'), overlay = document.createElement('div'),
    skip = document.createElement('button'), pointer = createTutorialPointer(narration.messages);
  audio.id = 'demo-tutorial-audio';
  audio.preload = 'auto';
  audio.src = '__TUTORIAL_AUDIO__';
  overlay.id = 'demo-tutorial';
  overlay.hidden = true;
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg"><defs><mask id="demo-tutorial-mask" maskUnits="userSpaceOnUse"><rect width="100%" height="100%" fill="white"/><rect class="demo-tutorial-window" rx="12" fill="black"/></mask></defs><rect width="100%" height="100%" fill="#283047" opacity=".25" mask="url(#demo-tutorial-mask)"/></svg>`;
  skip.id = 'demo-tutorial-skip';
  skip.type = 'button';
  skip.textContent = 'Skip guide →';
  skip.hidden = true;
  document.querySelector('.tour-controls').append(skip);
  document.body.append(audio, overlay);
  let active = false, frame, version = 0, currentStep = 0, currentWord = -2;

  function rect(node, boxes, padding) {
    const box = {left: Math.min(...boxes.map(box => box.left)), right: Math.max(...boxes.map(box => box.right)),
      top: Math.min(...boxes.map(box => box.top)), bottom: Math.max(...boxes.map(box => box.bottom))},
      x = Math.max(3, box.left - padding), y = Math.max(3, box.top - padding);
    for (const [key, value] of Object.entries({x, y,
      width: Math.max(0, Math.min(innerWidth - 3, box.right + padding) - x),
      height: Math.max(0, Math.min(innerHeight - 3, box.bottom + padding) - y)})) node.setAttribute(key, String(value));
  }

  function positionSpotlight() {
    if (!active) return;
    const selector = currentStep < 2 ? '.tour' : narration.messages[currentStep].target;
    overlay.dataset.spotlight = selector;
    const target = document.querySelector(selector),
      elements = currentStep === 2 ? [...target.querySelectorAll('[role="tab"]')] : [target];
    rect(overlay.querySelector('.demo-tutorial-window'), elements.map(element => element.getBoundingClientRect()), currentStep === 2 ? 8 : 1);
    pointer.render(currentStep, audio.currentTime);
  }

  function render() {
    if (!active) return;
    const time = audio.currentTime * 1000;
    let index = 0;
    narration.messages.forEach((message, i) => { if (time >= message.startMs) index = i; });
    const message = narration.messages[index], wordIndex = message.words.findIndex(word => word.startMs <= time && word.endMs > time);
    if (index !== currentStep || wordIndex !== currentWord) {
      currentStep = index;
      currentWord = wordIndex;
      const word = message.words[wordIndex];
      if (word) {
        const mark = document.createElement('mark');
        mark.textContent = message.text.slice(word.charIndex, word.charIndex + word.charLength);
        caption.replaceChildren(message.text.slice(0, word.charIndex), mark, message.text.slice(word.charIndex + word.charLength));
      } else caption.textContent = message.text;
    }
    title.textContent = `Quick tour · ${index + 1} / 4 · ${message.title}`;
    overlay.dataset.zone = message.target;
    overlay.style.opacity = String(1 - Math.max(0, Math.min(1, (time - narration.fadeStartMs) / (narration.durationMs - narration.fadeStartMs))));
    seek.max = String(duration);
    seek.value = String(audio.currentTime);
    seek.setAttribute('aria-label', 'Tutorial position');
    const stamp = seconds => `0:${String(Math.floor(seconds)).padStart(2, '0')}`;
    const clock = `${stamp(audio.currentTime)} / ${stamp(duration)}`;
    document.getElementById('tour-time').textContent = clock;
    seek.setAttribute('aria-valuetext', clock);
    play.textContent = audio.paused ? '▶ Play' : 'Ⅱ Pause';
    play.setAttribute('aria-label', audio.paused ? 'Play tutorial' : 'Pause tutorial');
    document.getElementById('tour-prev').disabled = index === 0;
    document.getElementById('tour-next').disabled = false;
    positionSpotlight();
  }

  function pause() { version++; audio.pause(); cancelAnimationFrame(frame); render(); }
  function tick() {
    if (!active || audio.paused) return;
    if (audio.currentTime >= duration) { finish(); return; }
    render();
    frame = requestAnimationFrame(tick);
  }
  async function resume() {
    const attempt = ++version;
    status.textContent = '';
    try {
      await audio.play();
      if (attempt === version && active) tick();
    } catch {
      if (attempt !== version || !active) return;
      pause();
      status.textContent = 'Press Play to start the spoken guide.';
    }
  }
  function move(time) {
    pause();
    audio.currentTime = Math.max(0, Math.min(duration, time));
    currentWord = -2;
    render();
  }
  function stop() {
    if (!active) return;
    pause();
    active = false;
    overlay.hidden = skip.hidden = true;
    pointer.stop();
    document.body.classList.remove('demo-tutorial-active');
    advance.disabled = false;
    seek.setAttribute('aria-label', 'Walkthrough position');
    document.getElementById('map-tab').click();
    seek.value = '0';
    seek.dispatchEvent(new Event('input', {bubbles: true}));
  }
  function finish() { stop(); document.getElementById('tour-restart').click(); }

  // Borrow the demo's visible controls, without changing the reusable player.
  review.addEventListener('click', event => {
    if (!active) return;
    const button = event.target.closest('button');
    if (!button || button.id === 'demo-replay') return;
    if (button.matches('[data-page]')) { stop(); return; }
    event.stopImmediatePropagation();
    if (button === play) { if (audio.paused) resume(); else pause(); }
    else if (button === skip) finish();
    else if (button.id === 'tour-restart') { move(0); resume(); }
    else if (button.id === 'tour-prev' || button.id === 'tour-next') {
      const index = currentStep + (button.id === 'tour-next' ? 1 : -1);
      if (index >= narration.messages.length) finish();
      else { const wasPlaying = !audio.paused; move(narration.messages[Math.max(0, index)].startMs / 1000); if (wasPlaying) resume(); }
    }
  }, true);
  seek.addEventListener('input', event => {
    if (!active) return;
    event.stopImmediatePropagation();
    move(Number(seek.value));
  }, true);
  document.addEventListener('keydown', event => {
    if (!active) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); stop(); }
    else if (event.code === 'Space' && !event.target.closest?.('button,input,select,a')) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (audio.paused) resume(); else pause();
    }
  }, true);
  for (const track of review.querySelectorAll('audio')) track.addEventListener('timeupdate', event => {
    if (active) event.stopImmediatePropagation();
  }, true);
  audio.addEventListener('ended', () => { if (active) finish(); });
  audio.addEventListener('error', () => { if (active) { pause(); status.textContent = 'Guide audio unavailable. Press Skip guide to continue.'; } });
  window.addEventListener('resize', positionSpotlight);
  window.addEventListener('scroll', positionSpotlight, true);
  window.addEventListener('pagehide', () => { if (active) pause(); });

  return {stop, start() {
    stop();
    document.getElementById('map-tab').click();
    review.querySelectorAll('.tour-focus').forEach(node => node.classList.remove('tour-focus'));
    active = true;
    audio.currentTime = 0;
    currentStep = 0; currentWord = -2;
    overlay.hidden = skip.hidden = false;
    document.body.classList.add('demo-tutorial-active');
    advance.disabled = true;
    render();
    resume();
  }};
}
