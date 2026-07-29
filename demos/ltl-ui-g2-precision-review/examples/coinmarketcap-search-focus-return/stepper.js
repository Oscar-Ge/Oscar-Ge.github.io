const steps = [
  {
    id: "s0",
    title: "Search button focused",
    action: "Tab to Search",
    image: "./assets/state-0-search-button.jpeg",
    alt: "CoinMarketCap-inspired watchlist page with the Search button focused.",
    caption: "The exact Search button is captured as the modal invoker.",
    focusBox: [82.05, 2.08, 13.18, 5.08, "Focus · Search button", "below"],
    facts: [
      ["focus event", "394", "neutral"],
      ["activeTag", "BUTTON", "true"],
      ["dialogPresent", "false", "neutral"],
    ],
    explanation:
      "Event 394 identifies the exact button node that must receive focus after dismissal.",
    verdict: "Invoker captured",
    violation: false,
  },
  {
    id: "s1",
    title: "Search dialog focused",
    action: "Press Enter",
    image: "./assets/state-1-search-dialog.jpeg",
    alt: "CoinMarketCap-inspired search dialog with focus in its search input.",
    caption: "The search dialog opens and focus enters #global-search.",
    focusBox: [24.46, 17.06, 48.44, 2.86, "Focus · #global-search"],
    facts: [
      ["focus event", "398", "neutral"],
      ["activeTag", "INPUT", "true"],
      ["dialogPresent", "true", "true"],
    ],
    explanation:
      "This binds the dialog episode to the Search button captured in s0.",
    verdict: "Focus entered modal",
    violation: false,
  },
  {
    id: "s2",
    title: "BODY focused after close",
    action: "Tab → Escape → settle 500 ms",
    image: "./assets/state-2-body-focus.jpeg",
    alt: "CoinMarketCap-inspired watchlist page after search closed, with document body focused.",
    caption:
      "The dialog closes, but focus settles on BODY instead of the exact Search button.",
    focusBox: null,
    facts: [
      ["Escape event", "405", "neutral"],
      ["dialog closed", "true", "true"],
      ["focusIsExactInvoker", "false", "false"],
      ["activeTag", "BODY", "false"],
    ],
    explanation:
      "The complete 500 ms observation reports no replacement modal and an eligible invoker.",
    verdict: "AP-M1-04 violation observed",
    violation: true,
  },
];

const byId = (id) => document.getElementById(id);
const requestedStep = Number(
  new URLSearchParams(window.location.search).get("step"),
);
let currentStep =
  Number.isInteger(requestedStep)
  && requestedStep >= 0
  && requestedStep < steps.length
    ? requestedStep
    : 0;

function renderFocusBox(box) {
  const focus = byId("evidence-focus");
  if (!box) {
    focus.hidden = true;
    return;
  }
  const [left, top, width, height, label, labelPosition] = box;
  focus.hidden = false;
  focus.classList.toggle("label-below", labelPosition === "below");
  focus.style.cssText =
    `left:${left}%;top:${top}%;width:${width}%;height:${height}%`;
  byId("focus-label").textContent = label;
}

function render() {
  const step = steps[currentStep];
  for (const state of document.querySelectorAll(".trace-state")) {
    const active = Number(state.dataset.step) === currentStep;
    state.classList.toggle("active", active);
    state.setAttribute("aria-current", active ? "step" : "false");
  }
  for (const edge of document.querySelectorAll(".trace-edge")) {
    edge.classList.toggle(
      "active",
      Number(edge.dataset.step) === currentStep,
    );
  }

  byId("step-title").textContent = `${step.id} · ${step.title}`;
  byId("state-image").src = step.image;
  byId("state-image").alt = step.alt;
  byId("caption").textContent = step.caption;
  byId("step-count").textContent = `${currentStep + 1} / ${steps.length}`;
  byId("action").innerHTML = `<span>Action</span>${step.action}`;
  byId("predicates").innerHTML = step.facts
    .map(
      ([name, value, state]) =>
        `<dt>${name}</dt><dd class="${state}">${value}</dd>`,
    )
    .join("");
  byId("explain").textContent = step.explanation;
  renderFocusBox(step.focusBox);

  const verdict = byId("step-verdict");
  verdict.textContent = step.verdict;
  verdict.classList.toggle("violation", step.violation);
  byId("previous").disabled = currentStep === 0;
  byId("next").disabled = currentStep === steps.length - 1;
  for (const dot of document.querySelectorAll(".dot")) {
    const active = Number(dot.dataset.step) === currentStep;
    dot.classList.toggle("active", active);
    dot.setAttribute("aria-current", active ? "step" : "false");
  }
}

function goToStep(index) {
  currentStep = Math.max(0, Math.min(steps.length - 1, index));
  const url = new URL(window.location.href);
  url.searchParams.set("step", String(currentStep));
  history.replaceState(null, "", url);
  render();
}

for (const state of document.querySelectorAll(".trace-state")) {
  state.addEventListener("click", () => goToStep(Number(state.dataset.step)));
}
byId("previous").addEventListener("click", () => goToStep(currentStep - 1));
byId("next").addEventListener("click", () => goToStep(currentStep + 1));
document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") goToStep(currentStep - 1);
  if (event.key === "ArrowRight") goToStep(currentStep + 1);
});

steps.forEach((step, index) => {
  const dot = document.createElement("button");
  dot.type = "button";
  dot.className = "dot";
  dot.dataset.step = String(index);
  dot.setAttribute("aria-label", `Go to ${step.id}: ${step.title}`);
  dot.addEventListener("click", () => goToStep(index));
  byId("dots").append(dot);
});

render();
