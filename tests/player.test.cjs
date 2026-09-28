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
const html = fs.readFileSync(path.join(repo, "docs/catalog.html"), "utf8");

function player(content = html) {
  const errors = [],
    virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(error));
  const dom = new JSDOM(content, {
    runScripts: "dangerously",
    virtualConsole,
    beforeParse(window) {
      window.matchMedia = () => ({ matches: false });
      window.requestAnimationFrame = () => 1;
      window.cancelAnimationFrame = () => {};
      window.scrollTo = () => {};
      window.Range.prototype.getClientRects = function () {
        const code = this.startContainer.parentElement?.closest("code");
        if (!code) return [];
        const line = code.closest(".code-line").getBoundingClientRect(),
          prefix = this.cloneRange();
        prefix.selectNodeContents(code);
        prefix.setEnd(this.startContainer, this.startOffset);
        const left = line.left + 45 + prefix.toString().length * 7,
          width = this.toString().length * 7;
        return [
          {
            left,
            right: left + width,
            top: line.top,
            bottom: line.bottom,
            width,
            height: line.height,
          },
        ];
      };
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
            top:
              225 +
              (Number(this.dataset.line) -
                Number(
                  this.closest(".code-card").querySelector(".code-line").dataset
                    .line,
                )) *
                22 -
              window.document.getElementById("code-cards").scrollTop,
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

for (const example of [
  { name: "catalog", page: "catalog.html", source: "after" },
  { name: "notices", page: "notices.html", source: "source" },
  { name: "checkout", page: "review.html", source: "source" },
])
  test(`${example.name}: each spoken cue selects exact source, message, and pointer pane`, () => {
    const fixture = path.join(repo, "examples", example.name);
    const review = JSON.parse(
      fs.readFileSync(path.join(fixture, "review.json")),
    );
    const sequenceTrack = JSON.parse(
      fs.readFileSync(path.join(fixture, "audio/sequences.json")),
    );
    const content = fs.readFileSync(
      path.join(repo, "docs", example.page),
      "utf8",
    );
    const { window, document, seek, close, errors } = player(content);
    try {
      document.getElementById("sequences-tab").click();
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
          if (phase.codeTarget) {
            assert.equal(
              window.codeTargetRange().toString(),
              phase.codeTarget.text,
            );
            assert.equal(
              document.getElementById("cross-pane-cursor").dataset.codeTarget,
              phase.codeTarget.text,
            );
          }
          visited.add(phase.point);
          for (const card of document.querySelectorAll(".code-card")) {
            const spec = review.cards[card.dataset.card];
            const lines = fs
              .readFileSync(
                path.join(fixture, example.source, spec.file),
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

test("successive token cues keep the context fixed and aim at distinct text", () => {
  const content = fs.readFileSync(path.join(repo, "docs/notices.html"), "utf8"),
    track = JSON.parse(
      fs.readFileSync(path.join(repo, "examples/notices/audio/sequences.json")),
    ),
    beat = track.beats.find(
      (beat) => beat.diagram === "source" && beat.row === 1,
    ),
    { window, document, seek, close } = player(content);
  try {
    const positions = [];
    for (const text of ["sharedInputs", "inputs", "derived"]) {
      const cue = beat.phases.find((phase) => phase.codeTarget?.text === text);
      seek(cue.start + 1);
      assert.equal(window.codeTargetRange().toString(), text);
      assert.deepEqual(
        [...document.querySelectorAll(".code-line.is-current")].map((line) =>
          Number(line.dataset.line),
        ),
        [3, 4, 5, 6],
      );
      positions.push(window.visibleTokenTarget().box.left);
    }
    assert(positions[0] < positions[1] && positions[1] < positions[2]);
    const expression = beat.phases.at(-1);
    seek(expression.start + 0.1);
    const range = window.codeTargetRange();
    assert.equal(range.toString(), expression.codeTarget.text);
    assert.notEqual(
      range.startContainer,
      range.endContainer,
      "expression crosses syntax spans",
    );
    // A wrapped target must aim at a visible fragment, not the union's empty middle.
    window.Range.prototype.getClientRects = () => [
      { left: 1050, right: 1120, top: 140, bottom: 155, width: 70, height: 15 },
      { left: 1070, right: 1150, top: 300, bottom: 320, width: 80, height: 20 },
    ];
    assert.equal(window.visibleTokenTarget().box.top, 300);
    window.Range.prototype.getClientRects = () => [];
    seek(expression.start + 0.2);
    assert.equal(
      document.getElementById("cross-pane-cursor").style.opacity,
      "0",
    );
  } finally {
    close();
  }
});

test("the player groups nearby tokens automatically during playback and after seeking", () => {
  const content = fs.readFileSync(path.join(repo, "docs/notices.html"), "utf8"),
    track = JSON.parse(
      fs.readFileSync(path.join(repo, "examples/notices/audio/sequences.json")),
    ),
    { window, document, seek, close } = player(content);
  const audio = document.getElementById("sequence-audio"),
    cursor = document.getElementById("cross-pane-cursor"),
    arrow = document.getElementById("cross-pane-arrow"),
    advance = (time) => {
      audio.currentTime = time;
      audio.dispatchEvent(new window.Event("timeupdate"));
    },
    rotation = () =>
      Number(arrow.getAttribute("transform").match(/rotate\(([^)]+)/)[1]);
  try {
    for (const [diagram, texts] of [
      ["selection", ["'en'", "'fr'", "'de'"]],
      ["source", ["sharedInputs", "inputs", "derived"]],
    ]) {
      const beat = track.beats.find(
          (b) => b.diagram === diagram && b.row === 1,
        ),
        cues = texts.map((text) =>
          beat.phases.find((p) => p.codeTarget?.text === text),
        );
      seek(cues[0].start + 0.7);
      const heading = rotation();
      for (const cue of cues.slice(1)) {
        advance(cue.start + 0.1);
        assert.equal(cursor.dataset.motion, "slide");
        assert(Math.abs(rotation() - heading) < 1e-8);
        advance(cue.start + 0.4);
        assert.equal(window.codeTargetRange().toString(), cue.codeTarget.text);
      }
      const placement = () => {
        const [x, y] = arrow
            .getAttribute("transform")
            .match(/translate\(([^)]+)/)[1]
            .split(" ")
            .map(Number),
          box = window.visibleTokenTarget().box;
        return [x - box.left, y - box.top, rotation()];
      };
      const beforeSeek = placement();
      seek(cues.at(-1).start + 0.4);
      assert.deepEqual(
        placement(),
        beforeSeek,
        "seeking uses the same group placement",
      );
    }
    const language = track.beats.find(
      (b) => b.diagram === "selection" && b.row === 1,
    );
    seek(language.phases[1].start + 1);
    advance(language.phases[2].start + 0.1);
    assert.equal(
      cursor.dataset.motion,
      "curve",
      "entering a different card keeps the long approach",
    );

    const en = language.phases[2],
      fr = language.phases[3];
    seek(en.start + 0.7);
    const rects = window.Range.prototype.getClientRects;
    window.Range.prototype.getClientRects = function () {
      return rects
        .call(this)
        .map((r) =>
          this.toString() === "'fr'"
            ? { ...r, top: r.top + 400, bottom: r.bottom + 400 }
            : r,
        );
    };
    advance(fr.start + 0.1);
    assert.equal(
      cursor.dataset.motion,
      "curve",
      "a distant rendered token starts a new group",
    );
    window.Range.prototype.getClientRects = rects;

    window.eval("reducedMotion.matches = true");
    seek(en.start + 0.7);
    advance(fr.start + 0.01);
    const still = arrow.getAttribute("transform");
    advance(fr.start + 0.4);
    assert.equal(
      arrow.getAttribute("transform"),
      still,
      "reduced motion reaches the target immediately",
    );
  } finally {
    close();
  }
});

test("behavior map renders boundaries, captions, and labelled recovery paths", () => {
  const { document, close } = player(
    fs.readFileSync(path.join(repo, "docs/notices.html"), "utf8"),
  );
  try {
    document.getElementById("map-tab").click();
    assert.equal(
      document.querySelectorAll("#map-annotations .section-label").length,
      2,
    );
    assert.equal(
      document.querySelector(".boundary-label").textContent,
      "SELECTED ONLY",
    );
    assert.match(
      document.querySelector("#map-annotations").textContent,
      /Empty selection bypasses validation/,
    );
    const loop = document.querySelector(
      '.edge[data-from="finding"][data-to="repair"]',
    );
    assert.match(loop.textContent, /expand by contract/);
    document
      .querySelector('.node[data-id="finding"]')
      .dispatchEvent(
        new document.defaultView.MouseEvent("click", { bubbles: true }),
      );
    assert(loop.classList.contains("related"));
    assert.equal(
      document
        .querySelector('.node[data-id="repair"]')
        .getAttribute("aria-pressed"),
      "false",
    );
  } finally {
    close();
  }
});

test("map details keep a stable layout slot while hovering and closing", () => {
  const { window, document, close } = player(
    fs.readFileSync(path.join(repo, "docs/review.html"), "utf8"),
  );
  try {
    const detail = document.querySelector(".detail"),
      node = document.querySelector('.node[data-id="inventory"]');
    const slot = detail.parentElement,
      before = window.getComputedStyle(slot);
    assert.equal(window.getComputedStyle(detail).display, "none");
    const height = before.height;
    node.dispatchEvent(new window.MouseEvent("mouseenter"));
    assert.equal(detail.hidden, false);
    assert.equal(window.getComputedStyle(slot).height, height);
    assert.equal(window.getComputedStyle(detail).display, "grid");
    node.dispatchEvent(new window.MouseEvent("mouseleave"));
    assert.equal(window.getComputedStyle(detail).display, "none");
    assert.equal(window.getComputedStyle(slot).height, height);
  } finally {
    close();
  }
});

test("the short showcase points across map siblings and continues into code", async () => {
  const content = fs.readFileSync(path.join(repo, "docs/review.html"), "utf8"),
    mapTrack = JSON.parse(
      fs.readFileSync(path.join(repo, "examples/checkout/audio/map.json")),
    ),
    { window, document, seek, close } = player(content);
  try {
    const pointer = document.getElementById("tour-pointer"),
      audio = document.getElementById("tour-audio");
    for (const name of ["inventory", "receipts", "shipping"]) {
      const beat = mapTrack.beats.find((beat) => beat.target === name);
      seek(beat.start + 0.7);
      assert.equal(
        (Number(pointer.getAttribute("transform").match(/rotate\(([^)]+)/)[1]) +
          720) %
          360,
        45,
      );
    }
    document.getElementById("tour-play").click();
    await Promise.resolve();
    audio.currentTime = mapTrack.clip.durationMs / 1000;
    audio.dispatchEvent(new window.Event("ended"));
    await Promise.resolve();
    assert.equal(document.getElementById("page-map").hidden, true);
    assert.equal(document.getElementById("sequence-audio").paused, false);
    assert.equal(document.getElementById("sequence-audio").currentTime, 0);
    const sequenceAudio = document.getElementById("sequence-audio");
    sequenceAudio.dispatchEvent(new window.Event("ended"));
    assert.match(document.getElementById("tour-status").textContent, /complete/);
    seek(1);
    assert.equal(document.getElementById("tour-status").textContent, "");
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
    fs.readFileSync(path.join(repo, "docs/index.html"), "utf8"),
  );
  assert.equal(
    readme.window.document.querySelector("iframe").getAttribute("src"),
    "review.html",
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
