function createVideoIntro(intro) {
  document.body.classList.add('demo-video-page');
  const narration = __VIDEO_NARRATION__, audio = document.createElement("audio");
  audio.id = "demo-video-audio";
  audio.preload = "auto";
  audio.src = "__VIDEO_AUDIO__";
  intro.append(audio);
  intro.classList.add("demo-video");
  if (new URLSearchParams(location.search).has("clean")) intro.classList.add("demo-clean");
  intro.querySelector(".demo-confirm").hidden = true;
  const ready = document.createElement("div");
  ready.className = "demo-video-ready";
  ready.innerHTML = '<div class="demo-video-thinking" role="status" aria-label="Preparing the walkthrough"><i></i><i></i><i></i></div><p class="demo-ready-text"></p>';
  intro.querySelector(".demo-chat").append(ready);
  const error = document.createElement("p");
  error.className = "demo-video-error";
  error.setAttribute("role", "status");
  error.hidden = true;
  intro.append(error);

  function spokenText(message, time) {
    let end = 0;
    for (const word of message.words) {
      if (word.startMs > time * 1000) break;
      end = Math.max(end, word.charIndex + word.charLength);
    }
    return message.text.slice(0, end);
  }

  return {
    audio,
    duration: narration.durationMs / 1000,
    error(message = "") { error.hidden = !message; error.textContent = message; },
    render(time) {
      const working = time * 1000 >= narration.loaderStartMs,
        speakingReady = time * 1000 >= narration.readyStartMs;
      intro.dataset.step = time < 10.8 ? "cards" : time < 12.8 ? "typing"
        : !working ? "reply" : !speakingReady ? "working" : "ready";
      intro.querySelector(".demo-reply").textContent = spokenText(narration.messages[0], time);
      ready.hidden = !working;
      ready.querySelector(".demo-video-thinking").hidden = speakingReady;
      ready.querySelector(".demo-ready-text").textContent = spokenText(narration.messages[1], time);
    },
  };
}
