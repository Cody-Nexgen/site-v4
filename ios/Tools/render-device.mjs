// Renders the focus timer device (the SHARED DEVICE part of App/Design/OrbShared.h, which
// FocusTimer.metal draws on the phone) in headless Chromium with WebGL2, so it can be looked at
// without a Mac. Uses the global Playwright; no dependencies.
//
//   node ios/Tools/render-device.mjs '[[50,0],[25,0,0.6,-0.4],[120,30]]' 340x200 <out dir>
//
// Each [minutes, seconds] pair becomes device-<minutes>-<seconds>.png at 3x (a 340 x 200 point view
// here) in <out dir>; [minutes, seconds, tiltX, tiltY] also tilts the phone (-1 to 1). On black.
import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pw = process.env.PW || path.join(execSync('npm root -g').toString().trim(), 'playwright');
const { chromium } = require(pw);

const src = fs.readFileSync(path.join(here, '../App/Design/OrbShared.h'), 'utf8');
const block = (name) => src.split('// BEGIN SHARED ' + name)[1].split('// END SHARED ' + name)[0];
const shared = block('PRISM') + block('DEVICE');
const shots = JSON.parse(process.argv[2] || '[[50,0],[25,0,0.6,-0.4]]');
const [vw, vh] = (process.argv[3] || '340x200').split('x').map(Number);
const px = vw * 3, py = vh * 3;
const out = path.resolve(process.argv[4] || '.');
fs.mkdirSync(out, { recursive: true });

// Metal names mapped onto GLSL; the shared code keeps to what both languages accept.
const frag = `#version 300 es
precision highp float;
#define float2 vec2
#define float3 vec3
#define float4 vec4
#define float2x2 mat2
#define static
#define inline
#define atan2 atan
uniform vec2 uSize; uniform float uT; uniform vec4 uValue; uniform vec2 uTilt;
out vec4 o;
${shared}
void main() {
  vec2 pos = vec2(gl_FragCoord.x, uSize.y * 3.0 - gl_FragCoord.y) / 3.0;
  vec4 c = fzDevice(pos, uSize, uValue, uT, uTilt, 1.0 / 3.0);
  o = vec4(c.rgb, 1.0);
}`;

const html = `<html><body style="margin:0;background:#000"><canvas id=c width=${px} height=${py}></canvas><script>
const gl = document.getElementById('c').getContext('webgl2', { preserveDrawingBuffer: true });
function sh(type, s) { const x = gl.createShader(type); gl.shaderSource(x, s); gl.compileShader(x);
  if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; }
const pr = gl.createProgram();
gl.attachShader(pr, sh(gl.VERTEX_SHADER, '#version 300 es\\nin vec2 a; void main() { gl_Position = vec4(a, 0, 1); }'));
gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, ${JSON.stringify(frag)}));
gl.linkProgram(pr);
if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
gl.useProgram(pr);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
window.draw = (m, sec, tx, ty) => {
  gl.uniform2f(gl.getUniformLocation(pr, 'uSize'), ${vw}, ${vh});
  gl.uniform1f(gl.getUniformLocation(pr, 'uT'), 9);
  gl.uniform4f(gl.getUniformLocation(pr, 'uValue'), m, sec, 1, 0);
  gl.uniform2f(gl.getUniformLocation(pr, 'uTilt'), tx ?? 0, ty ?? 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
};
</script></body></html>`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: px, height: py } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.setContent(html);
if (errors.length) {
  console.error(errors.join('\n'));
  await browser.close();
  process.exit(1);
}
for (const [m, sec, tx, ty] of shots) {
  await page.evaluate(([m, sec, tx, ty]) => window.draw(m, sec, tx, ty), [m, sec, tx ?? null, ty ?? null]);
  await page.locator('canvas').screenshot({ path: path.join(out, `device-${m}-${sec}${tx === undefined ? '' : `-x${tx}-y${ty}`}.png`) });
}
await browser.close();
console.log(`wrote ${shots.length} image(s) to ${out}`);
