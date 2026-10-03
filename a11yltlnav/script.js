'use strict';

(() => {
  const base = '/demos/ltl-ui-nfl-email-focus-demo/assets/';
  const states = [
    {
      image: '01-email-focused.png',
      alt: 'The Email article button is focused on the news page before the dialog opens.',
      label: 'State 01 / Starting context',
      title: 'The interaction begins with a known focus.',
      action: 'Navigate to the Email article button.',
      expected: 'The email control is reachable by keyboard.',
      observed: 'Focus is on the button that will open the dialog.'
    },
    {
      image: '02-dialog-open-focus-outside.png',
      alt: 'The Share by email dialog is open, but the focus annotation still identifies the Email article button behind the dialog.',
      label: 'State 02 / Focus entry failure',
      title: 'A visible dialog. No focus inside it.',
      action: 'Activate the Email article button.',
      expected: 'Keyboard focus moves into the newly opened dialog.',
      observed: 'The dialog appears, but focus remains on its invoker behind the modal.'
    },
    {
      image: '03-submit-focus-body.png',
      alt: 'After Prepare email is activated, the focus annotation identifies the document body instead of a dialog control.',
      label: 'State 03 / Context lost',
      title: 'The form updates. Focus falls to the document.',
      action: 'Activate Prepare email in the dialog.',
      expected: 'Focus remains in a meaningful place within the dialog.',
      observed: 'Focus falls to the document body after the interface updates.'
    },
    {
      image: '04-done-focus-body.png',
      alt: 'After Done closes the dialog, focus remains on the document body rather than returning to the Email article button.',
      label: 'State 04 / Focus restoration failure',
      title: 'The dialog closes. The original context is missing.',
      action: 'Activate Done to finish the dialog.',
      expected: 'Focus returns to the control that opened the dialog.',
      observed: 'Focus remains on the document body instead of returning to the invoker.'
    }
  ];
  const buttons = [...document.querySelectorAll('[data-step]')];
  const previous = document.getElementById('previous-state');
  const next = document.getElementById('next-state');
  const frame = document.getElementById('trace-frame');
  let current = 1;

  function render(index) {
    current = Math.max(0, Math.min(states.length - 1, index));
    const state = states[current];
    frame.src = base + state.image;
    frame.alt = state.alt;
    document.getElementById('full-frame').href = base + state.image;
    for (const field of ['label', 'title', 'action', 'expected', 'observed']) {
      document.getElementById('trace-' + field).textContent = state[field];
    }
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === current)));
    document.getElementById('step-count').textContent = `${current + 1} / ${states.length}`;
    previous.disabled = current === 0;
    next.disabled = current === states.length - 1;
  }

  buttons.forEach((button, i) => button.addEventListener('click', () => render(i)));
  previous.addEventListener('click', () => render(current - 1));
  next.addEventListener('click', () => render(current + 1));
  document.getElementById('trace-controls').hidden = false;
  document.getElementById('trace-navigation').hidden = false;
})();
