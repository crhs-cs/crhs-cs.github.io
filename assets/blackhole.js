// Cedar Ridge CS Club: the home page's live black hole.
// A fragment shader traces light rays bending around a black hole (a simplified Schwarzschild
// geodesic) and shades the accretion disk they cross. Scrolling moves the camera toward it.
(() => {
  const canvas = document.getElementById('sky');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return; // CSS gradient on the canvas stays as the fallback

  const vert = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
  const frag = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uDist;
uniform float uElev;
uniform float uShift;
uniform float uSteps;
uniform float uFade;
uniform float uFocal;

float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ v += a*noise(p); p = p*2.03 + 17.1; a *= 0.5; }
  return v;
}
vec2 rot(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c*v.x - s*v.y, s*v.x + c*v.y); }

// Disk texture with differential rotation; two time-offset layers crossfade so it never winds up into mush.
float diskTex(vec2 xz, float r){
  float omega = 1.6 / pow(r, 1.5);
  float T = 24.0;
  float t1 = mod(uTime, T), t2 = mod(uTime + T*0.5, T);
  float w = abs(t1/T - 0.5) * 2.0;
  vec2 a = rot(xz, -omega*t1), b = rot(xz, -omega*t2);
  float n1 = fbm(a*1.3) * 0.6 + fbm(vec2(r*5.0, 0.0) + a*0.35) * 0.6;
  float n2 = fbm(b*1.3 + 31.0) * 0.6 + fbm(vec2(r*5.0, 7.0) + b*0.35) * 0.6;
  return mix(n1, n2, w);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  uv.x -= uShift;

  float yaw = 0.0;
  vec3 ro = uDist * vec3(cos(uElev)*sin(yaw), sin(uElev), cos(uElev)*cos(yaw));
  vec3 fw = normalize(-ro);
  vec3 upW = normalize(vec3(0.12, 1.0, 0.0));
  vec3 rt = normalize(cross(fw, upW));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(fw*uFocal + uv.x*rt + uv.y*up);

  vec3 p = ro, v = rd;
  vec3 hv = cross(p, v);
  float h2 = dot(hv, hv);

  vec3 col = vec3(0.0);
  float alpha = 0.0;
  bool captured = false;

  for (int i = 0; i < 220; i++){
    if (float(i) >= uSteps) break;
    float r = length(p);
    if (r < 1.0){ captured = true; break; }
    if (r > 60.0) break;
    float dt = clamp(0.06*r, 0.02, 2.5);
    vec3 acc = -1.5 * h2 * p / pow(r, 5.0);
    v += acc*dt;
    vec3 np = p + v*dt;

    if (p.y * np.y < 0.0){
      float t = p.y / (p.y - np.y);
      vec3 hit = mix(p, np, t);
      float rr = length(hit.xz);
      if (rr > 2.2 && rr < 10.0){
        float prof = smoothstep(2.2, 3.0, rr) * (1.0 - smoothstep(5.5, 10.0, rr));
        float n = diskTex(hit.xz, rr);
        float dens = prof * clamp(0.15 + n*1.1, 0.0, 1.4);
        float temp = clamp(3.0/rr, 0.0, 1.0);
        vec3 c = mix(vec3(0.26, 0.05, 0.60), vec3(0.62, 0.30, 1.0), temp);
        c = mix(c, vec3(1.0, 0.92, 1.0), pow(temp, 5.0)*0.55);
        vec3 vel = normalize(vec3(-hit.z, 0.0, hit.x));
        float dop = 1.0 + 0.6*dot(vel, -normalize(v));
        c *= dop*dop * pow(3.0/rr, 1.2) * 2.0;
        float a = clamp(dens, 0.0, 1.0);
        col += (1.0 - alpha) * c * a;
        alpha += (1.0 - alpha) * a;
        if (alpha > 0.98) break;
      }
    }
    p = np;
  }

  if (!captured && alpha < 0.98){
    vec3 d = normalize(v);
    vec2 sp = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0)));
    vec2 g = sp * 180.0;
    float h = hash(floor(g));
    float star = smoothstep(0.996, 1.0, h) * (0.4 + 0.6*hash(floor(g)+3.7));
    float neb = fbm(sp*2.2 + 4.0);
    vec3 sky = vec3(star) * vec3(0.85, 0.8, 1.0) + vec3(0.22, 0.08, 0.42) * pow(neb, 3.0) * 0.5;
    col += (1.0 - alpha) * sky;
  }

  col = 1.0 - exp(-col * 1.25);
  vec2 q = gl_FragCoord.xy / uRes;
  col *= 0.55 + 0.45*pow(16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), 0.22);
  col *= uFade;
  gl_FragColor = vec4(col, 1.0);
}`;

  function compile(type, src){
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, vert), fs = compile(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ['uRes', 'uTime', 'uDist', 'uElev', 'uShift', 'uSteps', 'uFade', 'uFocal'].forEach(n => U[n] = gl.getUniformLocation(prog, n));

  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const quality = small ? 0.45 : 0.6;
  const steps = small ? 140 : 200;

  const touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  let lastW = 0;
  function resize(){
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    // On phones and tablets only a width change (rotation) should re-size the render;
    // the address bar showing or hiding changes the height and would otherwise warp it.
    if (touch && lastW && cw === lastW) return;
    lastW = cw;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = Math.floor(cw * dpr * quality);
    let h = Math.floor(ch * dpr * quality);
    const maxPx = 1.1e6;
    if (w * h > maxPx) { const k = Math.sqrt(maxPx / (w * h)); w = Math.floor(w * k); h = Math.floor(h * k); }
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
  resize();
  window.addEventListener('resize', resize);

  const hero = document.querySelector('.hero');
  const beats = [...document.querySelectorAll('.beat')];
  const cue = document.querySelector('.cue');
  const wideQuery = window.matchMedia('(min-width: 768px) and (min-height: 500px)');
  let desktop = wideQuery.matches;
  wideQuery.addEventListener?.('change', e => { desktop = e.matches; });

  const smooth = t => t * t * (3 - 2 * t);
  const clamp01 = x => Math.max(0, Math.min(1, x));

  let target = 0, cur = 0;
  function readScroll(){
    const span = hero.offsetHeight - window.innerHeight;
    target = span > 0 ? clamp01(window.scrollY / span) : 0;
  }
  readScroll();
  window.addEventListener('scroll', readScroll, { passive: true });

  function updateText(s){
    if (reduce) return;
    const o1 = desktop ? 1 - clamp01((s - 0.04) / 0.2) : 1 - clamp01((s - 0.1) / 0.3);
    [o1].forEach((o, i) => {
      beats[i].style.opacity = o.toFixed(3);
      beats[i].style.transform = `translateY(${((1 - o) * 24).toFixed(1)}px)`;
    });
    if (cue) cue.style.opacity = (1 - clamp01(s / 0.06)).toFixed(3);
  }

  const start = performance.now();
  const frozenTime = 9.0;
  function frame(now){
    cur += (target - cur) * 0.12;
    const s = reduce ? 0.35 : cur;
    updateText(s);

    const pastHero = window.scrollY > hero.offsetHeight + window.innerHeight * 0.5;
    if (!pastHero || reduce) {
      // Larger screens: finish the dive by 70% of the intro, so you're inside the black hole
      // before Meetings rises into view. Phones keep the original pacing.
      const e = smooth(desktop ? clamp01(s / 0.7) : s);
      const wide = canvas.width / canvas.height;
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime, reduce ? frozenTime : (now - start) / 1000);
      gl.uniform1f(U.uDist, 20.0 - 15.2 * e);
      gl.uniform1f(U.uElev, 0.2 - 0.13 * e);
      gl.uniform1f(U.uShift, wide > 1.1 ? (0.22 * (1 - e)) : 0.0);
      gl.uniform1f(U.uSteps, steps);
      gl.uniform1f(U.uFade, 1.0);
      // End-of-zoom lens: how far the screen's corners reach from the center, compared with a
      // typical phone (aspect 1:2, half-diagonal ~0.56). A phone gets 1.0, so it's unchanged;
      // wider screens narrow the view near the end until the shadow covers them the same way.
      const halfDiag = Math.hypot(0.5 * wide, 0.5);
      const lens = Math.min(2.4, Math.max(1, halfDiag / 0.56));
      gl.uniform1f(U.uFocal, 1.5 * (1 + (lens - 1) * e * e));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    if (!reduce) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (reduce) {
    // redraw the single still frame when the size changes
    window.addEventListener('resize', () => requestAnimationFrame(frame));
  }
})();
