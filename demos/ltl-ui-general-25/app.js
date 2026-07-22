(() => {
  const data = window.GALLERY_DATA;
  const items = Object.values(data);
  const explorer = document.querySelector('#gallery-app');
  const grid = document.querySelector('#property-grid');

  if (explorer) {
    let activeItem = Math.max(0, items.findIndex(item => `#${item.id}` === window.location.hash));
    if (!window.location.hash) {
      activeItem = Math.max(0, items.findIndex(item => item.id === 'AP-NAV-03'));
    }
    let activeExample = 0;
    let activeState = 'actual';

    explorer.innerHTML = `
      <aside class="property-rail" aria-label="Atomic properties">
        <div class="rail-head"><strong>GENERAL-25</strong><span>25 properties · 67 examples</span></div>
        <div class="property-list"></div>
      </aside>
      <section class="explorer-main">
        <header class="explorer-head">
          <div><span class="explorer-id"></span><h1 class="explorer-title"></h1></div>
          <a class="focused-link" href="#">FOCUSED VIEW ↗</a>
        </header>
        <section class="rule-strip" aria-label="Property translation">
          <article class="rule-block property-rule"><span>ATOMIC PROPERTY</span><strong></strong></article>
          <article class="rule-block ltl-rule"><span>LTL</span><code></code></article>
          <article class="rule-block bombadil-rule"><span>BOMBADIL</span><code></code></article>
        </section>
        <div class="site-switcher" role="tablist" aria-label="GenUI examples"></div>
        <section class="explorer-stage">
          <figure class="explorer-capture">
            <div class="capture-bar"><span class="capture-site"></span><span>CONTROLLED GENUI CAPTURE</span></div>
            <button class="explorer-image-button" type="button" aria-label="Open screenshot full size"><img class="explorer-image" alt=""></button>
          </figure>
          <aside class="state-panel">
            <div class="state-switcher" role="tablist" aria-label="Counterexample state">
              <button data-state="expected" role="tab">EXPECTED</button>
              <button data-state="actual" role="tab">ACTUAL</button>
              <button data-state="violation" role="tab">VIOLATION</button>
            </div>
            <div class="state-content">
              <span class="state-kicker"></span>
              <h2 class="state-title"></h2>
              <p class="state-message"></p>
              <div class="state-evidence"><span>CHECKER EVIDENCE</span><p></p></div>
            </div>
            <div class="state-foot"><span class="state-count"></span><strong class="state-verdict"></strong></div>
          </aside>
        </section>
      </section>
      <dialog class="image-dialog explorer-dialog">
        <button class="dialog-close" type="button" aria-label="Close full-size screenshot">CLOSE</button>
        <img alt="">
      </dialog>
    `;

    const propertyList = explorer.querySelector('.property-list');
    const id = explorer.querySelector('.explorer-id');
    const title = explorer.querySelector('.explorer-title');
    const focusedLink = explorer.querySelector('.focused-link');
    const propertyRule = explorer.querySelector('.property-rule strong');
    const ltlRule = explorer.querySelector('.ltl-rule code');
    const bombadilRule = explorer.querySelector('.bombadil-rule code');
    const siteSwitcher = explorer.querySelector('.site-switcher');
    const captureSite = explorer.querySelector('.capture-site');
    const captureImage = explorer.querySelector('.explorer-image');
    const statePanel = explorer.querySelector('.state-panel');
    const stateKicker = explorer.querySelector('.state-kicker');
    const stateTitle = explorer.querySelector('.state-title');
    const stateMessage = explorer.querySelector('.state-message');
    const stateEvidence = explorer.querySelector('.state-evidence');
    const stateCount = explorer.querySelector('.state-count');
    const stateVerdict = explorer.querySelector('.state-verdict');
    const dialog = explorer.querySelector('.explorer-dialog');
    const dialogImage = dialog.querySelector('img');

    const statesFor = item => ({
      expected: {
        kicker: 'Required state',
        title: 'Expected',
        message: item.expected,
        evidence: 'The interaction must settle in this state before the observation window closes.',
        verdict: 'REQUIREMENT',
      },
      actual: {
        kicker: 'Observed state',
        title: 'Actual',
        message: item.actual,
        evidence: item.examples[activeExample].detail,
        verdict: 'MISMATCH',
      },
      violation: {
        kicker: 'Checker verdict',
        title: 'Violation',
        message: `${item.id} does not satisfy its required temporal behavior.`,
        evidence: item.examples[activeExample].detail,
        verdict: 'VIOLATION',
      },
    });

    const renderState = item => {
      const state = statesFor(item)[activeState];
      statePanel.dataset.state = activeState;
      stateKicker.textContent = state.kicker;
      stateTitle.textContent = state.title;
      stateMessage.textContent = state.message;
      stateEvidence.querySelector('p').textContent = state.evidence;
      stateCount.textContent = `${activeExample + 1} / ${item.examples.length}`;
      stateVerdict.textContent = state.verdict;
      explorer.querySelectorAll('.state-switcher button').forEach(button => {
        const selected = button.dataset.state === activeState;
        button.setAttribute('aria-selected', selected);
      });
    };

    const renderExample = item => {
      siteSwitcher.innerHTML = item.examples.map((example, index) => `
        <button role="tab" aria-selected="${index === activeExample}" data-index="${index}">${example.site}</button>
      `).join('');
      const example = item.examples[activeExample];
      const source = example.image;
      captureSite.innerHTML = `<strong>${example.site}</strong><span>${example.route || '/'}</span>`;
      captureImage.src = source;
      captureImage.alt = `${item.id} controlled violation on ${example.site}`;
      dialogImage.src = source;
      dialogImage.alt = captureImage.alt;
      siteSwitcher.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
        activeExample = Number(button.dataset.index);
        renderExample(item);
        renderState(item);
      }));
    };

    const renderItem = () => {
      const item = items[activeItem];
      propertyList.innerHTML = items.map((candidate, index) => `
        <button class="rail-item" data-index="${index}" aria-current="${index === activeItem ? 'true' : 'false'}">
          <span>${candidate.id}</span><strong>${candidate.title}</strong>
        </button>
      `).join('');
      id.textContent = item.id;
      title.textContent = item.title;
      focusedLink.href = `${item.id.toLowerCase()}/index.html`;
      propertyRule.textContent = item.expected;
      ltlRule.textContent = item.ltl;
      bombadilRule.textContent = item.bombadil;
      activeExample = 0;
      activeState = 'actual';
      window.history.replaceState(null, '', `#${item.id}`);
      renderExample(item);
      renderState(item);
      propertyList.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
        activeItem = Number(button.dataset.index);
        renderItem();
      }));
      propertyList.querySelector('[aria-current="true"]').scrollIntoView({ block: 'nearest' });
    };

    explorer.querySelectorAll('.state-switcher button').forEach(button => button.addEventListener('click', () => {
      activeState = button.dataset.state;
      renderState(items[activeItem]);
    }));
    explorer.querySelector('.explorer-image-button').addEventListener('click', () => dialog.showModal());
    explorer.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
    renderItem();
    return;
  }

  if (grid) {
    grid.innerHTML = items.map(item => `
      <a class="property-card" href="${item.id.toLowerCase()}/index.html">
        <div class="card-meta"><span>${item.id}</span><span>${item.examples.length} EXAMPLES</span></div>
        <img src="${item.examples[0].image}" alt="${item.examples[0].site} controlled violation">
        <h2>${item.title}</h2>
      </a>
    `).join('');
    return;
  }

  const item = data[document.documentElement.dataset.property];
  const itemIndex = items.findIndex(candidate => candidate.id === item.id);
  const previous = items[(itemIndex - 1 + items.length) % items.length];
  const next = items[(itemIndex + 1) % items.length];
  const view = document.querySelector('#property-view');
  let active = 0;

  view.innerHTML = `
    <section class="property-head">
      <div class="property-id">${item.id}</div>
      <h1>${item.title}</h1>
    </section>
    <div class="example-tabs" role="tablist" aria-label="GenUI examples"></div>
    <figure class="evidence-frame">
      <button class="image-button" id="image-button" type="button" aria-label="Open screenshot full size">
        <img id="evidence-image" alt="">
        <span class="zoom-label">FULL IMAGE</span>
      </button>
    </figure>
    <div class="caption-row">
      <div class="state expected"><span>EXPECTED</span><strong>${item.expected}</strong></div>
      <div class="state actual"><span>ACTUAL</span><strong>${item.actual}</strong></div>
    </div>
    <div class="example-foot">
      <div><span class="controlled">CONTROLLED GENUI</span> <span id="example-route"></span></div>
      <details class="why"><summary>Checker evidence</summary><p id="example-detail"></p></details>
    </div>
    <details class="tech">
      <summary>Technical rule</summary>
      <div class="tech-grid">
        <div class="tech-item"><div class="tech-label">LTL</div><code>${item.ltl}</code></div>
        <div class="tech-item"><div class="tech-label">BOMBADIL</div><code>${item.bombadil}</code></div>
      </div>
    </details>
    <nav class="property-nav" aria-label="Property navigation">
      <a href="../${previous.id.toLowerCase()}/index.html"><span>PREVIOUS</span>${previous.id}</a>
      <a class="all-properties" href="../index.html">ALL 25</a>
      <a class="next-property" href="../${next.id.toLowerCase()}/index.html"><span>NEXT</span>${next.id}</a>
    </nav>
    <dialog class="image-dialog" id="image-dialog">
      <button class="dialog-close" type="button" aria-label="Close full-size screenshot">CLOSE</button>
      <img id="dialog-image" alt="">
    </dialog>
  `;

  const tabs = view.querySelector('.example-tabs');
  const image = view.querySelector('#evidence-image');
  const route = view.querySelector('#example-route');
  const detail = view.querySelector('#example-detail');
  const dialog = view.querySelector('#image-dialog');
  const dialogImage = view.querySelector('#dialog-image');

  const render = () => {
    tabs.innerHTML = item.examples.map((example, index) => `
      <button class="example-tab" role="tab" aria-selected="${index === active}" data-index="${index}">${example.site}</button>
    `).join('');

    const example = item.examples[active];
    const imageSource = `../${example.image}`;
    image.src = imageSource;
    image.alt = `${item.id} controlled violation on ${example.site}`;
    dialogImage.src = imageSource;
    dialogImage.alt = image.alt;
    route.innerHTML = `<strong>${example.site}</strong> · ${example.route || '/'}`;
    detail.textContent = example.detail;

    tabs.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
      active = Number(button.dataset.index);
      render();
    }));
  };

  view.querySelector('#image-button').addEventListener('click', () => dialog.showModal());
  view.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });

  render();
})();
