// The world around the focus orb, as SwiftUI layer effects:
// - `orbWorld` on the pedestal photo: the orb's light falling on the scene (stronger on the pedestal's
//   top, weak on its sides, a contact shadow at its foot), the ring's light spreading over the metal,
//   the orb mirrored in the polished top, fog drifting on the ground and glowing where the light
//   reaches it, the whole world colder and darker while it's "asleep", and a depth-based shift of the
//   photo for parallax (tilt the phone and near ground moves more than far rocks).
// - Pulling Today down pushes the camera in: each point of the photo grows by how near it is, so the
//   pedestal and the ground around it grow while the far rocks and the sky barely move.
// - `rockLight` on each floating rock: a mint rim on the edge that faces the orb.
//
// The world itself (`fzWorld`, the depth, the push, the fades) is in OrbShared.h, shared with the
// stage's Metal pass (StageView.metal) and the browser preview. These SwiftUI versions are the
// fallback when that pass can't start, and the onboarding's wide shot.
#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

#include "OrbShared.h"

/// The pedestal photo. Positions are the photo view's own points.
/// origin: the photo's top-left in stage points. pxScale: points per photo pixel. camera: the
/// parallax shift (points) for something at depth 1. state: time, energy, awake, flash.
/// orb: x, y, radius, the stage's scale k. ring: x, y, radii (stage points, already shifted with
/// the pedestal). topInfo: the top's radii, the foot's y, the horizon's y (stage points).
/// depthPx and pedPx: see fzWorldDepth. on: how much orb there is to give light, how far the ring is lit.
/// push: pulling Today down (see fzUnpush; x, y in the photo view's points). Everything else is
/// worked out where the point was before the push, so the light stays on the things it lights.
/// fade: see fzPhotoFade.
[[ stitchable ]] half4 orbWorld(float2 position, SwiftUI::Layer layer, float2 origin, float pxScale, float2 camera,
                                float4 state, float4 orb, float4 ring, float4 topInfo, float4 depthPx, float4 pedPx, float2 on,
                                float4 push, float4 fade) {
    float m = fzPhotoFade(position, fade, pedPx.xy * pxScale);
    if (m < 0.002) {
        return half4(0.0);
    }
    float2 src = fzUnpush(position, push, pxScale, depthPx, pedPx);
    float depth = fzWorldDepth(src / pxScale, depthPx, pedPx);
    half4 c = layer.sample(src - camera * depth);
    float a = float(c.a);
    if (a < 0.002) {
        return half4(0.0);
    }
    float3 photo = float3(c.rgb) / a;
    float3 col = fzWorld(photo, origin + src, state.x, state.y, state.z, state.w, on.x, on.y,
                         orb.xy, orb.z, ring.xy, ring.zw, topInfo.xy, topInfo.z, topInfo.w, orb.w);
    return half4(half3(col * a * m), half(a * m));
}

/// The wide shot as the camera flies in: everything grows from the pedestal by its own distance, so
/// the near ground rushes past while the far rocks barely move, with a little motion blur.
/// pxScale: points per wide-photo pixel. anchorPx: the pedestal's ring in the photo. anchorNow: where
/// it is now, in the view's points. travel: how far the camera has moved (the pedestal is 1 away).
/// blur: how fast it's moving.
[[ stitchable ]] half4 wideFly(float2 position, SwiftUI::Layer layer, float pxScale, float2 anchorPx, float2 anchorNow,
                               float travel, float4 depthPx, float4 pedPx, float blur) {
    float2 rel = (position - anchorNow) / pxScale;
    // Where on the photo this point came from: guess the pedestal's distance, then refine.
    float2 p = anchorPx + rel * (1.0 - travel);
    for (int i = 0; i < 4; i++) {
        p = anchorPx + rel / fzWideZoom(fzWideDistance(p, depthPx, pedPx), travel);
    }
    float2 away = p - anchorPx;
    half4 c = half4(0.0);
    for (int k = 0; k < 8; k++) {
        c += layer.sample((anchorPx + away * (1.0 - blur * 0.0016 * float(k))) * pxScale);
    }
    return c * 0.125h;
}

/// A floating rock: a mint rim on the edge that faces the orb (`toLight`, a unit vector in the rock's
/// own unrotated points), `light` 0...1 how much of the orb's light reaches it, `dim` how dark the
/// world is around it, `blur` how out of focus it is (points; done here, not as a SwiftUI blur,
/// which would be another pass every frame).
[[ stitchable ]] half4 rockLight(float2 position, SwiftUI::Layer layer, float2 toLight, float light, float dim, float blur) {
    half4 c = layer.sample(position);
    if (blur > 0.05) {
        // Thirteen taps: the middle, and two rings of six.
        half4 sum = c * 2.0h;
        for (int i = 0; i < 6; i++) {
            float a = float(i) * 1.0471976;
            float2 d = float2(cos(a), sin(a)) * blur;
            sum += layer.sample(position + d * 0.5) + layer.sample(position + d) * 0.75h;
        }
        c = sum / 12.5h;
    }
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
