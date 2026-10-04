// Renders the focus orb (the SHARED part of App/Design/FocusOrb.metal) in headless Chromium with
// WebGL2, so the shader can be looked at without a Mac. Uses the global Playwright; no dependencies.
//
//   node ios/Tools/render-orb.mjs '[[0.12,3],[0.5,8],[1,14]]' 420 <out dir>
//
// Each [energy, seconds] pair becomes orb-e<energy>-t<seconds>.png (420 px square here) in <out dir>.
// The browser is not the phone: SwiftUI may show the colours slightly differently.
import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pw = process.env.PW || path.join(execSync('npm root -g').toString().trim(), 'playwright');
const { chromium } = require(pw);

const src = fs.readFileSync(path.join(here, '../App/Design/FocusOrb.metal'), 'utf8');
const shared = src.split('// BEGIN SHARED')[1].split('// END SHARED')[0];
const shots = JSON.parse(process.argv[2] || '[[0.12,3],[0.5,8],[1,14]]');
const px = Number(process.argv[3] || 420);
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
#define atan2 atan
uniform vec2 uSize; uniform float uT; uniform float uE;
out vec4 o;
${shared}
void main() {
  vec2 pos = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);
  float side = min(uSize.x, uSize.y);
  vec2 p = (pos - uSize * 0.5) / (side * 0.5);
  vec4 c = fzOrb(p, uT, uE, 4.5 / side);
  o = vec4(c.rgb, 1.0);
}`;

const html = `<html><body style="margin:0;background:#000"><canvas id=c width=${px} height=${px}></canvas><script>
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
window.draw = (e, t) => {
  gl.uniform2f(gl.getUniformLocation(pr, 'uSize'), ${px}, ${px});
  gl.uniform1f(gl.getUniformLocation(pr, 'uT'), t);
  gl.uniform1f(gl.getUniformLocation(pr, 'uE'), e);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
};
</script></body></html>`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: px, height: px } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.setContent(html);
if (errors.length) {
  console.error(errors.join('\n'));
  await browser.close();
  process.exit(1);
}
for (const [e, t] of shots) {
  await page.evaluate(([e, t]) => window.draw(e, t), [e, t]);
  await page.locator('canvas').screenshot({ path: path.join(out, `orb-e${e}-t${t}.png`) });
}
await browser.close();
console.log(`wrote ${shots.length} image(s) to ${out}`);
