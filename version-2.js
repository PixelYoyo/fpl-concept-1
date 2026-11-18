/* ===== Version 2 only ===== */

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

/* Newsroom — topic filter.
   Cards alternate between two columns (.is-b = right column). The pinned
   two-column drift itself is a ScrollTrigger in motion.js; it listens for
   "newsroom:filter" to re-measure after the visible cards change. */
(() => {
  const root = document.querySelector('[data-newsroom]');
  if (!root) return;

  const cards = [...root.querySelectorAll('.nr-card')];
  const chips = [...root.querySelectorAll('[data-filter]')];
  const empty = root.querySelector('.nr__empty');

  function arrange() {
    const visible = cards.filter((c) => !c.hidden);
    cards.forEach((c) => c.classList.remove('is-b', 'is-lead', 'is-extra'));
    visible.forEach((c, i) => {
      c.classList.toggle('is-b', i % 2 === 1);
      c.classList.toggle('is-lead', i === 0);
      c.classList.toggle('is-extra', i > 2);
    });
    empty.hidden = visible.length > 0;
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
    root.dispatchEvent(new CustomEvent('newsroom:filter'));
  }));

  arrange();
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

/* Featured properties — depth carousel.
   Port of the React Bits "Depth Carousel" interaction: cards sit on a 3D
   rail, each step back is pushed along Z, nudged right, darkened and
   blurred. `pos` is a float so drags, wheel swipes and the 700ms GSAP
   power3.out tween all go through the same layout(). Autoplay is driven by
   the progress dot and pauses while a card is hovered. With GSAP motion on,
   the rail also fans out from a single stacked card as the section scrolls
   into view (`fan` 0 → 1, scrubbed by ScrollTrigger). */
(() => {
  const root = document.querySelector('[data-depth-carousel]');
  if (!root) return;

  const stage = root.querySelector('[data-stage]');
  const cards = Array.from(stage.querySelectorAll('.dfeat__card'));
  const tints = cards.map((c) => c.querySelector('.dfeat__tint'));
  const captions = Array.from(root.querySelectorAll('.dfeat__caption'));
  const dotsEl = root.querySelector('[data-dots]');
  const n = cards.length;
  if (!n) return;

  const CFG = {
    // React Bits defaults, tuned for its 300px card. Depth, spread and
    // perspective are scaled by (card width / 300) so the rail keeps the
    // same proportions at any card size.
    baseCard: 300,
    perspective: 1400,
    depth: 220,          // px pushed back per step
    spread: 90,          // px nudged right per step
    tilt: 22,            // rotateY (deg) on back cards, React Bits default
    visibleCards: 2,     // cards shown behind the active one
    falloff: 0.12,       // brightness lost per step back
    blur: 4,             // max blur (px); 2px on the first card behind, as in Figma
    duration: 700,
    autoplayDelay: 5000,
  };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const wrap = (i) => ((i % n) + n) % n;

  let pos = 0;     // float position on the rail
  let index = 0;   // focused card
  let cardW = 0;
  let k = 1; // cardW / baseCard
  let tween = null; // GSAP tween driving `pos`
  const rail = { fan: 1 }; // 0 = all cards stacked, 1 = full depth rail
  const motion = () => !!window.gsap && document.documentElement.classList.contains('motion');
  const stop = () => { if (tween) { tween.kill(); tween = null; } };

  /* ---------- layout (same maths as React Bits) ---------- */
  function layout(p) {
    const fadeEnd = Math.min(CFG.visibleCards + 1, n / 2);
    for (let i = 0; i < n; i++) {
      let d = i - p;
      if (n > 1) { d = wrap(d); if (d > n / 2) d -= n; }
      const back = Math.max(0, d);

      const f = rail.fan;
      const tz = -CFG.depth * k * d * f;
      const tx = CFG.spread * k * d * f;
      const ry = CFG.tilt * clamp(d, 0, 1) * f;

      // cards in front fade out as they pass; cards past the visible stack
      // fade in from the back instead of popping
      let opacity = d < 0 ? Math.max(0, 1 + d) : 1;
      if (d > CFG.visibleCards) opacity = clamp((fadeEnd - d) / Math.max(fadeEnd - CFG.visibleCards, 0.001), 0, 1);

      const brightness = Math.max(0.15, 1 - back * CFG.falloff);
      const blurPx = Math.min(CFG.blur, (back / Math.max(1, CFG.visibleCards)) * CFG.blur);

      const el = cards[i];
      el.style.transform = `translate(-50%, -50%) translateX(${tx.toFixed(2)}px) translateZ(${tz.toFixed(2)}px) rotateY(${ry.toFixed(3)}deg)`;
      el.style.opacity = opacity.toFixed(3);
      el.style.filter = `brightness(${brightness.toFixed(3)}) blur(${blurPx.toFixed(2)}px)`;
      el.style.zIndex = String(Math.round(2000 - d * 20));
      el.style.pointerEvents = opacity > 0.05 ? 'auto' : 'none';
      tints[i].style.opacity = clamp(back * CFG.falloff * 1.25, 0, 0.86).toFixed(3);
    }
  }

  function tweenTo(target) {
    stop();
    if (reduce.matches || !window.gsap) { pos = wrap(target); layout(pos); return; }
    const state = { pos };
    tween = gsap.to(state, {
      pos: target,
      duration: CFG.duration / 1000,
      ease: 'power3.out',
      onUpdate: () => { pos = state.pos; layout(pos); },
      onComplete: () => { tween = null; pos = wrap(target); layout(pos); },
    });
  }

  /* ---------- dots (timed progress = autoplay clock) ---------- */
  const timed = () => !reduce.matches && n > 1;
  dotsEl.innerHTML = cards.map((_, i) =>
    `<button class="dot" aria-label="Go to property ${i + 1}"><span class="dot__fill"></span></button>`).join('');
  const dots = Array.from(dotsEl.querySelectorAll('.dot'));
  const syncTimed = () => {
    dotsEl.toggleAttribute('data-timed', timed());
    dotsEl.style.setProperty('--duration', `${CFG.autoplayDelay}ms`);
  };
  syncTimed();
  dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
  dotsEl.addEventListener('animationend', (e) => {
    if (e.target.classList.contains('dot__fill') && timed()) go(index + 1);
  });

  /* ---------- focus a card ---------- */
  function go(raw, animate = true) {
    const idx = wrap(raw);
    let delta = idx - pos;
    if (n > 1) { delta = wrap(delta); if (delta > n / 2) delta -= n; }
    if (animate) tweenTo(pos + delta); else { pos = idx; layout(pos); }
    index = idx;

    cards.forEach((c, i) => {
      const on = i === idx;
      c.tabIndex = on ? 0 : -1;
      c.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    captions.forEach((c, i) => {
      c.classList.toggle('is-active', i === idx);
      c.setAttribute('aria-hidden', i === idx ? 'false' : 'true');
    });
    dots.forEach((d, i) => {
      const fill = d.firstElementChild;
      d.classList.remove('is-active');
      fill.style.animation = 'none';
      void fill.offsetWidth; // restart the progress fill
      fill.style.animation = '';
      d.classList.toggle('is-active', i === idx);
      d.setAttribute('aria-current', i === idx ? 'true' : 'false');
    });
  }

  root.querySelector('[data-prev]').addEventListener('click', () => go(index - 1));
  root.querySelector('[data-next]').addEventListener('click', () => go(index + 1));

  /* ---------- pausing ---------- */
  const pauses = new Set();
  const setPause = (key, on) => {
    on ? pauses.add(key) : pauses.delete(key);
    root.classList.toggle('is-paused', pauses.size > 0);
  };
  // hovering any card (active or behind) holds autoplay
  stage.addEventListener('mouseover', (e) => setPause('hover', !!e.target.closest('.dfeat__card')));
  stage.addEventListener('mouseleave', () => setPause('hover', false));
  // keyboard focus on the cards or caption also holds it (mouse clicks on arrows don't)
  root.addEventListener('focusin', (e) => setPause('focus',
    e.target.matches(':focus-visible') && (stage.contains(e.target) || !!e.target.closest('.dfeat__captions'))));
  root.addEventListener('focusout', () => setPause('focus', false));
  new IntersectionObserver(([e]) => setPause('view', !e.isIntersecting), { threshold: 0.25 }).observe(root);
  document.addEventListener('visibilitychange', () => setPause('tab', document.hidden));

  /* ---------- drag / swipe ---------- */
  let drag = null;
  let justDragged = false;
  const stepPx = () => Math.max(cardW * 0.55, 40);
  stage.addEventListener('pointerdown', (e) => {
    if (n < 2 || e.button > 0) return;
    drag = { x: e.clientX, start: pos, lastX: e.clientX, lastT: performance.now(), v: 0, moved: false, id: e.pointerId };
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 4) {
      drag.moved = true;
      stop();
      drag.start = pos; drag.x = e.clientX;
      stage.setPointerCapture(drag.id);
      stage.classList.add('is-dragging');
      setPause('drag', true);
    }
    if (!drag.moved) return;
    const now = performance.now();
    drag.v = (e.clientX - drag.lastX) / Math.max(now - drag.lastT, 1);
    drag.lastX = e.clientX; drag.lastT = now;
    pos = drag.start - dx / stepPx();
    layout(pos);
  });
  const endDrag = () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.moved) return; // a tap: let the click handler decide
    stage.classList.remove('is-dragging');
    setPause('drag', false);
    justDragged = true;
    setTimeout(() => { justDragged = false; }, 0);
    go(Math.round(pos - (d.v * 180) / stepPx()));
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  // horizontal trackpad swipes only, so vertical page scroll is never trapped
  let wheelTimer = null;
  stage.addEventListener('wheel', (e) => {
    if (n < 2 || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    stop();
    const delta = e.deltaMode === 1 ? e.deltaX * 24 : e.deltaX;
    pos += clamp(delta / (cardW * 0.9), -0.6, 0.6);
    layout(pos);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => go(Math.round(pos)), 130);
  }, { passive: false });

  stage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
  });

  // back cards come forward on click; the active card follows its link
  cards.forEach((c, i) => c.addEventListener('click', (e) => {
    if (justDragged) { e.preventDefault(); return; }
    if (i !== index) { e.preventDefault(); go(i); }
  }));

  /* ---------- sizing ---------- */
  const measure = () => {
    cardW = cards[0].offsetWidth;
    k = cardW / CFG.baseCard;
    stage.style.perspective = `${CFG.perspective * k}px`;
    layout(pos);
  };
  new ResizeObserver(measure).observe(stage);
  reduce.addEventListener?.('change', () => { syncTimed(); go(index, false); });

  measure();
  go(0, false);

  // Fan the rail out as the section enters the viewport.
  if (motion() && window.ScrollTrigger) {
    gsap.fromTo(rail, { fan: 0 }, {
      fan: 1, ease: 'power2.out',
      onUpdate: () => layout(pos),
      scrollTrigger: { trigger: stage, start: 'top 95%', end: 'center 55%', scrub: true },
    });
    layout(pos);
  }
})();

/* Where we operate — tilt + cursor glare on the open country card (desktop pointer only). */
(() => {
  const card = document.querySelector('.ops [data-popup]');
  const inner = card && card.querySelector('[data-popup-inner]');
  if (!inner) return;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const MAX = 10; // degrees
  let frame = 0;

  const reset = () => {
    cancelAnimationFrame(frame);
    inner.classList.remove('is-tilting');
    inner.style.setProperty('--rx', '0deg');
    inner.style.setProperty('--ry', '0deg');
  };

  inner.addEventListener('pointermove', (e) => {
    if (!fine.matches || !card.classList.contains('is-open')) return;
    const { clientX, clientY } = e;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const r = inner.getBoundingClientRect();
      const px = (clientX - r.left) / r.width;  // 0..1
      const py = (clientY - r.top) / r.height;
      inner.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
      inner.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
      if (!reduce.matches) {
        inner.style.setProperty('--ry', `${((px - 0.5) * 2 * MAX).toFixed(2)}deg`);
        inner.style.setProperty('--rx', `${((0.5 - py) * 2 * MAX).toFixed(2)}deg`);
      }
      inner.classList.add('is-tilting');
    });
  });
  inner.addEventListener('pointerleave', reset);
  // settle flat whenever the card closes
  new MutationObserver(() => { if (!card.classList.contains('is-open')) reset(); })
    .observe(card, { attributes: true, attributeFilter: ['class'] });
})();
