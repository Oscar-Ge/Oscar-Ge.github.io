'use strict';

(() => {
  const video = document.getElementById('checker-replay');
  const controls = document.getElementById('excerpt-controls');
  const status = document.getElementById('excerpt-status');
  if (!video || !controls || !status) return;

  const buttons = [...controls.querySelectorAll('button')];
  let end = null;
  let label = '';
  let request = 0;

  function clearSelection() {
    buttons.forEach(button => button.setAttribute('aria-pressed', 'false'));
  }

  buttons.forEach(button => {
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', async () => {
      const currentRequest = ++request;
      end = Number(button.dataset.end);
      label = button.dataset.label;
      clearSelection();
      button.setAttribute('aria-pressed', 'true');
      status.textContent = `${label}: loading the 12-second excerpt…`;
      try {
        // A seek made before metadata is available becomes the default start position.
        video.currentTime = Number(button.dataset.start);
        await video.play();
        if (currentRequest === request) status.textContent = `${label}: playing a 12-second excerpt from the full exploration replay.`;
      } catch {
        if (currentRequest !== request) return;
        end = null;
        clearSelection();
        status.textContent = 'The excerpt could not start. Use the video controls or the full replay link below.';
      }
    });
  });

  video.addEventListener('timeupdate', () => {
    if (end !== null && video.currentTime >= end) {
      video.pause();
      end = null;
      clearSelection();
      status.textContent = `${label}: excerpt finished. Replay it or select the other example above.`;
    }
  });
  video.addEventListener('error', () => {
    end = null;
    clearSelection();
    status.textContent = 'The embedded video could not load. Try the full replay link below.';
  });
  controls.hidden = false;
})();
