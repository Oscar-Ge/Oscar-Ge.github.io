const steps = [
  {
    id: "s0",
    title: "Heart button focused",
    action: "Tab to exact invoker",
    image: "./assets/state-1-heart-focused.jpeg",
    alt: "Airbnb stays page with the Saltwater Cottage heart button carrying the browser's native focus outline.",
    caption: "The exact wishlist invoker has keyboard focus before activation.",
    facts: [
      ["activeTag", "BUTTON", "neutral"],
      ["dialogPresent", "false", "neutral"],
      ["trace line", "521", "neutral"],
    ],
    explanation:
      "The checker retains this exact button node as the modal invoker.",
    verdict: "Precondition captured",
    violation: false,
  },
  {
    id: "s1",
    title: "Wishlist input focused",
    action: "Press Space",
    image: "./assets/state-2-modal-input-focused.jpeg",
    alt: "Save to wishlist modal open with its text input carrying the browser's native focus outline.",
    caption: "Space opens one modal and focus enters its wishlist-name input.",
    facts: [
      ["activeTag", "INPUT", "true"],
      ["dialogPresent", "true", "true"],
      ["trace line", "522", "neutral"],
    ],
    explanation:
      "This binds the modal episode to the button captured in the previous state.",
    verdict: "Focus entered modal",
    violation: false,
  },
  {
    id: "s2",
    title: "BODY focused",
    action: "Escape + settle 500 ms",
    image: "./assets/state-3-body-focused.jpeg",
    alt: "Airbnb stays page after the modal closed, with no focused control visible because document body has focus.",
    caption:
      "The modal is gone, but focus did not return to the exact eligible heart button.",
    facts: [
      ["originalDialogClosed", "true", "true"],
      ["invokerEligible", "true", "true"],
      ["focusIsExactInvoker", "false", "false"],
      ["activeTag", "BODY", "false"],
      ["trace line", "525", "neutral"],
    ],
    explanation:
      "The 500 ms observation is complete and uncontaminated by another action.",
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

function render() {
  const step = steps[currentStep];

  for (const state of document.querySelectorAll(".trace-state")) {
    state.classList.toggle(
      "active",
      Number(state.dataset.step) === currentStep,
    );
    state.setAttribute(
      "aria-current",
      Number(state.dataset.step) === currentStep ? "step" : "false",
    );
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
