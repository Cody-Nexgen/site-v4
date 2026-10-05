// Your focus orb, drawn on the GPU: a dark glass sphere holding live electricity. Lightning tendrils
// leave a white-hot core, fork, and strike the inside of the glass; faint veins crackle over the
// shell; a slow plasma haze turns inside; the rim catches the light. `energy` (0...1) is how charged
// it is: more tendrils, brighter strikes, a stronger glow. Touch it and, like a plasma globe, the
// tendrils bend to your finger and the glass glows under it.
//
// Used by FocusOrb.swift as a SwiftUI colour effect. Everything between BEGIN SHARED and END SHARED
// keeps to the subset Metal and GLSL share, so the same code can be rendered in a browser to check it
// (see docs/ios-focus-orb.md). No `fmod`, no `saturate`, matching argument types, no program-scope
// constants (macros instead).
#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

// BEGIN SHARED
#define FZ_TAU 6.2831853
#define FZ_ORB_R 0.56

static float orbHash(float3 p) {
    p = fract(p * 0.3183099 + float3(0.1, 0.17, 0.13));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

// Cheap 1D hash (Dave Hoskins): the tendrils call it a lot.
static float orbHash1(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

static float orbNoise1(float x) {
    float i = floor(x);
    float f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(orbHash1(i), orbHash1(i + 1.0), f);
}

static float orbNoise3(float3 x) {
    float3 i = floor(x);
    float3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float a = mix(orbHash(i), orbHash(i + float3(1.0, 0.0, 0.0)), f.x);
    float b = mix(orbHash(i + float3(0.0, 1.0, 0.0)), orbHash(i + float3(1.0, 1.0, 0.0)), f.x);
    float c = mix(orbHash(i + float3(0.0, 0.0, 1.0)), orbHash(i + float3(1.0, 0.0, 1.0)), f.x);
    float d = mix(orbHash(i + float3(0.0, 1.0, 1.0)), orbHash(i + float3(1.0, 1.0, 1.0)), f.x);
    return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}

static float orbFbm(float3 p) {
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
static float orbRidge(float3 p) {
    float n = 0.72 * orbNoise3(p) + 0.28 * orbNoise3(p * 3.1 + float3(7.0, 2.0, 5.0));
    return 1.0 - abs(n * 2.0 - 1.0);
}

// The angle of v, and 0 for no vector at all. Metal's fast maths makes atan2(0, 0) NaN (GLSL gives 0),
// and one NaN times 0 still poisons everything it touches: with no finger down, the touch angle is
// atan2(0, 0), and that blanked the whole inside of the orb on the iPhone while the browser was fine.
static float orbAngle(float2 v) {
    return dot(v, v) < 1e-12 ? 0.0 : atan2(v.y, v.x);
}

static float orbWrap(float a) {
    return a - FZ_TAU * floor((a + 3.14159265) / FZ_TAU);
}

static float3 orbTurnY(float3 v, float a) {
    float c = cos(a);
    float s = sin(a);
    return float3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
}

static float3 orbTone(float3 c) {
    return float3(1.0) - exp(-c * 1.2);
}

// How far a tendril has bent (radians) at radius r: a slow sway, kinks, and fine electric jitter.
static float orbBend(float r, float t, float fi) {
    return (orbNoise1(r * 2.4 - t * 0.85 + fi * 7.1) - 0.5) * 1.5 * r
         + (orbNoise1(r * 8.5 - t * 2.9 + fi * 3.7) - 0.5) * 0.46 * r
         + (orbNoise1(r * 24.0 - t * 7.5 + fi * 1.9) - 0.5) * 0.13 * r
         + (orbNoise1(r * 60.0 - t * 15.0 + fi * 4.3) - 0.5) * 0.035 * r;
}

// p: centred, 1 = half the view's shorter side, y down. t: seconds. e: energy 0...1.
// aa: one point in p units (for a smooth edge). touch: where a finger is (p units) and 1 while it's
// down, 0 otherwise. Returns a premultiplied colour.
static float4 fzOrb(float2 p, float t, float e, float aa, float3 touch) {
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
// END SHARED

/// touch: the finger relative to the centre (points) and 1 while it's down.
[[ stitchable ]] half4 focusOrb(float2 position, half4 color, float2 size, float time, float energy, float3 touch) {
    float side = min(size.x, size.y);
    float2 p = (position - size * 0.5) / (side * 0.5);
    float3 t = float3(touch.xy / (side * 0.5), touch.z);
    return half4(fzOrb(p, time, clamp(energy, 0.0, 1.0), 1.5 / side, t));
}
