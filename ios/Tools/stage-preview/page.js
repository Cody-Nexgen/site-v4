// Composes the orb stage like OrbStage.swift (same numbers, same shaders: the SHARED parts of
// OrbWorld.metal and FocusOrb.metal), to look at it without a Mac. The layout numbers are copied
// from OrbStageLayout and FloatingRock: change them in both places. Run shot.mjs.
const P = window.P;
const {W, H, TOP} = P;
const L = (() => {
  const IMG = {w: 1122, h: 1402}, RING = {x: 557.5, y: 570}, RR = {w: 195.5, h: 44.75}, TR = {w: 293.5, h: 69};
  const SL = [[551, 742], [571.5, 742]], SLS = {w: 10, h: 46}, BASE = 784, HORIZON = 440, HOVER = 75;
  const WIDE = {w: 941, h: 1672}, WRING = {x: 470, y: 793.75}, WRR = {w: 61.25, h: 12.5};
  const scale = Math.min(W * 1.12 / IMG.w, 0.62), R = RR.w * 0.95 * scale, orbTop = TOP + 126;
  const iw = IMG.w * scale, ih = IMG.h * scale, ringY = orbTop + R * 2 + HOVER * scale;
  const fr = {x: (W - iw) / 2, y: ringY - RING.y * scale, w: iw, h: ih};
  const pt = (x, y) => [fr.x + x * scale, fr.y + y * scale];
  const ring = pt(RING.x, RING.y), rr = [RR.w * scale, RR.h * scale], topR = [TR.w * scale, TR.h * scale];
  const base = pt(0, BASE)[1], horizon = pt(0, HORIZON)[1];
  const orb = [ring[0], orbTop + R], k = scale / 0.39;
  const sm = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
  const pedDepth = 0.06 + 0.94 * sm(HORIZON, IMG.h, BASE);
  const ws = Math.max(W / WIDE.w, H / WIDE.h);
  const wrest = [(W - WIDE.w * ws) / 2 + WRING.x * ws, (H - WIDE.h * ws) / 2 + WRING.y * ws];
  const zoom1 = rr[0] / (WRR.w * ws);
  const camera = (d) => [[wrest[0] + (ring[0] - wrest[0]) * d, wrest[1] + (ring[1] - wrest[1]) * d], Math.pow(zoom1, d)];
  const widePoint = (w, d) => { const [c, z] = camera(d); const s = ws * z; return [c[0] + (w[0] - WRING.x) * s, c[1] + (w[1] - WRING.y) * s]; };
  const orbInWide = [WRING.x + (orb[0] - ring[0]) / (ws * zoom1), WRING.y + (orb[1] - ring[1]) / (ws * zoom1)];
  return {IMG, RING, TR, SL, SLS, BASE, HORIZON, WIDE, WRING, scale, R, fr, pt, ring, rr, topR, base, horizon, orb, k, sm, pedDepth, ws, camera, widePoint, orbInWide, zoom1};
})();
window.L = L;
const sm = L.sm;
const cam = P.CAM, d = P.DOLLY, E = P.E, AW = P.AWAKE, LIFT = P.LIFT, T = P.T;
const pedShift = [cam[0] * L.pedDepth, cam[1] * L.pedDepth];
const bob = Math.sin(T * 1.15) * 3 * P.FORMED;
const orbAt = [L.orb[0] + cam[0] * (L.pedDepth + 0.08), L.orb[1] + bob + cam[1] * (L.pedDepth + 0.08)];
const close = sm(0.9, 1, d);
const root = document.getElementById('s');
function layer(z) { const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2; Object.assign(c.style, {position: 'absolute', left: 0, top: 0, width: W + 'px', height: H + 'px', zIndex: z}); root.appendChild(c); return c; }
function load(src) { return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; }); }
function hash(i, k) { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); }

function glProgram(gl, frag) {
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, '#version 300 es\nin vec2 a;void main(){gl_Position=vec4(a,0,1);}')); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, frag)); gl.linkProgram(pr); gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return pr;
}
const PRE = '#version 300 es\nprecision highp float;\n#define float2 vec2\n#define float3 vec3\n#define float4 vec4\n#define static\n#define atan2 atan\n';

(async () => {
  const [photo, wide, ...rocks] = await Promise.all([load('../../Art/orb-stage.jpg'), load('../../Art/orb-stage-wide.jpg'), ...[0, 1, 2, 3, 4, 5].map(i => load('../../App/Assets.xcassets/OrbRock' + i + '.imageset/orb-rock-' + i + '.png'))]);

  // 1. The wide shot.
  const c0 = layer(1).getContext('2d'); c0.scale(2, 2);
  if (d < 0.999) {
    const [c, z] = L.camera(d); const s = L.ws * z;
    c0.save(); c0.globalAlpha = P.SCENE * (1 - sm(0.6, 0.97, d));
    c0.filter = `saturate(${0.55 + 0.45 * AW}) brightness(${1 - 0.1 * (1 - AW)}) blur(${Math.max(0, z - 1.5) * 1.6}px)`;
    c0.drawImage(wide, c[0] - L.WRING.x * s + cam[0] * 0.3, c[1] - L.WRING.y * s + cam[1] * 0.3, L.WIDE.w * s, L.WIDE.h * s); c0.restore();
  }

  // 2. The stage photo through the world shader.
  const cv = layer(2); const gl = cv.getContext('webgl2', {premultipliedAlpha: false});
  const pr = glProgram(gl, PRE + `uniform sampler2D uPhoto; uniform vec2 uOrigin, uFrameSize, uCam, uSize, uOn; uniform float uPx; uniform vec4 uState, uOrb, uRing, uTop, uDepth, uPed; uniform float uReveal, uRevealR; out vec4 o;
${window.WORLD_GLSL}
void main() {
  vec2 p = vec2(gl_FragCoord.x, uSize.y * 2.0 - gl_FragCoord.y) / 2.0;
  vec2 local = p - uOrigin;
  if (local.x < 0.0 || local.y < 0.0 || local.x > uFrameSize.x || local.y > uFrameSize.y) { o = vec4(0); return; }
  float depth = fzWorldDepth(local / uPx, uDepth, uPed);
  vec2 src = (local - uCam * depth) / uFrameSize;
  vec3 photo = texture(uPhoto, src).rgb;
  vec3 c = fzWorld(photo, p, uState.x, uState.y, uState.z, uState.w, uOn.x, uOn.y, uOrb.xy, uOrb.z, uRing.xy, uRing.zw, uTop.xy, uTop.z, uTop.w, uOrb.w);
  vec2 uv = local / uFrameSize;
  float fade = smoothstep(0.0, 0.2, uv.y) * (1.0 - smoothstep(0.68, 1.0, uv.y));
  float rd = length(local - vec2(557.5, 570.0) * uPx) / (uFrameSize.x * uRevealR);
  float rad = 1.0 - smoothstep(0.7, 1.0, rd);
  o = vec4(c, fade * rad * uReveal);
}`);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, photo);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const u = n => gl.getUniformLocation(pr, n);
  const [c, z] = L.camera(d); const px = L.scale * z / L.zoom1;
  const origin = [c[0] - L.RING.x * px, c[1] - L.RING.y * px];
  const reveal = sm(0.45, 0.95, d);
  gl.uniform2f(u('uOrigin'), ...origin); gl.uniform2f(u('uFrameSize'), L.IMG.w * px, L.IMG.h * px); gl.uniform1f(u('uPx'), px);
  gl.uniform2f(u('uCam'), ...cam); gl.uniform2f(u('uSize'), W, H);
  gl.uniform4f(u('uState'), T % 1200, E, AW, P.FLASH);
  gl.uniform4f(u('uOrb'), orbAt[0], orbAt[1], L.R, L.k);
  gl.uniform4f(u('uRing'), L.ring[0] + pedShift[0], L.ring[1] + pedShift[1], L.rr[0], L.rr[1]);
  gl.uniform4f(u('uTop'), L.topR[0], L.topR[1], L.base + pedShift[1], L.horizon);
  gl.uniform4f(u('uDepth'), 440, 1402, 784, 0); gl.uniform4f(u('uPed'), 557.5, 570, 293.5, 69);
  gl.uniform2f(u('uOn'), Math.max(P.FORMED, P.SPARK * 0.5), P.RING);
  gl.uniform1f(u('uReveal'), reveal * P.SCENE); gl.uniform1f(u('uRevealR'), 0.4 + 3 * reveal);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  // 3. Light shaft, ring, slits.
  const c3 = layer(3); c3.style.mixBlendMode = 'screen'; const g3 = c3.getContext('2d'); g3.scale(2, 2);
  const k = L.k, ring = [L.ring[0] + pedShift[0], L.ring[1] + pedShift[1]];
  g3.save(); g3.globalAlpha = P.BEAM * (0.4 + 0.6 * AW) * close; g3.filter = `blur(${26 * k}px)`;
  const gr = g3.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(221,245,230,0.13)'); gr.addColorStop(0.5, 'rgba(221,245,230,0.05)'); gr.addColorStop(1, 'rgba(221,245,230,0.1)');
  g3.fillStyle = gr; g3.beginPath(); g3.moveTo(L.ring[0] - L.topR[0] * 0.35 + cam[0] * 0.1, 0); g3.lineTo(L.ring[0] + L.topR[0] * 0.35 + cam[0] * 0.1, 0); g3.lineTo(L.ring[0] + L.topR[0] * 1.05, L.ring[1]); g3.lineTo(L.ring[0] - L.topR[0] * 1.05, L.ring[1]); g3.fill(); g3.restore();
  const power = (0.45 + 0.55 * E) * close * (P.RING > 0 ? 1 : 0);
  g3.save(); g3.globalAlpha = power; g3.filter = `blur(${3.5 * k}px)`; g3.strokeStyle = 'rgba(166,230,191,0.75)'; g3.lineWidth = 3.5 * k; g3.beginPath(); g3.ellipse(ring[0], ring[1], L.rr[0], L.rr[1], 0, 0, 7); g3.stroke(); g3.restore();
  g3.save(); g3.globalAlpha = power; g3.strokeStyle = '#EFFFF5'; g3.lineWidth = 1.4 * k; g3.beginPath(); g3.ellipse(ring[0], ring[1], L.rr[0], L.rr[1], 0, 0, 7); g3.stroke(); g3.restore();
  for (const s of L.SL) { const p = L.pt(s[0], s[1]); const sw = L.SLS.w * L.scale, sh = L.SLS.h * L.scale; const x = p[0] + pedShift[0], y = p[1] + pedShift[1];
    g3.save(); g3.globalAlpha = power * 0.6; g3.filter = `blur(${5 * k}px)`; g3.fillStyle = 'rgb(166,230,191)'; g3.fillRect(x - sw * 1.1, y - sh * 0.65, sw * 2.2, sh * 1.3); g3.restore();
    g3.save(); g3.globalAlpha = power; g3.fillStyle = '#EFFFF5'; g3.fillRect(x - sw * 0.275, y - sh * 0.4, sw * 0.55, sh * 0.8); g3.restore(); }

  // 4. Rocks (behind and in front), lit with a rim facing the orb.
  const ROCKS = [[0, -2.3, 0.25, 0.95, 0.32, 0, 0, 0.35, 5, 0.3, false], [1, 2.25, -0.6, 0.78, 0.28, 0.6, 0.15, 0.5, 4, 1.7, false], [4, -1.45, -1.55, 0.62, 0.25, 0.8, 0.3, 0.65, 8, 2.9, false],
                 [2, -1.9, 2.5, 1.3, 0.75, 3, 0.1, 0.45, 3, 4.1, true], [3, 2.3, 1.9, 1.15, 0.6, 1.6, 0.4, 0.8, 3, 5.3, true]];
  function drawRock(g, img, w, x, y, angle, blur, alpha) {
    const h = w * img.height / img.width;
    const dx = orbAt[0] - x, dy = orbAt[1] - y, dist = Math.max(Math.hypot(dx, dy), 1);
    const near = dist / L.R; const light = P.FORMED * (0.25 + 0.85 * E) / (1 + near * near * 0.25) + P.FLASH * 0.5; const dim = 0.45 + 0.55 * AW;
    const off = document.createElement('canvas'); off.width = Math.ceil(w * 2) + 8; off.height = Math.ceil(h * 2) + 8; const o = off.getContext('2d'); o.scale(2, 2);
    o.drawImage(img, 2, 2, w, h);
    // brighten its own colour by the light (multiplicative, mint-tinted), then darken by dim
    const boost = light * 0.8; let left = boost;
    o.globalCompositeOperation = 'lighter';
    while (left > 0.001) { o.globalAlpha = Math.min(1, left); o.filter = 'sepia(0.3) hue-rotate(95deg) saturate(1.4)'; o.drawImage(img, 2, 2, w, h); left -= 1; }
    o.filter = 'none'; o.globalAlpha = 1;
    o.globalCompositeOperation = 'source-atop'; o.fillStyle = `rgba(0,0,0,${1 - dim * 0.62})`; o.fillRect(0, 0, w + 4, h + 4);
    // rim: the rock minus itself pushed towards the orb (in the rock's unrotated frame)
    const a = -angle * Math.PI / 180, ux = (dx * Math.cos(a) - dy * Math.sin(a)) / dist, uy = (dx * Math.sin(a) + dy * Math.cos(a)) / dist;
    const rim = document.createElement('canvas'); rim.width = off.width; rim.height = off.height; const r = rim.getContext('2d'); r.scale(2, 2);
    r.drawImage(img, 2, 2, w, h); r.globalCompositeOperation = 'source-in'; r.fillStyle = 'rgb(179,245,209)'; r.fillRect(0, 0, w + 4, h + 4);
    r.globalCompositeOperation = 'destination-out'; r.drawImage(img, 2 - ux * 2.5, 2 - uy * 2.5, w, h);
    o.globalCompositeOperation = 'lighter'; o.globalAlpha = Math.min(1, light); o.drawImage(rim, 0, 0, w + 4, h + 4);
    g.save(); g.globalAlpha = alpha; g.filter = blur > 0 ? `blur(${blur}px)` : 'none'; g.translate(x, y); g.rotate(angle * Math.PI / 180); g.drawImage(off, -w / 2 - 2, -h / 2 - 2, w + 4, h + 4); g.restore();
  }
  function rocksLayer(front, z) {
    const g = layer(z).getContext('2d'); g.scale(2, 2);
    for (const [i, rx, ry, rw, depth, blur, from, to, sway, phase, isFront] of ROCKS) { if (isFront !== front) continue;
      const up = sm(from, to, LIFT); const x = L.orb[0] + rx * L.R + cam[0] * depth;
      const y = L.orb[1] + ry * L.R + Math.sin(T * 0.55 + phase) * 0.09 * L.R + (1 - up) * 1.4 * L.R + cam[1] * depth;
      drawRock(g, rocks[i], rw * L.R, x, y, sway * Math.sin(T * 0.21 + phase) + (1 - up) * 24, blur * k, up * P.SCENE); }
    const a = T * 0.62; if ((Math.sin(a) > 0) === front) { const up = sm(0.55, 0.85, LIFT);
      drawRock(g, rocks[5], L.R * 0.3 * (1 + 0.15 * Math.sin(a)), orbAt[0] + Math.cos(a) * 1.6 * L.R + cam[0] * 0.05, orbAt[1] + Math.sin(a) * 0.32 * L.R - 0.1 * L.R, a * 20, 0, up * P.SCENE); }
  }
  rocksLayer(false, 4);

  // 5. Dust and arcs.
  const c5 = layer(5); c5.style.mixBlendMode = 'screen'; const g5 = c5.getContext('2d'); g5.scale(2, 2);
  const top = Math.max(0, L.fr.y), bottom = L.base + L.rr[1] * 3, span = bottom - top, spread = L.topR[0] * 1.7;
  for (let i = 0; i < 44; i++) { const h1 = hash(i, 1), h2 = hash(i, 2), h3 = hash(i, 3), h4 = hash(i, 4), h5 = hash(i, 5); const inBeam = i % 5 != 0; const depth = 0.1 + 0.9 * h5;
    const x0 = inBeam ? L.ring[0] + (h1 - 0.5) * spread : h1 * W; const rise = h3 * span + T * (4 + 9 * h2); const y = bottom - (rise % span) + cam[1] * depth; const x = x0 + Math.sin(T * (0.3 + h4 * 0.4) + h1 * 6) * 10 + cam[0] * depth;
    const size = (0.6 + 1.2 * h4) * (0.6 + 2.2 * depth * depth) * k; const tw = 0.5 + 0.5 * Math.sin(T * (1 + 2 * h2) + h3 * 6.3); const edge = Math.max(0, Math.min((y - top) / 40, (bottom - y) / 40, 1));
    const alpha = P.BEAM * close * (inBeam ? 0.55 : 0.3) * tw * edge * (1.15 - 0.6 * depth);
    if (depth > 0.75) { const rg = g5.createRadialGradient(x, y, 0, x, y, size); rg.addColorStop(0, `rgba(255,255,255,${alpha * 0.7})`); rg.addColorStop(1, 'rgba(255,255,255,0)'); g5.fillStyle = rg; g5.beginPath(); g5.arc(x, y, size, 0, 7); g5.fill(); }
    else { g5.fillStyle = `rgba(255,255,255,${alpha})`; g5.beginPath(); g5.arc(x, y, size / 2, 0, 7); g5.fill(); } }
  function bolt(a, b, seed, jag) { let pts = [a, b]; let amt = Math.hypot(b[0] - a[0], b[1] - a[1]) * jag; for (let l = 0; l < 4; l++) { const n = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1]; const dx = q[0] - p[0], dy = q[1] - p[1]; const len = Math.max(Math.hypot(dx, dy), 0.001); const off = (hash(seed + l * 97, i) - 0.5) * 2 * amt; n.push([(p[0] + q[0]) / 2 - dy / len * off, (p[1] + q[1]) / 2 + dx / len * off]); n.push(q); } pts = n; amt *= 0.5; } return pts; }
  function strokeBolt(a, b, seed, strength, width) { const pts = bolt(a, b, seed, 0.2); const dr = (w, col, bl) => { g5.save(); if (bl) g5.filter = `blur(${bl}px)`; g5.strokeStyle = col; g5.lineWidth = w; g5.beginPath(); g5.moveTo(...pts[0]); for (const p of pts) g5.lineTo(...p); g5.stroke(); g5.restore(); };
    dr((3 + 2 * (width - 1)) * k, `rgba(166,230,191,${Math.min(1, 0.7 * strength)})`, 3.5 * k); dr(width * k, `rgba(255,255,255,${Math.min(1, 0.95 * strength)})`, 0); }
  if (P.ARCS > 0.01) { const radius = L.R * (0.12 + 0.88 * P.FORMED) * 0.86; const count = 2 + Math.min(2, Math.floor(E * 2.99)); const seed = Math.floor(T * 13);
    const ra = [160, 20, 122, 58], sa = [130, 50, 110, 70];
    for (let i = 0; i < count; i++) { const fl = hash(seed, i + 11); if (fl <= 0.22) continue; const a = (ra[i] + 7 * Math.sin(T * 0.45 + i * 1.7)) * Math.PI / 180, end = [ring[0] + L.rr[0] * Math.cos(a), ring[1] + L.rr[1] * Math.sin(a)];
      const b = (sa[i] + 6 * Math.sin(T * 0.6 + i)) * Math.PI / 180, begin = [orbAt[0] + radius * Math.cos(b), orbAt[1] + radius * Math.sin(b)];
      strokeBolt(begin, end, seed * 7 + i, P.ARCS * (0.6 + 0.4 * fl), 1); } }

  // 6. The orb.
  if (P.FORMED > 0.001) { const og = layer(6); const size = L.R * 2 / 0.84 * 1.5; og.width = size * 2; og.height = size * 2; Object.assign(og.style, {left: (orbAt[0] - size / 2) + 'px', top: (orbAt[1] - size / 2) + 'px', width: size + 'px', height: size + 'px'});
    const g = og.getContext('webgl2', {premultipliedAlpha: true}); const p2 = glProgram(g, PRE + `uniform vec2 uSize; uniform float uT, uE; uniform vec3 uTouch; out vec4 o;\n${window.ORB_GLSL}\nvoid main(){ vec2 pos = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y); float side = min(uSize.x, uSize.y); vec2 p = (pos - uSize*0.5)/(side*0.5); o = fzOrb(p, uT, uE, 4.5/side, uTouch); }`);
    g.uniform2f(g.getUniformLocation(p2, 'uSize'), size * 2, size * 2); g.uniform1f(g.getUniformLocation(p2, 'uT'), T % 1200); g.uniform1f(g.getUniformLocation(p2, 'uE'), E);
    const tc = P.TOUCH ? [(P.TOUCH[0] - orbAt[0]) / (size / 2), (P.TOUCH[1] - orbAt[1]) / (size / 2), 1] : [0, 0, 0]; g.uniform3f(g.getUniformLocation(p2, 'uTouch'), ...tc); g.drawArrays(g.TRIANGLES, 0, 3); }

  rocksLayer(true, 7);

  // 8. Scattered lights.
  if (P.SCATTER > 0.01) { const c8 = layer(8); c8.style.mixBlendMode = 'screen'; const g8 = c8.getContext('2d'); g8.scale(2, 2); const target = L.orbInWide;
    for (let i = 0; i < 34; i++) { const h1 = hash(i, 21), h2 = hash(i, 22), h3 = hash(i, 23), h4 = hash(i, 24), h5 = hash(i, 25), h6 = hash(i, 26), h7 = hash(i, 27);
      const start = [70 + h1 * 800, 650 + h2 * h2 * 800]; const near = (start[1] - 650) / 800; let at = start, behind = null, alpha = P.SCATTER;
      if (P.GATHER >= 0) { const p = Math.min(Math.max((P.GATHER - h3 * 0.9) / 1.9, 0), 1); if (p >= 1) continue; const ctrl = [(start[0] + target[0]) / 2 + (h7 - 0.5) * 260, Math.min(start[1], target[1]) - 120 - h7 * 200];
        const along = q => { const u = 1 - q; return [u * u * start[0] + 2 * u * q * ctrl[0] + q * q * target[0], u * u * start[1] + 2 * u * q * ctrl[1] + q * q * target[1]]; };
        const e = p * p * (3 - 2 * p); at = along(e); behind = along(Math.max(0, e - 0.09)); alpha *= 1 - sm(0.85, 1, p) * 0.6; }
      const s = L.widePoint(at, d); const tw = 0.55 + 0.45 * Math.sin(T * (1.3 + h4 * 2.2) + h5 * 6.3); const size = (1.6 + 2 * h6) * (0.7 + 0.8 * near) * k; const a = alpha * tw;
      if (behind) { const b = L.widePoint(behind, d); const lg = g8.createLinearGradient(b[0], b[1], s[0], s[1]); lg.addColorStop(0, 'rgba(166,230,191,0)'); lg.addColorStop(1, `rgba(166,230,191,${0.85 * a})`); g8.strokeStyle = lg; g8.lineWidth = Math.max(0.8, size * 0.45); g8.lineCap = 'round'; g8.beginPath(); g8.moveTo(...b); g8.lineTo(...s); g8.stroke(); }
      const rg = g8.createRadialGradient(s[0], s[1], 0, s[0], s[1], size * 5); rg.addColorStop(0, `rgba(166,230,191,${0.5 * a})`); rg.addColorStop(1, 'rgba(166,230,191,0)'); g8.fillStyle = rg; g8.beginPath(); g8.arc(s[0], s[1], size * 5, 0, 7); g8.fill();
      g8.fillStyle = `rgba(255,255,255,${0.95 * a})`; g8.beginPath(); g8.arc(s[0], s[1], size / 2, 0, 7); g8.fill(); } }
  window.done = true;
})();
