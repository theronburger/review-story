const advanceControl = document.getElementById("tour-advance");
let advanceMode = "auto",
  manualWaiting = false,
  manualHasStarted = false,
  manualBeat = 0,
  manualTimer = null;
function manualEnd() {
  return manualBeat + 1 < tourData.beats.length
    ? tourData.beats[manualBeat + 1].start
    : tourDuration;
}
function holdManualBoundary() {
  if (advanceMode !== "manual" || tourAudio.paused || manualWaiting)
    return false;
  const end = manualEnd();
  if (tourAudio.currentTime < end - 0.025) return false;
  pauseTour();
  tourAudio.currentTime = Math.max(
    tourData.beats[manualBeat].start,
    end - 0.026,
  );
  manualWaiting = true;
  const last = manualBeat === tourData.beats.length - 1;
  tourPlay.textContent = last ? "↺ Replay" : "▶ Next beat";
  tourPlay.setAttribute(
    "aria-label",
    last ? "Replay walkthrough" : "Play next beat",
  );
  tourStatus.textContent = last
    ? "Walkthrough complete · Space to replay"
    : "Beat complete · Space for the next beat";
  return true;
}
function armManualStop() {
  clearTimeout(manualTimer);
  manualTimer = null;
  if (advanceMode !== "manual" || tourAudio.paused || manualWaiting) return;
  const remaining =
    ((manualEnd() - 0.025 - tourAudio.currentTime) * 1000) /
    Math.max(0.1, tourAudio.playbackRate || 1);
  manualTimer = setTimeout(
    () => {
      if (holdManualBoundary()) syncTour(true);
      else armManualStop();
    },
    Math.max(8, remaining),
  );
}
function advanceManual() {
  if (!manualHasStarted && !manualWaiting) {
    playTour();
    return;
  }
  const next = manualWaiting ? manualBeat + 1 : tourIndex + 1;
  pauseTour();
  seekTour(next < tourData.beats.length ? tourData.beats[next].start : 0);
  playTour();
}
let advanceChosenByPointer = false;
advanceControl.addEventListener("pointerdown", () => {
  advanceChosenByPointer = true;
});
advanceControl.addEventListener("keydown", () => {
  advanceChosenByPointer = false;
});
advanceControl.addEventListener("change", () => {
  advanceMode = advanceControl.value;
  if (advanceChosenByPointer) advanceControl.blur();
  advanceChosenByPointer = false;
  manualWaiting = false;
  manualHasStarted = !tourAudio.paused;
  manualBeat = Math.max(0, tourIndex);
  tourPlay.textContent = tourAudio.paused ? "▶ Play" : "Ⅱ Pause";
  tourPlay.setAttribute(
    "aria-label",
    tourAudio.paused ? "Play walkthrough" : "Pause walkthrough",
  );
  tourStatus.textContent =
    advanceMode === "manual"
      ? "Manual · pauses after each beat · Space advances"
      : "";
  armManualStop();
});
document.addEventListener("keydown", (event) => {
  if (
    event.code !== "Space" ||
    event.repeat ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  )
    return;
  if (
    event.target instanceof Element &&
    event.target.closest(
      'input,textarea,select,button,a,[contenteditable="true"]',
    )
  )
    return;
  event.preventDefault();
  if (advanceMode === "manual") advanceManual();
  else tourAudio.paused ? playTour() : pauseTour();
});
