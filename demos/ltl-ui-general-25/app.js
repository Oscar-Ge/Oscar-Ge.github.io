
(() => {
  const data = window.GALLERY_DATA;
  const grid = document.querySelector('#property-grid');
  if (grid) {
    grid.innerHTML = Object.values(data).map(item => `<a class="property-card" href="${item.id.toLowerCase()}/index.html"><div class="card-meta"><span>${item.id}</span><span>${item.examples.length} EXAMPLES</span></div><img src="${item.examples[0].image}" alt="${item.examples[0].site} controlled violation"><h2>${item.title}</h2></a>`).join('');
    return;
  }
  const root = document.documentElement;
  const item = data[root.dataset.property];
  const view = document.querySelector('#property-view');
  let active = 0;
  view.innerHTML = `<section class="property-head"><div class="property-id">${item.id}</div><h1>${item.title}</h1><p class="rule-line">${item.expected}</p></section><div class="example-tabs" role="tablist"></div><figure class="evidence-frame"><img id="evidence-image" alt=""></figure><div class="caption-row"><div class="state expected"><span>EXPECTED</span><strong>${item.expected}</strong></div><div class="state actual"><span>ACTUAL</span><strong>${item.actual}</strong></div></div><div class="example-foot"><div><span class="controlled">CONTROLLED GENUI EXAMPLE</span></div><div id="example-route"></div></div><details class="tech"><summary>Technical rule</summary><div class="tech-grid"><div class="tech-item"><div class="tech-label">LTL</div><code>${item.ltl}</code></div><div class="tech-item"><div class="tech-label">BOMBADIL</div><code>${item.bombadil}</code></div></div></details>`;
  const tabs = view.querySelector('.example-tabs');
  const image = view.querySelector('#evidence-image');
  const route = view.querySelector('#example-route');
  const render = () => {
    tabs.innerHTML = item.examples.map((example,index) => `<button class="example-tab" role="tab" aria-selected="${index===active}" data-index="${index}">${example.site}</button>`).join('');
    const example = item.examples[active];
    image.src = `../${example.image}`;
    image.alt = `${item.id} controlled violation on ${example.site}`;
    route.innerHTML = `<strong>${example.site}</strong> · ${example.route || '/'}`;
    tabs.querySelectorAll('button').forEach(button => button.addEventListener('click', () => { active=Number(button.dataset.index); render(); }));
  };
  render();
})();
