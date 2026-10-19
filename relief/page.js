'use strict';
(() => {
  const copy = document.getElementById('copy-citation');
  const status = document.getElementById('citation-status');
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(document.getElementById('bibtex').textContent.trim());
      status.textContent = 'BibTeX copied.';
    } catch {
      status.textContent = 'Select and copy the citation above, or use Download BibTeX below.';
    }
  });
})();
