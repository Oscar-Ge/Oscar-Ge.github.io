const storageKey = "ltl-ui-example:current-coinmarketcap-search-ap-m1-04";
const buttons = [...document.querySelectorAll("[data-decision]")];
const status = document.querySelector("#review-status");

function render(decision) {
  for (const button of buttons) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.decision === decision),
    );
  }
  status.textContent = decision
    ? `Saved locally: ${decision}.`
    : "Stored only in this browser.";
}

let saved = null;
let storageAvailable = true;
try {
  saved = window.localStorage.getItem(storageKey);
} catch {
  storageAvailable = false;
  status.textContent = "Local review storage is unavailable.";
}
if (storageAvailable) {
  render(saved);
}

for (const button of buttons) {
  button.addEventListener("click", () => {
    const decision = button.dataset.decision;
    try {
      window.localStorage.setItem(storageKey, decision);
      render(decision);
    } catch {
      status.textContent = "Could not save in local browser storage.";
    }
  });
}
