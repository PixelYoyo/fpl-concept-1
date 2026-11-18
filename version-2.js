/* ===== Version 2 only ===== */

/* Hero — scroll expand.
   Progress 0 → 1 as the stage scrolls through its pinned range.
   Start (Figma): a rounded card centred in the stage, big title overlapping
   its bottom edge. End: full-bleed video, title at its normal size, body
   copy faded in. */
(() => {
  const root = document.querySelector('[data-xhero]');
  if (!root) return;

  const stage = root.querySelector('.xhero__stage');
  const media = root.querySelector('.xhero__media');
  const shade = root.querySelector('.xhero__shade');
  const head = root.querySelector('.xhero__head');
  const overline = root.querySelector('.xhero__overline');
  const title = root.querySelector('.xhero__title');
  const body = root.querySelector('.xhero__body');
  const nav = document.getElementById('nav');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const ease = (t) => 0.5 - Math.cos(Math.PI * t) / 2; // ease-in-out sine

  let m = null; // measurements, refreshed on resize

  function measure() {
    root.style.setProperty('--nav-h', `${nav ? nav.offsetHeight : 0}px`);

    // Measure the end state with transforms cleared.
    head.style.transform = overline.style.transform = title.style.transform = '';
    body.style.transform = '';
    const W = stage.clientWidth, H = stage.clientHeight;
    const s = stage.getBoundingClientRect();
    const t = title.getBoundingClientRect();
    const mobile = W < 768;

    // Start card + title placement from the Figma frames.
    const cw = mobile ? W - 34 : Math.min(480, W - 160);
    const ch = mobile ? Math.min(377, H * 0.5) : Math.min(480, H - 128);
    const overhang = mobile ? 52 : -32; // title bottom relative to card bottom
    const cardTop = (H - (ch + Math.max(0, overhang))) / 2;

    m = {
      W, H, cw, ch, cardTop,
      radius: mobile ? 16 : 32,
      scale: mobile ? 48 / 40 : 80 / 64,
      titleH: t.height,
      dy: cardTop + ch + overhang - (t.bottom - s.top),
    };
  }

  function render() {
    if (!m) return;
    const range = root.offsetHeight - stage.offsetHeight;
    const navH = nav ? nav.offsetHeight : 0;
    const p = reduce.matches || range <= 0 ? 1 : clamp((navH - root.getBoundingClientRect().top) / range / 0.85);
    const e = ease(p);

    const { W, H, cw, ch, cardTop } = m;
    media.style.left = `${lerp((W - cw) / 2, 0, e)}px`;
    media.style.top = `${lerp(cardTop, 0, e)}px`;
    media.style.width = `${lerp(cw, W, e)}px`;
    media.style.height = `${lerp(ch, H, e)}px`;
    media.style.borderRadius = `${lerp(m.radius, 0, e)}px`;
    shade.style.opacity = lerp(0.36 / 0.7, 1, e);

    const s = lerp(m.scale, 1, e);
    head.style.transform = `translateY(${lerp(m.dy, 0, e)}px)`;
    title.style.transform = `scale(${s})`;
    overline.style.transform = `translateY(${-m.titleH * (s - 1)}px)`;

    const b = clamp((e - 0.6) / 0.4);
    body.style.opacity = b;
    body.style.transform = `translateY(${(1 - b) * 16}px)`;
  }

  let queued = false;
  const tick = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; render(); });
  };
  const refresh = () => { measure(); render(); };

  refresh();
  window.addEventListener('scroll', tick, { passive: true });
  window.addEventListener('resize', refresh);
  reduce.addEventListener?.('change', refresh);
  document.fonts?.ready.then(refresh);
})();

/* Footer link columns — an accordion on mobile, first column open. */
(() => {
  const cols = [...document.querySelectorAll('.ft__col')];
  if (!cols.length) return;
  const mq = window.matchMedia('(max-width: 767px)');

  const sync = () => cols.forEach((col) => {
    const btn = col.querySelector('.ft__trigger');
    const panel = col.querySelector('.ft__links');
    const open = col.classList.contains('is-open');
    if (mq.matches) {
      btn.setAttribute('aria-expanded', String(open));
      btn.removeAttribute('tabindex');
      panel.inert = !open;
    } else {
      btn.removeAttribute('aria-expanded');
      btn.setAttribute('tabindex', '-1'); // just a heading on desktop
      panel.inert = false;
    }
  });

  cols[0].classList.add('is-open');
  cols.forEach((col) => col.querySelector('.ft__trigger').addEventListener('click', () => {
    if (!mq.matches) return;
    col.classList.toggle('is-open');
    sync();
  }));
  mq.addEventListener('change', sync);
  sync();
})();

/* Newsroom — topic filter + pinned two-column drift.
   The stage pins for as long as the faster column needs to travel. Column A
   starts at the top fade and ends with its last card above the bottom fade;
   column B starts 120px lower and finishes 120px higher, so it moves faster. */
(() => {
  const root = document.querySelector('[data-newsroom]');
  if (!root) return;

  const stage = root.querySelector('.nr__stage');
  const viewport = root.querySelector('.nr__viewport');
  const cards = [...root.querySelectorAll('.nr-card')];
  const chips = [...root.querySelectorAll('[data-filter]')];
  const empty = root.querySelector('.nr__empty');
  const nav = document.getElementById('nav');
  const mobile = window.matchMedia('(max-width: 767px)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const OFFSET = 120;
  const clamp = (v) => Math.min(1, Math.max(0, v));

  let m = null;

  function arrange() {
    const visible = cards.filter((c) => !c.hidden);
    cards.forEach((c) => c.classList.remove('is-b', 'is-lead', 'is-extra'));
    visible.forEach((c, i) => {
      c.classList.toggle('is-b', i % 2 === 1);
      c.classList.toggle('is-lead', i === 0);
      c.classList.toggle('is-extra', i > 2);
    });
    empty.hidden = visible.length > 0;
    return visible;
  }

  function measure() {
    const navH = nav ? nav.offsetHeight : 0;
    root.style.setProperty('--nav-h', `${navH}px`);
    root.classList.remove('is-pinned', 'is-static');
    root.style.height = '';
    cards.forEach((c) => c.style.removeProperty('--y'));
    m = null;
    if (mobile.matches || reduce.matches) return;

    root.classList.add('is-pinned');
    const visible = cards.filter((c) => !c.hidden);
    const H = viewport.clientHeight;
    const pad = parseFloat(getComputedStyle(root).getPropertyValue('--fade-h')); // start/end clear of the fades
    const bottom = (list) => list.reduce((b, c) => Math.max(b, c.offsetTop + c.offsetHeight), 0);
    const hA = bottom(visible.filter((c) => !c.classList.contains('is-b')));
    const hB = bottom(visible.filter((c) => c.classList.contains('is-b')));
    const TA = Math.max(0, hA + pad * 2 - H);
    const TB = hB ? Math.max(0, hB + pad * 2 - H + OFFSET * 2) : 0;
    const travel = Math.max(TA, TB);

    // Few cards: centre them, nothing to pin.
    const centre = travel === 0 ? Math.max(0, (H - Math.max(hA, hB + OFFSET)) / 2) : pad;
    m = { pad: centre, TA, TB, travel };
    root.style.height = `${stage.offsetHeight + travel}px`;
    if (!travel) root.classList.replace('is-pinned', 'is-static');
  }

  function render() {
    if (!m) return;
    const navH = nav ? nav.offsetHeight : 0;
    const range = root.offsetHeight - stage.offsetHeight;
    const p = range > 0 ? clamp((navH - root.getBoundingClientRect().top) / range) : 0;
    const yA = m.pad - p * m.TA;
    const yB = m.pad + OFFSET - p * m.TB;
    cards.forEach((c) => c.style.setProperty('--y', `${c.classList.contains('is-b') ? yB : yA}px`));
  }

  chips.forEach((chip) => chip.addEventListener('click', () => {
    const f = chip.dataset.filter;
    chips.forEach((c) => {
      const on = c === chip;
      c.classList.toggle('is-selected', on);
      c.setAttribute('aria-pressed', String(on));
    });
    cards.forEach((c) => { c.hidden = f !== 'all' && !c.dataset.cat.split(' ').includes(f); });
    arrange();
    refresh();
  }));

  let queued = false;
  const tick = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; render(); });
  };
  const refresh = () => { measure(); render(); };

  arrange();
  refresh();
  window.addEventListener('scroll', tick, { passive: true });
  window.addEventListener('resize', refresh);
  mobile.addEventListener?.('change', refresh);
  reduce.addEventListener?.('change', refresh);
  document.fonts?.ready.then(refresh);
  window.addEventListener('load', refresh);
})();

/* Our businesses — expanding cards.
   Desktop: hovering a slim card previews it (it widens, details swap);
   clicking keeps it. Leaving the grid returns to the kept card.
   Mobile: the same buttons work as a one-open accordion. */
(() => {
  const root = document.querySelector('[data-bz]');
  if (!root) return;
  const grid = root.querySelector('.bz__grid');
  const items = [...root.querySelectorAll('.bz__item')];
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  let selected = 0;

  const show = (index) => {
    items.forEach((item, i) => {
      const on = i === index;
      item.classList.toggle('is-active', on);
      item.querySelector('.bz__card').setAttribute('aria-expanded', String(on));
    });
    grid.style.setProperty('--cols', items.map((_, i) => `minmax(0, ${i === index ? 4 : 1}fr)`).join(' '));
  };

  items.forEach((item, i) => {
    const card = item.querySelector('.bz__card');
    card.addEventListener('click', () => { selected = i; show(i); });
    card.addEventListener('mouseenter', () => { if (canHover.matches) show(i); });
  });
  grid.addEventListener('mouseleave', () => { if (canHover.matches) show(selected); });

  show(selected);
})();
