/* Footer "Have a question?" background — three twisted ribbons (Figma
   "Shape" 280:2806: a band whose edges cross at a pinch near the middle,
   then flare out again) drawn as SVG paths.

   Motion "Ripple": a soft wave travels along each ribbon and its edges rise
   and fall like fabric in a light breeze. The twist stays near the middle.
   Every moving term repeats exactly once per LOOP seconds, so the loop is
   seamless. Ribbons share the loop but start 0s / 3s / 6s into it, so all
   three are already moving on load. */
(() => {
  const hosts = document.querySelectorAll('[data-ribbons]');
  if (!hosts.length) return;

  const NS = 'http://www.w3.org/2000/svg';
  const LOOP = 9;            // seconds
  const SAMPLES = 120;        // points per edge
  const TAU = Math.PI * 2;

  // Back to front. Geometry comes from Figma "CTA band" 273:20030, in its
  // 1440 x 480 frame: left end, pinch (twist) and right end of each ribbon's
  // centreline. The ends sit off screen so the wide lobes fill the band.
  // scale = ribbon size, phase = start point in the loop (seconds).
  const RIBBONS = [
    { color: '#623945', opacity: 0.55, scale: 0.72, phase: 6,
      left: [-458, 172], pinch: [492, 149], right: [1793, 160] },
    { color: '#74404F', opacity: 0.75, scale: 0.86, phase: 3,
      left: [-203, 366], pinch: [737, 252], right: [2033, 135] },
    { color: '#8B4B5E', opacity: 1,    scale: 1,    phase: 0,
      left: [-294, 582], pinch: [623, 341], right: [1890, 49] },
  ];
  const FRAME_W = 1440, FRAME_H = 480;
  const HALF = 130;          // half-width of a ribbon end (frame px)
  const BULGE = 110;         // left lobe arcs up, right lobe sags down (frame px)

  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Width profile from the pinch (0) to a ribbon end (1): opens quickly,
  // then flares gently, like the Figma lobes.
  const K = 1.6, KN = Math.tanh(K);
  const flare = (a) => Math.tanh(K * a) / KN;

  function ribbonPath(r, t, w, h) {
    const p = (t + r.phase) / LOOP;          // 0…1 through the loop
    const mobile = w < 768;
    // Map frame coords to the section: fit the height, keep the ribbons'
    // proportions on narrow screens by cropping the sides around the centre.
    const sy = h / FRAME_H;
    const sx = Math.max(w / FRAME_W, mobile ? 0.55 : 0);
    const X = (fx) => w / 2 + (fx - FRAME_W / 2) * sx;
    const half = HALF * sy * r.scale * (mobile ? 0.77 : 1);
    const bulge = BULGE * sy * r.scale;
    const amp = h * (mobile ? 0.03 : 0.04);

    const [lx, ly] = r.left, [rx, ry] = r.right;
    const len = rx - lx;
    // Twist sways only slightly around its spot; it never travels or flips.
    const pu = (r.pinch[0] - lx) / len + 0.015 * Math.sin(TAU * p);
    const py = r.pinch[1];

    const top = [], bottom = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const u = i / SAMPLES;
      // s: -1 (left end) … 0 (pinch) … 1 (right end)
      const s = u < pu ? (u - pu) / pu : (u - pu) / (1 - pu);
      const base = s < 0 ? py + (ly - py) * -s : py + (ry - py) * s;
      const x = X(lx + u * len);
      // Travelling waves along the length (integer cycles per loop = seamless).
      const wave = amp * Math.sin(TAU * (u * 1.1 - p))
                 + amp * 0.35 * Math.sin(TAU * (u * 2.3 - 2 * p) + 1.3);
      // Edges breathe: the width swells and settles as the wave passes.
      const breathe = 1 + 0.16 * Math.sin(TAU * (u * 1.4 - p) + 0.6);
      // Slight independent lift of each edge so they read as soft fabric.
      const flutter = half * 0.12 * Math.sin(TAU * (u * 1.8 - p) + 2.1);
      const c = base * sy + bulge * Math.sin(Math.PI * s) + wave;
      const hw = half * breathe * flare(Math.abs(s)) * Math.sign(s);
      top.push([x, c - hw - flutter]);
      bottom.push([x, c + hw - flutter]);
    }
    // One outline: top edge left→right, bottom edge right→left. The edges
    // cross at the pinch; nonzero fill paints both lobes.
    const pts = top.concat(bottom.reverse());
    let d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (let i = 1; i < pts.length; i++) d += 'L' + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1);
    return d + 'Z';
  }

  function init(host) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('focusable', 'false');
    const paths = RIBBONS.map((r) => {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('fill', r.color);
      path.setAttribute('fill-opacity', r.opacity);
      svg.appendChild(path);
      return path;
    });
    host.appendChild(svg);

    let w = 1, h = 1, time = 0, running = false, visible = false;

    const draw = () => {
      paths.forEach((path, i) => path.setAttribute('d', ribbonPath(RIBBONS[i], time, w, h)));
    };

    // Runs on GSAP's ticker (the same frame loop as ScrollSmoother), with a
    // requestAnimationFrame fallback if GSAP isn't on the page.
    const ticker = window.gsap ? gsap.ticker : null;
    let raf = 0, last = 0;
    const canRun = () => visible && !document.hidden && !mqReduce.matches;
    const step = (dtMs) => {
      if (!canRun()) { sleep(); return; }
      time = (time + Math.min(0.05, dtMs / 1000)) % LOOP;
      draw();
    };
    const onTick = (t, dtMs) => step(dtMs);
    const onFrame = (now) => {
      const dt = last ? now - last : 0;
      last = now;
      step(dt);
      if (running) raf = requestAnimationFrame(onFrame);
    };
    const sleep = () => {
      if (!running) return;
      running = false;
      if (ticker) ticker.remove(onTick); else { cancelAnimationFrame(raf); last = 0; }
    };
    const wake = () => {
      if (running || !canRun()) return;
      running = true;
      if (ticker) ticker.add(onTick); else raf = requestAnimationFrame(onFrame);
    };

    const resize = () => {
      w = Math.max(1, host.clientWidth);
      h = Math.max(1, host.clientHeight);
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      draw();
    };

    new ResizeObserver(resize).observe(host);
    // Pause while the section is off screen.
    new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible) wake();
    }).observe(host);
    document.addEventListener('visibilitychange', wake);
    // Reduced motion: ribbons stay static at their staggered poses.
    mqReduce.addEventListener('change', () => { draw(); wake(); });
    resize();
  }

  hosts.forEach(init);
})();
