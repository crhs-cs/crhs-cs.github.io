// Cedar Ridge CS Club: live header scenes for the subpages, each a classic of computer science:
//   projects      -> an ASCII donut (the donut.c torus renderer)
//   presentations -> the Utah teapot, Martin Newell's 1975 model, as a spinning wireframe
//   resources     -> an endless zoom into the Mandelbrot set
//   opportunities -> the 3D Pipes screensaver
// Scenes draw in the open part of the header (right of the title on wide screens, faintly
// across the whole header on phones) and pause whenever the header is off screen.
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const C = { lav: '205,180,255', purple: '139,85,232', bright: '180,140,255', silver: '217,214,224', dim: '143,136,156' };
  const rgba = (k, a) => `rgba(${C[k]},${a})`;
  const NAV = 76; // the fixed nav overlaps the top of the header
  // Quality levels: 0 = full, 1 = 30 fps and lighter work, 2 = 30 fps and lowest resolution.
  // Weak hardware starts at 1; any scene that can't keep up steps itself down (never back up).
  const LOW_END = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const GL_RES = [0.75, 0.55, 0.4];
  const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  const SANS = '"Instrument Sans", "Helvetica Neue", Arial, sans-serif';

  // ---------- ASCII donut ----------
  // For each point on a torus: rotate it by angles A and B, project it, keep the nearest point
  // per character cell (a z-buffer), and pick a character by how much it faces the light.
  class Donut {
    init(g){
      this.g = g;
      const R = g.region, rw = R.x1 - R.x0, rh = R.y1 - R.y0;
      this.fs = g.narrow ? 10 : 13;
      this.cw = this.fs * 0.62; this.ch = this.fs * 1.05;
      this.cols = Math.floor(rw / this.cw); this.rows = Math.floor(rh / this.ch);
      this.ox = R.x0 + (rw - this.cols * this.cw) / 2; this.oy = R.y0 + (rh - this.rows * this.ch) / 2;
      const size = Math.min(rw, rh) * 0.47;            // pixel radius the donut should fill
      this.K2 = 5; this.K1 = size * this.K2 / 3 * 0.92;  // R1 + R2 = 3
      this.cx = R.x0 + rw / 2; this.cy = R.y0 + rh / 2;
      this.A = 1.0; this.B = 0.6;
      this.z = new Float32Array(this.cols * this.rows);
      this.lum = new Float32Array(this.cols * this.rows);
    }
    update(dt){ this.A += dt * 0.9; this.B += dt * 0.45; }
    render(){
      const { cols, rows, z, lum, K1, K2, cw, ch, cx, cy, ox, oy } = this;
      z.fill(0); lum.fill(-1);
      const cA = Math.cos(this.A), sA = Math.sin(this.A), cB = Math.cos(this.B), sB = Math.sin(this.B);
      const dth = this.g.level ? 0.11 : 0.08, dph = this.g.level ? 0.035 : 0.025;
      for (let th = 0; th < 6.283; th += dth) {
        const ct = Math.cos(th), st = Math.sin(th);
        for (let ph = 0; ph < 6.283; ph += dph) {
          const cp = Math.cos(ph), sp = Math.sin(ph);
          const cx2 = 2 + ct;                            // R2 + R1 cos(theta), with R1 = 1, R2 = 2
          const y1 = st;
          const x = cx2 * (cB * cp + sA * sB * sp) - y1 * cA * sB;
          const y = cx2 * (sB * cp - sA * cB * sp) + y1 * cA * cB;
          const zz = K2 + cA * cx2 * sp + y1 * sA;
          const ooz = 1 / zz;
          const px = cx + K1 * ooz * x, py = cy - K1 * ooz * y;
          const col = Math.floor((px - ox) / cw), row = Math.floor((py - oy) / ch);
          if (col < 0 || row < 0 || col >= cols || row >= rows) continue;
          const L = cp * ct * sB - cA * ct * sp - sA * st + cB * (cA * st - ct * sA * sp);
          const i = row * cols + col;
          if (ooz > z[i]) { z[i] = ooz; lum[i] = L; }
        }
      }
    }
    draw(ctx){
      this.render();
      const chars = '.,-~:;=!*#$@';
      ctx.font = `500 ${this.fs}px ${MONO}`;
      ctx.textBaseline = 'top';
      const { cols, rows, lum, cw, ch, ox, oy } = this;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const L = lum[r * cols + c];
        if (L <= 0) continue;
        const k = Math.min(11, Math.floor(L * 8));
        ctx.fillStyle = k > 8 ? rgba('silver', 0.95) : rgba('lav', 0.3 + 0.65 * (k / 11));
        ctx.fillText(chars[k], ox + c * cw, oy + r * ch);
      }
    }
    settle(){}
  }

  // ---------- Utah teapot wireframe ----------
  class Teapot {
    init(g){
      this.g = g;
      const D = window.UTAH_TEAPOT;
      this.ok = !!D;
      if (!D) return;
      const R = g.region, rw = R.x1 - R.x0, rh = R.y1 - R.y0;
      this.v = D.v; this.e = D.e;
      this.n = D.v.length / 3;
      this.p = new Float32Array(this.n * 3);     // projected x, y, depth
      this.size = Math.min(rw / 34, rh / 19);    // the model is about 32 units wide and 16 tall
      this.cx = R.x0 + rw / 2; this.cy = R.y0 + rh * 0.54;
      this.a = 0.6;
    }
    update(dt){ this.a += dt * 0.35; }
    draw(ctx){
      if (!this.ok) return;
      const { v, e, p, n, size, cx, cy } = this;
      const ca = Math.cos(this.a), sa = Math.sin(this.a);
      const tilt = 0.32, ct = Math.cos(tilt), st = Math.sin(tilt);
      for (let i = 0; i < n; i++) {
        const x = v[i * 3], y = v[i * 3 + 1], z = v[i * 3 + 2];
        const x1 = x * ca + z * sa, z1 = -x * sa + z * ca;       // spin around the vertical axis
        const y2 = y * ct - z1 * st, z2 = y * st + z1 * ct;      // tip it toward the viewer
        const f = 60 / (60 + z2);                                // gentle perspective
        p[i * 3] = cx + x1 * size * f; p[i * 3 + 1] = cy - y2 * size * f; p[i * 3 + 2] = z2;
      }
      // bucket edges by depth so near lines draw brighter, in a handful of batched paths
      const B = 6, paths = Array.from({ length: B }, () => new Path2D());
      for (let k = 0; k < e.length; k += 2) {
        const i = e[k] * 3, j = e[k + 1] * 3;
        const dz = (p[i + 2] + p[j + 2]) / 2;                    // about -11 (near) to 11 (far)
        const b = Math.max(0, Math.min(B - 1, Math.floor((dz + 11) / 22 * B)));
        paths[b].moveTo(p[i], p[i + 1]); paths[b].lineTo(p[j], p[j + 1]);
      }
      ctx.lineWidth = 1;
      for (let b = B - 1; b >= 0; b--) {
        const t = 1 - b / (B - 1);
        ctx.strokeStyle = t > 0.8 ? rgba('silver', 0.75) : rgba('lav', 0.12 + 0.55 * t);
        ctx.stroke(paths[b]);
      }
    }
    settle(){}
  }

  // ---------- Mandelbrot zoom (WebGL) ----------
  // Each pixel iterates z = z^2 + c and is colored by how fast it escapes. The view eases in
  // toward a point in "seahorse valley" about 15,000x, then eases back out, so it never jumps.
  // The center is split into a high and low part to stretch float32 precision further.
  class Mandelbrot {
    static webgl = true;
    init(g, gl){
      this.g = g; this.gl = gl;
      if (!this.prog) {
        const vs = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
        const fs = `
precision highp float;
uniform vec2 uRes; uniform vec2 uFocus; uniform vec2 uHi; uniform vec2 uLo;
uniform float uScale; uniform float uIter; uniform float uShift;
vec3 palette(float t){
  t = fract(t);
  vec3 a = vec3(0.09, 0.03, 0.22), b = vec3(0.34, 0.13, 0.68), c = vec3(0.62, 0.42, 0.96), d = vec3(0.42, 0.20, 0.78);
  if (t < 0.25) return mix(a, b, t*4.0);
  if (t < 0.5) return mix(b, c, (t - 0.25)*4.0);
  if (t < 0.75) return mix(c, d, (t - 0.5)*4.0);
  return mix(d, a, (t - 0.75)*4.0);
}
void main(){
  vec2 uv = (gl_FragCoord.xy - uFocus*uRes) / uRes.y;
  vec2 c = uHi + (uLo + uv*uScale);
  vec2 z = vec2(0.0);
  float n = 0.0, m2 = 0.0;
  for (int i = 0; i < 700; i++){
    if (float(i) >= uIter) break;
    z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
    m2 = dot(z, z);
    if (m2 > 256.0) break;
    n += 1.0;
  }
  vec3 col = vec3(0.027, 0.016, 0.05);
  if (n < uIter){
    float sn = n - log2(log2(m2)) + 4.0;                  // smooth iteration count
    col = palette(sn*0.028 + uShift) * smoothstep(0.0, 18.0, sn) * 0.88;
    col = mix(vec3(0.027, 0.016, 0.05), col, 0.9);
  }
  gl_FragColor = vec4(col, 1.0);
}`;
        const sh = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); return o; };
        const prog = gl.createProgram();
        gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
        gl.useProgram(prog);
        const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        this.prog = prog; this.U = {};
        ['uRes', 'uFocus', 'uHi', 'uLo', 'uScale', 'uIter', 'uShift'].forEach(k => this.U[k] = gl.getUniformLocation(prog, k));
        const X = -0.743643887037151, Y = 0.131825904205330;
        this.hi = [Math.fround(X), Math.fround(Y)]; this.lo = [X - Math.fround(X), Y - Math.fround(Y)];
        this.t = 0;
      }
      const R = g.region;
      // zoom toward a point on the right, clear of the title (y is measured up from the bottom)
      this.focus = g.narrow ? [0.72, 0.6] : [0.76, 1 - ((NAV + g.h) / 2) / g.h];
    }
    update(dt){ this.t += dt; }
    draw(gl){
      const T = 60, ph = (this.t % T) / T, u = ph < 0.5 ? ph * 2 : 2 - ph * 2;
      const ease = u * u * (3 - 2 * u);
      const scale = 2.6 * Math.pow(1.7e-4 / 2.6, ease);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.useProgram(this.prog);
      gl.uniform2f(this.U.uRes, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(this.U.uFocus, this.focus[0], this.focus[1]);
      gl.uniform2f(this.U.uHi, this.hi[0], this.hi[1]);
      gl.uniform2f(this.U.uLo, this.lo[0], this.lo[1]);
      gl.uniform1f(this.U.uScale, scale);
      const maxIter = [630, 420, 260][this.g.level || 0];
      gl.uniform1f(this.U.uIter, Math.round(110 + (maxIter - 110) * ease));
      gl.uniform1f(this.U.uShift, this.t * 0.012);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    settle(){ this.t = 14; }
  }

  // ---------- 3D Pipes ----------
  // Pipes grow one segment at a time through a 3D grid, turning at random and never crossing
  // an occupied cell, with ball joints at the turns. Segments are depth sorted every frame
  // (painter's algorithm) while the camera slowly orbits. When the grid fills, it fades and restarts.
  class Pipes {
    init(g){
      this.g = g;
      const R = g.region;
      this.nx = g.narrow ? 10 : 12; this.ny = 7; this.nz = 7;
      this.cx = (R.x0 + R.x1) / 2; this.cy = (R.y0 + R.y1) / 2;
      this.unit = Math.min((R.x1 - R.x0) / (this.nx + 2), (R.y1 - R.y0) / (this.ny + 1.5)) * 0.82;
      this.yaw = 0.5; this.reset();
    }
    reset(){
      this.occ = new Uint8Array(this.nx * this.ny * this.nz);
      this.segs = []; this.joints = []; this.pipes = []; this.timer = 0; this.fade = 1; this.ending = false;
      const palette = [['lav', 'silver'], ['bright', 'lav'], ['purple', 'bright'], ['silver', 'lav']];
      for (let k = 0; k < 4; k++) this.spawn(palette[k]);
    }
    id(x, y, z){ return (z * this.ny + y) * this.nx + x; }
    free(x, y, z){ return x >= 0 && y >= 0 && z >= 0 && x < this.nx && y < this.ny && z < this.nz && !this.occ[this.id(x, y, z)]; }
    spawn(colors){
      for (let tries = 0; tries < 40; tries++) {
        const x = Math.floor(Math.random() * this.nx), y = Math.floor(Math.random() * this.ny), z = Math.floor(Math.random() * this.nz);
        if (this.free(x, y, z)) { this.occ[this.id(x, y, z)] = 1; this.pipes.push({ at: [x, y, z], dir: null, colors, alive: true }); this.joints.push({ p: [x, y, z], colors }); return; }
      }
    }
    grow(pipe){
      const D = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      const [x, y, z] = pipe.at;
      const ok = D.filter(([dx, dy, dz]) => this.free(x + dx, y + dy, z + dz));
      if (!ok.length) { pipe.alive = false; return; }
      let d = pipe.dir && Math.random() < 0.72 && ok.some(o => o === pipe.dir || (o[0] === pipe.dir[0] && o[1] === pipe.dir[1] && o[2] === pipe.dir[2]))
        ? pipe.dir : ok[Math.floor(Math.random() * ok.length)];
      if (pipe.dir && (d[0] !== pipe.dir[0] || d[1] !== pipe.dir[1] || d[2] !== pipe.dir[2])) this.joints.push({ p: [x, y, z], colors: pipe.colors });
      const to = [x + d[0], y + d[1], z + d[2]];
      this.occ[this.id(...to)] = 1;
      this.segs.push({ a: [x, y, z], b: to, colors: pipe.colors, grow: 0 });
      pipe.at = to; pipe.dir = d;
    }
    update(dt){
      this.yaw += dt * 0.12;
      this.segs.forEach(s => { s.grow = Math.min(1, s.grow + dt * 7); });
      if (this.ending) { this.fade -= dt * 0.8; if (this.fade <= 0) this.reset(); return; }
      this.timer += dt;
      while (this.timer > 0.11) {
        this.timer -= 0.11;
        this.pipes.forEach(p => p.alive && this.grow(p));
        this.pipes.forEach((p, i) => { if (!p.alive) { const c = p.colors; this.pipes.splice(i, 1); this.spawn(c); } });
        if (this.segs.length > this.nx * this.ny * this.nz * 0.45) { this.ending = true; break; }
      }
    }
    project([x, y, z]){
      const X = x - (this.nx - 1) / 2, Y = y - (this.ny - 1) / 2, Z = z - (this.nz - 1) / 2;
      const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
      const x1 = X * c + Z * s, z1 = -X * s + Z * c;
      const ct = Math.cos(0.38), st = Math.sin(0.38);
      const y2 = Y * ct - z1 * st, z2 = Y * st + z1 * ct;
      const f = 14 / (14 + z2);
      return [this.cx + x1 * this.unit * f, this.cy - y2 * this.unit * f, z2, f];
    }
    draw(ctx){
      const items = [];
      this.segs.forEach(s => {
        const b = [s.a[0] + (s.b[0] - s.a[0]) * s.grow, s.a[1] + (s.b[1] - s.a[1]) * s.grow, s.a[2] + (s.b[2] - s.a[2]) * s.grow];
        const A = this.project(s.a), B = this.project(b);
        items.push({ z: (A[2] + B[2]) / 2, seg: [A, B], colors: s.colors });
      });
      this.joints.forEach(j => { const P = this.project(j.p); items.push({ z: P[2] - 0.01, joint: P, colors: j.colors }); });
      items.sort((a, b) => b.z - a.z);   // far first
      ctx.globalAlpha = Math.max(0, this.fade);
      ctx.lineCap = 'round';
      const w0 = this.unit * 0.34;
      for (const it of items) {
        const near = Math.max(0, Math.min(1, 0.55 - it.z / 10));     // simple depth shading
        const [base, hi] = it.colors;
        if (it.seg) {
          const [A, B] = it.seg, w = w0 * (A[3] + B[3]) / 2;
          ctx.strokeStyle = rgba(base, 0.35 + 0.5 * near); ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
          ctx.strokeStyle = rgba(hi, 0.18 + 0.45 * near); ctx.lineWidth = w * 0.32;   // highlight along the tube
          ctx.beginPath(); ctx.moveTo(A[0] - w * 0.16, A[1] - w * 0.16); ctx.lineTo(B[0] - w * 0.16, B[1] - w * 0.16); ctx.stroke();
        } else {
          const P = it.joint, r = w0 * P[3] * 0.62;
          ctx.fillStyle = rgba(base, 0.4 + 0.5 * near);
          ctx.beginPath(); ctx.arc(P[0], P[1], r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = rgba(hi, 0.25 + 0.45 * near);
          ctx.beginPath(); ctx.arc(P[0] - r * 0.3, P[1] - r * 0.3, r * 0.35, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    settle(){ for (let k = 0; k < 120; k++) this.update(0.11); this.segs.forEach(s => s.grow = 1); }
  }

  const SCENES = { projects: Donut, presentations: Teapot, resources: Mandelbrot, opportunities: Pipes };

  function setup(canvas){
    const Scene = SCENES[canvas.dataset.scene];
    if (!Scene) return null;
    const head = canvas.closest('.page-head') || canvas.parentElement;
    const title = head.querySelector('h1');
    const isGL = !!Scene.webgl;
    const ctx = isGL ? canvas.getContext('webgl', { antialias: false, alpha: false }) : canvas.getContext('2d');
    if (!ctx) return null;
    const inst = { scene: new Scene(), ready: false, visible: true, running: false, lastW: 0, last: 0, level: LOW_END ? 1 : 0, lastDraw: 0, slow: 0, frames: 0 };

    inst.layout = (force) => {
      const c = canvas.getBoundingClientRect();
      if (!c.width || !c.height) return;
      if (!force && touch && inst.lastW && Math.round(c.width) === inst.lastW) return; // ignore address-bar height changes on phones
      inst.lastW = Math.round(c.width);
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * (isGL ? GL_RES[inst.level] : 1);   // fractal renders at reduced resolution
      canvas.width = Math.round(c.width * dpr); canvas.height = Math.round(c.height * dpr);
      if (!isGL) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      let r = title.getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(title);
      const rects = range.getClientRects(); if (rects.length) r = rects[rects.length - 1];
      const fs = parseFloat(getComputedStyle(title).fontSize) || 64;
      const tr = r.right - c.left;
      const narrow = c.width < 700;
      const gutter = Math.max(16, c.width * 0.04);
      const full = canvas.dataset.scene === 'resources';
      const region = (narrow || full)
        ? { x0: 14, x1: c.width - 14, y0: NAV + 10, y1: c.height - 16 }
        : { x0: Math.min(tr + fs * 0.8, c.width * 0.66), x1: c.width - gutter, y0: NAV + 14, y1: c.height - 26 };   // right of the title, or the right third for long titles
      canvas.classList.toggle('scene-faint', narrow);
      canvas.classList.toggle('scene-full', full && !narrow);
      inst.scene.init({ w: c.width, h: c.height, narrow, region, level: inst.level }, isGL ? ctx : null);
      inst.ready = true;
      if (reduce) { inst.scene.settle(); inst.paint(); }
    };
    inst.paint = () => {
      if (!inst.ready) return;
      if (!isGL) { const c = canvas.getBoundingClientRect(); ctx.clearRect(0, 0, c.width, c.height); }
      inst.scene.draw(ctx);
    };
    inst.frame = now => {
      if (!inst.visible) { inst.running = false; inst.last = 0; return; }
      requestAnimationFrame(inst.frame);
      // at reduced quality, draw at most 30 times a second
      if (inst.level >= 1 && inst.lastDraw && now - inst.lastDraw < 32) return;
      const gap = inst.lastDraw ? now - inst.lastDraw : 16;
      inst.lastDraw = now;
      const dt = Math.min(0.05, (now - (inst.last || now)) / 1000);
      inst.last = now;
      if (!inst.ready) inst.layout(true);              // set up once the header has a size
      if (!inst.ready) return;
      inst.scene.update(dt);
      inst.paint();
      // watch the frame rate; after a run of slow frames, step quality down a level
      if (++inst.frames > 20) {
        const budget = inst.level === 0 ? 28 : 50;
        inst.slow = gap > budget ? inst.slow + 1 : Math.max(0, inst.slow - 1);
        if (inst.slow > 25 && inst.level < 2) { inst.level++; inst.slow = 0; inst.frames = 0; inst.layout(true); }
      }
    };
    inst.kick = () => { if (!reduce && !inst.running) { inst.running = true; requestAnimationFrame(inst.frame); } };

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        inst.visible = e.isIntersecting;
        if (inst.visible) { if (!inst.lastW) inst.layout(true); inst.kick(); }
      }).observe(head);
    }
    inst.layout(true); inst.kick();
    return inst;
  }

  const instances = [...document.querySelectorAll('canvas[data-scene]')].map(setup).filter(Boolean);
  window.addEventListener('resize', () => instances.forEach(i => i.layout(false)));
  const refresh = () => instances.forEach(i => { i.layout(true); i.kick(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  window.clubScenesRefresh = refresh;
})();
