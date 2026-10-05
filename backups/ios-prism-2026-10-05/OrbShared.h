// The focus orb and its world: the code that runs on the iPhone (the SwiftUI shaders in FocusOrb.metal
// and OrbWorld.metal, and the stage's own Metal pass in StageView.metal) and in the browser previews
// (ios/Tools: they paste the parts between the BEGIN/END markers into WebGL).
//
// Between the markers, only what Metal and GLSL both accept: no `fmod`/`mod`, no `saturate`, matching
// argument types (`float3(t)` in `mix`), no program-scope constants (macros), no GLSL keywords as
// names (`out`, `in`, `sample`, `smooth`, `flat`), and guard `atan2(0, 0)`, `normalize(0)`, `pow` of a
// negative and divisions by zero: Metal's fast maths turns them into NaN, and one NaN blanks a pixel.
#ifndef FZ_ORB_SHARED_H
#define FZ_ORB_SHARED_H
#include <metal_stdlib>
using namespace metal;

// BEGIN SHARED ORB
#define FZ_TAU 6.2831853
#define FZ_ORB_R 0.56

static inline float orbHash(float3 p) {
    p = fract(p * 0.3183099 + float3(0.1, 0.17, 0.13));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

// Cheap 1D hash (Dave Hoskins): the tendrils call it a lot.
static inline float orbHash1(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

static inline float orbNoise1(float x) {
    float i = floor(x);
    float f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(orbHash1(i), orbHash1(i + 1.0), f);
}

static inline float orbNoise3(float3 x) {
    float3 i = floor(x);
    float3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float a = mix(orbHash(i), orbHash(i + float3(1.0, 0.0, 0.0)), f.x);
    float b = mix(orbHash(i + float3(0.0, 1.0, 0.0)), orbHash(i + float3(1.0, 1.0, 0.0)), f.x);
    float c = mix(orbHash(i + float3(0.0, 0.0, 1.0)), orbHash(i + float3(1.0, 0.0, 1.0)), f.x);
    float d = mix(orbHash(i + float3(0.0, 1.0, 1.0)), orbHash(i + float3(1.0, 1.0, 1.0)), f.x);
    return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}

static inline float orbFbm(float3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
        v += a * orbNoise3(p);
        p = p * 2.03 + float3(1.7, -1.3, 0.8);
        a *= 0.5;
    }
    return v;
}

// 1 on the noise's mid contour, falling away on both sides: thin, jagged, branching lines.
static inline float orbRidge(float3 p) {
    float n = 0.72 * orbNoise3(p) + 0.28 * orbNoise3(p * 3.1 + float3(7.0, 2.0, 5.0));
    return 1.0 - abs(n * 2.0 - 1.0);
}

// The angle of v, and 0 for no vector at all. Metal's fast maths makes atan2(0, 0) NaN (GLSL gives 0),
// and one NaN times 0 still poisons everything it touches: with no finger down, the touch angle is
// atan2(0, 0), and that blanked the whole inside of the orb on the iPhone while the browser was fine.
static inline float orbAngle(float2 v) {
    return dot(v, v) < 1e-12 ? 0.0 : atan2(v.y, v.x);
}

static inline float orbWrap(float a) {
    return a - FZ_TAU * floor((a + 3.14159265) / FZ_TAU);
}

static inline float3 orbTurnY(float3 v, float a) {
    float c = cos(a);
    float s = sin(a);
    return float3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
}

static inline float3 orbTone(float3 c) {
    return float3(1.0) - exp(-c * 1.2);
}

// How far a tendril has bent (radians) at radius r: a slow sway, kinks, and fine electric jitter.
static inline float orbBend(float r, float t, float fi) {
    return (orbNoise1(r * 2.4 - t * 0.85 + fi * 7.1) - 0.5) * 1.5 * r
         + (orbNoise1(r * 8.5 - t * 2.9 + fi * 3.7) - 0.5) * 0.46 * r
         + (orbNoise1(r * 24.0 - t * 7.5 + fi * 1.9) - 0.5) * 0.13 * r
         + (orbNoise1(r * 60.0 - t * 15.0 + fi * 4.3) - 0.5) * 0.035 * r;
}

// p: centred, 1 = half the view's shorter side, y down. t: seconds. e: energy 0...1.
// aa: one point in p units (for a smooth edge). touch: where a finger is (p units) and 1 while it's
// down, 0 otherwise. Returns a premultiplied colour.
static inline float4 fzOrb(float2 p, float t, float e, float aa, float3 touch) {
    float3 mint = float3(0.651, 0.902, 0.749);   // #A6E6BF, fzMint
    float3 deep = float3(0.04, 0.42, 0.32);
    float3 hot = float3(0.94, 1.0, 0.97);

    float2 q = p / FZ_ORB_R;
    float r = length(q);
    float ang = orbAngle(q);
    float charge = 0.35 + 0.65 * e;
    float2 tq = touch.xy / FZ_ORB_R;
    float touchAng = orbAngle(tq);
    float touchOn = touch.z;

    // Outside: the light it throws, flickering a little with the strikes.
    float beyond = max(r - 1.0, 0.0);
    float fade = 1.0 - smoothstep(0.8, 1.0, length(p));
    float shimmer = 0.9 + 0.1 * orbNoise1(t * 7.0);
    float3 halo = mint * (exp(-beyond * 5.0) * (0.12 + 0.36 * e) + exp(-beyond * 20.0) * (0.18 + 0.45 * e)) * shimmer;
    halo *= fade;
    float3 haloC = orbTone(halo);
    float haloA = clamp(max(haloC.r, max(haloC.g, haloC.b)), 0.0, 1.0);
    float4 outside = float4(haloC, haloA);

    if (r > 1.0 + 2.0 * aa / FZ_ORB_R) {
        return outside;
    }

    float rr = min(r, 1.0);
    float z = sqrt(max(1.0 - rr * rr, 0.0));
    float3 n = float3(q.x, q.y, z);

    // The glass body, darker towards the edge.
    float3 col = mix(float3(0.02, 0.075, 0.06), float3(0.004, 0.014, 0.012), float3(rr));

    // A slow plasma haze turning inside.
    float warp = orbFbm(float3(q * 1.3, t * 0.11));
    float haze = orbFbm(float3(q * 2.1 + float2(warp * 1.4, -warp), t * 0.19 + 4.0));
    col += deep * pow(haze, 2.2) * (0.75 + 1.25 * e) * (1.0 - 0.4 * rr);

    // Veins crackling over the shell, in patches that drift and flicker.
    float3 front = orbTurnY(n, t * 0.2);
    float patches = smoothstep(0.48, 0.78, orbNoise3(front * 1.7 + float3(0.0, 0.0, t * 0.3)));
    float sharp = mix(30.0, 18.0, e);
    float veins = pow(orbRidge(front * 3.0 + float3(0.0, t * 0.08, warp)), sharp) * patches;
    float crackle = 0.5 + 0.5 * orbNoise1(t * 11.0 + front.x * 5.0 + front.y * 3.0);
    col += mix(mint, hot, float3(0.3)) * veins * crackle * (0.15 + 0.55 * e) * smoothstep(0.25, 0.7, rr);

    // The tendrils: they leave the core, fork, and strike the glass.
    float tendrils = 0.0;
    float tips = 0.0;
    for (int i = 0; i < 8; i++) {
        float fi = float(i);
        float on = clamp(e * 9.0 + 3.0 - fi * 1.15, 0.0, 1.0);
        if (on <= 0.0) {
            break;
        }
        float base = fi * (FZ_TAU / 8.0) + 0.85 * sin(t * 0.19 + fi * 2.3) + t * 0.07;
        // A finger pulls most of them to it, like a plasma globe, and they end at the fingertip.
        float pull = touchOn * (0.55 + 0.4 * orbHash(float3(fi, 7.0, 3.0)));
        base += orbWrap(touchAng - base) * pull;
        float reach = mix(1.0, clamp(length(tq), 0.3, 0.97), pull);
        // Some swing towards you (brighter, thicker), some behind the core.
        float depth = 0.68 + 0.32 * sin(t * 0.33 + fi * 1.9);
        float flick = 0.45 + 0.55 * orbNoise1(t * 6.0 + fi * 13.0);
        float strike = pow(orbNoise1(t * 1.9 + fi * 17.0), 6.0) * 2.4;
        float power = (flick + strike) * on * charge * depth * (1.0 + 0.7 * touchOn);

        float bend = orbBend(rr, t, fi);
        float span = smoothstep(0.05, 0.18, rr) * (1.0 - smoothstep(reach - 0.025, reach, r));
        float d = abs(orbWrap(ang - base - bend)) * rr;
        float width = mix(70.0, 240.0, rr) / (0.7 + 0.5 * depth);
        tendrils += (1.3 * exp(-d * width) + 0.32 * exp(-d * 20.0)) * span * power;

        // A fork that splits off part way out.
        float forkAt = 0.4 + 0.22 * orbHash(float3(fi, 3.0, 1.0));
        float k = max(rr - forkAt, 0.0);
        float side = orbHash(float3(fi, 5.0, 2.0)) > 0.5 ? 1.0 : -1.0;
        float bend2 = bend + side * k * (1.0 + 0.4 * sin(t * 0.7 + fi))
                    + (orbNoise1(rr * 15.0 - t * 4.5 + fi * 5.3) - 0.5) * 0.24 * rr;
        float d2 = abs(orbWrap(ang - base - bend2)) * rr;
        tendrils += (exp(-d2 * 300.0) + 0.18 * exp(-d2 * 28.0)) * smoothstep(0.0, 0.1, k) * span * power * 0.65;

        // Where it strikes the glass.
        float endA = base + orbBend(reach, t, fi);
        float2 tip = float2(cos(endA), sin(endA)) * min(reach, 0.985);
        float td = length(q - tip);
        tips += (exp(-td * 40.0) * 1.1 + exp(-td * 10.0) * 0.2) * power;
    }
    col += mix(mint, hot, float3(0.6)) * tendrils;
    col += mix(mint, hot, float3(0.45)) * tips;

    // The glass glowing under the finger (or on the rim nearest it, if it's outside).
    float2 under = tq / max(length(tq), 0.0001) * min(length(tq), 0.97);
    float ud = length(q - under);
    col += mix(mint, hot, float3(0.7)) * (exp(-ud * 16.0) * 1.8 + exp(-ud * 5.0) * 0.35) * touchOn;

    // The core.
    float breathe = 0.5 + 0.5 * sin(t * 1.6);
    float coreR = 0.08 + 0.055 * e + 0.012 * breathe;
    col += hot * exp(-(rr * rr) / (coreR * coreR)) * (1.4 + 0.8 * e);
    col += mint * exp(-rr / (coreR * 2.4)) * (0.4 + 0.6 * e);

    // Glass: a rim that catches the light, a crescent of light on the top left, a bounce at the bottom.
    float fres = pow(1.0 - z, 3.0);
    col += mint * fres * (0.28 + 0.42 * e);
    col += mint * smoothstep(0.955, 0.995, rr) * (0.16 + 0.2 * e);
    float2 towards = q / max(rr, 0.0001);
    float lit = max(dot(towards, float2(-0.6, -0.8)), 0.0);
    col += float3(0.9, 1.0, 0.95) * fres * lit * lit * 0.75;
    float2 b = (q - float2(0.12, 0.8)) / float2(0.5, 0.14);
    col += mint * exp(-dot(b, b) * 2.0) * 0.1 * (0.5 + e);

    // Glass you can see into: the body only half hides what's behind it (the stage shows the world
    // through it, upside down), the rim is solid, and all the light inside adds on top.
    float inside = 1.0 - smoothstep(1.0 - aa / FZ_ORB_R, 1.0 + aa / FZ_ORB_R, r);
    float glass = 0.42 + 0.58 * smoothstep(0.55, 1.0, rr);
    float4 sphere = float4(orbTone(col), glass);
    return mix(outside, sphere, float4(inside));
}
// END SHARED ORB

// BEGIN SHARED WORLD
#define FZ_LUMA float3(0.299, 0.587, 0.114)

static inline float wHash(float3 p) {
    p = fract(p * 0.3183099 + float3(0.1, 0.17, 0.13));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

static inline float wNoise(float3 x) {
    float3 i = floor(x);
    float3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float a = mix(wHash(i), wHash(i + float3(1.0, 0.0, 0.0)), f.x);
    float b = mix(wHash(i + float3(0.0, 1.0, 0.0)), wHash(i + float3(1.0, 1.0, 0.0)), f.x);
    float c = mix(wHash(i + float3(0.0, 0.0, 1.0)), wHash(i + float3(1.0, 0.0, 1.0)), f.x);
    float d = mix(wHash(i + float3(0.0, 1.0, 1.0)), wHash(i + float3(1.0, 1.0, 1.0)), f.x);
    return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}

static inline float wFbm(float3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * wNoise(p);
        p = p * 2.07 + float3(3.1, -1.7, 0.9);
        a *= 0.5;
    }
    return v;
}

// How near a photo pixel is, 0 (the far rocks and sky) to 1 (the ground at the bottom). ip: photo
// pixels. depthPx: horizon y, bottom y, the pedestal's foot y, unused. pedPx: the pedestal's top centre
// x, y and its top's radii (it's as near as its foot).
static inline float fzWorldDepth(float2 ip, float4 depthPx, float4 pedPx) {
    float ground = 0.06 + 0.94 * smoothstep(depthPx.x, depthPx.y, ip.y);
    float footDepth = 0.06 + 0.94 * smoothstep(depthPx.x, depthPx.y, depthPx.z);
    float2 q = (ip - pedPx.xy) / pedPx.zw;
    float top = 1.0 - smoothstep(0.95, 1.08, length(q));
    float body = (1.0 - smoothstep(pedPx.z * 1.05, pedPx.z * 1.15, abs(ip.x - pedPx.x)))
               * smoothstep(pedPx.y - 4.0, pedPx.y + 4.0, ip.y)
               * (1.0 - smoothstep(depthPx.z, depthPx.z + 18.0, ip.y));
    return mix(ground, footDepth, max(top, body));
}

// The wide shot, for the camera flying in: how far a point is, relative to the pedestal (1). The
// ground is a plane (twice as far halfway to the horizon...), the far rocks and sky are very far, and
// the pedestal is solid (as far as its foot). P: wide-photo pixels. depthPx: the horizon's y, the
// pedestal's foot y. pedPx: the pedestal's top centre and its top's radii.
static inline float fzWideDistance(float2 P, float4 depthPx, float4 pedPx) {
    // (A little flatter than a true plane, so the ground under the camera doesn't smear.)
    float ground = pow((depthPx.y - depthPx.x) / max(P.y - depthPx.x, 18.0), 0.8);
    float2 q = (P - pedPx.xy) / pedPx.zw;
    float top = 1.0 - smoothstep(0.95, 1.1, length(q));
    float body = (1.0 - smoothstep(pedPx.z * 1.04, pedPx.z * 1.14, abs(P.x - pedPx.x)))
               * step(pedPx.y, P.y) * (1.0 - smoothstep(depthPx.y, depthPx.y + 6.0, P.y));
    return mix(ground, 1.0, max(top, body));
}

// How much bigger something at `distance` looks once the camera has moved `travel` towards it
// (the pedestal is at 1).
static inline float fzWideZoom(float distance, float travel) {
    return distance / max(distance - travel, 0.06);
}

// Pulling Today down pushes the camera in: how much bigger a point at nearness d gets when the
// pedestal (nearness dp) grows by `grow`. Far things barely move; the near ground grows most, capped so
// it doesn't smear.
static inline float fzPushZoom(float d, float grow, float dp) {
    return 1.0 + grow * min(d / dp, 1.8);
}

// The same nearness with a hard edge round the pedestal, for the push: a soft edge stretches the photo
// across it as the pedestal outgrows the ground behind, and its rim showed up twice. A little wide of
// the measured edge, so the rim always goes with the pedestal.
static inline float fzPushDepth(float2 ip, float4 depthPx, float4 pedPx) {
    float ground = 0.06 + 0.94 * smoothstep(depthPx.x, depthPx.y, ip.y);
    float footDepth = 0.06 + 0.94 * smoothstep(depthPx.x, depthPx.y, depthPx.z);
    float2 q = (ip - pedPx.xy) / pedPx.zw;
    float top = 1.0 - smoothstep(1.02, 1.05, length(q));
    float body = (1.0 - smoothstep(pedPx.z * 1.06, pedPx.z * 1.08, abs(ip.x - pedPx.x)))
               * smoothstep(pedPx.y - 4.0, pedPx.y + 4.0, ip.y)
               * (1.0 - smoothstep(depthPx.z, depthPx.z + 18.0, ip.y));
    return mix(ground, footDepth, max(top, body));
}

// Where the point now at `position` was before the push (`push`: the point it grows from, how much the
// pedestal has grown, the pedestal's nearness). Starts from the pedestal's own zoom, so where the
// grown pedestal now covers the ground behind it, the pedestal wins.
static inline float2 fzUnpush(float2 position, float4 push, float pxScale, float4 depthPx, float4 pedPx) {
    if (push.z < 0.0001) {
        return position;
    }
    float2 f = push.xy;
    float2 src = f + (position - f) / (1.0 + push.z);
    for (int i = 0; i < 4; i++) {
        float d = fzPushDepth(src / pxScale, depthPx, pedPx);
        src = f + (position - f) / fzPushZoom(d, push.z, push.w);
    }
    return src;
}

// The photo's own fades: into black at the top and bottom, at the sides on iPad (fade.z 1), and the
// reveal out of the wide shot (a circle round the pedestal, radius fade.w). They were three SwiftUI
// masks, each an extra full-size pass every frame. pos: the photo view's points. fade.xy: its size.
static inline float fzPhotoFade(float2 pos, float4 fade, float2 revealAt) {
    float v = pos.y / fade.y;
    float a = clamp(v / 0.05, 0.0, 1.0) * clamp((1.0 - v) / 0.32, 0.0, 1.0);
    float u = pos.x / fade.x;
    a *= mix(1.0, clamp(u / 0.14, 0.0, 1.0) * clamp((1.0 - u) / 0.14, 0.0, 1.0), fade.z);
    a *= 1.0 - clamp((length(pos - revealAt) / max(fade.w, 1.0) - 0.7) / 0.3, 0.0, 1.0);
    return a;
}

// photo: the photo's colour at p. p and every place: stage points, y down. e: the orb's energy.
// awake: how lit the world is (0 asleep). flash: a strike, 1 fading to 0. orbOn: how much of the orb
// there is to give light. ringOn: how far the pedestal's ring is lit. k: the stage's scale.
static inline float3 fzWorld(float3 photo, float2 p, float t, float e, float awake, float flash, float orbOn, float ringOn,
                      float2 orb, float orbR, float2 ring, float2 ringR, float2 topR, float baseY, float horizonY, float k) {
    float3 lightC = float3(0.70, 0.96, 0.82);
    float Y = dot(photo, FZ_LUMA);

    // Asleep the world is darker and colourless; it wakes as the orb charges. (The wide shot, the sky
    // above and the rocks use the same grade: saturation 0.5 + 0.5 awake, brightness 0.62 + 0.38 awake.)
    float3 base = mix(float3(Y), photo, float3(0.5 + 0.5 * awake)) * (0.62 + 0.38 * awake);

    // Where the pedestal is: its top, and its sides (which face you, not the orb).
    float2 qt = (p - ring) / topR;
    float top = 1.0 - smoothstep(0.93, 1.02, length(qt));
    float side = step(ring.y, p.y) * (1.0 - smoothstep(baseY - 3.0 * k, baseY + 3.0 * k, p.y))
               * (1.0 - smoothstep(topR.x * 1.0, topR.x * 1.12, abs(p.x - ring.x))) * (1.0 - top);

    // The orb's light: falls off with distance, flickers with its lightning, flashes on a strike.
    float d = length(p - orb) / orbR;
    float flick = 0.86 + 0.14 * wNoise(float3(t * 9.0, 0.5, 0.5)) + flash * 1.8;
    float orbL = orbOn * (0.14 + 0.95 * e) * flick / (1.0 + d * d * 0.5);
    float facing = top * 1.4 + side * 0.3 + (1.0 - top - side);
    // A contact shadow on the ground round the foot of the pedestal.
    float2 fq = (p - float2(ring.x, baseY)) / float2(topR.x * 1.25, 18.0 * k);
    float foot = (1.0 - side) * (1.0 - top) * exp(-dot(fq, fq) * 1.2);

    // The ring's light spreading over the metal of the top.
    float rq = abs(length((p - ring) / ringR) - 1.0);
    float ringL = top * exp(-rq * 6.0) * (0.45 + 0.6 * e) * (1.0 + flash) * ringOn;

    float light = orbL * facing * (1.0 - 0.6 * foot) + ringL * 1.6;
    float3 col = base * (1.0 - 0.55 * foot) * (float3(1.0) + lightC * light * 2.6) + lightC * light * 0.01;

    // The orb mirrored in the polished top, following the brushed grooves.
    float2 m = (p - float2(orb.x, ring.y + (ring.y - orb.y) * 0.1)) / float2(orbR * 0.85, orbR * 0.24);
    col += lightC * exp(-dot(m, m) * 1.5) * top * (0.015 + 0.8 * Y) * (0.3 + 0.9 * e) * orbOn;

    // Fog lying on the ground, drifting slowly; it glows where the light reaches it, and thins as
    // the world wakes.
    float band = smoothstep(horizonY - 30.0 * k, horizonY + 50.0 * k, p.y) * (1.0 - smoothstep(baseY + 30.0 * k, baseY + 230.0 * k, p.y));
    if (band > 0.001) {
        float n = wFbm(float3(p.x * 0.011 / k + t * 0.03, p.y * 0.04 / k, t * 0.05));
        float fog = band * smoothstep(0.38, 0.86, n) * (1.0 - 0.45 * awake);
        float3 fogC = float3(0.13, 0.14, 0.14) * (0.5 + 0.5 * awake) + lightC * min(orbL, 1.2) * 0.32;
        col = mix(col, max(col, fogC), fog * 0.6);
    }
    return col;
}
// END SHARED WORLD

// BEGIN SHARED STAGE
// The light round the orb that used to be SwiftUI views over the photo (StageView.metal draws them now).
// Uses orbAngle and orbWrap from the ORB part. px: one screen pixel, in points (for smooth edges).

static inline float fzHash2(float2 p) {
    float3 q = fract(float3(p.x, p.y, p.x) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
}

// How far p is from the line from a to b.
static inline float fzSegment(float2 p, float2 a, float2 b) {
    float2 pa = p - a;
    float2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}

// How much of a pixel a line `halfWidth` either side covers, `dist` from its middle.
static inline float fzCover(float dist, float halfWidth, float px) {
    return clamp((halfWidth - dist) / px + 0.5, 0.0, 1.0);
}

// The night sky's stars, twinkling: one in about half the cells of a grid. Returns its brightness.
static inline float fzStars(float2 p, float t, float k, float px) {
    float cell = 34.0 * k;
    float2 id = floor(p / cell);
    float h1 = fzHash2(id + float2(0.31, 0.17));
    if (h1 > 0.5) {
        return 0.0;
    }
    float h2 = fzHash2(id + float2(4.7, 1.3));
    float h3 = fzHash2(id + float2(2.1, 7.9));
    float h4 = fzHash2(id + float2(6.3, 3.7));
    float2 at = (id + float2(0.15, 0.15) + float2(h2, h1 * 2.0) * 0.7) * cell;
    float r = (0.45 + 1.1 * h3 * h3) * k;
    float twinkle = 0.45 + 0.55 * (0.5 + 0.5 * sin(t * (0.6 + h3 * 1.8) + h4 * 6.3));
    return fzCover(length(p - at), r, px) * twinkle * (0.25 + 0.55 * h4);
}

// The shaft of light falling onto the pedestal, from far above the screen: narrow at the top of the
// stage, as wide as the pedestal's top at the ring. Its soft sides are 52 points (on a phone) wide.
// p: the shaft's own points (the stage's, less its parallax). ring: the ring's centre. topW: the
// pedestal top's half width. Returns how bright it is.
static inline float fzShaft(float2 p, float2 ring, float topW, float k, float px) {
    if (p.y > ring.y + px) {
        return 0.0;
    }
    float narrow = topW * 0.35;
    float hw = p.y < 0.0 ? narrow * mix(0.8, 1.0, clamp((p.y + 420.0) / 420.0, 0.0, 1.0))
                         : mix(narrow, topW * 1.05, clamp(p.y / max(ring.y, 1.0), 0.0, 1.0));
    float e = abs(p.x - ring.x) - hw;
    float cov = clamp((26.0 * k - e) / (52.0 * k), 0.0, 1.0);
    float v = clamp((p.y + 420.0) / (ring.y + 420.0), 0.0, 1.0);
    float g = v < 0.5 ? mix(0.13, 0.05, v * 2.0) : mix(0.05, 0.1, v * 2.0 - 1.0);
    // It lands softly on the pedestal's top instead of stopping in a line at the ring.
    return 2.0 * g * cov * (1.0 - smoothstep(ring.y - 10.0 * k, ring.y, p.y));
}

// How far p is from the edge of an ellipse (centre c, radii r): close enough for a thin line.
static inline float fzEllipse(float2 p, float2 c, float2 r) {
    float2 d = p - c;
    float k0 = length(d / r);
    float k1 = length(d / (r * r));
    return abs(k0 * (k0 - 1.0) / max(k1, 1e-5));
}

// The pedestal's groove ring lighting up from the front, both ways round (trace 1: all the way), with
// a soft glow round it and a bright head at each end while it runs, and the white flash of a strike.
// ring: centre and radii. Returns premultiplied light, to add.
static inline float4 fzRingGlow(float2 p, float4 ring, float trace, float power, float flash, float k, float px) {
    float3 mint = float3(0.651, 0.902, 0.749);
    float de = fzEllipse(p, ring.xy, ring.zw);
    float4 col = float4(0.0);
    float lit = clamp(trace, 0.0, 1.0);
    if (lit > 0.001 && power > 0.001) {
        float a1 = 1.5707963 + 3.14159265 * lit;
        float a2 = 1.5707963 - 3.14159265 * lit;
        float2 e1 = ring.xy + ring.zw * float2(cos(a1), sin(a1));
        float2 e2 = ring.xy + ring.zw * float2(cos(a2), sin(a2));
        float dist = de;
        if (lit < 0.999 && abs(orbWrap(orbAngle((p - ring.xy) / ring.zw) - 1.5707963)) > 3.14159265 * lit) {
            dist = min(length(p - e1), length(p - e2));
        }
        float wide = 0.16 * fzCover(dist, 4.5 * k, px);
        float mid = 0.3 * fzCover(dist, 2.75 * k, px);
        float core = fzCover(dist, 0.7 * k, px);
        float4 c = float4(mint * wide, wide);
        c = float4(mint * mid, mid) + c * (1.0 - mid);
        c = float4(float3(0.937, 1.0, 0.961) * core, core) + c * (1.0 - core);
        col = c * power;
        if (lit < 0.999) {
            for (int i = 0; i < 2; i++) {
                float h = length(p - (i == 0 ? e1 : e2)) / (9.0 * k);
                float4 head = h < 0.5 ? mix(float4(1.0), float4(mint * 0.6, 0.6), float4(h * 2.0))
                                      : mix(float4(mint * 0.6, 0.6), float4(0.0), float4(clamp(h * 2.0 - 1.0, 0.0, 1.0)));
                col = head + col * (1.0 - head.a);
            }
        }
    }
    if (flash > 0.001) {
        float wide = 0.25 * fzCover(de, 5.0 * k, px);
        float core = 0.6 * fzCover(de, 1.5 * k, px);
        float a = (core + wide * (1.0 - core)) * flash;
        col += float4(a, a, a, a);
    }
    return col;
}
// END SHARED STAGE

#endif
