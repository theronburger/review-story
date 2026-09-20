const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { JSDOM, VirtualConsole } = require("jsdom");
const repo = path.resolve(__dirname, "..");
const review = JSON.parse(
  fs.readFileSync(path.join(repo, "examples/catalog/review.json")),
);
const sequenceTrack = JSON.parse(
  fs.readFileSync(path.join(repo, "examples/catalog/audio/sequences.json")),
);
const html = fs.readFileSync(path.join(repo, "docs/review.html"), "utf8");

function player() {
  const errors = [],
    virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(error));
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    virtualConsole,
    beforeParse(window) {
      window.matchMedia = () => ({ matches: false });
      window.requestAnimationFrame = () => 1;
      window.cancelAnimationFrame = () => {};
      window.innerHeight = 1000;
      window.innerWidth = 1800;
      window.HTMLElement.prototype.scrollTo = function ({
        top = 0,
        left = 0,
      } = {}) {
        this.scrollTop = top;
        this.scrollLeft = left;
      };
      Object.defineProperty(window.HTMLMediaElement.prototype, "readyState", {
        get() {
          return 1;
        },
      });
      Object.defineProperty(window.HTMLMediaElement.prototype, "paused", {
        get() {
          return this._paused !== false;
        },
      });
      window.HTMLMediaElement.prototype.play = function () {
        this._paused = false;
        return Promise.resolve();
      };
      window.HTMLMediaElement.prototype.pause = function () {
        this._paused = true;
      };
      window.Element.prototype.getBoundingClientRect = function () {
        let rect = { left: 20, top: 420, width: 100, height: 22 };
        if (this.id === "code-cards")
          rect = { left: 980, top: 150, width: 750, height: 750 };
        else if (this.matches(".code-card header"))
          rect = { left: 1000, top: 160, width: 700, height: 50 };
        else if (this.classList.contains("code-line"))
          rect = {
            left: 1000,
            top: 225 + Number(this.dataset.line) * 22,
            width: 700,
            height: 22,
          };
        else if (this.classList.contains("sequence-canvas"))
          rect = { left: 20, top: 300, width: 900, height: 580 };
        else if (this.matches(".sequence-participants svg"))
          rect = { left: 20, top: 300, width: 900, height: 86 };
        else if (this.matches(".seq-row text:not(.seq-number)"))
          rect = { left: 260, top: 455, width: 240, height: 22 };
        else if (this.classList.contains("seq-line"))
          rect = { left: 260, top: 480, width: 240, height: 8 };
        return {
          ...rect,
          right: rect.left + rect.width,
          bottom: rect.top + rect.height,
          x: rect.left,
          y: rect.top,
        };
      };
    },
  });
  const window = dom.window,
    document = window.document;
  assert.deepEqual(errors, []);
  return {
    window,
    document,
    errors,
    close: () => window.close(),
    seek(time) {
      const slider = document.getElementById("tour-seek");
      slider.value = time;
      slider.dispatchEvent(new window.Event("input"));
    },
  };
}

test("each spoken cue selects its exact source, message, and pointer pane", () => {
  const { document, seek, close, errors } = player();
  try {
    assert.equal(document.getElementById("page-sequences").hidden, false);
    const visited = new Set();
    for (const beat of sequenceTrack.beats)
      for (const phase of beat.phases) {
        seek(phase.start + 0.01);
        const row = document.querySelector(".seq-row.active");
        assert.equal(Number(row.dataset.row), beat.row);
        assert.equal(Number(row.dataset.message), phase.message);
        assert.equal(
          document.querySelector(".code-card.active").dataset.card,
          phase.card,
        );
        const selected = [
          ...document.querySelectorAll(".code-line.is-current"),
        ].map((line) => Number(line.dataset.line));
        const expected = [
          ...new Set(
            phase.ranges.flatMap(([first, last]) =>
              Array.from(
                { length: last - first + 1 },
                (_, index) => first + index,
              ),
            ),
          ),
        ].sort((a, b) => a - b);
        assert.deepEqual(selected, expected);
        assert.equal(
          document.getElementById("cross-pane-cursor").dataset.target,
          phase.point,
        );
        visited.add(phase.point);
        for (const card of document.querySelectorAll(".code-card")) {
          const spec = review.cards[card.dataset.card];
          const lines = fs
            .readFileSync(
              path.join(repo, "examples/catalog/after", spec.file),
              "utf8",
            )
            .split("\n");
          for (const line of card.querySelectorAll(".code-line"))
            assert.equal(
              line.querySelector("code").textContent,
              lines[Number(line.dataset.line) - 1] || " ",
            );
        }
      }
    assert.deepEqual([...visited].sort(), ["code", "diagram"]);
    assert.deepEqual(errors, []);
  } finally {
    close();
  }
});

test("path toggle hides during seeking and restores the current beat only", () => {
  const { window, document, seek, close } = player();
  try {
    const toggle = document.getElementById("show-cursor-path"),
      overlay = document.getElementById("cursor-trail-debug");
    assert.equal(toggle.checked, false);
    seek(1);
    assert.equal(overlay.style.opacity, "0");
    toggle.checked = true;
    toggle.dispatchEvent(new window.Event("change"));
    assert.equal(overlay.style.opacity, "1");
    seek(sequenceTrack.beats[1].start + 0.1);
    assert.equal(
      document
        .getElementById("cursor-trail-actual")
        .getAttribute("d")
        .split("L").length,
      1,
    );
    toggle.checked = false;
    toggle.dispatchEvent(new window.Event("change"));
    seek(2);
    assert.equal(overlay.style.opacity, "0");
  } finally {
    close();
  }
});

test("manual playback stops before the next beat and Space advances", async () => {
  const { window, document, close } = player();
  try {
    const select = document.getElementById("tour-advance");
    select.value = "manual";
    select.dispatchEvent(new window.Event("change"));
    document.getElementById("tour-play").click();
    await Promise.resolve();
    const audio = document.getElementById("sequence-audio");
    assert.equal(audio.paused, false);
    audio.currentTime = sequenceTrack.beats[1].start - 0.01;
    audio.dispatchEvent(new window.Event("timeupdate"));
    assert.equal(audio.paused, true);
    assert.match(document.getElementById("tour-play").textContent, /Next beat/);
    assert.match(document.getElementById("tour-title").textContent, /^1 \/ /);
    document.body.dispatchEvent(
      new window.KeyboardEvent("keydown", { code: "Space", bubbles: true }),
    );
    await Promise.resolve();
    assert.equal(audio.currentTime, sequenceTrack.beats[1].start);
    assert.equal(audio.paused, false);
    select.dispatchEvent(
      new window.KeyboardEvent("keydown", { code: "Space", bubbles: true }),
    );
    assert.equal(audio.currentTime, sequenceTrack.beats[1].start);
  } finally {
    close();
  }
});

test("page tabs preserve independent positions and map selection works", () => {
  const { document, seek, close } = player();
  try {
    seek(15);
    document.getElementById("map-tab").click();
    assert(document.getElementById("code-pane").hidden);
    seek(2);
    assert.equal(document.querySelectorAll(".node.tour-focus").length, 1);
    document.getElementById("sequences-tab").click();
    assert.equal(document.getElementById("sequence-audio").currentTime, 15);
    assert.equal(document.getElementById("tour-audio").currentTime, 2);
    document.querySelector('[data-sequence="decisions"]').click();
    assert.equal(
      document.getElementById("sequence-title").textContent,
      "Fallback and rejection",
    );
  } finally {
    close();
  }
});

test("HTML README embeds the demo; playback resources and source links are present", () => {
  const readme = new JSDOM(
    fs.readFileSync(path.join(repo, "README.html"), "utf8"),
  );
  assert.equal(
    readme.window.document.querySelector("iframe").getAttribute("src"),
    "docs/review.html",
  );
  readme.window.close();
  const dom = new JSDOM(html),
    document = dom.window.document;
  assert.equal(
    document.querySelectorAll('script[src],link[rel="stylesheet"]').length,
    0,
  );
  for (const [id, name] of [
    ["tour-audio", "map"],
    ["sequence-audio", "sequences"],
  ]) {
    const encoded = document
      .getElementById(id)
      .getAttribute("src")
      .split(",")[1];
    assert.deepEqual(
      Buffer.from(encoded, "base64"),
      fs.readFileSync(path.join(repo, `examples/catalog/audio/${name}.wav`)),
    );
  }
  for (const card of Object.values(review.cards)) {
    const page = fs.readFileSync(
      path.join(repo, "docs/source", card.file + ".html"),
      "utf8",
    );
    assert(page.includes(`id="L${card.end}"`));
  }
  dom.window.close();
});
