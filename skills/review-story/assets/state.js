const mapAudio = document.getElementById("tour-audio"),
  sequenceAudio = document.getElementById("sequence-audio");
let activePage = "map",
  activeSequence = null,
  tourData = mapTourData,
  tourAudio = mapAudio,
  tourIndex = -1,
  tourWord = -1,
  tourFollowing = false,
  tourFrame = 0,
  playbackVersion = 0;
const savedTimes = { map: 0, sequences: 0 };
const tourPlay = document.getElementById("tour-play"),
  tourSeek = document.getElementById("tour-seek"),
  tourTitle = document.getElementById("tour-title"),
  tourCaption = document.getElementById("tour-caption"),
  tourStatus = document.getElementById("tour-status");
let tourPointer = document.getElementById("tour-pointer"),
  tourDuration = mapTourData.clip.durationMs / 1000;
let activePhaseKey = "",
  pointerPathNow = null,
  pointerStart = 0,
  pointerDuration = 0.62,
  pointerGrouped = false,
  codeBeatId = "";
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const formatTime = (t) =>
  `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const beatAt = (time) => {
  let n = 0;
  for (
    let i = 1;
    i < tourData.beats.length && tourData.beats[i].start <= time;
    i++
  )
    n = i;
  return n;
};
function phaseAt(beat, time) {
  let n = 0;
  for (let i = 1; i < beat.phases.length && beat.phases[i].start <= time; i++)
    n = i;
  return n;
}
