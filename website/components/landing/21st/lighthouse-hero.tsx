/*
 * Lighthouse Hero
 * Copyright (c) 2026 FocuzNow (https://focuznow.com)
 *
 * FocuzNow Attribution License 1.0
 * - You may use, copy, modify and distribute this component, including in commercial and
 *   client projects, free of charge.
 * - Keep the "Lighthouse by FocuzNow" credit link (<Credit /> below) visible, legible and
 *   pointing at CREDIT_URL. For a license without the credit, write to support@focuznow.com.
 * - Keep this notice in copies and modified versions of the source.
 * - Use without the credit link is not licensed.
 * - Provided "as is", without warranty of any kind. FocuzNow is not liable for any claim or
 *   damage arising from its use.
 */
'use client';

/**
 * Lighthouse hero: a live 3D night sea rendered through a 1-bit ordered dither.
 * A beam sweeps the water; distractions floating in it (phones, bells, play buttons)
 * sink when the light finds them. The water behind your headline stays calm,
 * and as the page scrolls the camera pivots on that spot, so the text rides the sea.
 *
 * Theming: the dither draws in exactly two colors, your theme's `background` and
 * `foreground` (read from the section, so a className like `bg-zinc-950 text-zinc-50`
 * works too). Dark mode gives a night sea; light mode gives the same scene as an ink print.
 * It follows theme switches live.
 *
 * Dependencies: react, three (@types/three optional), framer-motion, lucide-react; Tailwind
 * with shadcn-style tokens (background, foreground, primary, muted-foreground, ring).
 * The headline is set in Satoshi (fontshare.com) when your page loads it; otherwise Inter / system.
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
// @types/three is optional: installed, you get full types; missing, three is untyped.
// @ts-ignore
import * as THREE from 'three';
// @ts-ignore
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/* =============================================================== scene */

const LIGHT_POS = new THREE.Vector3(21, 13.2, -64); // lantern
const CAMERA_HOME = new THREE.Vector3(0, 3.4, 12);
const LOOK_AT = new THREE.Vector3(3, -0.6, -40);
const UP = new THREE.Vector3(0, 1, 0);
/** How far the camera pitches down (radians) as the hero scrolls away. */
const TILT = THREE.MathUtils.degToRad(12);

type Rgb = [number, number, number];
/** Used only when the page has no background color to read (no theme tokens). */
const DEFAULT_INK: Rgb = [0.043, 0.043, 0.051];
const DEFAULT_PAPER: Rgb = [0.925, 0.914, 0.886];

/** Any CSS color the browser understands (oklch, hsl, color-mix…) as sRGB 0–1 plus alpha. */
function cssToRgb(css: string): [...Rgb, number] | null {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r / 255, g / 255, b / 255, a / 255];
}

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
    (wv, i) =>
        `const vec4 W${i} = vec4(${wv.dir[0].toFixed(3)}, ${wv.dir[1].toFixed(3)}, ${wv.k.toFixed(3)}, ${wv.w.toFixed(3)}); const float A${i} = ${wv.a.toFixed(3)};`,
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
vec3 swell(vec2 p, float calm) {
    vec3 s = vec3(0.0);
    ${WAVES.map(
        (_, i) =>
            `{ float ph = dot(W${i}.xy, p) * W${i}.z + uTime * W${i}.w; s.x += A${i} * sin(ph); s.yz += A${i} * W${i}.z * cos(ph) * W${i}.xy; }`,
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
uniform vec4 uClearing; // calm water behind the text: centre x/y, half-size x/y (screen space)
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
    vec2 q = abs(gl_FragCoord.xy / uResolution - uClearing.xy) / uClearing.zw;
    float d = pow(pow(q.x, 4.0) + pow(q.y, 4.0), 0.25);
    float clearing = 1.0 - smoothstep(0.85, 1.3, d);
    float calm = max(vCalm, clearing);
    vec3 s = swell(p, calm);
    float rip = (noise(p * 1.7 + uTime * 0.6) - 0.5) * 0.35 * (1.0 - calm * 0.8);
    vec3 N = normalize(vec3(-s.y - rip, 1.0, -s.z + rip));
    vec3 V = normalize(cameraPosition - vWorld);
    float dist = length(p - uLight.xz);
    float camDist = length(cameraPosition - vWorld);
    vec3 moon = normalize(vec3(-0.55, 0.55, 0.45));
    float lum = 0.002 + 0.03 * pow(max(dot(N, moon), 0.0), 3.0);
    float lit = beamCover(p) * smoothstep(6.0, 30.0, dist);
    vec3 L = normalize(uLight - vWorld);
    float spec = pow(max(dot(N, normalize(L + V)), 0.0), 90.0);
    lum += lit * (0.06 + 1.1 * smoothstep(50.0, 260.0, camDist) + 2.0 * spec);
    lum += spec * 0.45 * (1.0 - lit) * smoothstep(20.0, 60.0, dist) * (1.0 - smoothstep(60.0, 140.0, camDist));
    float crest = smoothstep(0.4, 0.44, s.x) * smoothstep(0.55, 0.7, noise(p * 2.6 + uTime * 0.35));
    lum += crest * 0.8 * (1.0 - calm) * (1.0 - smoothstep(18.0, 55.0, camDist));
    lum *= mix(1.0, lit, smoothstep(45.0, 160.0, camDist));
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

const DITHER_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/* 1-bit ordered dither: luminance against an 8×8 Bayer matrix. */
const DITHER_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform vec3 uInk;   // theme background, sRGB
uniform vec3 uPaper; // theme foreground, sRGB
varying vec2 vUv;
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
void main() {
    vec3 c = texture2D(tScene, vUv).rgb;
    float l = pow(clamp(dot(c, vec3(0.299, 0.587, 0.114)), 0.0, 1.0), 0.85);
    float bit = step(bayer8(gl_FragCoord.xy) + 0.004, l);
    gl_FragColor = vec4(mix(uInk, uPaper, bit), 1.0);
}
`;

/*
 * The 3D scene is lit in greys only: every material below is a brightness level, and the dither
 * turns brightness into the theme's two colors. None of these are colors you will see.
 */
const shade = (l: number) => new THREE.Color().setRGB(l, l, l, THREE.SRGBColorSpace);
const shadeCss = (l: number, alpha = 1) => `rgb(${Math.round(l * 255)} ${Math.round(l * 255)} ${Math.round(l * 255)} / ${alpha})`;

function rockGeometry(radius: number, seed: number) {
    const geo = new THREE.IcosahedronGeometry(radius, 1);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        v.multiplyScalar(1 + Math.sin(v.x * 1.7 + seed) * Math.cos(v.z * 1.3 - seed) * 0.28 + Math.sin(v.y * 2.1 + seed * 2) * 0.15);
        pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
}

function buildIsland() {
    const island = new THREE.Group();
    const white = new THREE.MeshLambertMaterial({ color: shade(0.9) });
    const dark = new THREE.MeshLambertMaterial({ color: shade(0.1) });
    const rockMat = new THREE.MeshLambertMaterial({ color: shade(0.42), flatShading: true });
    const rocks: [number, number, number, number, number][] = [
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
    const profile = [
        new THREE.Vector2(1.95, 0),
        new THREE.Vector2(1.8, 0.6),
        new THREE.Vector2(1.55, 5),
        new THREE.Vector2(1.32, 9.2),
        new THREE.Vector2(1.32, 9.4),
    ];
    const tower = new THREE.Mesh(new THREE.LatheGeometry(profile, 36), white);
    tower.position.y = 2.2;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.47, 1.56, 1.6, 36, 1, true), dark);
    band.position.y = 7.4;
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.7, 0.3, 36), dark);
    gallery.position.y = 11.7;
    const rail = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.05, 6, 36), white);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = 12.3;
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.5, 16), new THREE.MeshBasicMaterial({ color: shade(1) }));
    lantern.position.y = 12.6;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.2, 16), dark);
    roof.position.y = 13.95;
    const cottage = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.9, 2.4), white);
    cottage.position.set(3.1, 2.8, 0.6);
    const roofGeo = new THREE.CylinderGeometry(1.4, 1.4, 3.6, 3, 1);
    roofGeo.rotateZ(Math.PI / 2);
    const cottageRoof = new THREE.Mesh(roofGeo, dark);
    cottageRoof.scale.set(1, 0.62, 1);
    cottageRoof.position.set(3.1, 4.15, 0.6);
    island.add(tower, band, gallery, rail, lantern, roof, cottage, cottageRoof);
    island.position.set(LIGHT_POS.x, 0, LIGHT_POS.z);
    return island;
}

function outlined(mesh: THREE.Mesh, width: number) {
    const group = new THREE.Group();
    const hull = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: shade(1), side: THREE.BackSide }));
    hull.scale.setScalar(width);
    group.add(hull, mesh);
    return group;
}

function screenTexture() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = shadeCss(0.08);
    g.fillRect(0, 0, 64, 128);
    const glare = g.createLinearGradient(0, 20, 64, 90);
    glare.addColorStop(0.35, shadeCss(1, 0));
    glare.addColorStop(0.5, shadeCss(1, 0.32));
    glare.addColorStop(0.62, shadeCss(1, 0));
    g.fillStyle = glare;
    g.fillRect(0, 0, 64, 128);
    g.fillStyle = shadeCss(0);
    g.fillRect(24, 6, 16, 5);
    return new THREE.CanvasTexture(c);
}

function makeFloater(kind: number, screen: THREE.Texture) {
    const g = new THREE.Group();
    if (kind === 0) {
        const body = new THREE.Mesh(new RoundedBoxGeometry(0.9, 1.8, 0.1, 4, 0.14), new THREE.MeshLambertMaterial({ color: shade(0.08) }));
        g.add(outlined(body, 1.06));
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 1.6), new THREE.MeshBasicMaterial({ map: screen }));
        glass.position.z = 0.056;
        g.add(glass);
    } else if (kind === 1) {
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
        const bell = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: shade(0.78), side: THREE.DoubleSide }));
        g.add(outlined(bell, 1.05));
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 6, 16), bell.material);
        handle.position.y = 0.62;
        g.add(handle);
    } else {
        const tile = new THREE.Mesh(new RoundedBoxGeometry(1.45, 1.02, 0.28, 4, 0.22), new THREE.MeshLambertMaterial({ color: shade(0.86) }));
        g.add(outlined(tile, 1.05));
        const tri = new THREE.Mesh(new THREE.CircleGeometry(0.36, 3), new THREE.MeshBasicMaterial({ color: shade(0) }));
        tri.position.set(0.03, 0, 0.145);
        g.add(tri);
    }
    return g;
}

/** Wreckage heaped at the left and right edges and along the horizon; the middle stays clear. */
function scatter() {
    let seed = 7;
    const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
    };
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(16)) * 1.9;
    const worldX = (sx: number, z: number) => {
        const depth = CAMERA_HOME.z - z;
        return (LOOK_AT.x * depth) / (CAMERA_HOME.z - LOOK_AT.z) + (sx - 0.5) * 2 * depth * tanHalf;
    };
    const spots: { x: number; z: number; kind: number }[] = [];
    for (let i = 0; i < 16; i++) {
        const z = THREE.MathUtils.lerp(-10, -40, Math.pow(rand(), 1.3));
        const sx = rand() < 0.6 ? THREE.MathUtils.lerp(-0.06, 0.09, rand()) : THREE.MathUtils.lerp(0.87, 1.05, rand());
        spots.push({ x: worldX(sx, z), z, kind: Math.floor(rand() * 3) });
    }
    for (let i = 0; i < 12; i++) {
        const z = THREE.MathUtils.lerp(-46, -66, rand());
        spots.push({ x: worldX(THREE.MathUtils.lerp(0.02, 0.98, rand()), z), z, kind: Math.floor(rand() * 3) });
    }
    for (let i = 0; i < 8; i++) {
        const a = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(160, 200, rand()));
        const r = THREE.MathUtils.lerp(35, 120, rand());
        spots.push({ x: LIGHT_POS.x + Math.cos(a) * r, z: LIGHT_POS.z + Math.sin(a) * r, kind: Math.floor(rand() * 3) });
    }
    return { spots, rand };
}

type SceneHandle = {
    resize: (width: number, height: number) => void;
    setPointer: (x: number, y: number) => void;
    setScroll: (progress: number) => void;
    setClearing: (clearing: [number, number, number, number]) => void;
    /** The dither's two colors as sRGB 0–1: dark water and sky, then light. */
    setPalette: (background: Rgb, foreground: Rgb) => void;
    start: () => void;
    stop: () => void;
    renderStill: () => void;
    dispose: () => void;
};

function createScene(canvas: HTMLCanvasElement, pixelSize = 2): SceneHandle {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.setClearColor(shade(0), 1);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 900);

    scene.add(new THREE.AmbientLight(shade(1), 0.05));
    const moon = new THREE.DirectionalLight(shade(1), 2.3);
    moon.position.set(-50, 18, -12);
    const lamp = new THREE.PointLight(shade(1), 25, 30, 1.6);
    lamp.position.copy(LIGHT_POS);
    scene.add(moon, lamp);

    const starGeo = new THREE.BufferGeometry();
    const stars: number[] = [];
    for (let i = 0; i < 260; i++) {
        const a = Math.random() * Math.PI - Math.PI;
        const e = THREE.MathUtils.degToRad(3 + Math.random() * 38);
        stars.push(Math.cos(a) * Math.cos(e) * 600, Math.sin(e) * 600, Math.sin(a) * Math.cos(e) * 600 - 100);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: shade(1), size: 1.4, sizeAttenuation: false })));

    const beamDir = new THREE.Vector2(-1, 0);
    const seaUniforms = {
        uTime: { value: 0 },
        uLight: { value: LIGHT_POS.clone() },
        uBeamDir: { value: beamDir },
        uCosCore: { value: Math.cos(BEAM_CORE) },
        uCosEdge: { value: Math.cos(BEAM_EDGE) },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uClearing: { value: new THREE.Vector4(0.5, 0.47, 0.5, 0.2) },
    };
    const seaGeo = new THREE.PlaneGeometry(700, 700, 220, 220);
    seaGeo.rotateX(-Math.PI / 2);
    const sea = new THREE.Mesh(seaGeo, new THREE.ShaderMaterial({ uniforms: seaUniforms, vertexShader: SEA_VERT, fragmentShader: SEA_FRAG }));
    sea.position.z = -250;
    scene.add(sea, buildIsland());

    const beamGeo = new THREE.ConeGeometry(11, 170, 48, 1, true);
    beamGeo.translate(0, -85, 0);
    beamGeo.rotateZ(Math.PI / 2);
    const beam = new THREE.Mesh(
        beamGeo,
        new THREE.ShaderMaterial({
            uniforms: { uStrength: { value: 0.5 } },
            vertexShader: BEAM_VERT,
            fragmentShader: BEAM_FRAG,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
        }),
    );
    beam.rotation.z = THREE.MathUtils.degToRad(-4);
    const beamPivot = new THREE.Group();
    beamPivot.position.copy(LIGHT_POS);
    beamPivot.add(beam);
    scene.add(beamPivot);

    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowCanvas.height = 64;
    const gctx = glowCanvas.getContext('2d')!;
    const grad = gctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, shadeCss(1));
    grad.addColorStop(0.25, shadeCss(1, 0.45));
    grad.addColorStop(1, shadeCss(1, 0));
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, 64, 64);
    const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowCanvas), blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    glow.scale.setScalar(4.5);
    glow.position.copy(LIGHT_POS);
    scene.add(glow);

    const screen = screenTexture();
    const { spots, rand } = scatter();
    const floaters = spots.map(({ x, z, kind }) => {
        const root = makeFloater(kind, screen);
        root.scale.setScalar((1 + rand() * 0.35) * (z < -70 ? 1.8 : 1));
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
                (rand() - 0.5) * (kind === 1 ? 1 : 0.7),
            ),
            sink: 0,
        };
    });

    // Plain vectors, not THREE.Color: the two theme colors go to the screen as given, no color management.
    const ink = new THREE.Vector3(...DEFAULT_INK);
    const paper = new THREE.Vector3(...DEFAULT_PAPER);
    const target = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    const ditherScene = new THREE.Scene();
    const ditherCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    ditherScene.add(
        new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            new THREE.ShaderMaterial({
                uniforms: {
                    tScene: { value: target.texture },
                    uInk: { value: ink },
                    uPaper: { value: paper },
                },
                vertexShader: DITHER_VERT,
                fragmentShader: DITHER_FRAG,
                depthTest: false,
            }),
        ),
    );

    // The anchor: where the ray through the middle of the clearing meets the sea. Every camera
    // move pivots around it, so the water under the text stays put on screen.
    const clearing = seaUniforms.uClearing.value;
    const anchor = new THREE.Vector3();
    const anchorOffset = new THREE.Vector3();
    const baseQuat = new THREE.Quaternion();
    const camRight = new THREE.Vector3();
    const orbit = new THREE.Quaternion();
    const yawQ = new THREE.Quaternion();
    const offset = new THREE.Vector3();
    const placeAnchor = () => {
        camera.position.copy(CAMERA_HOME);
        camera.lookAt(LOOK_AT);
        camera.updateMatrixWorld();
        baseQuat.copy(camera.quaternion);
        camRight.set(1, 0, 0).applyQuaternion(baseQuat);
        const ray = new THREE.Vector3(clearing.x * 2 - 1, clearing.y * 2 - 1, 0.5).unproject(camera).sub(CAMERA_HOME).normalize();
        const dist = ray.y < -0.01 ? -CAMERA_HOME.y / ray.y : 40;
        anchor.copy(CAMERA_HOME).addScaledVector(ray, Math.min(dist, 120));
        anchorOffset.copy(CAMERA_HOME).sub(anchor);
    };

    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    let scroll = 0;
    let elapsed = 0;
    let lastTick = 0;
    let lastFrame = 0;
    let raf = 0;

    const update = (t: number, dt: number) => {
        const angle = beamAngle(t);
        beamDir.set(Math.cos(angle), Math.sin(angle));
        beamPivot.rotation.y = -angle;
        seaUniforms.uTime.value = t;

        pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 2.5);
        pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 2.5);
        const intro = 1 - Math.pow(1 - Math.min(1, t / 3.2), 3);
        const pitch = scroll * TILT + pointer.sy * 0.018;
        const yaw = -pointer.sx * 0.035 + Math.sin(t * 0.13) * 0.006;
        orbit.setFromAxisAngle(camRight, -pitch).premultiply(yawQ.setFromAxisAngle(UP, yaw));
        offset.copy(anchorOffset).multiplyScalar(1 + (1 - intro) * 0.3).applyQuaternion(orbit);
        camera.position.copy(anchor).add(offset);
        camera.quaternion.copy(orbit).multiply(baseQuat);

        for (const f of floaters) {
            const cover = beamCover(f.x, f.z, angle);
            const goal = cover > 0.2 ? 1 : 0;
            f.sink += (goal - f.sink) * Math.min(1, dt * (goal ? 2.2 : 0.35));
            f.root.position.set(f.x, waveHeight(f.x, f.z, t, cover) + f.lift - f.sink * 2.4, f.z);
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

    const redrawIfIdle = () => {
        if (raf) return;
        update(elapsed, 0);
        render();
    };

    const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        if (now - lastFrame < 1000 / 45) return;
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
            redrawIfIdle();
        },
        setPointer(x, y) {
            pointer.x = x;
            pointer.y = y;
        },
        setScroll(progress) {
            scroll = progress;
        },
        setClearing([x, y, rx, ry]) {
            clearing.set(x, y, rx, ry);
            placeAnchor();
            redrawIfIdle();
        },
        setPalette(background, foreground) {
            ink.set(...background);
            paper.set(...foreground);
            redrawIfIdle();
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
        renderStill() {
            elapsed = 9.5; // later redraws (resize, theme change) keep this same moment
            for (let i = 0; i < 400; i++) update(elapsed, 0.1);
            render();
        },
        dispose() {
            cancelAnimationFrame(raf);
            raf = 0;
            scene.traverse((obj: THREE.Object3D) => {
                const mesh = obj as THREE.Mesh;
                mesh.geometry?.dispose();
                const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
                if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
                else mat?.dispose();
            });
            screen.dispose();
            target.dispose();
            renderer.dispose();
        },
    };
}

/* ========================================================= React layer */

function supportsWebGL() {
    try {
        const canvas = document.createElement('canvas');
        return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
        return false;
    }
}

/** The canvas: runs only while on screen, pivots on `textRef`, tilts as `sectionRef` scrolls away. */
function LighthouseCanvas({ textRef, sectionRef }: { textRef: RefObject<HTMLElement | null>; sectionRef: RefObject<HTMLElement | null> }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !supportsWebGL()) return;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let scene: SceneHandle;
        try {
            scene = createScene(canvas);
        } catch {
            return;
        }

        const fitClearing = () => {
            const el = textRef.current;
            if (!el) return;
            const c = canvas.getBoundingClientRect();
            const r = el.getBoundingClientRect();
            if (!c.width || !c.height || !r.width) return;
            scene.setClearing([
                (r.left + r.width / 2 - c.left) / c.width,
                1 - (r.top + r.height / 2 - c.top) / c.height,
                (r.width / 2 + 40) / c.width,
                (r.height / 2 + 36) / c.height,
            ]);
        };
        const size = () => {
            scene.resize(canvas.clientWidth, canvas.clientHeight);
            fitClearing();
        };
        size();
        const ro = new ResizeObserver(size);
        ro.observe(canvas);
        if (textRef.current) ro.observe(textRef.current);

        // The dither's two colors come from the section: its background and its text color.
        const readPalette = () => {
            const el = sectionRef.current;
            if (!el) return;
            const style = getComputedStyle(el);
            el.style.setProperty('--lighthouse-halo', style.backgroundColor);
            const bg = cssToRgb(style.backgroundColor);
            const fg = cssToRgb(style.color);
            if (bg && fg && bg[3] > 0.5) scene.setPalette([bg[0], bg[1], bg[2]], [fg[0], fg[1], fg[2]]);
            else scene.setPalette(DEFAULT_INK, DEFAULT_PAPER);
        };
        let paletteFrame = 0;
        const onThemeChange = () => {
            cancelAnimationFrame(paletteFrame);
            paletteFrame = requestAnimationFrame(readPalette);
        };
        readPalette();
        const themeWatch = new MutationObserver(onThemeChange);
        for (const node of [document.documentElement, document.body]) {
            themeWatch.observe(node, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-mode'] });
        }
        const scheme = window.matchMedia('(prefers-color-scheme: dark)');
        scheme.addEventListener('change', onThemeChange);

        let onScreen = true;
        const run = () => {
            if (reduce) return;
            if (onScreen && !document.hidden) scene.start();
            else scene.stop();
        };
        const io = new IntersectionObserver(([entry]) => {
            onScreen = entry.isIntersecting;
            run();
        });
        io.observe(canvas);
        document.addEventListener('visibilitychange', run);

        const onPointer = (e: PointerEvent) =>
            scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
        const onScroll = () => {
            const el = sectionRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            scene.setScroll(Math.min(1, Math.max(0, -rect.top / rect.height)));
        };

        if (reduce) {
            scene.renderStill();
        } else {
            window.addEventListener('pointermove', onPointer, { passive: true });
            window.addEventListener('scroll', onScroll, { passive: true });
            onScroll();
            run();
        }

        return () => {
            ro.disconnect();
            io.disconnect();
            themeWatch.disconnect();
            scheme.removeEventListener('change', onThemeChange);
            cancelAnimationFrame(paletteFrame);
            document.removeEventListener('visibilitychange', run);
            window.removeEventListener('pointermove', onPointer);
            window.removeEventListener('scroll', onScroll);
            scene.dispose();
        };
    }, [textRef, sectionRef]);

    return <canvas ref={canvasRef} aria-hidden className="block h-full w-full" style={{ imageRendering: 'pixelated' }} />;
}

const EASE = [0.16, 1, 0.3, 1] as const;
/** Keyboard focus ring, drawn in the theme's ring color. */
const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
/** A soft halo in the section's own background color (set by the canvas), so text stays readable over the dither. */
const HALO = '[text-shadow:0_2px_24px_color-mix(in_oklab,var(--lighthouse-halo,transparent)_65%,transparent)]';
/** The credit link's address (see the license at the top of this file). */
const CREDIT_URL = 'https://focuznow.com/?utm_source=21st&utm_medium=component&utm_campaign=lighthouse-hero';

type Action = {
    label: string;
    /** Renders a link when set, otherwise a button. */
    href?: string;
    onClick?: () => void;
};

export type LighthouseHeroProps = {
    /** The headline, one entry per line. */
    title?: [string, string];
    /** One or two sentences beside the headline. */
    description?: string;
    /** The filled call-to-action button. */
    primaryAction?: Action;
    /** Optional quieter text link next to the primary action. */
    secondaryAction?: Action;
    /** Optional panel peeking up from the bottom, cut off exactly where its rounded corners begin. */
    children?: ReactNode;
    /** Corner radius of your panel in px, so the fold lands right where the corners start. */
    panelRadius?: number;
    /** Extra classes for the section. Background and text colors here also recolor the scene. */
    className?: string;
};

/** "Lighthouse by FocuzNow" credit link (see the license at the top of this file). */
function Credit({ className }: { className: string }) {
    return (
        <a
            href={CREDIT_URL}
            target="_blank"
            rel="noopener"
            className={`rounded-md bg-background/60 px-2 py-1 font-mono text-[11px] text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground ${FOCUS} ${className}`}
        >
            Lighthouse by FocuzNow <span aria-hidden>↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
        </a>
    );
}

function ActionLink({ action, primary }: { action: Action; primary?: boolean }) {
    const className = primary
        ? `group inline-flex h-11 items-center gap-2 rounded-[10px] bg-primary px-5 text-[15px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 ${FOCUS}`
        : `rounded-sm text-[15px] font-medium text-foreground/75 transition-colors hover:text-foreground ${FOCUS}`;
    const inner = (
        <>
            {action.label}
            {primary && <ArrowRight aria-hidden size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />}
        </>
    );
    return action.href ? (
        <a href={action.href} onClick={action.onClick} className={className}>
            {inner}
        </a>
    ) : (
        <button type="button" onClick={action.onClick} className={className}>
            {inner}
        </button>
    );
}

export function LighthouseHero({
    title = ['Everything else', 'can wait.'],
    description = 'Blocks distractions, runs your focus sessions, and keeps your plans and passwords in one place.',
    primaryAction = { label: 'Get started' },
    secondaryAction,
    children,
    panelRadius = 26,
    className = '',
}: LighthouseHeroProps) {
    const reduce = useReducedMotion();
    const headingId = useId();
    const sectionRef = useRef<HTMLElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const [sceneReady, setSceneReady] = useState(false);

    // Let the text paint first; the scene is decoration.
    useEffect(() => {
        const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 120));
        const cancel = window.cancelIdleCallback ?? window.clearTimeout;
        const id = idle(() => setSceneReady(true));
        return () => cancel(id);
    }, []);

    const rise = useCallback(
        (delay: number) => ({
            initial: reduce ? false : { opacity: 0, y: 12 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.9, ease: EASE, delay },
        }),
        [reduce],
    );

    return (
        <section
            ref={sectionRef}
            aria-labelledby={headingId}
            className={`relative h-[max(760px,100svh)] w-full bg-background text-foreground ${className}`}
        >
            <div className="absolute inset-0 isolate overflow-hidden">
                <div aria-hidden className="absolute inset-0 -z-10">
                    {sceneReady && (
                        <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.6, ease: EASE }}>
                            <LighthouseCanvas textRef={textRef} sectionRef={sectionRef} />
                        </motion.div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-[22%] bg-gradient-to-b from-transparent to-background" />
                </div>

                <div className="absolute inset-x-0 top-[45%]">
                    <div ref={textRef} className="mx-auto grid max-w-[1180px] grid-cols-1 gap-8 px-8 md:grid-cols-[1.25fr_1fr] md:gap-16">
                        <h1
                            id={headingId}
                            className={`text-[clamp(2.8rem,min(4.6vw,8.2vh),5rem)] font-bold leading-[0.95] tracking-[-0.04em] ${HALO}`}
                            style={{ fontFamily: "'Satoshi', 'Inter', ui-sans-serif, system-ui, sans-serif" }}
                        >
                            {title.map((line, i) => (
                                // Clipped only along the bottom edge (for the rise), so the halo can spread.
                                <span key={line} className="block pb-[0.08em] [clip-path:inset(-1em_-1em_-0.35em_-1em)]">
                                    <motion.span
                                        className="block"
                                        initial={reduce ? false : { y: '140%' }}
                                        animate={{ y: '0%' }}
                                        transition={{ duration: 1.05, ease: EASE, delay: 0.15 + i * 0.09 }}
                                    >
                                        {line}
                                    </motion.span>
                                </span>
                            ))}
                        </h1>
                        <div className={`flex flex-col justify-between pb-[0.55rem] pt-[0.7rem] ${HALO}`}>
                            <motion.p {...rise(0.5)} className="max-w-[28rem] text-[17px] leading-[1.5] text-foreground/80">
                                {description}
                            </motion.p>
                            <motion.div {...rise(0.62)} className="mt-4 flex items-center gap-6 [text-shadow:none]">
                                <ActionLink action={primaryAction} primary />
                                {secondaryAction && <ActionLink action={secondaryAction} />}
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>

            {children ? (
                <motion.div
                    className="absolute inset-x-0 z-10 px-8"
                    style={{ bottom: -panelRadius }}
                    initial={reduce ? false : { opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.1, ease: EASE, delay: 0.7 }}
                >
                    <div className="relative mx-auto max-w-[1120px]">
                        {/* Credit link (license): sits just above the panel. */}
                        <Credit className="absolute bottom-[calc(100%+12px)] right-2" />
                        {children}
                    </div>
                </motion.div>
            ) : (
                <Credit className="absolute bottom-4 right-4 z-20" />
            )}
        </section>
    );
}

export default LighthouseHero;
