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

function player(content = html, url = "about:blank") {
  const errors = [],
    virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(error));
  const dom = new JSDOM(content, {
    url,
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

function introPlayer() {
  const fixture = player(fs.readFileSync(path.join(repo, "docs/review.html"), "utf8"));
  return {...fixture, seekIntro(time) {
    const slider = fixture.document.querySelector(".demo-seek");
    slider.value = String(time);
    slider.dispatchEvent(new fixture.window.Event("input"));
  }};
}

test("demo streaming uses literal 2–3-character chunks and accelerates smoothly", () => {
  const context = {};
  require("node:vm").runInNewContext(fs.readFileSync(path.join(repo, "examples/checkout/intro/stream.js"), "utf8"), context);
  const text = "A deliberately verbose proposal that will leverage all the things. ".repeat(30);
  const stream = context.createDemoStream(text, .35, 3.25);
  let previousEnd = 0, previousTime = .35, previousInterval = Infinity;
  assert.equal(stream.at(0), "");
  for (const chunk of stream.chunks) {
    const interval = chunk.at - previousTime;
    assert([2, 3].includes(chunk.end - previousEnd));
    assert(interval <= previousInterval + 1e-12);
    assert.equal(stream.at(chunk.at), text.slice(0, chunk.end));
    assert.equal(stream.at(chunk.at - 1e-8), text.slice(0, previousEnd));
    previousEnd = chunk.end;
    previousTime = chunk.at;
    previousInterval = interval;
  }
  assert.equal(stream.at(3.6), text);
  assert(stream.chunks[0].at - .35 > previousInterval * 20);
});

test("silent intro starts blank and stacks RFC, PR, RFC, PR, PR in order", () => {
  const {document, seekIntro, close, errors} = introPlayer();
  try {
    const first = document.querySelector('[data-rfc="0"]');
    assert.equal(document.getElementById("operations-map").inert, true);
    assert.equal(document.getElementById("demo-intro-audio"), null);
    assert.equal(first.classList.contains("rfc-landed"), true);
    assert.equal(first.querySelector(".rfc-sheet").textContent, "");
    assert.equal(document.querySelectorAll(".pr-landed").length, 0);
    assert.equal(document.querySelector(".pr-total").hidden, true);
    seekIntro(1);
    assert(first.querySelector(".rfc-sheet").textContent.length > 0);
    assert.equal(document.querySelector(".pr-total").hidden, false);
    const initialRfcLines = Number(document.querySelector(".pr-total").dataset.value);
    assert(initialRfcLines > 0 && initialRfcLines < 30);
    seekIntro(3.65);
    assert.match(first.textContent, /follow-up RFC/);
    assert.equal(document.querySelector(".pr-total-added").dataset.value, "30");
    assert.equal(document.querySelector(".pr-total-removed").dataset.value, "0");
    const firstPr = document.querySelector(".pr-card");
    seekIntro(4.1);
    assert.equal(firstPr.querySelector('[data-stat="commits"]').dataset.value, "1");
    seekIntro(4.5);
    const risingCommits = Number(firstPr.querySelector('[data-stat="commits"]').dataset.value);
    const risingLines = Number(document.querySelector(".pr-total").dataset.value);
    assert(risingCommits > 1 && risingCommits < 47);
    assert(risingLines > 84 && risingLines < 10314);
    seekIntro(5);
    assert.equal(firstPr.querySelector('[data-stat="commits"]').dataset.value, "47");
    assert.equal(document.querySelector(".pr-total").dataset.value, "10314");
    seekIntro(6.5);
    const growingRfcTotal = Number(document.querySelector(".pr-total").dataset.value);
    assert(growingRfcTotal > 10314 && growingRfcTotal < 10341);
    seekIntro(7.2);
    assert.match(document.querySelector('[data-rfc="1"]').textContent, /forthcoming RFC-044/);
    assert.equal(document.querySelector(".pr-total").dataset.value, "10341");
    for (const [time, layers] of [[4.5, [1,2]], [6, [1,2,3]], [8.3, [1,2,3,4]], [10.5, [1,2,3,4,5]]]) {
      seekIntro(time);
      const visible = Array.from(document.querySelectorAll(".rfc-landed,.pr-landed"));
      assert.deepEqual(visible.map(card => Number(card.style.zIndex)).sort((a,b) => a-b), layers);
    }
    assert.equal(document.querySelector(".pr-total").dataset.value, "103271");
    assert.equal(document.querySelector(".pr-total-added").dataset.value, "91204");
    assert.equal(document.querySelector(".pr-total-removed").dataset.value, "12067");
    seekIntro(0);
    assert.equal(first.querySelector(".rfc-sheet").textContent, "");
    assert.equal(document.querySelectorAll(".pr-landed").length, 0);
    assert.deepEqual(errors, []);
  } finally { close(); }
});

test("intro holds silently at the final message until Send starts narration once", async () => {
  const {window, document, seekIntro, close, errors} = introPlayer();
  let now = 0, nextFrame, plays = 0;
  window.performance.now = () => now;
  window.requestAnimationFrame = callback => { nextFrame = callback; return 1; };
  const originalPlay = window.HTMLMediaElement.prototype.play;
  window.HTMLMediaElement.prototype.play = function () { plays++; return originalPlay.call(this); };
  try {
    const send = document.querySelector(".demo-send"), intro = document.getElementById("demo-intro");
    send.click();
    assert.equal(plays, 0);
    seekIntro(12.65);
    assert.equal(document.querySelector(".demo-typed").textContent,
      "My gosh thats a lot of code. Use that review story thing or whatever to make it hurt less please");
    seekIntro(13);
    assert(document.querySelector(".demo-reply").textContent.length > 0);
    seekIntro(17);
    assert.match(document.querySelector(".demo-reply").textContent, /If you turn on sound I can talk you though it$/);
    assert.equal(send.disabled, true);
    document.querySelector(".demo-pause").click();
    now = 10000;
    nextFrame();
    assert.equal(document.querySelector(".demo-confirm-text").textContent, "OK! Sound is on");
    assert.equal(send.disabled, false);
    assert.equal(plays, 0);
    assert.equal(intro.hidden, false);
    assert.equal(document.querySelector(".demo-seek").value, "18");
    assert.equal(document.querySelector(".demo-pause").textContent, "↺ Replay");
    send.click();
    assert.equal(plays, 1, "audio starts synchronously within Send, without a delayed handoff");
    send.click();
    await Promise.resolve();
    assert.equal(plays, 1);
    assert.equal(document.getElementById("demo-tutorial-audio").paused, false);
    assert.equal(document.getElementById("tour-audio").paused, true);
    await new Promise(resolve => setTimeout(resolve, 380));
    assert.equal(intro.hidden, true);
    assert.equal(document.getElementById("operations-map").inert, false);
    document.getElementById("demo-replay").click();
    assert.equal(intro.hidden, false);
    assert.equal(intro.dataset.step, "cards");
    assert.equal(document.getElementById("operations-map").inert, true);
    assert.equal(document.getElementById("tour-audio").paused, true);
    assert.equal(document.querySelector('[data-rfc="0"] .rfc-sheet').textContent, "");
    assert.equal(plays, 1);
    assert.deepEqual(errors, []);
  } finally { close(); }
});

test("Skip and Escape open the review paused without enabling sound", async () => {
  for (const skip of [true, false]) {
    const {window, document, seekIntro, close, errors} = introPlayer();
    try {
      seekIntro(10);
      if (skip) document.querySelector(".demo-skip").click();
      else document.body.dispatchEvent(new window.KeyboardEvent("keydown", {key: "Escape", bubbles: true}));
      await new Promise(resolve => setTimeout(resolve, 380));
      assert.equal(document.getElementById("demo-intro").hidden, true);
      assert.equal(document.getElementById("operations-map").inert, false);
      assert.equal(document.getElementById("tour-audio").paused, true);
      assert.equal(document.getElementById("tour-audio").currentTime, 0);
      assert.deepEqual(errors, []);
    } finally { close(); }
  }
});

test("intro transport freezes playback, seeks backward, and resumes from the chosen time", () => {
  const {window, document, seekIntro, close} = introPlayer();
  let now = 0, nextFrame;
  window.performance.now = () => now;
  window.requestAnimationFrame = callback => { nextFrame = callback; return 1; };
  try {
    const intro = document.getElementById("demo-intro"), pause = document.querySelector(".demo-pause");
    const animation = {playState: "running", pause() {this.playState = "paused";}, play() {this.playState = "running";}};
    intro.getAnimations = () => [animation];
    seekIntro(11.5);
    assert.equal(document.querySelector(".pr-total").dataset.value, "103271");
    assert.equal(animation.playState, "paused");
    seekIntro(1);
    assert.equal(document.querySelectorAll(".pr-landed").length, 0);
    const text = document.querySelector('[data-rfc="0"] .rfc-sheet').textContent;
    now = 5000;
    pause.click();
    assert.equal(animation.playState, "running");
    assert.equal(document.querySelector(".demo-seek").value, "1");
    now = 7000;
    nextFrame();
    assert.equal(document.querySelector(".demo-seek").value, "3");
    assert(document.querySelector('[data-rfc="0"] .rfc-sheet').textContent.length > text.length);
    document.body.dispatchEvent(new window.KeyboardEvent("keydown", {code: "Space", bubbles: true}));
    assert.equal(animation.playState, "paused");
    const frozen = document.querySelector('[data-rfc="0"] .rfc-sheet').textContent;
    now = 20000;
    nextFrame();
    assert.equal(document.querySelector('[data-rfc="0"] .rfc-sheet').textContent, frozen);
    assert.equal(document.getElementById("tour-audio").paused, true);
  } finally { close(); }
});

test("video replies reveal only spoken text, pause for dots, and hand off to the guide", async () => {
  const clip = JSON.parse(fs.readFileSync(path.join(repo, "examples/checkout/intro/video-narration.json")));
  const {window, document, errors, close} = player(fs.readFileSync(path.join(repo, "docs/review.html"), "utf8"), "http://localhost/review.html?video=1");
  let nextFrame;
  window.requestAnimationFrame = callback => {nextFrame = callback; return 1;};
  try {
    const intro = document.getElementById("demo-intro"), audio = document.getElementById("demo-video-audio"),
      pause = document.querySelector(".demo-pause"), slider = document.querySelector(".demo-seek");
    assert.equal(audio.paused, true);
    assert.equal(document.querySelector(".demo-confirm").hidden, true);
    pause.click();
    await new Promise(setImmediate);
    assert.equal(audio.paused, false);
    for (const [index, selector] of [[0, ".demo-reply"], [1, ".demo-ready-text"]]) {
      const message = clip.messages[index];
      for (const word of message.words) {
        audio.currentTime = word.startMs / 1000 + .001;
        nextFrame();
        const end = Math.max(...message.words.filter(item => item.startMs <= audio.currentTime * 1000).map(item => item.charIndex + item.charLength));
        const node = document.querySelector(selector);
        assert.equal(node.textContent, message.text.slice(0, end));
        assert.equal(node.children.length, 0, "no future-word or active-word spans");
      }
      if (index === 0) {
        audio.currentTime = (clip.loaderStartMs + 500) / 1000;
        nextFrame();
        assert.equal(intro.dataset.step, "working");
        assert.equal(document.querySelector(".demo-video-thinking").hidden, false);
        assert.equal(document.querySelector(".demo-ready-text").textContent, "");
        assert.equal(document.querySelectorAll(".demo-video-thinking i").length, 3);
        assert.equal(clip.readyStartMs - clip.loaderStartMs, 1000);
      }
    }
    assert.equal(document.querySelector(".demo-ready-text").textContent, "OK ready, let me walk you through it");
    assert.equal(document.querySelector(".demo-video-thinking").hidden, true);
    pause.click();
    assert.equal(audio.paused, true);
    slider.value = "12.8";
    slider.dispatchEvent(new window.Event("input"));
    assert.equal(audio.currentTime, 12.8);
    assert.equal(document.querySelector(".demo-reply").textContent, "");
    assert.equal(document.querySelector(".demo-ready-text").textContent, "");
    pause.click();
    await new Promise(setImmediate);
    audio.currentTime = clip.durationMs / 1000;
    nextFrame();
    await new Promise(setImmediate);
    assert.equal(audio.paused, true);
    assert.equal(document.getElementById("demo-tutorial-audio").paused, false);
    assert.equal(document.getElementById("tour-audio").paused, true);
    await new Promise(resolve => setTimeout(resolve, 380));
    assert.equal(intro.hidden, true);
    document.getElementById("demo-replay").click();
    assert.equal(audio.currentTime, 0);
    assert.equal(audio.paused, true);
    assert.equal(document.getElementById("tour-audio").paused, true);
    assert.equal(intro.hidden, false);
    assert.deepEqual(errors, []);
  } finally {close();}
});

test("tutorial spotlights all four zones, freezes spoken context, and hands off once", async () => {
  const clip = JSON.parse(fs.readFileSync(path.join(repo, "examples/checkout/intro/tutorial-narration.json")));
  const {window, document, seekIntro, errors, close} = introPlayer();
  let nextFrame;
  window.requestAnimationFrame = callback => { nextFrame = callback; return 1; };
  try {
    for (const [selector, top] of [['.tour', 100], ['.page-tabs', 300], ['#page-map .diagram', 400]]) {
      document.querySelector(selector).getBoundingClientRect = () => ({left:20, right:420, top, bottom:top+80, width:400, height:80});
    }
    for (const [id, left, width] of [['map-tab',20,120], ['sequences-tab',146,160]]) {
      document.getElementById(id).getBoundingClientRect = () => ({left, right:left+width, top:300, bottom:336, width, height:36});
    }
    seekIntro(18);
    document.querySelector('.demo-send').click();
    await new Promise(setImmediate);
    const audio = document.getElementById('demo-tutorial-audio'), overlay = document.getElementById('demo-tutorial'),
      play = document.getElementById('tour-play'), slider = document.getElementById('tour-seek');
    assert.equal(overlay.hidden, false);
    assert.equal(document.getElementById('tour-audio').paused, true);
    const pointer = document.getElementById('cross-pane-arrow'), cursor = document.getElementById('cross-pane-cursor');
    assert(pointer.getAttribute('transform')?.startsWith('translate('));
    assert.equal(cursor.style.opacity, '1');
    assert.equal(document.querySelectorAll('#page-map .tour-focus,#page-map .selected').length, 0);
    assert.equal(overlay.querySelector('.demo-tutorial-border'), null);
    assert.equal(overlay.querySelectorAll('mask rect[fill="black"]').length, 1, 'only one zone stays bright');
    assert.equal(clip.messages[1].text, "The spoken words are here. Notice it highlights the word I'm speaking. If you pause, its easy to jump to the surrounding context because the cursor is visible");
    for (const [index, message] of clip.messages.entries()) {
      const word = message.words[1];
      audio.currentTime = (word.startMs + 1) / 1000;
      nextFrame();
      assert.equal(overlay.dataset.zone, message.target);
      assert.equal(overlay.dataset.spotlight, ['.tour','.tour','.page-tabs','#page-map .diagram'][index]);
      assert.equal(Number(overlay.querySelector('.demo-tutorial-window').getAttribute('y')), [99,99,292,399][index]);
      if (index === 2) {
        const lit = overlay.querySelector('.demo-tutorial-window');
        assert.equal(Number(lit.getAttribute('x')), 12);
        assert.equal(Number(lit.getAttribute('width')), 302);
        assert.equal(Number(lit.getAttribute('height')), 52);
      }
      assert.equal(cursor.dataset.tutorialTarget, ['#tour-play','#tour-caption','#sequences-tab','.node[data-id="paid"] .surface'][index]);
      assert.match(document.getElementById('tour-title').textContent, new RegExp(`${index + 1} / 4`));
      assert.equal(document.getElementById('tour-caption').textContent, message.text);
      assert.equal(document.querySelector('#tour-caption mark').textContent, message.text.slice(word.charIndex, word.charIndex + word.charLength));
    }
    const frozenPointer = pointer.getAttribute('transform');
    play.click();
    const frozen = document.getElementById('tour-caption').innerHTML;
    nextFrame();
    assert.equal(audio.paused, true);
    assert.equal(document.getElementById('tour-caption').innerHTML, frozen);
    assert.equal(pointer.getAttribute('transform'), frozenPointer);
    slider.value = String(clip.messages[1].words[2].startMs / 1000 + .001);
    slider.dispatchEvent(new window.Event('input', {bubbles: true}));
    assert.equal(overlay.dataset.zone, '#tour-caption');
    assert.equal(audio.paused, true);
    document.getElementById('tour-audio').dispatchEvent(new window.Event('timeupdate'));
    assert.equal(document.getElementById('tour-caption').textContent, clip.messages[1].text);
    play.click();
    await new Promise(setImmediate);
    assert.equal(clip.durationMs - clip.fadeStartMs, 500);
    audio.currentTime = (clip.fadeStartMs + 250) / 1000;
    nextFrame();
    assert.equal(overlay.hidden, false);
    assert.equal(overlay.style.opacity, '0.5');
    assert.equal(document.getElementById('tour-audio').paused, true);
    play.click();
    nextFrame();
    assert.equal(overlay.style.opacity, '0.5', 'pausing freezes the fade');
    slider.value = '1';
    slider.dispatchEvent(new window.Event('input'));
    assert.equal(overlay.style.opacity, '1', 'seeking backward restores dimming');
    play.click();
    await new Promise(setImmediate);
    audio.currentTime = clip.durationMs / 1000;
    nextFrame();
    await new Promise(setImmediate);
    assert.equal(overlay.hidden, true);
    assert.equal(audio.paused, true);
    assert.equal(document.getElementById('tour-audio').paused, false);
    assert.equal(document.getElementById('tour-audio').currentTime, 0);
    assert.equal(document.body.classList.contains('demo-tutorial-active'), false);
    assert.equal(cursor.style.opacity, '0');
    assert.equal(cursor.dataset.tutorialTarget, undefined);
    assert.equal(document.getElementById('tour-advance').disabled, false);
    assert.match(document.getElementById('tour-title').textContent, /1 \/ 5 · One event/);
    let repeatPlays = 0;
    document.getElementById('tour-audio').play = () => { repeatPlays++; return Promise.resolve(); };
    audio.dispatchEvent(new window.Event('ended'));
    assert.equal(repeatPlays, 0);
    assert.deepEqual(errors, []);
  } finally { close(); }
});

test("the caption pointer holds a default position while spoken words change", async () => {
  const clip = JSON.parse(fs.readFileSync(path.join(repo, "examples/checkout/intro/tutorial-narration.json")));
  const {window, document, seekIntro, close} = introPlayer();
  try {
    seekIntro(18);
    document.querySelector('.demo-send').click();
    await new Promise(setImmediate);
    const slider = document.getElementById('tour-seek'), arrow = document.getElementById('cross-pane-arrow'),
      message = clip.messages[1];
    function seek(time) { slider.value = String(time); slider.dispatchEvent(new window.Event('input')); }
    seek(message.startMs / 1000 + 1);
    const parked = arrow.getAttribute('transform');
    for (const word of message.words.filter(word => word.startMs > message.startMs + 1000).reverse()) {
      seek(word.startMs / 1000 + .01);
      assert.equal(arrow.getAttribute('transform'), parked);
      assert.equal(document.getElementById('demo-tutorial-audio').paused, true);
    }
    seek(clip.messages[2].startMs / 1000 + 1);
    const scenePointer = arrow.getAttribute('transform');
    seek(clip.messages[2].startMs / 1000 + 1.7);
    assert.equal(arrow.getAttribute('transform'), scenePointer);
    assert.equal(document.getElementById('cross-pane-cursor').dataset.tutorialTarget, '#sequences-tab');
  } finally { close(); }
});

test("tutorial can retry blocked audio, skip, exit, and cancel on intro replay", async () => {
  for (const action of ['skip', 'escape', 'replay', 'scene']) {
    const {window, document, seekIntro, errors, close} = introPlayer();
    try {
      const audio = document.getElementById('demo-tutorial-audio'), nativePlay = audio.play;
      audio.play = () => Promise.reject(new Error('NotAllowedError'));
      seekIntro(18);
      document.querySelector('.demo-send').click();
      await new Promise(setImmediate);
      assert.match(document.getElementById('tour-status').textContent, /Press Play/);
      audio.play = nativePlay;
      document.getElementById('tour-play').click();
      await new Promise(setImmediate);
      assert.equal(audio.paused, false);
      if (action === 'skip') document.getElementById('demo-tutorial-skip').click();
      if (action === 'escape') document.body.dispatchEvent(new window.KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
      if (action === 'replay') document.getElementById('demo-replay').click();
      if (action === 'scene') document.getElementById('sequences-tab').click();
      await new Promise(setImmediate);
      assert.equal(audio.paused, true);
      assert.equal(document.getElementById('demo-tutorial').hidden, true);
      assert.equal(document.getElementById('tour-audio').paused, action !== 'skip');
      assert.equal(document.getElementById('sequence-audio').paused, true);
      if (action === 'replay') assert.equal(document.getElementById('demo-intro').inert, false);
      if (action === 'scene') assert.equal(document.getElementById('page-sequences').hidden, false);
      assert.deepEqual(errors, []);
    } finally { close(); }
  }
});

test("video autoplay rejection leaves the intro paused and ready to retry", async () => {
  const {window, document, close} = player(fs.readFileSync(path.join(repo, "docs/review.html"), "utf8"), "http://localhost/review.html?video=1");
  try {
    const audio = document.getElementById("demo-video-audio");
    audio.play = () => Promise.reject(new Error("NotAllowedError"));
    document.querySelector(".demo-pause").click();
    await new Promise(setImmediate);
    await new Promise(setImmediate);
    assert(document.getElementById("demo-intro").classList.contains("demo-paused"));
    assert.equal(document.querySelector(".demo-video-error").hidden, false);
    assert.equal(document.getElementById("tour-audio").paused, true);
    assert.equal(audio.currentTime, 0);
  } finally {close();}
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
