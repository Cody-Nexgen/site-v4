/**
 * The lighthouse: a live 3D night sea rendered through a 1-bit ordered dither.
 * A beam sweeps the water; where it passes the sea calms and the distractions
 * floating in it (phones, bells, play buttons) sink until the light moves on.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/* ---------------------------------------------------------------- world */

const LIGHT_POS = new THREE.Vector3(21, 13.2, -64); // lantern
const CAMERA_HOME = new THREE.Vector3(0, 3.4, 12);
const LOOK_AT = new THREE.Vector3(3, -0.6, -40);

const UP = new THREE.Vector3(0, 1, 0);
/** How far the camera pitches down (radians) as the hero scrolls away. */
const TILT = THREE.MathUtils.degToRad(12);

/** Beam heading in the XZ plane (radians from +X) over time: a slow sweep across the sea. */
const beamAngle = (t: number) => THREE.MathUtils.degToRad(183 + 27 * Math.sin((t / 18) * Math.PI * 2 + 0.6));
const BEAM_CORE = THREE.MathUtils.degToRad(2.4);
const BEAM_EDGE = THREE.MathUtils.degToRad(6.5);

/* Waves: shared by the sea shader and the floating objects so they bob on the same water. */
const WAVES = [
    { dir: [0.8, 0.6], k: 0.32, w: 0.85, a: 0.32 },
    { dir: [-0.5, 0.86], k: 0.52, w: 1.25, a: 0.2 },
    { dir: [0.97, -0.24], k: 1.05, w: 1.9, a: 0.09 },
    { dir: [-0.3, -0.95], k: 1.8, w: 2.6, a: 0.05 },
];

/** 0 outside the beam, 1 at its core, for a point on the water. */
function beamCover(x: number, z: number, angle: number) {
    const dx = x - LIGHT_POS.x;
    const dz = z - LIGHT_POS.z;
    const len = Math.hypot(dx, dz) || 1;
    const cos = (dx / len) * Math.cos(angle) + (dz / len) * Math.sin(angle);
    return THREE.MathUtils.smoothstep(cos, Math.cos(BEAM_EDGE), Math.cos(BEAM_CORE));
}

function waveHeight(x: number, z: number, t: number, calm: number) {
    let h = 0;
    for (const wv of WAVES) h += wv.a * Math.sin((wv.dir[0] * x + wv.dir[1] * z) * wv.k + t * wv.w);
    return h * (1 - calm * 0.75);
}

const WAVE_GLSL = WAVES.map(
    (wv, i) => `const vec4 W${i} = vec4(${wv.dir[0].toFixed(3)}, ${wv.dir[1].toFixed(3)}, ${wv.k.toFixed(3)}, ${wv.w.toFixed(3)}); const float A${i} = ${wv.a.toFixed(3)};`,
).join('\n');

const SEA_COMMON = /* glsl */ `
uniform float uTime;
uniform vec3 uLight;
uniform vec2 uBeamDir;
uniform float uCosCore;
uniform float uCosEdge;
${WAVE_GLSL}

float beamCover(vec2 p) {
    vec2 d = normalize(p - uLight.xz);
    return smoothstep(uCosEdge, uCosCore, dot(d, uBeamDir));
}

// Height and analytic slope of the swell (x: height, yz: d/dx, d/dz).
vec3 swell(vec2 p, float calm) {
    vec3 s = vec3(0.0);
    ${WAVES.map(
        (_, i) => `{ float ph = dot(W${i}.xy, p) * W${i}.z + uTime * W${i}.w; s.x += A${i} * sin(ph); s.yz += A${i} * W${i}.z * cos(ph) * W${i}.xy; }`,
    ).join('\n    ')}
    return s * (1.0 - calm * 0.75);
}
`;

const SEA_VERT = /* glsl */ `
${SEA_COMMON}
varying vec3 vWorld;
varying float vCalm;
void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    float calm = beamCover(world.xz);
    world.y += swell(world.xz, calm).x;
    vWorld = world.xyz;
    vCalm = calm;
    gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const SEA_FRAG = /* glsl */ `
${SEA_COMMON}
uniform vec2 uResolution;
/* The clearing: calm, dark water behind the text (screen space: centre x/y, half-size x/y). */
uniform vec4 uClearing;
varying vec3 vWorld;
varying float vCalm;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

void main() {
    vec2 p = vWorld.xz;
    // A soft rounded rectangle, so it follows the shape of the text block.
    vec2 q = abs(gl_FragCoord.xy / uResolution - uClearing.xy) / uClearing.zw;
    float d = pow(pow(q.x, 4.0) + pow(q.y, 4.0), 0.25);
    float clearing = 1.0 - smoothstep(0.85, 1.3, d);
    float calm = max(vCalm, clearing);
    vec3 s = swell(p, calm);
    // Fine ripples for glitter, stilled in the beam.
    float rip = (noise(p * 1.7 + uTime * 0.6) - 0.5) * 0.35 * (1.0 - calm * 0.8);
    vec3 N = normalize(vec3(-s.y - rip, 1.0, -s.z + rip));
    vec3 V = normalize(cameraPosition - vWorld);
    float dist = length(p - uLight.xz);
    float camDist = length(cameraPosition - vWorld);

    // Moonlight from the upper left gives the swell its texture.
    vec3 moon = normalize(vec3(-0.55, 0.55, 0.45));
    float lum = 0.002 + 0.03 * pow(max(dot(N, moon), 0.0), 3.0);

    // The beam on the water: a bright path, brighter where it skims the far sea.
    float lit = beamCover(p) * smoothstep(6.0, 30.0, dist);
    vec3 L = normalize(uLight - vWorld);
    float spec = pow(max(dot(N, normalize(L + V)), 0.0), 90.0);
    lum += lit * (0.06 + 1.1 * smoothstep(50.0, 260.0, camDist) + 2.0 * spec);

    // The lantern's own glitter path running toward us.
    lum += spec * 0.45 * (1.0 - lit) * smoothstep(20.0, 60.0, dist) * (1.0 - smoothstep(60.0, 140.0, camDist));

    // Foam on the crests of the restless water.
    float crest = smoothstep(0.4, 0.44, s.x) * smoothstep(0.55, 0.7, noise(p * 2.6 + uTime * 0.35));
    lum += crest * 0.8 * (1.0 - calm) * (1.0 - smoothstep(18.0, 55.0, camDist));

    // Fade into the dark toward the horizon (except where the beam lands).
    lum *= mix(1.0, lit, smoothstep(45.0, 160.0, camDist));
    // Still water in the clearing: only the faintest texture survives.
    lum *= 1.0 - clearing * 0.94;
    gl_FragColor = vec4(vec3(lum), 1.0);
}
`;

const BEAM_VERT = /* glsl */ `
varying float vAlong;
varying vec3 vNormalW;
varying vec3 vWorld;
void main() {
    vAlong = uv.y;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const BEAM_FRAG = /* glsl */ `
uniform float uStrength;
varying float vAlong;
varying vec3 vNormalW;
varying vec3 vWorld;
void main() {
    float facing = abs(dot(normalize(vNormalW), normalize(cameraPosition - vWorld)));
    float body = pow(vAlong, 1.3) * smoothstep(0.0, 0.45, vAlong) * pow(facing, 1.4);
    gl_FragColor = vec4(vec3(body * uStrength), 1.0);
}
`;

/* 1-bit ordered dither: luminance against an 8×8 Bayer matrix. */
const DITHER_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const DITHER_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform vec3 uInk;
uniform vec3 uPaper;
varying vec2 vUv;
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
void main() {
    vec3 c = texture2D(tScene, vUv).rgb;
    float l = clamp(dot(c, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
    l = pow(l, 0.85);
    float bit = step(bayer8(gl_FragCoord.xy) + 0.004, l);
    gl_FragColor = vec4(mix(uInk, uPaper, bit), 1.0);
}
`;

/* ------------------------------------------------------------ building */

function rockGeometry(radius: number, seed: number) {
    const geo = new THREE.IcosahedronGeometry(radius, 1);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const n = Math.sin(v.x * 1.7 + seed) * Math.cos(v.z * 1.3 - seed) * 0.28 + Math.sin(v.y * 2.1 + seed * 2) * 0.15;
        v.multiplyScalar(1 + n);
        pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
}

function buildIsland() {
    const island = new THREE.Group();
    const white = new THREE.MeshLambertMaterial({ color: 0xe8e6e1 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x6a6a6a, flatShading: true });

    const rocks: [number, number, number, number, number][] = [
        // x, z, radius, y-scale, seed
        [0, 0, 5.2, 0.55, 1],
        [4.5, 1.5, 3.4, 0.5, 2],
        [-4.8, 1.2, 3.2, 0.42, 3],
        [2, 4.2, 2.6, 0.38, 4],
        [-2.4, 4.6, 2.2, 0.32, 5],
        [7.4, -0.6, 2.4, 0.36, 6],
        [-7.6, -1.2, 2.0, 0.3, 7],
    ];
    for (const [x, z, r, sy, seed] of rocks) {
        const rock = new THREE.Mesh(rockGeometry(r, seed), rockMat);
        rock.position.set(x, 0.2, z);
        rock.scale.set(1, sy, 1);
        island.add(rock);
    }

    // Tower
    const profile = [
        new THREE.Vector2(1.95, 0),
        new THREE.Vector2(1.8, 0.6),
        new THREE.Vector2(1.55, 5),
        new THREE.Vector2(1.32, 9.2),
        new THREE.Vector2(1.32, 9.4),
    ];
    const tower = new THREE.Mesh(new THREE.LatheGeometry(profile, 36), white);
    tower.position.y = 2.2;
    island.add(tower);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.47, 1.56, 1.6, 36, 1, true), dark);
    band.position.y = 7.4;
    island.add(band);

    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.7, 0.3, 36), dark);
    gallery.position.y = 11.7;
    island.add(gallery);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.05, 6, 36), white);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = 12.3;
    island.add(rail);

    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.5, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    lantern.position.y = 12.6;
    island.add(lantern);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.2, 16), dark);
    roof.position.y = 13.95;
    island.add(roof);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), dark);
    finial.position.y = 14.65;
    island.add(finial);

    // Keeper's cottage
    const cottage = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.9, 2.4), white);
    cottage.position.set(3.1, 2.8, 0.6);
    island.add(cottage);
    const roofGeo = new THREE.CylinderGeometry(1.4, 1.4, 3.6, 3, 1);
    roofGeo.rotateZ(Math.PI / 2);
    const cottageRoof = new THREE.Mesh(roofGeo, dark);
    cottageRoof.scale.set(1, 0.62, 1);
    cottageRoof.position.set(3.1, 4.15, 0.6);
    island.add(cottageRoof);
    for (const wx of [2.3, 3.9]) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.05), new THREE.MeshBasicMaterial({ color: 0x9a9a9a }));
        win.position.set(wx, 2.9, 1.83);
        island.add(win);
    }

    island.position.set(LIGHT_POS.x, 0, LIGHT_POS.z);
    return island;
}

type Floater = {
    root: THREE.Object3D;
    x: number;
    z: number;
    lift: number;
    phase: number;
    spin: number;
    tilt: THREE.Euler;
    sink: number;
};

function outlined(mesh: THREE.Mesh, width = 1.07) {
    const group = new THREE.Group();
    const hull = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide }));
    hull.scale.setScalar(width);
    group.add(hull, mesh);
    return group;
}

let screenTex: THREE.Texture | null = null;
/** Dark glass with a diagonal glare and a notch. */
function screenTexture() {
    if (screenTex) return screenTex;
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#141414';
    g.fillRect(0, 0, 64, 128);
    const glare = g.createLinearGradient(0, 20, 64, 90);
    glare.addColorStop(0.35, 'rgba(255,255,255,0)');
    glare.addColorStop(0.5, 'rgba(255,255,255,0.32)');
    glare.addColorStop(0.62, 'rgba(255,255,255,0)');
    g.fillStyle = glare;
    g.fillRect(0, 0, 64, 128);
    g.fillStyle = '#000';
    g.fillRect(24, 6, 16, 5);
    screenTex = new THREE.CanvasTexture(c);
    return screenTex;
}

function makePhone() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.9, 1.8, 0.1, 4, 0.14), new THREE.MeshLambertMaterial({ color: 0x151515 }));
    g.add(outlined(body, 1.06));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 1.6), new THREE.MeshBasicMaterial({ map: screenTexture() }));
    screen.position.z = 0.056;
    g.add(screen);
    return g;
}

function makeBell() {
    const pts = [
        [0, 1.08],
        [0.2, 1.06],
        [0.33, 0.96],
        [0.36, 0.8],
        [0.36, 0.55],
        [0.42, 0.3],
        [0.58, 0.1],
        [0.7, 0.02],
        [0.66, 0],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const geo = new THREE.LatheGeometry(pts, 28);
    geo.translate(0, -0.5, 0);
    const g = new THREE.Group();
    const bell = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xc9c7c2, side: THREE.DoubleSide }));
    g.add(outlined(bell, 1.05));
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 6, 16), bell.material);
    handle.position.y = 0.62;
    g.add(handle);
    const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), new THREE.MeshLambertMaterial({ color: 0x777777 }));
    clapper.position.y = -0.56;
    g.add(clapper);
    return g;
}

function makePlay() {
    const g = new THREE.Group();
    const tile = new THREE.Mesh(new RoundedBoxGeometry(1.45, 1.02, 0.28, 4, 0.22), new THREE.MeshLambertMaterial({ color: 0xdedcd7 }));
    g.add(outlined(tile, 1.05));
    const tri = new THREE.Mesh(new THREE.CircleGeometry(0.36, 3), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    tri.position.set(0.03, 0, 0.145);
    g.add(tri);
    return g;
}

/**
 * Deterministic scatter so the composition is the same on every load. The wreckage frames
 * the picture: heaped at the left and right edges and strung along the horizon, leaving a
 * clearing of calm water in the middle where the headline sits.
 */
function scatter(edges: number, horizon: number, beam: number) {
    let seed = 7;
    const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
    };
    // Where a screen-x fraction (0 = left edge, 1 = right) lands at a given depth.
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(16)) * 1.9;
    const worldX = (sx: number, z: number) => {
        const depth = CAMERA_HOME.z - z;
        const centre = (LOOK_AT.x * depth) / (CAMERA_HOME.z - LOOK_AT.z);
        return centre + (sx - 0.5) * 2 * depth * tanHalf;
    };
    const spots: { x: number; z: number; kind: number }[] = [];
    for (let i = 0; i < edges; i++) {
        const z = THREE.MathUtils.lerp(-10, -40, Math.pow(rand(), 1.3));
        const left = rand() < 0.6;
        const sx = left ? THREE.MathUtils.lerp(-0.06, 0.09, rand()) : THREE.MathUtils.lerp(0.87, 1.05, rand());
        spots.push({ x: worldX(sx, z), z, kind: Math.floor(rand() * 3) });
    }
    for (let i = 0; i < horizon; i++) {
        const z = THREE.MathUtils.lerp(-46, -66, rand());
        spots.push({ x: worldX(THREE.MathUtils.lerp(0.02, 0.98, rand()), z), z, kind: Math.floor(rand() * 3) });
    }
    // Out along the beam's sweep, left of the lighthouse.
    for (let i = 0; i < beam; i++) {
        const a = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(160, 200, rand()));
        const r = THREE.MathUtils.lerp(35, 120, rand());
        spots.push({ x: LIGHT_POS.x + Math.cos(a) * r, z: LIGHT_POS.z + Math.sin(a) * r, kind: Math.floor(rand() * 3) });
    }
    return { spots, rand };
}

/* -------------------------------------------------------------- public */

export type LighthouseHandle = {
    resize: (width: number, height: number) => void;
    setPointer: (x: number, y: number) => void;
    setScroll: (progress: number) => void;
    start: () => void;
    stop: () => void;
    renderStill: () => void;
    /** Screen-space calm water behind the text: centre x/y and half-size x/y (0–1, y from the bottom). */
    setClearing: (clearing: [number, number, number, number]) => void;
    dispose: () => void;
};

export type LighthouseView = {
    /** Camera position and target. Defaults to the hero's wide shot. */
    camera?: { home: [number, number, number]; look: [number, number, number] };
    /** Calm, dark pool behind the text: screen-space centre x/y and radius x/y (0–1, y from the bottom). */
    clearing?: [number, number, number, number];
    /** Float the distractions on the water (the closing shot shows an empty, calm sea). */
    wreckage?: boolean;
};

export function createLighthouse(
    canvas: HTMLCanvasElement,
    { pixelSize = 2, view = {} as LighthouseView } = {},
): LighthouseHandle {
    const home = view.camera ? new THREE.Vector3(...view.camera.home) : CAMERA_HOME;
    const look = view.camera ? new THREE.Vector3(...view.camera.look) : LOOK_AT;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 900);
    camera.position.copy(home);

    scene.add(new THREE.AmbientLight(0xffffff, 0.05));
    const moon = new THREE.DirectionalLight(0xffffff, 2.3);
    moon.position.set(-50, 18, -12);
    scene.add(moon);
    const lamp = new THREE.PointLight(0xffffff, 25, 30, 1.6);
    lamp.position.copy(LIGHT_POS);
    scene.add(lamp);

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const stars: number[] = [];
    for (let i = 0; i < 260; i++) {
        const a = Math.random() * Math.PI - Math.PI;
        const e = THREE.MathUtils.degToRad(3 + Math.random() * 38);
        stars.push(Math.cos(a) * Math.cos(e) * 600, Math.sin(e) * 600, Math.sin(a) * Math.cos(e) * 600 - 100);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false })));

    // Sea
    const beamDir = new THREE.Vector2(-1, 0);
    const seaUniforms = {
        uTime: { value: 0 },
        uLight: { value: LIGHT_POS.clone() },
        uBeamDir: { value: beamDir },
        uCosCore: { value: Math.cos(BEAM_CORE) },
        uCosEdge: { value: Math.cos(BEAM_EDGE) },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uClearing: { value: new THREE.Vector4(...(view.clearing ?? [0.5, 0.47, 0.5, 0.2])) },
    };
    const seaGeo = new THREE.PlaneGeometry(700, 700, 220, 220);
    seaGeo.rotateX(-Math.PI / 2);
    const sea = new THREE.Mesh(seaGeo, new THREE.ShaderMaterial({ uniforms: seaUniforms, vertexShader: SEA_VERT, fragmentShader: SEA_FRAG }));
    sea.position.z = -250;
    scene.add(sea);

    scene.add(buildIsland());

    // Beam: an open cone from the lantern, added on top of everything.
    const beamGeo = new THREE.ConeGeometry(11, 170, 48, 1, true);
    beamGeo.translate(0, -85, 0);
    beamGeo.rotateZ(Math.PI / 2); // apex at the origin, opening toward +X
    const beamUniforms = { uStrength: { value: 0.5 } };
    const beam = new THREE.Mesh(
        beamGeo,
        new THREE.ShaderMaterial({
            uniforms: beamUniforms,
            vertexShader: BEAM_VERT,
            fragmentShader: BEAM_FRAG,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
        }),
    );
    const beamPivot = new THREE.Group();
    beamPivot.position.copy(LIGHT_POS);
    beamPivot.add(beam);
    beam.rotation.z = THREE.MathUtils.degToRad(-4); // tipped slightly toward the water
    scene.add(beamPivot);

    const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
            map: (() => {
                const c = document.createElement('canvas');
                c.width = c.height = 64;
                const g = c.getContext('2d')!;
                const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
                grad.addColorStop(0, 'rgba(255,255,255,1)');
                grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
                grad.addColorStop(1, 'rgba(255,255,255,0)');
                g.fillStyle = grad;
                g.fillRect(0, 0, 64, 64);
                return new THREE.CanvasTexture(c);
            })(),
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        }),
    );
    glow.scale.setScalar(4.5);
    glow.position.copy(LIGHT_POS);
    scene.add(glow);

    // Distractions
    const { spots, rand } = view.wreckage === false ? { spots: [], rand: Math.random } : scatter(16, 12, 8);
    const floaters: Floater[] = spots.map(({ x, z, kind }) => {
        const root = kind === 0 ? makePhone() : kind === 1 ? makeBell() : makePlay();
        const scale = (1.0 + rand() * 0.35) * (z < -70 ? 1.8 : 1);
        root.scale.setScalar(scale);
        scene.add(root);
        return {
            root,
            x,
            z,
            lift: kind === 1 ? 0.45 : kind === 0 ? 0.5 : 0.3,
            phase: rand() * Math.PI * 2,
            spin: (rand() - 0.5) * 0.25,
            tilt: new THREE.Euler(
                kind === 1 ? 0.35 + rand() * 0.6 : -0.1 - rand() * 0.3,
                kind === 1 ? rand() * Math.PI * 2 : (rand() - 0.5) * 1.1,
                (rand() - 0.5) * (kind === 1 ? 1.0 : 0.7),
            ),
            sink: 0,
        };
    });

    // Offscreen scene target + dither pass
    const target = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    const ditherScene = new THREE.Scene();
    const ditherCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    ditherScene.add(
        new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            new THREE.ShaderMaterial({
                uniforms: {
                    tScene: { value: target.texture },
                    uInk: { value: new THREE.Color('#0a0a0c') },
                    uPaper: { value: new THREE.Color('#ecE9e2') },
                },
                vertexShader: DITHER_VERT,
                fragmentShader: DITHER_FRAG,
                depthTest: false,
            }),
        ),
    );

    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };

    // The anchor: where the ray through the middle of the clearing meets the sea.
    const clearing = seaUniforms.uClearing.value;
    const anchor = new THREE.Vector3();
    const anchorOffset = new THREE.Vector3();
    const baseQuat = new THREE.Quaternion();
    const camRight = new THREE.Vector3();
    const orbit = new THREE.Quaternion();
    const yawQ = new THREE.Quaternion();
    const offset = new THREE.Vector3();
    const placeAnchor = () => {
        camera.position.copy(home);
        camera.lookAt(look);
        camera.updateMatrixWorld();
        baseQuat.copy(camera.quaternion);
        camRight.set(1, 0, 0).applyQuaternion(baseQuat);
        const ray = new THREE.Vector3(clearing.x * 2 - 1, clearing.y * 2 - 1, 0.5).unproject(camera).sub(home).normalize();
        const dist = ray.y < -0.01 ? -home.y / ray.y : 40;
        anchor.copy(home).addScaledVector(ray, Math.min(dist, 120));
        anchorOffset.copy(home).sub(anchor);
    };
    let scroll = 0;
    let elapsed = 0;
    let lastTick = 0;
    let raf = 0;
    let lastFrame = 0;

    const update = (t: number, dt: number) => {
        const angle = beamAngle(t);
        beamDir.set(Math.cos(angle), Math.sin(angle));
        beamPivot.rotation.y = -angle;
        seaUniforms.uTime.value = t;

        pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 2.5);
        pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 2.5);
        const intro = 1 - Math.pow(1 - Math.min(1, t / 3.2), 3);

        // Every camera move pivots around the anchor (the water under the text), so that spot
        // stays put on screen while the lighthouse, beam and horizon move around it in 3D.
        const pitch = scroll * TILT + pointer.sy * 0.018;
        const yaw = -pointer.sx * 0.035 + Math.sin(t * 0.13) * 0.006;
        orbit.setFromAxisAngle(camRight, -pitch).premultiply(yawQ.setFromAxisAngle(UP, yaw));
        // The intro drifts in along the line to the anchor, which also keeps it in place.
        offset.copy(anchorOffset).multiplyScalar(1 + (1 - intro) * 0.3).applyQuaternion(orbit);
        camera.position.copy(anchor).add(offset);
        camera.quaternion.copy(orbit).multiply(baseQuat);

        for (const f of floaters) {
            const cover = beamCover(f.x, f.z, angle);
            // Sink fast when the light finds you; drift back up slowly once it's gone.
            const target = cover > 0.2 ? 1 : 0;
            f.sink += (target - f.sink) * Math.min(1, dt * (target ? 2.2 : 0.35));
            const h = waveHeight(f.x, f.z, t, cover);
            f.root.position.set(f.x, h + f.lift - f.sink * 2.4, f.z);
            f.root.rotation.set(
                f.tilt.x + Math.sin(t * 0.9 + f.phase) * 0.12,
                f.tilt.y + Math.sin(t * 0.21 + f.phase) * f.spin * 3,
                f.tilt.z + Math.cos(t * 0.7 + f.phase) * 0.1,
            );
        }
    };

    const render = () => {
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        renderer.render(ditherScene, ditherCam);
    };

    const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        if (now - lastFrame < 1000 / 45) return; // 45 fps is plenty for 1-bit
        lastFrame = now;
        const dt = Math.min(0.1, (now - lastTick) / 1000);
        lastTick = now;
        elapsed += dt;
        update(elapsed, dt);
        render();
    };

    return {
        resize(width, height) {
            const w = Math.max(2, Math.round(width / pixelSize));
            const h = Math.max(2, Math.round(height / pixelSize));
            renderer.setSize(w, h, false);
            target.setSize(w, h);
            seaUniforms.uResolution.value.set(w, h);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            placeAnchor();
            if (!raf) {
                update(elapsed, 0);
                render();
            }
        },
        setPointer(x, y) {
            pointer.x = x;
            pointer.y = y;
        },
        setScroll(progress) {
            scroll = progress;
        },
        start() {
            if (raf) return;
            lastTick = performance.now();
            raf = requestAnimationFrame(loop);
        },
        stop() {
            cancelAnimationFrame(raf);
            raf = 0;
        },
        setClearing([x, y, rx, ry]) {
            seaUniforms.uClearing.value.set(x, y, rx, ry);
            placeAnchor();
            if (!raf) {
                update(elapsed, 0);
                render();
            }
        },
        renderStill() {
            update(9.5, 0.016);
            for (let i = 0; i < 400; i++) update(9.5, 0.1); // settle the floaters
            render();
        },
        dispose() {
            cancelAnimationFrame(raf);
            raf = 0;
            scene.traverse((obj) => {
                const mesh = obj as THREE.Mesh;
                mesh.geometry?.dispose();
                const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
                if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
                else mat?.dispose();
            });
            target.dispose();
            renderer.dispose();
        },
    };
}
