/* Frasers Property — conceptual homepage interactions */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const mqMobile = window.matchMedia('(max-width: 767px)');
  const icon = (id, cls = '') => `<svg class="icon ${cls}"><use href="#i-${id}"/></svg>`;

  /* ---------------- Nav shadow ---------------- */
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 4);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------- Reveal on scroll ---------------- */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      revealIO.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  $$('.reveal').forEach((el) => {
    // light stagger for siblings that reveal together
    const sibs = $$(':scope > .reveal', el.parentElement);
    const i = sibs.indexOf(el);
    if (i > 0 && !el.closest('.hero')) el.style.transitionDelay = `${Math.min(i, 4) * 80}ms`;
    revealIO.observe(el);
  });

  /* ---------------- Timed carousel ----------------
     The active progress line fills over `duration`; when it completes
     the carousel advances. Pauses on hover/focus and when off-screen. */
  function timedCarousel(root, { count, duration = 6000, onChange }) {
    let index = 0;
    const dotGroups = $$('[data-dots]', root);
    dotGroups.forEach((g) => {
      g.setAttribute('data-timed', '');
      g.style.setProperty('--duration', `${duration}ms`);
      g.innerHTML = Array.from({ length: count }, (_, i) =>
        `<button class="dot" aria-label="Go to slide ${i + 1}"><span class="dot__fill"></span></button>`).join('');
      $$('.dot', g).forEach((d, i) => d.addEventListener('click', () => go(i)));
      g.addEventListener('animationend', (e) => {
        if (e.target.classList.contains('dot__fill') && g.offsetParent !== null) go(index + 1);
      });
    });

    function go(i) {
      const delta = i - index; // raw step, so infinite carousels know which way to move
      index = ((i % count) + count) % count;
      dotGroups.forEach((g) => $$('.dot', g).forEach((d, j) => {
        const fill = d.firstElementChild;
        d.classList.remove('is-active');
        fill.style.animation = 'none';
        void fill.offsetWidth; // restart the progress animation
        fill.style.animation = '';
        d.classList.toggle('is-active', j === index);
        d.setAttribute('aria-current', j === index ? 'true' : 'false');
      }));
      onChange(index, delta);
    }

    $$('[data-prev]', root).forEach((b) => b.addEventListener('click', () => go(index - 1)));
    $$('[data-next]', root).forEach((b) => b.addEventListener('click', () => go(index + 1)));

    // pause logic
    const pauses = new Set();
    const setPause = (key, on) => {
      on ? pauses.add(key) : pauses.delete(key);
      root.classList.toggle('is-paused', pauses.size > 0);
    };
    root.addEventListener('mouseenter', () => setPause('hover', true));
    root.addEventListener('mouseleave', () => setPause('hover', false));
    root.addEventListener('focusin', () => setPause('focus', true));
    root.addEventListener('focusout', () => setPause('focus', false));
    new IntersectionObserver(([e]) => setPause('view', !e.isIntersecting), { threshold: 0.25 }).observe(root);
    document.addEventListener('visibilitychange', () => setPause('tab', document.hidden));

    // swipe
    let x0 = null;
    root.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') x0 = e.clientX; });
    root.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
    });

    go(0);
    return { go };
  }

  /* Latest from Frasers Property */
  const latest = $('[data-carousel="latest"]');
  const latestSlides = $$('.latest__slide', latest);
  timedCarousel(latest, {
    count: latestSlides.length,
    duration: 6000,
    onChange: (i) => latestSlides.forEach((s, j) => {
      s.classList.toggle('is-active', j === i);
      s.setAttribute('aria-hidden', j === i ? 'false' : 'true');
    }),
  });

  /* Featured properties — infinite loop.
     The track holds [clones][originals][clones]; `pos` is the position in that
     strip. After each move settles, if we've drifted into a clone set we jump
     silently (no transition) to the identical original, so it never rewinds. */
  const featured = $('[data-carousel="featured"]');
  const featTrack = $('[data-track]', featured);
  const originals = $$('.feat-card', featTrack);
  const N = originals.length;
  const makeClone = (c) => {
    const k = c.cloneNode(true);
    k.classList.remove('is-active');
    k.setAttribute('aria-hidden', 'true');
    k.tabIndex = -1;
    k.dataset.clone = '';
    return k;
  };
  originals.slice().reverse().forEach((c) => featTrack.prepend(makeClone(c)));
  originals.forEach((c) => featTrack.append(makeClone(c)));
  const featCards = $$('.feat-card', featTrack);
  let pos = N;
  let settleTimer = null;

  const renderFeat = () => {
    featTrack.style.setProperty('--i', pos);
    featCards.forEach((c, j) => {
      c.classList.toggle('is-active', j === pos);
      c.classList.toggle('is-before', j < pos);
    });
  };
  const normalize = () => {
    clearTimeout(settleTimer);
    settleTimer = null;
    if (pos >= N && pos < 2 * N) return;
    pos = ((pos - N) % N + N) % N + N;
    featTrack.classList.add('no-anim');
    renderFeat();
    void featTrack.offsetWidth;
    featTrack.classList.remove('no-anim');
  };

  const featCarousel = timedCarousel(featured, {
    count: N,
    duration: 7000,
    onChange: (i, delta) => {
      if (settleTimer) normalize(); // finish any pending reset before moving again
      pos += delta;
      renderFeat();
      settleTimer = setTimeout(normalize, 950); // after the 900ms slide
    },
  });
  featCards.forEach((c, j) => c.addEventListener('click', (e) => {
    if (j === pos) return; // active card: follow its link
    e.preventDefault();    // other cards: bring them into view first
    // step relative to the current card, so clicking a card on the right always moves forward
    const current = ((pos - N) % N + N) % N;
    featCarousel.go(current + (j - pos));
  }));

  /* ---------------- Our businesses (scroll carousel) ---------------- */
  (() => {
    const root = $('[data-scroller="biz"]');
    if (!root) return;
    const track = $('[data-track]', root);
    const cards = $$('.biz-card', track);
    const dots = $('[data-dots]', root);
    const prev = $('[data-prev]', root);
    const next = $('[data-next]', root);
    let pages = 1;

    const step = () => cards[1].offsetLeft - cards[0].offsetLeft;
    const build = () => {
      const max = track.scrollWidth - track.clientWidth;
      pages = Math.max(1, Math.round(max / step()) + 1);
      dots.innerHTML = Array.from({ length: pages }, (_, i) =>
        `<button class="dot" aria-label="Go to card ${i + 1}"><span class="dot__fill"></span></button>`).join('');
      $$('.dot', dots).forEach((d, i) => d.addEventListener('click', () => track.scrollTo({ left: i * step() })));
      sync();
    };
    const sync = () => {
      const max = track.scrollWidth - track.clientWidth;
      const i = Math.min(pages - 1, Math.round(track.scrollLeft / step()));
      $$('.dot', dots).forEach((d, j) => d.classList.toggle('is-active', j === i));
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max - 2;
    };
    prev.addEventListener('click', () => track.scrollBy({ left: -step() }));
    next.addEventListener('click', () => track.scrollBy({ left: step() }));
    track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
    window.addEventListener('resize', build);
    build();
  })();

  /* ---------------- Where we operate ---------------- */
  const BIZ = {
    res: 'Residential', ret: 'Retail', com: 'Commercial & business parks', hos: 'Hospitality', ind: 'Industrial & logistics',
  };
  const COUNTRIES = {
    apac: [
      { name: 'Singapore', x: 50.48, y: 84.27, biz: ['res', 'ret', 'com', 'hos'],
        desc: 'Our home market and Group headquarters. We develop homes, own and manage shopping centres and offices, and sponsor two SGX-listed REITs.' },
      { name: 'Australia', x: 69.23, y: 121.5, biz: ['res', 'com', 'ind'],
        desc: 'One of our largest markets, spanning master-planned communities, apartments, logistics estates and workplaces across five states.' },
      { name: 'Cambodia', x: 51.68, y: 66.67, biz: ['hos'],
        desc: 'Serviced residences in Phnom Penh, offering long-stay living for business travellers and families.' },
      { name: 'China', x: 59.62, y: 39.96, biz: ['res', 'hos', 'com'],
        desc: 'Residential developments and serviced residences in key cities including Shanghai, Suzhou and Chengdu.' },
      { name: 'Indonesia', x: 65.38, y: 90.48, biz: ['hos', 'ind'],
        desc: 'Hospitality and industrial assets serving Jakarta and the wider Java corridor.' },
      { name: 'Japan', x: 70.91, y: 33.13, biz: ['hos', 'com'],
        desc: 'Hospitality and commercial assets in Tokyo and Osaka, held directly and through our REITs.' },
      { name: 'Malaysia', x: 44.71, y: 77.02, biz: ['hos'],
        desc: 'Serviced residences in Kuala Lumpur, close to the city’s central business district.' },
      { name: 'Thailand', x: 44.23, y: 58.39, biz: ['res', 'com', 'ind'],
        desc: 'Homes, offices and industrial estates through Frasers Property Thailand and our stake in One Bangkok.' },
      { name: 'Vietnam', x: 50.84, y: 54.87, biz: ['res', 'com', 'ind'],
        desc: 'Mixed-use developments and industrial parks in Ho Chi Minh City and the north.' },
    ],
    eama: [
      { name: 'United Kingdom', biz: ['com', 'ind', 'hos'],
        desc: 'Business parks, logistics assets and serviced residences across England and Scotland.' },
      { name: 'Germany', biz: ['ind'],
        desc: 'A large portfolio of modern logistics and light industrial facilities.' },
      { name: 'Netherlands', biz: ['ind'],
        desc: 'Logistics hubs close to the Port of Rotterdam and major European trade routes.' },
      { name: 'Austria', biz: ['ind'],
        desc: 'Logistics facilities serving Central and Eastern Europe.' },
    ],
  };

  const ops = $('#ops');
  const list = $('[data-country-list]', ops);
  const acc = $('[data-accordion]', ops);
  const stage = $('[data-stage]', ops);
  const markers = $('[data-markers]', ops);
  const popup = $('[data-popup]', ops);
  const popupInner = $('[data-popup-inner]', ops);
  let region = 'apac';
  let current = null;

  const panelHTML = (c) => `
    <div class="cc__panel">
      <p class="cc__desc">${c.desc}</p>
      <div class="cc__biz">
        <p class="cc__biz-title">Our businesses here</p>
        <div class="tags">${c.biz.map((b) => `<span class="tag">${BIZ[b]}</span>`).join('')}</div>
      </div>
    </div>
    <a href="#" class="text-link cc__link">Explore ${c.name} ${icon('arrow-right', 'icon--16 text-red')}</a>`;

  function renderRegion() {
    const data = COUNTRIES[region];
    list.innerHTML = data.map((c, i) => `<li><button data-i="${i}">${c.name}</button></li>`).join('');
    markers.innerHTML = region === 'apac'
      ? data.map((c, i) => `<button class="marker" data-i="${i}" style="left:${c.x}%;top:${c.y}%" aria-label="${c.name}">${icon('plus')}<span class="marker__label">${c.name}</span></button>`).join('')
      : '';
    stage.classList.toggle('is-eama', region !== 'apac');
    acc.innerHTML = data.map((c, i) => `
      <div class="acc-item${i === 0 ? ' is-open' : ''}">
        <button class="cc__head" aria-expanded="${i === 0}" data-i="${i}">
          <span class="cc__name">${c.name}</span>
          <span class="cc__toggle">${icon('minus')}${icon('minus', 'i-v')}</span>
        </button>
        <div class="acc-item__body"><div>${panelHTML(c)}</div></div>
      </div>`).join('');
  }

  function placePopup(c) {
    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    const cw = popup.offsetWidth;
    const ch = popup.offsetHeight;
    let x; let y; let origin;
    if (c.x !== undefined) {
      const mx = (c.x / 100) * sw;
      const my = (c.y / 100) * sh;
      x = mx - cw - 32; origin = 'right top';
      if (x < 0) { x = mx + 32; origin = 'left top'; }
      y = my - 48;
    } else {
      x = sw * 0.5 - cw / 2; y = sh * 0.18; origin = 'center top';
    }
    // keep inside the section
    const sec = ops.getBoundingClientRect();
    const st = stage.getBoundingClientRect();
    const minY = sec.top - st.top + 24;
    const maxY = sec.bottom - st.top - ch - 24;
    y = Math.max(minY, Math.min(y, maxY));
    popup.style.setProperty('--x', `${Math.round(x)}px`);
    popup.style.setProperty('--y', `${Math.round(y)}px`);
    popup.style.setProperty('--origin', origin);
  }

  function fillPopup(c) {
    popupInner.innerHTML = `
      <button class="cc__head" data-close aria-label="Close ${c.name}">
        <span class="cc__name">${c.name}</span>
        <span class="cc__toggle">${icon('minus')}${icon('minus', 'i-v')}</span>
      </button>
      ${panelHTML(c)}`;
  }

  function setActive(i) {
    $$('button', list).forEach((b) => b.classList.toggle('is-active', Number(b.dataset.i) === i));
    $$('.marker', markers).forEach((m) => {
      const on = Number(m.dataset.i) === i;
      m.classList.toggle('is-active', on);
      m.setAttribute('aria-expanded', on);
    });
  }

  function openCountry(i) {
    const c = COUNTRIES[region][i];
    if (current === i && popup.classList.contains('is-open')) { closeCountry(); return; }
    const wasOpen = popup.classList.contains('is-open');
    current = i;
    setActive(i);
    if (wasOpen) {
      // cross-fade content while the card glides to its new position
      popupInner.classList.add('is-fading');
      setTimeout(() => {
        fillPopup(c);
        placePopup(c);
        popupInner.classList.remove('is-fading');
      }, 180);
    } else {
      fillPopup(c);
      // position first (without transition jump), then open
      popup.style.transition = 'none';
      placePopup(c);
      void popup.offsetWidth;
      popup.style.transition = '';
      popup.classList.add('is-open');
      popup.setAttribute('aria-hidden', 'false');
    }
  }

  function closeCountry() {
    current = null;
    setActive(-1);
    popup.classList.remove('is-open');
    popup.setAttribute('aria-hidden', 'true');
  }

  list.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (b) openCountry(Number(b.dataset.i));
  });
  markers.addEventListener('click', (e) => {
    const b = e.target.closest('.marker');
    if (b) openCountry(Number(b.dataset.i));
  });
  popup.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) closeCountry();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCountry(); });
  document.addEventListener('click', (e) => {
    if (!popup.classList.contains('is-open')) return;
    if (e.target.closest('[data-popup], [data-markers], [data-country-list], .chips')) return;
    closeCountry();
  });
  window.addEventListener('resize', () => {
    if (current !== null) placePopup(COUNTRIES[region][current]);
  });

  // mobile accordion — one open at a time
  acc.addEventListener('click', (e) => {
    const head = e.target.closest('.cc__head');
    if (!head) return;
    const item = head.parentElement;
    const willOpen = !item.classList.contains('is-open');
    $$('.acc-item', acc).forEach((it) => {
      it.classList.remove('is-open');
      $('.cc__head', it).setAttribute('aria-expanded', 'false');
    });
    if (willOpen) { item.classList.add('is-open'); head.setAttribute('aria-expanded', 'true'); }
  });

  // region chips
  $$('.chip', ops).forEach((chip) => chip.addEventListener('click', () => {
    if (chip.dataset.region === region) return;
    $$('.chip', ops).forEach((c) => {
      const on = c === chip;
      c.classList.toggle('is-selected', on);
      c.setAttribute('aria-selected', on);
    });
    closeCountry();
    [list, acc, markers].forEach((el) => el.classList.add('is-swapping'));
    setTimeout(() => {
      region = chip.dataset.region;
      renderRegion();
      requestAnimationFrame(() => [list, acc, markers].forEach((el) => el.classList.remove('is-swapping')));
    }, 300);
  }));

  renderRegion();

  /* ---------------- Footer accordions (mobile) ---------------- */
  const footCols = $$('.foot__col');
  footCols.forEach((d, i) => {
    if (i === 0) d.classList.add('is-open');
    d.querySelector('summary').addEventListener('click', (e) => {
      e.preventDefault(); // keep <details> open so content can animate
      if (!mqMobile.matches) return;
      d.classList.toggle('is-open');
    });
  });
})();
