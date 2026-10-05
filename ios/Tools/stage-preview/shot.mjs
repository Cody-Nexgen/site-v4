// Renders frames of the orb stage in headless Chromium (global Playwright, the pre-installed Chromium):
//   node ios/Tools/stage-preview/shot.mjs shots.json <out dir>
// shots.json is a list of frames: {"name": "today"} plus any of page.js's P values to change
// (E energy, AWAKE, LIFT, DOLLY, SCATTER, GATHER seconds, CAM [x, y], TOUCH [x, y], FORMED, T time,
// PUSH: Today pulled down, how much the pedestal has grown, 0.28 at most; METAL: true draws the whole
// stage the way StageView.metal does, in one pass (sky, stars, photo, shaft, ring, rocks, dust, lightning,
// glass, orb), instead of as separate layers; STRIKE: seconds since a strike...).
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import { execSync } from 'child_process'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url); const { chromium } = require(process.env.PW || path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const shared = fs.readFileSync(path.join(here, '../../App/Design/OrbShared.h'), 'utf8');
const strip = (name) => shared.split('// BEGIN SHARED ' + name)[1].split('// END SHARED ' + name)[0];
const PRISM = strip('PRISM'), WORLD = PRISM + strip('WORLD'), ORB = strip('ORB'), STAGE = strip('STAGE');
const shots = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = path.resolve(process.argv[3] || '.'); fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
for (const s of shots) {
  const P = Object.assign({W: 393, H: 852, TOP: 59, T: 9, E: 0.82, AWAKE: 0.87, LIFT: 0.75, DOLLY: 1, SCATTER: 0, GATHER: -1, CAM: [0, 0], FLASH: 0, FORMED: 1, SPARK: 0, RING: 1, ARCS: 1, BEAM: 1, SCENE: 1, TOUCH: null, PUSH: 0}, s);
  const html = `<html><head><meta charset="utf-8"></head><body style="margin:0;background:#000"><div id=s style="position:relative;width:${P.W}px;height:${P.H}px;overflow:hidden;background:#000"></div>
<script>window.P=${JSON.stringify(P)};window.WORLD_GLSL=${JSON.stringify(WORLD)};window.ORB_GLSL=${JSON.stringify(ORB)};window.STAGE_GLSL=${JSON.stringify(STAGE)};window.PRISM_GLSL=${JSON.stringify(PRISM)};</script><script src="page.js"></script></body></html>`;
  fs.writeFileSync(path.join(here, 'frame.html'), html);
  const page = await browser.newPage({ viewport: { width: P.W, height: P.H }, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.join(here, 'frame.html'));
  try { await page.waitForFunction(() => window.done === true, null, { timeout: 60000 }); } catch (e) { errs.push('timeout'); }
  if (errs.length) console.log(s.name, errs.join('\n'));
  await page.locator('#s').screenshot({ path: path.join(out, s.name + '.png') }); await page.close();
}
await browser.close(); fs.rmSync(path.join(here, 'frame.html'), { force: true }); console.log('wrote ' + shots.length + ' frame(s) to ' + out);
