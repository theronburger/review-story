const actorX = (spec, i) => 90 + (i * 720) / (spec.actors.length - 1);
function messageGeometry(spec, row, mi) {
  const m = spec.rows[row].messages[mi];
  const index =
    spec.rows.slice(0, row).reduce((n, r) => n + r.messages.length, 0) + mi;
  const y = 130 + index * 66,
    x1 = actorX(spec, m.from),
    x2 = actorX(spec, m.to);
  return { m, y, x1, x2, index };
}
function labelMarkup(label, x, y) {
  const lines = [""];
  for (const word of label.split(" ")) {
    const i = lines.length - 1;
    if (lines[i] && (lines[i] + " " + word).length > 55) lines.push(word);
    else lines[i] += (lines[i] ? " " : "") + word;
  }
  const width = Math.max(...lines.map((s) => s.length)) * 3.65,
    center = Math.max(width + 35, Math.min(865 - width, x));
  return `<text x="${center}" y="${y - 8 - (lines.length - 1) * 15}" text-anchor="middle">${lines.map((line, i) => `<tspan x="${center}" dy="${i ? 15 : 0}">${escapeText(line)}</tspan>`).join("")}</text>`;
}
function renderSequence(id) {
  if (activeSequence === id) {
    tourPointer = document.getElementById("sequence-pointer");
    return;
  }
  activeSequence = id;
  const spec = sequenceSpecs.find((s) => s.id === id),
    svg = document.getElementById("sequence-svg"),
    count = spec.rows.reduce((n, r) => n + r.messages.length, 0),
    end = 170 + count * 66;
  document.getElementById("sequence-title").textContent = spec.title;
  document.getElementById("sequence-subtitle").textContent = spec.subtitle;
  document.getElementById("sequence-source").href = sourceLink(spec.file);
  document.querySelectorAll("[data-sequence]").forEach((el) => {
    const selected = el.dataset.sequence === id;
    el.setAttribute("aria-selected", String(selected));
    el.tabIndex = selected ? 0 : -1;
  });
  svg.setAttribute("viewBox", `0 0 900 ${end}`);
  svg.setAttribute("aria-label", spec.title + ". " + spec.subtitle);
  svg.innerHTML =
    '<defs><marker id="call-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#607b98"/></marker><marker id="return-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 1L9 5L0 9" fill="none" stroke="#607b98" stroke-width="1.5"/></marker></defs>' +
    spec.actors
      .map((label, i) => {
        const x = actorX(spec, i);
        return `<line class="seq-life" x1="${x}" x2="${x}" y1="78" y2="${end - 45}"/><g class="seq-actor"><rect x="${x - 79}" y="24" width="158" height="54" rx="9"/><text x="${x}" y="56" text-anchor="middle">${escapeText(label)}</text></g>`;
      })
      .join("") +
    spec.rows
      .flatMap((row, ri) =>
        row.messages.map((message, mi) => {
          const { m, y, x1, x2 } = messageGeometry(spec, ri, mi),
            local = m.kind === "local",
            isReturn = m.kind === "return";
          const path = local
            ? `M${x1} ${y}h42v20h-42`
            : `M${x1} ${y + 8}H${x2}`;
          return `<g class="seq-row" data-row="${ri}" data-message="${mi}" data-kind="${m.kind}" role="button" tabindex="0" aria-label="Step ${ri + 1}, ${m.kind}: ${escapeText(m.label)}"><rect class="seq-hit" x="12" y="${y - 38}" width="876" height="64" rx="7"/><text class="seq-number" x="24" y="${y + 7}">${ri + 1}.${mi + 1}</text><path class="seq-line" d="${path}" marker-end="url(#${isReturn ? "return" : "call"}-arrow)"${isReturn ? ' stroke-dasharray="5 4"' : ""}/>${labelMarkup(m.label, local ? x1 + 80 : (x1 + x2) / 2, y)}</g>`;
        }),
      )
      .join("") +
    '<g id="sequence-pointer" aria-hidden="true" style="opacity:0"><path d="M0 0 L7.1 17 L9.6 9.6 L17 7.1 Z" fill="#7044c3" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></g>';
  document.querySelector(".sequence-participants svg").innerHTML = [
    ...svg.querySelectorAll(".seq-actor"),
  ]
    .map((el) => el.outerHTML)
    .join("");
  tourPointer = document.getElementById("sequence-pointer");
  svg.querySelectorAll(".seq-row").forEach((el) => {
    const inspect = () => {
      pauseTour();
      const beat = sequenceTourData.beats.find(
        (b) => b.diagram === id && b.row === Number(el.dataset.row),
      );
      const mi = Number(el.dataset.message),
        phase =
          beat.phases.find((p) => p.message === mi) ||
          beat.phases.reduce((best, p) =>
            Math.abs(p.message - mi) < Math.abs(best.message - mi) ? p : best,
          );
      seekTour(phase.start);
      if (phase.message !== mi) {
        focusStep(
          beat,
          {
            ...phase,
            message: mi,
            phrase: spec.rows[beat.row].messages[mi].label,
          },
          tourAudio.currentTime,
        );
        samplePointer(tourAudio.currentTime);
      }
    };
    el.addEventListener("click", inspect);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        inspect();
      }
    });
  });
}
