// The world around the focus orb, as SwiftUI layer effects:
// - `orbWorld` on the pedestal photo: the orb's light falling on the scene (stronger on the pedestal's
//   top, weak on its sides, a contact shadow at its foot), the ring's light spreading over the metal,
//   the orb mirrored in the polished top, fog drifting on the ground and glowing where the light
//   reaches it, the whole world colder and darker while it's "asleep", and a depth-based shift of the
//   photo for parallax (tilt the phone and near ground moves more than far rocks).
// - `rockLight` on each floating rock: a mint rim on the edge that faces the orb.
//
// Everything between BEGIN SHARED and END SHARED keeps to the subset Metal and GLSL share, like
// FocusOrb.metal, so it can be rendered in a browser to check it (docs/ios-focus-orb.md).
#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

// BEGIN SHARED
#define FZ_LUMA float3(0.299, 0.587, 0.114)

static float wHash(float3 p) {
    p = fract(p * 0.3183099 + float3(0.1, 0.17, 0.13));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

static float wNoise(float3 x) {
    float3 i = floor(x);
    float3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float a = mix(wHash(i), wHash(i + float3(1.0, 0.0, 0.0)), f.x);
    float b = mix(wHash(i + float3(0.0, 1.0, 0.0)), wHash(i + float3(1.0, 1.0, 0.0)), f.x);
    float c = mix(wHash(i + float3(0.0, 0.0, 1.0)), wHash(i + float3(1.0, 0.0, 1.0)), f.x);
    float d = mix(wHash(i + float3(0.0, 1.0, 1.0)), wHash(i + float3(1.0, 1.0, 1.0)), f.x);
    return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}

static float wFbm(float3 p) {
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
static float fzWorldDepth(float2 ip, float4 depthPx, float4 pedPx) {
    float ground = 0.06 + 0.94 * smoothstep(depthPx.x, depthPx.y, ip.y);
    float footDepth = 0.06 + 0.94 * smoothstep(depthPx.x, depthPx.y, depthPx.z);
    float2 q = (ip - pedPx.xy) / pedPx.zw;
    float top = 1.0 - smoothstep(0.95, 1.08, length(q));
    float body = (1.0 - smoothstep(pedPx.z * 1.05, pedPx.z * 1.15, abs(ip.x - pedPx.x)))
               * smoothstep(pedPx.y - 4.0, pedPx.y + 4.0, ip.y)
               * (1.0 - smoothstep(depthPx.z, depthPx.z + 18.0, ip.y));
    return mix(ground, footDepth, max(top, body));
}

// photo: the photo's colour at p. p and every place: stage points, y down. e: the orb's energy.
// awake: how lit the world is (0 asleep). flash: a strike, 1 fading to 0. orbOn: how much of the orb
// there is to give light. ringOn: how far the pedestal's ring is lit. k: the stage's scale.
static float3 fzWorld(float3 photo, float2 p, float t, float e, float awake, float flash, float orbOn, float ringOn,
                      float2 orb, float orbR, float2 ring, float2 ringR, float2 topR, float baseY, float horizonY, float k) {
    float3 lightC = float3(0.70, 0.96, 0.82);
    float Y = dot(photo, FZ_LUMA);

    // Asleep the world is darker and colourless; it wakes as the orb charges.
    float3 base = mix(float3(Y), photo, float3(0.45 + 0.55 * awake)) * (0.45 + 0.55 * awake);

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
// END SHARED

/// The pedestal photo. Positions are the photo view's own points.
/// origin: the photo's top-left in stage points. pxScale: points per photo pixel. camera: the
/// parallax shift (points) for something at depth 1. state: time, energy, awake, flash.
/// orb: x, y, radius, the stage's scale k. ring: x, y, radii (stage points, already shifted with
/// the pedestal). topInfo: the top's radii, the foot's y, the horizon's y (stage points).
/// depthPx and pedPx: see fzWorldDepth. on: how much orb there is to give light, how far the ring is lit.
[[ stitchable ]] half4 orbWorld(float2 position, SwiftUI::Layer layer, float2 origin, float pxScale, float2 camera,
                                float4 state, float4 orb, float4 ring, float4 topInfo, float4 depthPx, float4 pedPx, float2 on) {
    float depth = fzWorldDepth(position / pxScale, depthPx, pedPx);
    half4 c = layer.sample(position - camera * depth);
    float a = float(c.a);
    if (a < 0.002) {
        return c;
    }
    float3 photo = float3(c.rgb) / a;
    float3 col = fzWorld(photo, origin + position, state.x, state.y, state.z, state.w, on.x, on.y,
                         orb.xy, orb.z, ring.xy, ring.zw, topInfo.xy, topInfo.z, topInfo.w, orb.w);
    return half4(half3(col * a), c.a);
}

/// A floating rock: a mint rim on the edge that faces the orb (`toLight`, a unit vector in the rock's
/// own unrotated points), `light` 0...1 how much of the orb's light reaches it, `dim` how dark the
/// world is around it.
[[ stitchable ]] half4 rockLight(float2 position, SwiftUI::Layer layer, float2 toLight, float light, float dim) {
    half4 c = layer.sample(position);
    float a = float(c.a);
    if (a < 0.01) {
        return c;
    }
    float near = float(layer.sample(position + toLight * 2.0).a);
    float far = float(layer.sample(position + toLight * 6.0).a);
    float rim = max(clamp(a - near, 0.0, 1.0), clamp(a - far, 0.0, 1.0) * 0.55);
    float3 mint = float3(0.70, 0.96, 0.82);
    // The rocks were shot brighter than this ground: darker, lit mostly on the rim.
    float3 col = float3(c.rgb) * dim * 0.62 * (float3(1.0) + mint * light * 0.8) + mint * rim * light * a;
    return half4(half3(col), c.a);
}
