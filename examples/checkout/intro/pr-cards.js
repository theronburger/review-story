function createPullRequestScene(stage, totals) {
  const icons = __INTRO_ICONS__;
  const specs = [
    { title: "fix: one tiny typo", number: 42, branch: "just-a-typo", at: 3.85, ramp: .8, rotation: -2.1, layer: 2,
      conversation: 19, commits: 47, checks: 8, files: 67, added: 8948, removed: 1336,
      paths: ["src/labels.ts", "src/labels.test.ts", "README.md"],
      code: ["export const receipt = {", "-  title: 'Thanks for you're order',", "+  title: 'Thanks for your order',", "   total: formatCurrency(order.total),", "   sent: true,", "};"] },
    { title: "chore: while we're in here", number: 43, branch: "quick-cleanup", at: 7.45, ramp: .9, rotation: 1.35, layer: 4,
      conversation: 37, commits: 64, checks: 12, files: 128, added: 18420, removed: 3912,
      paths: ["src/events/dispatch.ts", "src/receipts/send.ts", "src/inventory/reserve.ts", "src/shipping/book.ts", "src/shared/types.ts", "tests/checkout.test.ts"],
      code: ["export async function dispatch(event) {", "-  await sendReceipt(event.data);", "+  return Promise.allSettled([", "+    inventory.reserve(event.data),", "+    receipts.send(event.data),", "+    shipping.book(event.data),", "+  ]);", "}"] },
    { title: "refactor: should be a quick review", number: 44, branch: "one-last-thing", at: 8.8, ramp: 1.15, rotation: -.65, layer: 5,
      conversation: 214, commits: 387, checks: 28, files: 842, added: 63779, removed: 6819,
      paths: ["apps/checkout/index.ts", "workers/inventory/reserve.ts", "workers/receipts/compose.ts", "workers/receipts/retry.ts", "workers/shipping/carriers.ts", "packages/events/bus.ts", "packages/shared/contracts.ts", "tests/integration/order.test.ts"],
      code: ["export async function processOrder(event) {", "-  const result = await legacyCheckout(event);", "+  const context = await hydrate(event);", "+  const consumers = registerAll(context);", "+  const results = await fanOut(consumers);", "+  await persistOutcomes(results);", "+  await scheduleRetries(results);", "+  return summarize(results);", "}"] },
  ];
  const initialCounts = {conversation: 2, commits: 1, checks: 3, files: 3, added: 48, removed: 6};
  const icon = (name) => icons[name] || "";
  const escape = (text) => text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const tabs = [["conversation","comment-discussion","Conversation"],["commits","git-commit","Commits"],["checks","checklist","Checks"],["files","diff","Files changed"]];
  const cards = specs.map((spec, index) => {
    const card = document.createElement("article");
    card.className = "pr-card";
    card.setAttribute("aria-label", `Fictional pull request ${spec.number}: ${spec.title}`);
    card.setAttribute("aria-hidden", "true");
    card.style.setProperty("--card-angle", `${spec.rotation}deg`);
    card.style.setProperty("--card-x", `${(index - 1) * 8}px`);
    card.style.zIndex = String(spec.layer);
    card.innerHTML = `
      <div class="pr-repo">${icon("mark-github")}<span>tinyco <i>/</i> <b>checkout</b></span><span class="pr-repo-label">Public</span><span class="pr-search">${icon("search")} Type / to search</span></div>
      <div class="pr-repo-tabs"><span>${icon("code")} Code</span><span class="pr-selected">${icon("git-pull-request")} Pull requests <b>3</b></span><span>${icon("comment-discussion")} Discussions</span><span>${icon("checklist")} Actions</span></div>
      <div class="pr-content">
        <div class="pr-title-fill"><h3>${spec.title} <span>#${spec.number}</span></h3><p class="pr-merge"><span class="pr-open">${icon("git-pull-request")} Open</span><b>someone</b> wants to merge <span class="pr-merge-count">0</span> commits into <code>main</code> from <code>${spec.branch}</code></p></div>
        <div class="pr-counts">${tabs.map(([key,name,label])=>`<div class="pr-tab ${key === "files" ? "pr-active-tab" : ""}">${icon(name)}<span>${label}</span><b data-stat="${key}"></b></div>`).join("")}
          <div class="pr-loc"><span class="pr-added">+<b data-stat="added"></b></span><span class="pr-removed">−<b data-stat="removed"></b></span><span class="pr-diff-squares"><i></i><i></i><i></i><i></i><i></i></span></div>
        </div>
        <div class="pr-file-toolbar"><span>${icon("diff")} All commits ${icon("chevron-down")}</span><small>0 / <b class="pr-file-count">0</b> viewed</small><b class="pr-review-button">Review changes ${icon("chevron-down")}</b></div>
        <div class="pr-files"><aside class="pr-file-tree"><div class="pr-file-filter">${icon("search")} Filter files…</div>${spec.paths.map((file,i)=>`<div class="pr-tree-row" style="--row:${i}">${icon("file")}<span>${file}</span></div>`).join("")}<small>${spec.files > spec.paths.length ? `+ ${spec.files - spec.paths.length} more files` : "3 files changed"}</small></aside>
          <div class="pr-diffs">${index === 2 ? '<div class="pr-large-notice">This is a large pull request. Some files are collapsed.</div>' : ""}<div class="pr-diff-heading">${icon("chevron-down")}${icon("file")}<b>${spec.paths[0]}</b><span>Viewed □</span></div><div class="pr-hunk">@@ −12,6 +12,${spec.code.length} @@</div><div class="pr-code-lines">${spec.code.map((line,i)=>`<div class="pr-code-line ${line.startsWith("+") ? "pr-code-added" : line.startsWith("-") ? "pr-code-removed" : ""}" style="--row:${i}"><i>${12+i}</i><code>${escape(line)}</code></div>`).join("")}</div><div class="pr-another-file">${icon("chevron-down")} ${spec.paths[1]} <span>+${index ? "128" : "12"} −${index ? "32" : "2"}</span></div></div>
        </div>
      </div>`;
    stage.querySelector(".pr-stack").append(card);
    const counters = Object.fromEntries(Object.keys(spec).filter(key => card.querySelector(`[data-stat="${key}"]`)).map(key => [key, rollingNumber(card.querySelector(`[data-stat="${key}"]`), spec[key])]));
    return { card, spec, counters, landed: false };
  });
  const totalAdded = rollingNumber(totals.querySelector(".pr-total-added"), specs.reduce((sum, spec) => sum + spec.added, 0));
  const totalRemoved = rollingNumber(totals.querySelector(".pr-total-removed"), specs.reduce((sum, spec) => sum + spec.removed, 0));
  const particles = stage.querySelector(".pr-chaff");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const bursts = specs.flatMap((spec, index) => index === 0 ? []
    : Array.from({length: Math.ceil(spec.ramp / .26)}, (_, burst) => ({index, at: spec.at + .32 + burst * .26})));
  let previousTime = 0;

  function rollingNumber(host, target) {
    const digits = String(target).length, slots = [];
    host.classList.add("pr-number");
    for (let position = digits - 1; position >= 0; position--) {
      const separator = document.createElement("span");
      separator.textContent = position < digits - 1 && (position + 1) % 3 === 0 ? "," : "";
      const slot = document.createElement("span");
      slot.className = "pr-digit";
      slot.setAttribute("aria-hidden", "true");
      separator.setAttribute("aria-hidden", "true");
      slot.innerHTML = `<span class="pr-digit-strip">${Array.from({length:20},(_,i)=>`<span>${i%10}</span>`).join("")}</span>`;
      host.append(separator, slot);
      slots.push({ slot, separator, strip: slot.firstElementChild, divisor: 10 ** position });
    }
    return (value, settled) => {
      host.setAttribute("aria-label", Math.floor(value).toLocaleString("en-US"));
      host.dataset.value = String(Math.floor(value));
      for (const {slot, separator, strip, divisor} of slots) {
        const visible = value >= divisor || divisor === 1;
        slot.hidden = !visible;
        separator.hidden = !visible || value < divisor * 10;
        const carry = settled ? 0 : Math.max(0, value % divisor - (divisor - 1));
        const digit = Math.floor(value / divisor) % 10 + carry;
        strip.style.transform = `translateY(${-digit * 1.18}em)`;
      }
    };
  }

  function scatter(index, burst, elapsedMs = 0) {
    if (reducedMotion) return;
    const origin = particles.getBoundingClientRect();
    for (let i=0;i<6;i++) {
      const added = i % 3 !== 1;
      const box = cards[index].card.querySelector(`[data-stat="${added ? "added" : "removed"}"]`).getBoundingClientRect();
      const piece = document.createElement("span");
      piece.className = `pr-fragment ${added ? "pr-added" : "pr-removed"}`;
      piece.textContent = ["+128", "−64", "+512", "+1k", "−32", "+256"][i];
      piece.style.left = `${box.left + box.width / 2 - origin.left}px`;
      piece.style.top = `${box.top + box.height / 2 - origin.top}px`;
      piece.style.setProperty("--dx", `${-28 + Math.cos(i * .9 + burst) * 45}px`);
      piece.style.setProperty("--dy", `${-38 - (i % 3) * 28}px`);
      piece.style.setProperty("--spin", `${(i - 4) * 13}deg`);
      piece.addEventListener("animationend", () => piece.remove(), {once:true});
      particles.append(piece);
      if (elapsedMs) for (const animation of piece.getAnimations?.() || []) animation.currentTime = elapsedMs;
    }
  }

  return {
    render(time, rfcLines = 0, seeking = false) {
      let added = rfcLines, removed = 0;
      cards.forEach(({card,spec,counters}, index) => {
        const age = time - spec.at;
        const progress = Math.max(0,Math.min(1,(age - .32) / spec.ramp));
        const value = reducedMotion ? Number(progress > 0) : 1 - (1 - progress) ** 2;
        if (age >= 0 && !cards[index].landed) {
          cards[index].landed = true;
          card.classList.add("pr-landed");
          card.setAttribute("aria-hidden", "false");
        }
        card.classList.toggle("pr-counting", progress > 0 && progress < 1);
        const count = key => initialCounts[key] + (spec[key] - initialCounts[key]) * value;
        for (const [key, update] of Object.entries(counters)) update(count(key), reducedMotion || progress === 1);
        card.querySelector(".pr-merge-count").textContent = Math.floor(count("commits"));
        card.querySelector(".pr-file-count").textContent = Math.floor(count("files"));
        if (age >= 0) { added += count("added"); removed += count("removed"); }
      });
      const settled = cards.every(({spec}) => time < spec.at || time >= spec.at + .32 + spec.ramp);
      totalAdded(added, reducedMotion || settled);
      totalRemoved(removed, reducedMotion || settled);
      totals.dataset.value = String(Math.round(added + removed));
      totals.setAttribute("aria-label", `${Math.floor(added).toLocaleString("en-US")} additions, ${Math.floor(removed).toLocaleString("en-US")} deletions`);
      if (!seeking) bursts.forEach(({index, at}, burst) => {
        if (at > previousTime && at <= time && time - at < .72) scatter(index, burst, (time - at) * 1000);
      });
      previousTime = time;
    },
    reset() {
      previousTime = 0;
      particles.replaceChildren();
      cards.forEach(item => {
        item.landed = false;
        item.card.className = "pr-card";
        item.card.setAttribute("aria-hidden", "true");
      });
      totalAdded(0, true);
      totalRemoved(0, true);
      totals.dataset.value = "0";
    },
    seek(time, rfcLines = 0) {
      this.reset();
      this.render(time, rfcLines, true);
      cards.forEach(({card,spec}) => {
        for (const animation of card.getAnimations?.() || []) {
          if (animation.animationName === "pr-toss") {
            animation.currentTime = Math.max(0, (time - spec.at) * 1000);
            animation.pause();
          }
        }
      });
      bursts.forEach(({index, at}, burst) => {
        const age = (time - at) * 1000;
        if (age >= 0 && age < 720) scatter(index, burst, age);
      });
    },
  };
}
