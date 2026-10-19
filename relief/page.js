'use strict';

(() => {
  const sources = {
    interaction: {
      label: 'Observe people performing tasks', title: 'Human interaction recordings',
      description: 'A video-capable model inferred usability critiques from recordings of people completing tasks on generated websites, including signs of confusion and bugs encountered during interaction.',
      stat: '355 recordings', detail: '585 inferred critiques across the generated websites.'
    },
    written: {
      label: 'Ask people about their experience', title: 'Human-written feedback',
      description: 'After completing their assigned tasks, participants reviewed their recordings and wrote feedback about usability problems they encountered.',
      stat: '341 written critiques', detail: 'Collected from the user study with 24 participants.'
    },
    cua: {
      label: 'Let agents interact with the interface', title: 'Computer-use-agent critiques',
      description: 'A computer-use agent attempted tasks on the generated websites, then produced usability critiques based on its interaction history.',
      stat: '355 task attempts', detail: '544 critiques across 200 generated websites.'
    },
    code: {
      label: 'Inspect the implementation', title: 'Coding-agent critiques',
      description: 'A coding agent inspected each generated website’s source code to identify potential usability problems, without running or interacting with the interface.',
      stat: '2,979 critiques', detail: 'Source-code inspection across 200 generated websites.'
    }
  };
  const tabs = [...document.querySelectorAll('[role="tab"][data-source]')];
  const panel = document.getElementById('feedback-panel');
  function select(tab, focus = false) {
    const source = sources[tab.dataset.source];
    tabs.forEach(item => {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
    });
    for (const key of ['label', 'title', 'description', 'stat', 'detail']) {
      document.getElementById(`feedback-${key}`).textContent = source[key];
    }
    panel.setAttribute('aria-labelledby', tab.id);
    if (focus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); select(tabs[next], true); }
    });
  });
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
