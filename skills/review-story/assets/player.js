function focusStep(beat, phase, time) {
  if (activePage === "map") {
    show(beat.target, true);
    root
      .querySelectorAll(".node")
      .forEach((el) =>
        el.classList.toggle("tour-focus", el.dataset.id === beat.target),
      );
  } else {
    renderSequence(beat.diagram);
    document.querySelectorAll(".seq-row").forEach((el) => {
      const inBeat = Number(el.dataset.row) === beat.row;
      el.classList.toggle("in-beat", inBeat);
      el.classList.toggle(
        "active",
        inBeat && Number(el.dataset.message) === phase.message,
      );
    });
    showCode(beat, phase);
    manageCueVisibility();
  }
  preparePointer(beat, phase, time);
}
function syncTour(force = false) {
  if (holdManualBoundary()) {
    syncTour(true);
    return;
  }
  const time = tourAudio.currentTime,
    index = beatAt(time),
    beat = tourData.beats[index],
    pi = activePage === "sequences" ? phaseAt(beat, time) : 0,
    phase = activePage === "sequences" ? beat.phases[pi] : null,
    key = `${activePage}:${index}:${pi}`;
  if (index !== tourIndex || force) {
    tourIndex = index;
    tourWord = -1;
    tourTitle.textContent = `${index + 1} / ${tourData.beats.length} · ${beat.title}`;
    tourCaption.textContent = beat.text;
  }
  if (key !== activePhaseKey || force) {
    activePhaseKey = key;
    if (activePage === "sequences" || tourFollowing)
      focusStep(beat, phase, time);
  }
  samplePointer(time);
  const wi = tourData.clip.words.findIndex(
    (w) => w.startMs <= time * 1000 && w.endMs > time * 1000,
  );
  if (wi !== tourWord) {
    tourWord = wi;
    const w = tourData.clip.words[wi];
    if (
      w &&
      w.charIndex >= beat.charStart &&
      w.charIndex < beat.charStart + beat.text.length
    ) {
      const offset = w.charIndex - beat.charStart,
        mark = document.createElement("mark");
      mark.textContent = beat.text.slice(offset, offset + w.charLength);
      tourCaption.replaceChildren(
        document.createTextNode(beat.text.slice(0, offset)),
        mark,
        document.createTextNode(beat.text.slice(offset + w.charLength)),
      );
    } else tourCaption.textContent = beat.text;
    const spoken = tourCaption.querySelector("mark");
    if (spoken) ensureVisible(tourCaption, spoken, 3);
  }
  tourSeek.value = String(time);
  tourSeek.setAttribute(
    "aria-valuetext",
    `${formatTime(time)} of ${formatTime(tourDuration)}`,
  );
  document.getElementById("tour-time").textContent =
    `${formatTime(time)} / ${formatTime(tourDuration)}`;
  document.getElementById("tour-prev").disabled = index === 0;
  document.getElementById("tour-next").disabled =
    index === tourData.beats.length - 1;
}
function tickTour() {
  syncTour();
  if (!tourAudio.paused) tourFrame = requestAnimationFrame(tickTour);
}
function pauseTour() {
  clearTimeout(manualTimer);
  manualTimer = null;
  playbackVersion++;
  tourAudio.pause();
  cancelAnimationFrame(tourFrame);
  tourPlay.textContent = "▶ Play";
  tourPlay.setAttribute("aria-label", "Play walkthrough");
}
async function playTour() {
  manualWaiting = false;
  const version = ++playbackVersion,
    audio = tourAudio;
  if (audio.ended || audio.currentTime >= tourDuration - 0.05)
    audio.currentTime = 0;
  tourFollowing = true;
  syncTour(true);
  try {
    await audio.play();
    if (version !== playbackVersion || audio !== tourAudio) return;
    tourPlay.textContent = "Ⅱ Pause";
    tourPlay.setAttribute("aria-label", "Pause walkthrough");
    manualHasStarted = true;
    manualBeat = tourIndex;
    tourStatus.textContent =
      advanceMode === "manual" ? "Manual · Space advances" : "";
    armManualStop();
    cancelAnimationFrame(tourFrame);
    tickTour();
  } catch {
    if (version !== playbackVersion || audio !== tourAudio) return;
    pauseTour();
    tourStatus.textContent =
      "Press Play to retry, or use the arrows to read the walkthrough.";
  }
}
function seekTour(time) {
  manualWaiting = false;
  tourStatus.textContent =
    advanceMode === "manual" ? "Manual · Space advances" : "";
  manualHasStarted = !tourAudio.paused;
  crossInstant = true;
  tourAudio.currentTime = Math.max(0, Math.min(tourDuration, time));
  manualBeat = beatAt(tourAudio.currentTime);
  tourFollowing = true;
  syncTour(true);
  armManualStop();
}
function releaseTour() {
  crossCursor.style.opacity = "0";
  pauseTour();
  tourFollowing = false;
  tourPointer.style.opacity = "0";
  root
    .querySelectorAll(".tour-focus")
    .forEach((el) => el.classList.remove("tour-focus"));
}
function switchPage(page) {
  manualWaiting = false;
  manualHasStarted = false;
  crossCursor.style.opacity = "0";
  crossKey = "";
  crossPosition = null;
  crossGroup = "";
  crossInstant = false;
  pauseTour();
  savedTimes[activePage] = tourAudio.currentTime;
  tourPointer.style.opacity = "0";
  clear();
  tourFollowing = false;
  activePage = page;
  tourData = page === "map" ? mapTourData : sequenceTourData;
  tourAudio = page === "map" ? mapAudio : sequenceAudio;
  tourDuration = tourData.clip.durationMs / 1000;
  tourSeek.max = String(tourDuration);
  tourStatus.textContent = "";
  root.classList.toggle("sequence-page", page === "sequences");
  document.getElementById("page-map").hidden = page !== "map";
  document.getElementById("page-sequences").hidden = page !== "sequences";
  document.getElementById("code-pane").hidden = page !== "sequences";
  document.querySelectorAll("[data-page]").forEach((el) => {
    const on = el.dataset.page === page;
    el.setAttribute("aria-selected", String(on));
    el.tabIndex = on ? 0 : -1;
  });
  if (page === "map") tourPointer = document.getElementById("tour-pointer");
  tourIndex = -1;
  tourWord = -1;
  activePhaseKey = "";
  const audio = tourAudio,
    restore = () => {
      if (activePage !== page || audio !== tourAudio) return;
      audio.currentTime = savedTimes[page];
      syncTour(true);
    };
  if (audio.readyState >= 1) restore();
  else {
    syncTour(true);
    audio.addEventListener("loadedmetadata", restore, { once: true });
  }
}
tourPlay.addEventListener("click", () =>
  manualWaiting ? advanceManual() : tourAudio.paused ? playTour() : pauseTour(),
);
document.getElementById("tour-restart").addEventListener("click", () => {
  pauseTour();
  seekTour(0);
  playTour();
});
document
  .getElementById("tour-prev")
  .addEventListener("click", () =>
    seekTour(tourData.beats[Math.max(0, tourIndex - 1)].start),
  );
document.getElementById("tour-next").addEventListener("click", () => {
  if (advanceMode === "manual") {
    manualHasStarted = true;
    advanceManual();
  } else
    seekTour(
      tourData.beats[Math.min(tourData.beats.length - 1, tourIndex + 1)].start,
    );
});
tourSeek.addEventListener("input", () => seekTour(Number(tourSeek.value)));
for (const audio of [mapAudio, sequenceAudio]) {
  audio.addEventListener("timeupdate", () => {
    if (audio === tourAudio) syncTour();
  });
  audio.addEventListener("ended", () => {
    if (audio === tourAudio) {
      if (
        review.playThrough &&
        activePage === "map" &&
        advanceMode === "auto" &&
        tourFollowing
      ) {
        switchPage("sequences");
        seekTour(0);
        window.scrollTo(0, 0);
        playTour();
        return;
      }
      pauseTour();
      tourStatus.textContent = "Walkthrough complete. Explore or replay.";
    }
  });
  audio.addEventListener("error", () => {
    if (audio === tourAudio) {
      pauseTour();
      tourStatus.textContent =
        "Audio unavailable. Use the arrows to follow the written walkthrough.";
    }
  });
}
root
  .querySelector("#page-map svg")
  .addEventListener("click", releaseTour, true);
root
  .querySelector(".detail .close")
  .addEventListener("click", releaseTour, true);
root.querySelectorAll(".node").forEach((el) =>
  el.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Enter" || e.key === " ") releaseTour();
    },
    true,
  ),
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") releaseTour();
});
document.querySelector(".sequence-tabs").innerHTML = sequenceSpecs
  .map(
    (s, i) =>
      `<button type="button" role="tab" aria-controls="sequence-svg" aria-selected="false" tabindex="-1" data-sequence="${s.id}">${i + 1} · ${escapeText(s.title)}</button>`,
  )
  .join("");
document
  .querySelectorAll("[data-page]")
  .forEach((el) =>
    el.addEventListener("click", () => switchPage(el.dataset.page)),
  );
document.querySelectorAll("[data-sequence]").forEach((el) =>
  el.addEventListener("click", () => {
    pauseTour();
    seekTour(
      sequenceTourData.beats.find((b) => b.diagram === el.dataset.sequence)
        .start,
    );
  }),
);
for (const selector of [".page-tabs", ".sequence-tabs"])
  document.querySelector(selector).addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const tabs = [...e.currentTarget.querySelectorAll('[role="tab"]')],
      i = tabs.indexOf(document.activeElement),
      next =
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? tabs.length - 1
            : (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) %
              tabs.length;
    tabs[next].focus();
    tabs[next].click();
  });
window.addEventListener("pagehide", pauseTour);
switchPage(review.initialPage || "sequences");
