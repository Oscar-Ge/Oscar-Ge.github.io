(() => {
  const data = window.GALLERY_DATA;
  const items = Object.values(data);
  const grid = document.querySelector('#property-grid');

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
