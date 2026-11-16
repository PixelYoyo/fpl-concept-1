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
