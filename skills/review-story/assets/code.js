function colorCode(line) {
  const re =
    /((?:\/\/.*$)|(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|\b(?:export|const|let|return|if|throw|new|typeof|interface|import|from|default|void|true|false)\b)/g;
  let out = "",
    last = 0;
  for (const m of line.matchAll(re)) {
    out += escapeText(line.slice(last, m.index));
    const kind = m[0].startsWith("//")
      ? "comment"
      : /^["'`]/.test(m[0])
        ? "str"
        : "kw";
    out += `<span class="${kind}">${escapeText(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + escapeText(line.slice(last));
}
function showCode(beat, phase) {
  if (codeBeatId !== beat.target) {
    codeBeatId = beat.target;
    document.getElementById("code-step").textContent = beat.title;
    document.getElementById("code-cards").innerHTML = beat.cards
      .map((id) => {
        const c = codeCards[id];
        return `<article class="code-card" data-card="${id}"><header><div><span class="code-role">${escapeText(c.label)}</span><span class="code-path">${escapeText(c.file)}</span></div><a href="${sourceLink(c.file, c.start)}" target="_blank" rel="noopener noreferrer">Source ↗</a></header><pre>${c.lines
          .map((line, i) => {
            const n = c.start + i,
              context = c.context.some(([a, b]) => a <= n && n <= b);
            return `<span class="code-line${context ? " in-context" : ""}" data-line="${n}"><span class="ln" aria-hidden="true">${n}</span><code>${colorCode(line) || " "}</code></span>`;
          })
          .join("")}</pre></article>`;
      })
      .join("");
    document.getElementById("code-cards").scrollTop = 0;
  }
  document.getElementById("code-phrase").textContent = phase.phrase;
  document.querySelectorAll(".code-card").forEach((card) => {
    const active = card.dataset.card === phase.card;
    card.classList.toggle("active", active);
    card.querySelectorAll(".code-line").forEach((line) => {
      const n = Number(line.dataset.line),
        current = active && phase.ranges.some(([a, b]) => a <= n && n <= b);
      line.classList.toggle("is-current", current);
      if (current) line.setAttribute("aria-label", `Highlighted line ${n}`);
      else line.removeAttribute("aria-label");
    });
  });
  // Visibility is coordinated with the diagram after both highlights are applied.
}
