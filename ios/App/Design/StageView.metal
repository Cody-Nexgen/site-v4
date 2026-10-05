// The heavy part of the orb's stage in one Metal pass (StageMetalView.swift): the pedestal photo lit
// by the orb (`fzWorld`), the rocks lit from the orb's side, the world upside down in the glass, and
// the orb itself (`fzOrb`). It draws at 2x into a see-through view; SwiftUI draws the light vector
// parts over it (the shaft, the ring's glow, the lightning, dust) and the sky under it.
//
// As SwiftUI shader effects these were a dozen passes a frame (each effect rasterises its view
// first); here they're one. The maths is the same code as before: OrbShared.h.
#include <metal_stdlib>
using namespace metal;

#include "OrbShared.h"

/// Matches `StageUniforms` in StageMetalView.swift. Every field is a float4, so the two can't drift.
struct StageUniforms {
    float4 view;     // drawable width, height (pixels), pixels per point, time (seconds, wrapped)
    float4 photo;    // the photo's top-left x, y (stage points), points per photo pixel, its opacity
    float4 fade;     // the photo's width, height (points), side fade (0/1), reveal radius (points)
    float4 camera;   // parallax shift x, y (points) for depth 1, how many rocks, unused
    float4 state;    // energy, awake, flash, how much orb there is to give light
    float4 orb;      // the orb's centre x, y, its sphere's radius (points), the stage's scale k
    float4 ring;     // the ring's centre x, y and radii (points, shifted with the pedestal)
    float4 top;      // the top's radii (points), the foot's y, the horizon's y
    float4 depthPx;  // horizon, bottom, foot (photo pixels), unused
    float4 pedPx;    // the ring's centre and the top's radii (photo pixels)
    float4 push;     // grows from x, y (points), how much, the pedestal's nearness
    float4 orbView;  // the orb's canvas (points), how formed it is, how far the ring is lit, unused
    float4 touch;    // a finger, from the orb's centre (points), 1 while it's down, unused
    float4 glass;    // the world in the glass: opacity, saturation, unused, unused
};

struct StageOut { float4 position [[position]]; };

vertex StageOut fzStageVertex(uint vid [[vertex_id]]) {
    float2 p = float2(float((vid << 1) & 2), float(vid & 2));
    StageOut o;
    o.position = float4(p * 2.0 - 1.0, 0.0, 1.0);
    return o;
}

/// `over` on top of `under`, both premultiplied.
static inline float4 fzOver(float4 over, float4 under) {
    return over + under * (1.0 - over.a);
}

/// One floating rock at p (stage points), premultiplied. a: its centre x, y and half its width and
/// height (points). b: the cos and sin of its angle, its opacity, the mip level to read (its size on
/// screen plus its blur). c: the way to the orb (a unit vector in its own frame), how much of the
/// orb's light reaches it, how dark the world is. Like `rockLight` in OrbWorld.metal: darkened to the
/// ground's tone, a little mint where the light falls, and a mint rim on the edge facing the orb.
static inline float4 fzRock(float2 p, float4 a, float4 b, float4 c, texture2d<half> tex, sampler s) {
    float2 d = p - a.xy;
    // Into its own unrotated frame.
    float2 own = float2(d.x * b.x + d.y * b.y, -d.x * b.y + d.y * b.x);
    float2 uv = own / (a.zw * 2.0) + 0.5;
    if (b.z < 0.002 || uv.x < -0.02 || uv.y < -0.02 || uv.x > 1.02 || uv.y > 1.02) {
        return float4(0.0);
    }
    float4 col = float4(tex.sample(s, uv, level(b.w)));
    float alpha = col.a;
    if (alpha < 0.01) {
        return float4(0.0);
    }
    float2 toward = c.xy / (a.zw * 2.0);
    float near = float(tex.sample(s, uv + toward * 2.0, level(b.w)).a);
    float far = float(tex.sample(s, uv + toward * 6.0, level(b.w)).a);
    float rim = max(clamp(alpha - near, 0.0, 1.0), clamp(alpha - far, 0.0, 1.0) * 0.55);
    float3 mint = float3(0.70, 0.96, 0.82);
    float3 rgb = col.rgb * alpha * c.w * 0.62 * (float3(1.0) + mint * c.z * 0.8) + mint * rim * c.z * alpha;
    return float4(rgb, alpha) * b.z;
}

/// The rocks behind the orb (front 0) or in front of it (front 1). Each takes four float4s: the three
/// fzRock wants, then whether it's in front and which texture it is.
static inline float4 fzRocks(float4 col, float2 p, constant float4* rocks, int count, float front, sampler s,
                             texture2d<half> t0, texture2d<half> t1, texture2d<half> t2,
                             texture2d<half> t3, texture2d<half> t4, texture2d<half> t5) {
    for (int i = 0; i < count; i++) {
        float4 a = rocks[i * 4];
        float4 b = rocks[i * 4 + 1];
        float4 c = rocks[i * 4 + 2];
        float4 e = rocks[i * 4 + 3];
        if (e.x != front) {
            continue;
        }
        float4 r;
        switch (int(e.y)) {
            case 0: r = fzRock(p, a, b, c, t0, s); break;
            case 1: r = fzRock(p, a, b, c, t1, s); break;
            case 2: r = fzRock(p, a, b, c, t2, s); break;
            case 3: r = fzRock(p, a, b, c, t3, s); break;
            case 4: r = fzRock(p, a, b, c, t4, s); break;
            default: r = fzRock(p, a, b, c, t5, s); break;
        }
        col = fzOver(r, col);
    }
    return col;
}

fragment half4 fzStageFragment(StageOut in [[stage_in]],
                               constant StageUniforms& u [[buffer(0)]],
                               constant float4* rocks [[buffer(1)]],
                               texture2d<half> photo [[texture(0)]],
                               texture2d<half> rock0 [[texture(1)]],
                               texture2d<half> rock1 [[texture(2)]],
                               texture2d<half> rock2 [[texture(3)]],
                               texture2d<half> rock3 [[texture(4)]],
                               texture2d<half> rock4 [[texture(5)]],
                               texture2d<half> rock5 [[texture(6)]]) {
    constexpr sampler s(address::clamp_to_zero, filter::linear, mip_filter::linear);
    float2 p = in.position.xy / u.view.z;
    float t = u.view.w;
    int count = int(u.camera.z);
    float4 col = float4(0.0);

    // The photo, lit by the orb, pushed in when Today is pulled down, faded at its edges.
    float2 origin = u.photo.xy;
    float pxScale = u.photo.z;
    float2 local = p - origin;
    float m = fzPhotoFade(local, u.fade, u.pedPx.xy * pxScale) * u.photo.w;
    if (m > 0.002) {
        float2 src = fzUnpush(local, float4(u.push.xy - origin, u.push.zw), pxScale, u.depthPx, u.pedPx);
        float depth = fzWorldDepth(src / pxScale, u.depthPx, u.pedPx);
        // The mip level for its size on screen (it's shown a little smaller than its pixels).
        float lod = log2(max(1.0, 1.0 / (pxScale * u.view.z)));
        float4 c = float4(photo.sample(s, (src - u.camera.xy * depth) / u.fade.xy, level(lod)));
        if (c.a > 0.002) {
            float3 lit = fzWorld(c.rgb / c.a, origin + src, t, u.state.x, u.state.y, u.state.z, u.state.w, u.orbView.z,
                                 u.orb.xy, u.orb.z, u.ring.xy, u.ring.zw, u.top.xy, u.top.z, u.top.w, u.orb.w);
            col = float4(lit * c.a, c.a) * m;
        }
    }

    col = fzRocks(col, p, rocks, count, 0.0, s, rock0, rock1, rock2, rock3, rock4, rock5);

    // The glass and the orb, at the pedestal's depth: undo the push for them first.
    float formed = u.orbView.y;
    if (formed > 0.001) {
        float2 q = u.push.xy + (p - u.push.xy) / (1.0 + u.push.z);
        float shrink = 0.12 + 0.88 * formed;
        float2 d = (q - u.orb.xy) / shrink;
        float ball = u.orb.z;
        float r = length(d);
        if (formed > 0.05 && r < ball + 1.0) {
            // The world behind it, upside down and squeezed, like a crystal ball (the plain photo).
            float2 w = u.orb.xy - 2.0 * d;
            float4 seen = float4(photo.sample(s, (w - origin) / u.fade.xy, level(1.0)));
            float3 g = mix(float3(dot(seen.rgb, FZ_LUMA)), seen.rgb, float3(u.glass.y)) * float3(0.78, 0.96, 0.86);
            float a = min(1.0, formed * 2.0) * u.glass.x * seen.a * (1.0 - smoothstep(ball - 1.0, ball, r));
            col = fzOver(float4(g * a, a), col);
        }
        float side = u.orbView.x;
        float2 op = d / (side * 0.5);
        if (abs(op.x) < 1.0 && abs(op.y) < 1.0) {
            float3 finger = float3(u.touch.xy / (side * 0.5), u.touch.z);
            float4 o = fzOrb(op, t, clamp(u.state.x, 0.0, 1.0), 1.5 / (side * shrink), finger);
            col = fzOver(o * min(1.0, formed * 2.5), col);
        }
    }

    col = fzRocks(col, p, rocks, count, 1.0, s, rock0, rock1, rock2, rock3, rock4, rock5);
    return half4(col);
}
