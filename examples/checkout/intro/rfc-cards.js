function createRfcScene(stage) {
  const specs = [
    {at: 0, start: .35, duration: 3.25, rotation: -.45, layer: 1, blocks: [
      ["small", "RFC-042 · DRAFT · PLATFORM"],
      ["h2", "A holistic, future-proof checkout ecosystem"],
      ["p", "Authors: Platform Enablement Working Group · Status: Open for alignment"],
      ["h3", "Executive summary"],
      ["p", "In today's rapidly evolving digital landscape, checkout is more than a transaction. It is a strategic opportunity to unlock seamless, scalable, and delightful experiences across the entire customer journey. This RFC proposes a robust, extensible foundation that empowers teams to move forward with confidence."],
      ["h3", "Guiding principles"],
      ["p", "1. Leverage synergies across inventory, receipts, and shipping.\n2. Foster alignment through a shared, single source of truth.\n3. Embrace a modular, composable, cloud-ready architecture.\n4. Prioritize simplicity without compromising comprehensive flexibility."],
      ["h3", "Proposed architecture"],
      ["p", "We will introduce a unified orchestration layer that seamlessly bridges existing abstractions while creating a clear path toward future abstraction. Each capability will be independently decoupled, yet holistically integrated, through a thoughtfully designed ecosystem of adapters, providers, and provider adapters."],
      ["p", "It is important to note that this approach is intentionally technology-agnostic. By leveraging best-in-class patterns, we can ensure that the solution remains both battle-tested and forward-looking. The resulting framework provides a flexible foundation for a wide range of future use cases."],
      ["h3", "Rollout and success criteria"],
      ["p", "Phase 1: Align on the alignment framework. Phase 2: Enable foundational enablement. Phase 3: Operationalize continuous optimization. Success will be measured through a balanced scorecard of adoption, stakeholder confidence, and demonstrable progress toward measurable outcomes."],
      ["h3", "Open questions"],
      ["p", "How might we further streamline the streamlined experience? Which cross-functional stakeholders should own the ownership model? These questions will be explored in a follow-up RFC to ensure a comprehensive, well-rounded approach."],
    ]},
    {at: 5.25, start: 5.45, duration: 1.7, rotation: .7, layer: 3, blocks: [
      ["small", "RFC-043 · FOLLOW-UP · STRATEGIC ALIGNMENT"],
      ["h2", "Unifying the unified platform foundation"],
      ["p", "A comprehensive proposal for a cohesive, scalable, next-generation architecture"],
      ["h3", "Context and motivation"],
      ["p", "Building on the strong foundation established in RFC-042, this document takes a step back to examine the bigger picture. Our current approach presents a unique opportunity to rethink how we think about platform thinking. A holistic lens will help us identify the key enablers of sustainable, long-term transformation."],
      ["h3", "The north star"],
      ["p", "A seamless developer experience, powered by a robust ecosystem of loosely coupled capabilities. The platform should be intuitive yet powerful, opinionated yet flexible, and simple yet comprehensive. These complementary principles will guide every decision throughout the implementation journey."],
      ["h3", "Scope and non-goals"],
      ["p", "In scope: the event bus, all consumers, shared contracts, retry semantics, observability, dashboards, configuration, migration tooling, and a lightweight governance framework. Out of scope: unnecessary complexity, premature optimization, and anything that does not directly support the broader strategic vision."],
      ["h3", "Implementation strategy"],
      ["p", "Introduce an abstraction over the orchestration layer to streamline the coordination of cross-cutting concerns. Then consolidate the abstraction registry into a unified registry abstraction. This creates a natural extension point for future extension points while preserving backward compatibility with forward-looking requirements."],
      ["p", "Each workstream will ship incrementally behind a feature flag, with a phased rollout, a gradual ramp, a feedback loop, and a clearly defined definition of done. A dedicated enablement workstream will enable the other workstreams to work more effectively."],
      ["h3", "Risks and mitigations"],
      ["p", "Risk: insufficient alignment. Mitigation: additional alignment. Risk: scope expansion. Mitigation: a flexible scope framework. Risk: documentation overhead. Mitigation: a comprehensive documentation strategy, detailed in the forthcoming RFC-044."],
    ]},
  ];
  const cards = specs.map((spec, index) => {
    const card = document.createElement("article"), sheet = document.createElement("div");
    card.className = "rfc-card";
    card.dataset.rfc = String(index);
    card.setAttribute("aria-label", `Fictional RFC ${index + 1}`);
    card.style.zIndex = String(spec.layer);
    card.style.setProperty("--card-angle", `${spec.rotation}deg`);
    card.style.setProperty("--card-x", `${index ? -6 : -14}px`);
    sheet.className = "rfc-sheet";
    let offset = 0;
    const blocks = spec.blocks.map(([tag, text]) => {
      const node = document.createElement(tag), start = offset;
      node.hidden = true;
      offset += text.length + 2;
      sheet.append(node);
      return {node, text, start};
    });
    const caret = document.createElement("span");
    caret.className = "rfc-blank-caret";
    caret.setAttribute("aria-hidden", "true");
    card.append(sheet, caret);
    stage.querySelector(".pr-stack").append(card);
    return {card, sheet, caret, blocks, spec, previous: -1,
      stream: createDemoStream(spec.blocks.map(block => block[1]).join("\n\n"), spec.start, spec.duration)};
  });
  return {
    render(time, seeking = false) {
      let lines = 0;
      for (const item of cards) {
        const {card, sheet, caret, blocks, spec, stream} = item;
        const visible = time >= spec.at, text = stream.at(time), count = text.length;
        lines += text ? text.split("\n").length : 0;
        card.classList.toggle("rfc-landed", visible);
        card.setAttribute("aria-hidden", String(!visible));
        caret.hidden = count > 0;
        if (count !== item.previous) {
          for (const {node, text, start} of blocks) {
            const length = Math.max(0, count - start);
            node.hidden = length === 0;
            node.textContent = text.slice(0, length);
            node.classList.toggle("rfc-writing", length > 0 && length < text.length);
          }
          sheet.scrollTop = sheet.scrollHeight;
          item.previous = count;
        }
        if (seeking) for (const animation of card.getAnimations?.() || []) {
          animation.currentTime = Math.max(0, (time - spec.at) * 1000);
          animation.pause();
        }
      }
      return lines;
    },
  };
}
