/* Footer "Have a question?" background — three twisting ribbons of light
   (Figma "Shape" 280:2806: a band that pinches to a point where its edges
   cross, then flares out again), one per brand colour, blending to white
   where they overlap. Twists and waves travel left to right and the ribbons
   run past both edges of the screen.
   Adapted from the React Bits "Sliced Waves" idea (wave motion, perspective,
   cursor-driven depth of field, palette drift) but drawn as one unbroken
   shape per pixel in a single WebGL pass instead of instanced bars. */
(() => {
  const hosts = document.querySelectorAll('[data-waves]');
  if (!hosts.length) return;

  const SETTINGS = {
    colors: ['#623945', '#74404F', '#8B4B5E'],
    overlap: '#48252F',  // colour where ribbons cross
    ribbons: 3,          // one continuous ribbon per colour
    ribbonHeight: 0.21,  // widest point of a ribbon, fraction of section height
    spread: 0.11,
    twist: 0.1,          // twists per world unit (~1 pinch across the screen)
    amplitude: 0.08,
    frequency: 1,
    speed: 0.6,
    perspective: 0.45,
    curve: 0.5,
    blur: 0.6,
    glow: 1,
    brightness: 1.1,
    position: 0.78,      // vertical centre line, 0 = top, 1 = bottom
    grain: 0.06,
    fade: 0.25,          // soft top/bottom mask; sides stay open so ribbons run off-screen
  };

  const FOCAL = 1.1;
  const DISTANCE = 2.6;
  const INTRO_SECONDS = 1.6;
  const MAX_RENDER_DIM = 2560;

  const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `
precision highp float;
uniform vec2 uRes;        // css px
uniform float uDpr;
uniform float uTime;
uniform float uIntro;
uniform float uFocus;
uniform float uLift;
uniform float uLiftX;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform float uRibbons;
uniform float uHeight;
uniform float uSpread;
uniform float uAmp;
uniform float uFreq;
uniform float uYaw;
uniform float uBend;
uniform float uBlur;
uniform float uGlow;
uniform float uExposure;
uniform float uPosition;
uniform float uGrain;
uniform float uFade;
uniform float uTwist;
uniform vec3 uOverlap;

const float TAU = 6.28318530718;
const float FOCAL = ${FOCAL.toFixed(4)};
const float DIST = ${DISTANCE.toFixed(4)};

float erfApprox(float x) {
  float a = x * x;
  float t = 1.0 - exp(-a * (1.2732395 + 0.147 * a) / (1.0 + 0.147 * a));
  return sign(x) * sqrt(max(t, 0.0));
}
// Box of half-size h convolved with a gaussian of sigma s, sampled at d.
float box(float d, float h, float s) {
  float k = 0.70710678 / max(s, 0.3);
  return 0.5 * (erfApprox((h - d) * k) + erfApprox((h + d) * k));
}
vec3 palette(float x) {
  float f = mod(x, 3.0);
  float i = floor(f);
  float m = f - i;
  m = m * m * (3.0 - 2.0 * m);
  vec3 a = i < 0.5 ? uC0 : (i < 1.5 ? uC1 : uC2);
  vec3 b = i < 0.5 ? uC1 : (i < 1.5 ? uC2 : uC0);
  return mix(a, b, m);
}
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float smoother(float edge, float x) {
  float t = clamp(x / max(edge, 0.0001), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

void main() {
  vec2 frag = gl_FragCoord.xy / uDpr;
  float w = uRes.x;
  float h = uRes.y;
  float px = frag.x;
  float py = h - frag.y;

  // Invert the yawed perspective: screen x -> world x along the ribbon.
  float F = h * FOCAL;
  float u = (px - w * 0.5) / F;
  float cy = cos(uYaw), sy = sin(uYaw);
  float den = cy - u * sy;
  vec3 hdr = vec3(0.0);
  float cover = 0.0;
  if (den > 0.02) {
    float x = u * DIST / den;
    float local = uBend * sin(x * 0.9 + 0.8);
    float Z = x * sy + local * cy + DIST;
    if (Z > 0.45) {
      float scale = F / Z;
      float centerScale = F / DIST;
      float thickness = uHeight * h * 0.5 / centerScale;
      float separation = uSpread * h / centerScale;
      float amp = uAmp * h / centerScale;
      float freq = 0.22 * uFreq;
      float base = h * uPosition;
      float t = uTime;
      float across = px / max(w, 1.0);
      float blurPx = 0.5 + uBlur * 0.6 + uBlur * 16.0 * abs(uFocus / Z - 1.0);
      float lift = uLift * exp(-pow((px - uLiftX) / max(w * 0.12, 60.0), 2.0));

      for (int i = 0; i < 4; i++) {
        float r = float(i);
        if (r >= uRibbons) break;
        float offset = (r - (uRibbons - 1.0) * 0.5) * separation;
        // Every term uses (x - t): waves and twists travel left to right.
        float wave = 0.62 * sin(TAU * freq * x - t * 1.6 + r * 2.1)
                   + 0.38 * sin(TAU * freq * 1.9 * x - t * 1.15 + r * 1.3);
        float yc = base - (offset + wave * amp) * scale;
        // Signed half-width: where it passes through zero the top and bottom
        // edges cross, pinching the band to a point like the Figma shape.
        float twist = cos(TAU * uTwist * x - t * 0.7 + r * 2.4);
        float grow = clamp((uIntro * 1.6 - across - r * 0.04) / 0.6, 0.0, 1.0);
        float eased = grow * grow * (3.0 - 2.0 * grow);
        float hh = thickness * abs(twist) * eased * scale;
        if (hh < 0.4) continue;
        float face = twist > 0.0 ? 1.0 : 0.72;   // back of the ribbon a touch darker

        float d = py - yc;
        float body = box(d, hh, blurPx * 1.15);
        float glow = box(d, hh, hh * 0.35 + 14.0);
        float v = clamp(d / hh, -1.0, 1.0);
        body *= 1.0 - 0.35 * v * v * v * v;

        // Each ribbon owns one colour, with only a slight drift towards the
        // next so the three stay distinct.
        float tone = r + 0.12 * sin(x * 0.6 + t * 0.4 + r);
        vec3 top = palette(tone - 0.08);
        vec3 bot = palette(tone + 0.08);
        vec3 color = mix(top, bot, clamp(v * 0.5 + 0.5, 0.0, 1.0));
        cover += body * (0.4 + 0.6 * eased);
        vec3 tint = color * color / max(max(color.r, max(color.g, color.b)), 0.05);
        float shimmer = 0.8 + 0.2 * sin(x * 2.3 + r * 7.7 - t * 1.2);
        float intensity = shimmer * face * (1.0 + lift * 0.6) * (0.4 + 0.6 * eased);
        hdr += (color * body + tint * uGlow * glow * 0.16) * intensity;
      }
    }
  }

  hdr *= uExposure;
  vec2 uv = frag / uRes;
  float edge = uFade * 0.5;
  float mask = smoother(edge, uv.y) * smoother(edge, 1.0 - uv.y);
  float grain = (hash(gl_FragCoord.xy + fract(uTime * 7.31) * 113.0) - 0.5) * uGrain;
  float peak = max(hdr.r, max(hdr.g, hdr.b));
  vec3 mapped = 1.0 - exp(-hdr);
  mapped = mix(mapped, vec3(1.0), smoothstep(1.1, 3.2, peak) * 0.6);
  float level = max(mapped.r, max(mapped.g, mapped.b));
  mapped = clamp(mapped + grain * level, 0.0, 1.0) * mask;
  // Premultiplied over the band colour; grain only lives inside the light.
  vec4 light = vec4(mapped, max(mapped.r, max(mapped.g, mapped.b)));
  // Where ribbons overlap they turn solid in the overlap colour (opaque, so
  // the band behind doesn't tint it).
  float k = smoothstep(1.05, 1.9, cover) * mask;
  gl_FragColor = mix(light, vec4(uOverlap, 1.0), k);
}`;

  const hexToLinear = (hex) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.pow(c / 255, 2.2));
  };

  const compile = (gl, type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn('footer-waves shader:', gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  };

  const init = (host) => {
    const canvas = host.querySelector('canvas');
    const gl = canvas && canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const U = {};
    ['uRes', 'uDpr', 'uTime', 'uIntro', 'uFocus', 'uLift', 'uLiftX', 'uC0', 'uC1', 'uC2', 'uRibbons', 'uHeight',
      'uSpread', 'uAmp', 'uFreq', 'uYaw', 'uBend', 'uBlur', 'uGlow', 'uExposure', 'uPosition', 'uGrain', 'uFade', 'uTwist', 'uOverlap']
      .forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });

    const s = SETTINGS;
    const yaw = s.perspective * 0.66;
    const [c0, c1, c2] = s.colors.map(hexToLinear);
    gl.uniform3fv(U.uC0, c0);
    gl.uniform3fv(U.uC1, c1);
    gl.uniform3fv(U.uC2, c2);
    gl.uniform1f(U.uRibbons, s.ribbons);
    gl.uniform1f(U.uHeight, s.ribbonHeight);
    gl.uniform1f(U.uSpread, s.spread);
    gl.uniform1f(U.uAmp, s.amplitude);
    gl.uniform1f(U.uFreq, s.frequency);
    gl.uniform1f(U.uYaw, yaw);
    gl.uniform1f(U.uBend, s.curve * 0.6);
    gl.uniform1f(U.uBlur, s.blur);
    gl.uniform1f(U.uGlow, s.glow);
    gl.uniform1f(U.uExposure, 1.6 * s.brightness);
    gl.uniform1f(U.uPosition, s.position);
    gl.uniform1f(U.uGrain, s.grain);
    gl.uniform1f(U.uFade, s.fade);
    gl.uniform1f(U.uTwist, s.twist);
    // Output is written straight to the screen, so use the sRGB value as-is.
    gl.uniform3fv(U.uOverlap, hexToLinear(s.overlap).map((c) => Math.pow(c, 1 / 2.2)));

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const state = { w: 1, h: 1, dpr: 1, time: 0, intro: reduce ? 1 : 0, started: reduce, focus: DISTANCE, focusVel: 0, lift: 0, liftX: 0 };
    const pointer = { x: 0, inside: false };
    let raf = 0;
    let last = 0;
    let visible = false;

    // Depth of the ribbon under screen x (same inversion as the shader).
    const depthAt = (px) => {
      const F = state.h * FOCAL;
      const u = (px - state.w * 0.5) / F;
      const den = Math.cos(yaw) - u * Math.sin(yaw);
      if (den <= 0.02) return DISTANCE;
      const x = (u * DISTANCE) / den;
      const local = s.curve * 0.6 * Math.sin(x * 0.9 + 0.8);
      return Math.max(0.45, x * Math.sin(yaw) + local * Math.cos(yaw) + DISTANCE);
    };

    const draw = () => {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(U.uRes, state.w, state.h);
      gl.uniform1f(U.uDpr, canvas.width / state.w);
      gl.uniform1f(U.uTime, state.time % 1000);
      gl.uniform1f(U.uIntro, state.intro);
      gl.uniform1f(U.uFocus, state.focus);
      gl.uniform1f(U.uLift, state.lift);
      gl.uniform1f(U.uLiftX, state.liftX);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const frame = (now) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      if (!reduce) state.time += dt * s.speed;
      if (state.started && state.intro < 1) state.intro = Math.min(1, state.intro + dt / INTRO_SECONDS);

      const engaged = pointer.inside && !reduce;
      const target = engaged ? depthAt(pointer.x) : DISTANCE;
      state.focusVel += (36 * (target - state.focus) - 11 * state.focusVel) * dt;
      state.focus += state.focusVel * dt;
      state.lift += ((engaged ? 1 : 0) - state.lift) * (1 - Math.exp(-dt / (engaged ? 0.25 : 0.6)));
      state.liftX += (pointer.x - state.liftX) * (1 - Math.exp(-dt / 0.12));

      draw();
      const settling = state.intro < 1 || Math.abs(state.focusVel) > 0.001 || state.lift > 0.002 || engaged;
      if (!reduce || settling) raf = requestAnimationFrame(frame);
      else last = 0;
    };

    const wake = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };

    const resize = () => {
      state.w = Math.max(1, host.clientWidth);
      state.h = Math.max(1, host.clientHeight);
      const base = Math.min(window.devicePixelRatio || 1, 2);
      const longest = Math.max(state.w, state.h) * base;
      const ratio = longest > MAX_RENDER_DIM ? (base * MAX_RENDER_DIM) / longest : base;
      canvas.width = Math.round(state.w * ratio);
      canvas.height = Math.round(state.h * ratio);
      draw();
      wake();
    };

    new ResizeObserver(resize).observe(host);
    new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible) { state.started = true; last = 0; wake(); }
    }, { threshold: 0.15 }).observe(host);

    window.addEventListener('pointermove', (e) => {
      const r = host.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      const y = e.clientY - r.top;
      pointer.inside = pointer.x >= 0 && y >= 0 && pointer.x <= r.width && y <= r.height;
      wake();
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { pointer.inside = false; wake(); });
    document.addEventListener('visibilitychange', () => { last = 0; wake(); });
    resize();
  };

  hosts.forEach(init);
})();
