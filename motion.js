/* Version 2 — GSAP motion layer.
   ScrollSmoother for smooth scrolling, ScrollTrigger for every scroll-driven
   section (pinned hero, newsroom drift, insights stack, parallax, reveals)
   and SplitText for heading line reveals.

   Everything runs inside gsap.matchMedia() so it is skipped for visitors who
   prefer reduced motion and is cleanly reverted if that preference or the
   breakpoint changes. html.motion is set in the <head>; this file removes it
   if GSAP failed to load, so script.js falls back to its CSS reveals. */
(() => {
  const html = document.documentElement;
  if (!window.gsap || !window.ScrollTrigger || !window.ScrollSmoother || !window.SplitText) {
    html.classList.remove('motion');
    return;
  }
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const nav = $('#nav');
  const navH = () => (nav ? nav.offsetHeight : 0);
  const setNavOffset = () => html.style.setProperty('--nav-offset', `${navH()}px`);
  setNavOffset();
  window.addEventListener('resize', setNavOffset);

  const MOTION = '(prefers-reduced-motion: no-preference)';
  const DESKTOP_MOTION = '(min-width: 768px) and (prefers-reduced-motion: no-preference)';
  const mm = gsap.matchMedia();
  const motionOn = html.classList.contains('motion');

  // Offset of `el` from the top of `ancestor`, ignoring transforms.
  const topWithin = (el, ancestor) => {
    let y = 0;
    while (el && el !== ancestor) { y += el.offsetTop; el = el.offsetParent; }
    return y;
  };
  // Re-measure hooks that must run before ScrollTrigger recalculates.
  const onRefreshInit = (fn) => {
    ScrollTrigger.addEventListener('refreshInit', fn);
    return () => ScrollTrigger.removeEventListener('refreshInit', fn);
  };

  /* ---------------- Smooth scrolling ----------------
     Created before any ScrollTrigger. Touch devices keep native scrolling. */
  mm.add(MOTION, () => {
    const smoother = ScrollSmoother.create({
      wrapper: '#smooth-wrapper',
      content: '#smooth-content',
      smooth: 1.1,
      effects: true,
      smoothTouch: false,
    });
    return () => smoother.kill();
  });

  // The rest needs the DOM that script.js / version-2.js render.
  // Pins and scroll scenes start straight away; text splitting waits for the
  // web font so lines are measured with the real glyphs (capped at 1.5s).
  document.addEventListener('DOMContentLoaded', () => {
    if (!motionOn) return;
    hero();
    sections();
    newsroom();
    insights();
    footer();
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    Promise.race([fonts, new Promise((r) => setTimeout(r, 1500))]).then(() => {
      heroTitle();
      headings();
      reveals();
      ScrollTrigger.refresh();
    });
  });

  /* ---------------- Hero: pinned scroll-expand ----------------
     The stage pins under the nav for 1.2 viewports of scroll. Over the first
     85% the video's clip-path opens from the Figma start card (centred,
     rounded) to full bleed, the video settles from 1.2x, the title shrinks
     from its oversized start and slides down into place; the body copy fades
     in near the end, then the frame holds briefly before releasing. */
  function hero() {
    const root = $('[data-xhero]');
    if (!root) return;
    const stage = $('.xhero__stage', root);
    const media = $('.xhero__media', root);
    const video = $('video', media);
    const shade = $('.xhero__shade', root);
    const head = $('.xhero__head', root);
    const overline = $('.xhero__overline', root);
    const title = $('.xhero__title', root);
    const body = $('.xhero__body', root);

    mm.add(MOTION, () => {
      let m = null;
      const measure = () => {
        root.style.setProperty('--nav-h', `${navH()}px`);
        const W = stage.clientWidth;
        const H = stage.clientHeight;
        const mobile = W < 768;
        // Start card + title placement from the Figma frames.
        const cw = mobile ? W - 34 : Math.min(480, W - 160);
        const ch = mobile ? Math.min(377, H * 0.5) : Math.min(480, H - 128);
        const overhang = mobile ? 52 : -32; // title bottom relative to card bottom
        const cardTop = (H - (ch + Math.max(0, overhang))) / 2;
        const x = (W - cw) / 2;
        const scale = mobile ? 48 / 40 : 80 / 64;
        m = {
          clip: `inset(${cardTop}px ${x}px ${H - cardTop - ch}px ${x}px round ${mobile ? 16 : 32}px)`,
          scale,
          lift: -title.offsetHeight * (scale - 1),
          dy: cardTop + ch + overhang - (topWithin(title, stage) + title.offsetHeight),
        };
      };
      measure();
      const off = onRefreshInit(measure);

      gsap.timeline({
        defaults: { ease: 'sine.inOut', duration: 0.85 },
        scrollTrigger: {
          trigger: stage,
          start: () => `top ${navH()}`,
          end: () => `+=${stage.offsetHeight * 1.2}`,
          pin: true,
          scrub: true,
          invalidateOnRefresh: true,
        },
      })
        .fromTo(media, { clipPath: () => m.clip }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }, 0)
        .fromTo(video, { scale: 1.2 }, { scale: 1 }, 0)
        .fromTo(shade, { opacity: 0.36 / 0.7 }, { opacity: 1 }, 0)
        .fromTo(head, { y: () => m.dy }, { y: 0 }, 0)
        .fromTo(title, { scale: () => m.scale }, { scale: 1 }, 0)
        .fromTo(overline, { y: () => m.lift }, { y: 0 }, 0)
        .fromTo(body, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out' }, 0.55)
        .to({}, { duration: 0.15 }); // hold the full-bleed frame

      // Page-load intro: nav drops in, the card rises (title: heroTitle()).
      gsap.set(title, { autoAlpha: 0 });
      gsap.timeline({ delay: 0.1 })
        .from(nav, { yPercent: -100, duration: 1, ease: 'expo.out' }, 0)
        .from(media, { y: 80, autoAlpha: 0, duration: 1.4, ease: 'expo.out' }, 0.05)
        .from(overline, { autoAlpha: 0, duration: 0.8, ease: 'power2.out' }, 0.6);

      return off;
    });
  }

  // Hero title words lift out of their masks once the font is ready.
  function heroTitle() {
    const title = $('.xhero__title');
    if (!title) return;
    mm.add(MOTION, () => {
      const split = SplitText.create(title, { type: 'words', mask: 'words', wordsClass: 'split-word' });
      gsap.set(title, { autoAlpha: 1 });
      gsap.from(split.words, { yPercent: 110, duration: 1.2, ease: 'expo.out', stagger: 0.07, delay: 0.1 });
      return () => split.revert();
    });
  }

  /* ---------------- Headings: masked line reveals ----------------
     Section titles split into lines that rise out of a mask as they scroll
     into view. Groups marked .reveal that hold a heading are not faded as a
     block; their overline, title lines and remaining items enter in sequence. */
  const HEADING = '.h-xl, [data-split], .lf__title';
  const OVERLINE = '.overline';

  function splitLines(el, scrollTrigger, delay = 0) {
    return SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'split-line',
      autoSplit: true, // re-split on resize / font load, keeping the animation in sync
      onSplit: (self) => gsap.from(self.lines, {
        yPercent: 110, duration: 1.2, ease: 'expo.out', stagger: 0.1, delay, scrollTrigger,
      }),
    });
  }

  // Direct "leaf" items inside a group that aren't the heading or overline.
  function restOf(group) {
    const out = [];
    const walk = (el) => [...el.children].forEach((ch) => {
      if (ch.matches(`${HEADING}, ${OVERLINE}`)) return;
      if (ch.querySelector(`${HEADING}, ${OVERLINE}`)) walk(ch); else out.push(ch);
    });
    walk(group);
    return out;
  }

  function headings() {
    mm.add(MOTION, () => {
      const groups = $$('.reveal').filter((g) => g.querySelector(HEADING));
      groups.forEach((g) => {
        gsap.set(g, { autoAlpha: 1, y: 0 });
        g.dataset.motionDone = '';
      });

      const splits = $$(HEADING).filter((h) => !h.closest('.xhero')).map((h) => {
        const group = h.closest('.reveal') || h.parentElement;
        const st = { trigger: h, start: 'top 90%', toggleActions: 'play none none none' };
        const over = $$(OVERLINE, group).filter((o) => !o.closest('.chips, .ft__bar'));
        if (over.length) gsap.from(over, { autoAlpha: 0, y: 14, duration: 0.9, ease: 'power3.out', scrollTrigger: st });
        const rest = h.closest('.reveal') ? restOf(group) : [];
        if (rest.length) {
          gsap.from(rest, {
            autoAlpha: 0, y: 24, duration: 1, ease: 'expo.out', stagger: 0.08, delay: 0.25, scrollTrigger: st,
          });
        }
        return splitLines(h, st, over.length ? 0.08 : 0);
      });
      return () => splits.forEach((s) => s.revert());
    });
  }

  /* ---------------- Generic reveals ----------------
     Remaining .reveal blocks rise in, batched so neighbours stagger. */
  function reveals() {
    mm.add(MOTION, () => {
      const items = $$('.reveal').filter((el) => !('motionDone' in el.dataset));
      gsap.set(items, { autoAlpha: 0, y: 48 });
      ScrollTrigger.batch(items, {
        start: 'top 90%',
        once: true,
        onEnter: (batch) => gsap.to(batch, {
          autoAlpha: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.1, overwrite: 'auto',
        }),
      });
    });
  }

  /* ---------------- Section-specific motion ---------------- */
  function sections() {
    mm.add(MOTION, () => {
      // Latest from Frasers — the story slides in under the title.
      const latest = $('.latest__right');
      if (latest) {
        gsap.from(latest, {
          autoAlpha: 0, x: 40, duration: 1.2, ease: 'expo.out',
          scrollTrigger: { trigger: latest, start: 'top 90%' },
        });
      }

      // I'm looking for — panel sweeps in, links stagger, photo drifts.
      const lf = $('.lf');
      if (lf) {
        const st = { trigger: lf, start: 'top 80%' };
        gsap.from('.lf__shape', { xPercent: -12, autoAlpha: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: st });
        gsap.from('.lf__link', {
          autoAlpha: 0, y: 24, duration: 1, ease: 'expo.out', stagger: 0.08, delay: 0.3, scrollTrigger: st,
        });
        gsap.fromTo(lf, { backgroundPositionY: '30%' }, {
          backgroundPositionY: '70%', ease: 'none',
          scrollTrigger: { trigger: lf, start: 'top bottom', end: 'bottom top', scrub: true },
        });
      }

      // Our businesses — cards rise in sequence from the left.
      const bz = $('.bz__grid');
      if (bz) {
        gsap.from($$('.bz__card', bz), {
          y: 100, autoAlpha: 0, duration: 1.2, ease: 'expo.out', stagger: 0.07,
          scrollTrigger: { trigger: bz, start: 'top 85%' },
        });
      }

      // Where we operate — map settles in, country list cascades.
      const ops = $('#ops');
      if (ops) {
        const st = { trigger: ops, start: 'top 70%' };
        gsap.from('.ops__map', { autoAlpha: 0, scale: 0.94, duration: 1.6, ease: 'expo.out', scrollTrigger: st });
        gsap.from($$('.ops .chip'), { autoAlpha: 0, y: 16, duration: 0.8, ease: 'power3.out', stagger: 0.06, delay: 0.2, scrollTrigger: st });
        gsap.from($$('.ops__list li'), { autoAlpha: 0, x: -24, duration: 0.9, ease: 'expo.out', stagger: 0.05, delay: 0.3, scrollTrigger: st });
      }

      // Investors — photo opens from the bottom and keeps a gentle parallax.
      const invImg = $('.investors__img');
      if (invImg) {
        const img = $('img', invImg);
        gsap.fromTo(invImg, { clipPath: 'inset(100% 0% 0% 0%)' }, {
          clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut',
          scrollTrigger: { trigger: invImg, start: 'top 85%' },
        });
        gsap.fromTo(img, { yPercent: -6, scale: 1.15 }, {
          yPercent: 6, scale: 1.15, ease: 'none',
          scrollTrigger: { trigger: invImg, start: 'top bottom', end: 'bottom top', scrub: true },
        });
      }

      // Sustainability — photo wipes open, facets float up after it.
      const susImg = $('.sus__media > img');
      if (susImg) {
        gsap.fromTo(susImg, { clipPath: 'inset(0% 100% 0% 0% round 16px)' }, {
          clipPath: 'inset(0% 0% 0% 0% round 16px)', duration: 1.6, ease: 'expo.inOut',
          scrollTrigger: { trigger: susImg, start: 'top 80%' },
        });
        gsap.from('.sus__facets .facet', {
          autoAlpha: 0, y: 40, duration: 1.1, ease: 'expo.out', stagger: 0.12, delay: 0.6,
          scrollTrigger: { trigger: susImg, start: 'top 80%' },
        });
      }

      // Count-ups: share price and sustainability figures.
      $$('.stat-card__num, .sus__facets .facet strong').forEach(countUp);

      // Big links — each row's arrow slides in after the row lands.
      $$('.biglink').forEach((link) => {
        gsap.from($('.icon', link), {
          x: -32, autoAlpha: 0, duration: 1, ease: 'expo.out', delay: 0.2,
          scrollTrigger: { trigger: link, start: 'top 90%' },
        });
      });
    });
  }

  // Counts the first number in an element up from zero, keeping its prefix,
  // suffix and decimal places (">76 MW", "0.880").
  function countUp(el) {
    const text = el.textContent;
    const match = text.match(/\d+(?:\.\d+)?/);
    if (!match) return;
    const target = parseFloat(match[0]);
    const decimals = (match[0].split('.')[1] || '').length;
    const [pre, post] = [text.slice(0, match.index), text.slice(match.index + match[0].length)];
    const state = { v: 0 };
    const write = () => { el.textContent = pre + state.v.toFixed(decimals) + post; };
    gsap.to(state, {
      v: target, duration: 2, ease: 'expo.out', onUpdate: write,
      onStart: write,
      scrollTrigger: { trigger: el, start: 'top 90%' },
    });
    write();
  }

  /* ---------------- Newsroom: pinned two-column drift ----------------
     Desktop only. The stage pins for as long as the faster column needs to
     travel. Column A starts at the top fade and ends with its last card above
     the bottom fade; column B starts 120px lower and finishes 120px higher,
     so it moves faster. Re-measured after every topic filter. */
  function newsroom() {
    const root = $('[data-newsroom]');
    if (!root) return;
    const stage = $('.nr__stage', root);
    const viewport = $('.nr__viewport', root);
    const OFFSET = 120;

    root.addEventListener('newsroom:filter', () => ScrollTrigger.refresh());

    mm.add(DESKTOP_MOTION, () => {
      let m = null;
      const measure = () => {
        root.style.setProperty('--nav-h', `${navH()}px`);
        root.classList.add('is-pinned');
        const visible = $$('.nr-card', root).filter((c) => !c.hidden);
        const H = viewport.clientHeight;
        const pad = parseFloat(getComputedStyle(root).getPropertyValue('--fade-h')) || 0;
        const bottom = (list) => list.reduce((b, c) => Math.max(b, c.offsetTop + c.offsetHeight), 0);
        const hA = bottom(visible.filter((c) => !c.classList.contains('is-b')));
        const hB = bottom(visible.filter((c) => c.classList.contains('is-b')));
        const TA = Math.max(0, hA + pad * 2 - H);
        const TB = hB ? Math.max(0, hB + pad * 2 - H + OFFSET * 2) : 0;
        const travel = Math.max(TA, TB);
        // Few cards: centre them, nothing to scroll through.
        const start = travel === 0 ? Math.max(0, (H - Math.max(hA, hB + OFFSET)) / 2) : pad;
        m = { start, TA, TB, travel };
        root.classList.toggle('is-static', travel === 0);
      };
      measure();
      const off = onRefreshInit(measure);

      gsap.fromTo(root,
        { '--ya': () => `${m.start}px`, '--yb': () => `${m.start + OFFSET}px` },
        {
          '--ya': () => `${m.start - m.TA}px`,
          '--yb': () => `${m.start + OFFSET - m.TB}px`,
          ease: 'none',
          scrollTrigger: {
            trigger: stage,
            start: () => `top ${navH()}`,
            end: () => `+=${Math.max(1, m.travel)}`,
            pin: true,
            scrub: true,
            invalidateOnRefresh: true,
          },
        });

      // Cards fade up into the columns as the stage arrives.
      gsap.from($$('.nr-card__link', root), {
        autoAlpha: 0, y: 60, duration: 1.1, ease: 'expo.out', stagger: 0.06,
        scrollTrigger: { trigger: root, start: 'top 70%' },
      });

      return () => { off(); root.classList.remove('is-pinned', 'is-static'); };
    });
  }

  /* ---------------- Insights: scroll stack ----------------
     Each card pins a little lower than the one before (pinSpacing: false, so
     the next card slides up over it). As a card covers the one beneath, that
     card's "depth" grows 0 → 1; depth drives its scale and a black shade, so
     the stack recedes. The full stack holds for HOLD px, then scrolls away. */
  function insights() {
    const root = $('[data-scroll-stack]');
    if (!root) return;
    const slots = $$('[data-stack-slot]', root);
    const cards = slots.map((s) => s.firstElementChild);
    const n = slots.length;
    if (n < 2) return;

    mm.add(MOTION, () => {
      const OFFSET = 24;     // how much lower each pinned card sits
      const POSITION = 0.15; // pin line, as a fraction of viewport height
      const SCALE = 0.05;    // scale lost per card stacked on top
      const MIN_SCALE = 0.8;
      const DIM = 0.2;       // shade added per card stacked on top
      const HOLD = 200;      // scroll the full stack stays pinned for
      const stackTop = () => Math.max(navH() + 16, POSITION * window.innerHeight);
      const cover = new Array(n).fill(0);
      const last = slots[n - 1];

      const apply = () => cards.forEach((card, i) => {
        let depth = 0;
        for (let j = i + 1; j < n; j++) depth += cover[j];
        gsap.set(card, {
          scale: Math.max(MIN_SCALE, 1 - depth * SCALE),
          '--stack-dim': (1 - Math.pow(1 - DIM, depth)).toFixed(3),
        });
      });

      slots.forEach((slot, i) => {
        slot.style.zIndex = String(i + 1);
        ScrollTrigger.create({
          trigger: slot,
          start: () => `top ${stackTop() + i * OFFSET}`,
          endTrigger: last,
          end: () => `top+=${HOLD} ${stackTop() + (n - 1) * OFFSET}`,
          pin: true,
          pinSpacing: false,
          invalidateOnRefresh: true,
        });
        if (i === 0) return;
        const track = (self) => { cover[i] = self.progress; apply(); };
        ScrollTrigger.create({
          trigger: slot,
          start: () => `top ${stackTop() + (i - 1) * OFFSET + slots[i - 1].offsetHeight}`,
          end: () => `top ${stackTop() + i * OFFSET}`,
          invalidateOnRefresh: true,
          onUpdate: track,
          onRefresh: track,
        });
      });

      return () => {
        slots.forEach((s) => { s.style.zIndex = ''; });
        cards.forEach((c) => { c.style.transform = ''; c.style.removeProperty('--stack-dim'); });
      };
    });
  }

  /* ---------------- Footer ----------------
     CTA copy rises in; the plum wordmark lifts out of the floor as the
     footer scrolls into view. (The ribbons run on gsap.ticker, footer-ribbons.js.) */
  function footer() {
    mm.add(MOTION, () => {
      const cta = $('.ft__cta');
      if (cta) {
        gsap.from(['.ft__cta-body', '.ft__cta-btn'], {
          autoAlpha: 0, y: 30, duration: 1.1, ease: 'expo.out', stagger: 0.1, delay: 0.25,
          scrollTrigger: { trigger: cta, start: 'top 75%' },
        });
      }
      const mark = $('[data-wordmark]');
      if (mark) {
        gsap.fromTo(mark, { yPercent: 60 }, {
          yPercent: 0, ease: 'none',
          scrollTrigger: { trigger: mark, start: 'top bottom', end: 'bottom bottom', scrub: true },
        });
      }
    });
  }
})();
