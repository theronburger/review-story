const root = document.getElementById("operations-map");
const { nodes, edges } = review.map;
const { mapTourData, sequenceTourData, sequenceSpecs, codeCards } = review;
const sourceLink = (file, line = 1) =>
  review.sources[file]?.replace("{line}", String(line)) || "#";

const escapeText = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('\"', "&quot;")
    .replaceAll("'", "&#39;");
root.querySelector("#map-annotations").innerHTML = [
  ...(review.map.sections || []).map(
    (section) =>
      `<text class="section-label" x="${section.x}" y="${section.y}">${escapeText(section.label)}</text><line class="phase-line" x1="${section.x}" y1="${section.y + 12}" x2="${section.x + section.width}" y2="${section.y + 12}"/>`,
  ),
  ...(review.map.boundaries || []).map(
    (boundary) =>
      `<line class="boundary" x1="${boundary.x1}" y1="${boundary.y1}" x2="${boundary.x2}" y2="${boundary.y2}"/><text class="boundary-label" x="${boundary.labelX}" y="${boundary.labelY}" text-anchor="${boundary.anchor || "start"}">${escapeText(boundary.label)}</text>`,
  ),
  ...(review.map.captions || []).map(
    (caption) =>
      `<text class="caption" x="${caption.x}" y="${caption.y}" text-anchor="${caption.anchor || "start"}">${escapeText(caption.text)}</text>`,
  ),
].join("");
root.querySelector("#nodes").innerHTML = nodes
  .map(
    (node) =>
      `<g class="node ${node.side} ${node.small ? "small" : ""} ${node.state ? "state" : ""}" data-id="${node.id}" tabindex="0" role="button" aria-label="${escapeText(node.label)}: ${escapeText(node.description)}" aria-pressed="false"><rect class="surface" x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="10"/><text class="node-title" x="${node.x + node.w / 2}" y="${node.y + (node.subtitle ? 30 : node.h / 2 + 6)}" text-anchor="middle">${escapeText(node.label)}</text>${node.subtitle ? `<text class="node-subtitle" x="${node.x + node.w / 2}" y="${node.y + 51}" text-anchor="middle">${escapeText(node.subtitle)}</text>` : ""}</g>`,
  )
  .join("");
root.querySelector("#edges").innerHTML = edges
  .map(
    (edge) =>
      `<g class="edge ${edge.secondary ? "secondary" : ""}" data-from="${edge.from}" data-to="${edge.to}"><path d="${edge.d}" marker-end="url(#arrow-${edge.secondary ? "secondary" : "main"})"/>${edge.label ? `<text class="edge-label" x="${edge.x}" y="${edge.y}" text-anchor="middle">${escapeText(edge.label)}</text>` : ""}</g>`,
  )
  .join("");
const detail = root.querySelector(".detail");
let pinnedId = null;
const clear = () => {
  root.classList.remove("tracing");
  detail.hidden = true;
  pinnedId = null;
  root.querySelectorAll(".node").forEach((element) => {
    element.classList.remove("selected");
    element.setAttribute("aria-pressed", "false");
  });
};
const show = (id, pin = false) => {
  if (pinnedId && !pin) return;
  const node = nodes.find((candidate) => candidate.id === id);
  if (pin) pinnedId = id;
  const relatedEdges = edges.filter(
    (edge) => edge.from === id || edge.to === id,
  );
  const relatedNodes = new Set([
    id,
    ...relatedEdges.flatMap((edge) => [edge.from, edge.to]),
  ]);
  root.classList.add("tracing");
  root.querySelectorAll(".node").forEach((element) => {
    element.classList.toggle("dimmed", !relatedNodes.has(element.dataset.id));
    element.classList.toggle("selected", element.dataset.id === id);
    element.setAttribute(
      "aria-pressed",
      String(Boolean(pinnedId && element.dataset.id === id)),
    );
  });
  root.querySelectorAll(".edge").forEach((element) => {
    const related = element.dataset.from === id || element.dataset.to === id;
    element.classList.toggle("related", related);
    element.classList.toggle("dimmed", !related);
  });
  detail.classList.toggle("pinned", Boolean(pinnedId));
  detail.classList.toggle("context", node.side === "context");
  detail.querySelector(".kind").textContent = review.legend[node.side];
  detail.querySelector("h2").textContent = node.label;
  detail.querySelector(".description").textContent = node.description;
  detail.querySelector(".boundary-note").textContent = node.boundary;
  detail.querySelector("a").href = sourceLink(node.file);
  detail.hidden = false;
};
root.querySelectorAll(".node").forEach((element) => {
  element.addEventListener("mouseenter", () => show(element.dataset.id));
  element.addEventListener("mouseleave", () => {
    if (!pinnedId) clear();
  });
  element.addEventListener("focus", () => show(element.dataset.id));
  element.addEventListener("blur", () => {
    if (!pinnedId) clear();
  });
  element.addEventListener("click", () => {
    if (pinnedId === element.dataset.id) clear();
    else show(element.dataset.id, true);
  });
  element.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (pinnedId === element.dataset.id) clear();
      else show(element.dataset.id, true);
    }
  });
});
detail.querySelector(".close").addEventListener("click", clear);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") clear();
});
root.querySelector("svg").addEventListener("click", (event) => {
  if (!event.target.closest(".node")) clear();
});
