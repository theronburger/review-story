(() => {
  const intro = document.getElementById("demo-intro"),
    review = document.getElementById("operations-map"),
    stage = intro.querySelector(".demo-pr-stage"),
    totals = intro.querySelector(".pr-total"),
    rfcs = createRfcScene(stage),
    prs = createPullRequestScene(stage, totals),
    pauseButton = intro.querySelector(".demo-pause"),
    slider = intro.querySelector(".demo-seek"),
    send = intro.querySelector(".demo-send"),
    video = new URLSearchParams(location.search).has("video") ? createVideoIntro(intro) : null,
    request = createDemoStream("My gosh thats a lot of code. Use that review story thing or whatever to make it hurt less please", 11, 1.6),
    reply = createDemoStream("103k lines? Doable. I'll walk you through the context you need and the bits that feel controversial.\n\nIf you turn on sound I can talk you though it", 12.8, 3.35),
    confirmation = createDemoStream("OK! Sound is on", 16.85, 1),
    duration = video?.duration ?? 18,
    tutorial = createDemoTutorial();
  let frame, timer, startedAt = 0, position = 0, paused = false, active = false, pausedAnimations = [], playbackVersion = 0;
  slider.max = String(duration);

  function updateTransport() {
    const stamp = seconds => `0:${String(Math.floor(seconds)).padStart(2, "0")}`;
    slider.value = String(position);
    intro.querySelector(".demo-time").textContent = `${stamp(position)} / ${stamp(duration)}`;
    pauseButton.textContent = position >= duration ? "↺ Replay" : paused ? position === 0 ? "▶ Play" : "▶ Resume" : "Ⅱ Pause";
    pauseButton.setAttribute("aria-label", position >= duration ? "Replay intro animation" : paused ? "Resume intro animation" : "Pause intro animation");
  }

  function render(time, seeking = false) {
    position = Math.max(0, Math.min(duration, time));
    intro.dataset.step = position < 10.8 ? "cards" : position < 12.8 ? "typing"
      : position < 16.8 ? "reply" : "confirm";
    if (video) video.render(position);
    const rfcLines = rfcs.render(position, seeking);
    if (seeking) prs.seek(position, rfcLines); else prs.render(position, rfcLines);
    totals.hidden = Number(totals.dataset.value) === 0;
    stage.setAttribute("aria-hidden", String(position >= 10.8));
    intro.querySelector(".demo-chat").setAttribute("aria-hidden", String(position < 10.8));
    intro.querySelector(".demo-assistant").setAttribute("aria-hidden", String(position < 12.8));
    intro.querySelector(".demo-confirm").setAttribute("aria-hidden", String(!!video || position < 16.8));
    intro.querySelector(".demo-typed").textContent = request.at(position);
    if (!video) {
      intro.querySelector(".demo-reply").textContent = reply.at(position);
      intro.querySelector(".demo-confirm-text").textContent = confirmation.at(position);
    }
    send.disabled = !!video || position < 17.85;
    updateTransport();
  }

  function freezeAnimations() {
    pausedAnimations = (intro.getAnimations?.({subtree: true}) || []).filter(animation => animation.playState !== "finished");
    pausedAnimations.forEach(animation => animation.pause());
    intro.classList.add("demo-paused");
  }

  function pause() {
    if (!active || paused) return;
    render(video ? video.audio.currentTime : (performance.now() - startedAt) / 1000);
    video?.audio.pause();
    playbackVersion++;
    paused = true;
    cancelAnimationFrame(frame);
    freezeAnimations();
    updateTransport();
  }

  async function resume() {
    if (!active) return;
    if (position >= duration) { reset(); return; }
    paused = false;
    intro.classList.remove("demo-paused");
    pausedAnimations.forEach(animation => animation.play());
    pausedAnimations = [];
    startedAt = performance.now() - position * 1000;
    const version = ++playbackVersion;
    if (video) {
      video.error();
      try { await video.audio.play(); }
      catch {
        if (version !== playbackVersion) return;
        pause();
        video.error("Press Play to enable narration.");
        return;
      }
      if (version !== playbackVersion) return;
    }
    tick();
  }

  function tick() {
    if (!active || paused) return;
    render(video ? video.audio.currentTime : (performance.now() - startedAt) / 1000);
    if (position >= duration) {
      if (video) { showReview(true); return; }
      paused = true;
      freezeAnimations();
      updateTransport();
    } else frame = requestAnimationFrame(tick);
  }

  function seek() {
    const time = Number(slider.value);
    pause();
    if (video) video.audio.currentTime = time;
    intro.classList.add("demo-seeking");
    render(time, true);
    void intro.offsetWidth;
    intro.classList.remove("demo-seeking");
    freezeAnimations();
  }

  function showReview(speak) {
    if (!active) return;
    active = false;
    playbackVersion++;
    video?.audio.pause();
    cancelAnimationFrame(frame);
    document.body.classList.remove("demo-intro-visible");
    review.inert = false;
    intro.inert = true;
    intro.classList.add("demo-leaving");
    review.classList.add("demo-review-entering");
    document.getElementById("map-tab").click();
    window.scrollTo(0, 0);
    if (speak) {
      tutorial.start();
    } else {
      const seek = document.getElementById("tour-seek");
      seek.value = "0";
      seek.dispatchEvent(new Event("input", {bubbles: true}));
    }
    timer = setTimeout(() => {
      intro.hidden = true;
      review.classList.remove("demo-review-entering");
      document.getElementById("tour-play").focus({preventScroll: true});
    }, 340);
  }

  function reset() {
    tutorial.stop();
    playbackVersion++;
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    const play = document.getElementById("tour-play");
    if (play.getAttribute("aria-label") === "Pause walkthrough") play.click();
    for (const track of document.querySelectorAll("audio")) track.pause();
    if (video) { video.audio.currentTime = 0; video.error(); }
    intro.hidden = false;
    intro.inert = false;
    intro.classList.remove("demo-leaving", "demo-paused");
    pausedAnimations = [];
    review.inert = true;
    review.classList.remove("demo-review-entering");
    document.body.classList.add("demo-intro-visible");
    active = true;
    paused = !!video;
    render(0, true);
    for (const animation of intro.getAnimations?.({subtree: true}) || []) animation.play();
    startedAt = performance.now();
    if (paused) freezeAnimations();
    else frame = requestAnimationFrame(tick);
  }

  const replay = document.createElement("button");
  replay.id = "demo-replay";
  replay.type = "button";
  replay.textContent = "↺ Intro";
  replay.setAttribute("aria-label", "Replay the demo intro");
  document.querySelector(".tour-controls").append(replay);
  replay.addEventListener("click", () => { reset(); pauseButton.focus({preventScroll: true}); });
  intro.querySelector(".demo-confirm").addEventListener("submit", event => {
    event.preventDefault();
    if (!send.disabled) showReview(true);
  });
  pauseButton.addEventListener("click", () => paused ? resume() : pause());
  slider.addEventListener("input", seek);
  video?.audio.addEventListener("ended", () => { if (active && !paused) showReview(true); });
  intro.querySelector(".demo-skip").addEventListener("click", () => showReview(false));
  document.addEventListener("keydown", event => {
    if (!active) return;
    if (event.key === "Escape") {
      event.preventDefault();
      showReview(false);
    } else if (event.code === "Space" && !event.target.closest?.("button,input,a")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (paused) resume(); else pause();
    }
  }, true);
  reset();
})();
