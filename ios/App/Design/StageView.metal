// The orb's whole stage in one Metal pass (StageMetalView.swift): the sky above the photo and its
// stars, the pedestal photo lit by the orb (`fzWorld`), the shaft of light, the ring's glow, the rocks
// lit from the orb's side, dust, the lightning, the world upside down in the glass, and the orb itself
// (`fzOrb`). It draws at 2x into a see-through view and runs its own 60 fps loop.
//
// As SwiftUI views and shader effects these were dozens of passes and a view rebuild a frame; here
// they're one. The maths is the same code as before: OrbShared.h.
#include <metal_stdlib>
using namespace metal;

#include "OrbShared.h"

/// Matches `StageUniforms` in StageMetalView.swift. Every field is a float4, so the two can't drift.
struct StageUniforms {
    float4 view;     // drawable width, height (pixels), pixels per point, time (seconds, wrapped)
    float4 photo;    // the photo's top-left x, y (stage points), points per photo pixel, its opacity
    float4 fade;     // the photo's width, height (points), side fade (0/1), reveal radius (points)
    float4 camera;   // parallax shift x, y (points) for depth 1, unused, unused
    float4 state;    // energy, awake, flash, how much orb there is to give light
    float4 orb;      // the orb's centre x, y, its sphere's radius (points), the stage's scale k
    float4 ring;     // the ring's centre x, y and radii (points, shifted with the pedestal)
    float4 top;      // the top's radii (points), the foot's y, the horizon's y
    float4 depthPx;  // horizon, bottom, foot (photo pixels), unused
    float4 pedPx;    // the ring's centre and the top's radii (photo pixels)
    float4 push;     // grows from x, y (points), how much, the pedestal's nearness
    float4 orbView;  // the orb's canvas (points), how formed it is, how far the ring is lit, the stage's width
    float4 touch;    // a finger, from the orb's centre (points), 1 while it's down, unused
    float4 glass;    // the world in the glass: opacity, saturation, unused, unused
    float4 sky;      // the stage photo's frame: left, width, top (points); how much sky and stars there is
    float4 shaft;    // the shaft of light: how bright, its parallax x, y (points), unused
    float4 glow;     // the ring: how far lit, how bright, the strike's flash, unused
    float4 counts;   // how many rocks, dust specks, bolt segments, glow spots are in `items`
    float4 boltBox;  // where the lightning and its glow spots are: min x, y, max x, y (points)
    float4 dustBox;  // where the dust is: top y, bottom y (points), unused, unused
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

/// Dust drifting up through the light: each speck is x, y, its size, and its alpha (negative when
/// it's out of focus: a soft disc instead of a dot). Returns how much white to add.
static inline float fzDust(float2 q, constant float4* specks, int count, float px) {
    float light = 0.0;
    for (int i = 0; i < count; i++) {
        float4 s = specks[i];
        float d = length(q - s.xy);
        if (d > s.z + px) {
            continue;
        }
        light += s.w < 0.0 ? -s.w * 0.7 * max(0.0, 1.0 - d / s.z) : s.w * fzCover(d, s.z * 0.5, px);
    }
    return min(light, 1.0);
}

/// The lightning: bolt segments (two float4s each: the ends, then strength, width, whether it's a
/// fork), then soft glow spots (x, y, radius, negative when it's squashed onto the ring's plane, and
/// alpha). Each bolt is a wide faint mint glow, a narrower brighter one and a white core; forks are a
/// thin white line. Returns premultiplied light, to add.
static inline float4 fzLightning(float2 q, constant float4* segments, int count, constant float4* spots, int spotCount,
                                 float k, float px) {
    float3 mint = float3(0.651, 0.902, 0.749);
    float wide = 0.0, mid = 0.0, core = 0.0, fork = 0.0;
    for (int i = 0; i < count; i++) {
        float4 ends = segments[i * 2];
        float4 look = segments[i * 2 + 1];
        float d = fzSegment(q, ends.xy, ends.zw);
        if (look.z > 0.5) {
            fork = max(fork, min(1.0, 0.6 * look.x) * fzCover(d, 0.4 * k, px));
            continue;
        }
        float glowWidth = (3.0 + 2.0 * (look.y - 1.0)) * k;
        if (d > glowWidth * 1.5 + px) {
            continue;
        }
        wide = max(wide, min(1.0, 0.12 * look.x) * fzCover(d, glowWidth * 1.5, px));
        mid = max(mid, min(1.0, 0.3 * look.x) * fzCover(d, glowWidth * 0.7, px));
        core = max(core, min(1.0, 0.95 * look.x) * fzCover(d, look.y * k * 0.5, px));
    }
    float4 col = float4(mint * wide, wide);
    col = fzOver(float4(mint * mid, mid), col);
    col = fzOver(float4(core), col);
    col = fzOver(float4(fork), col);
    for (int i = 0; i < spotCount; i++) {
        float4 s = spots[i];
        float2 d = q - s.xy;
        if (s.z < 0.0) {
            d.y *= 2.0;
        }
        float a = s.w * max(0.0, 1.0 - length(d) / abs(s.z));
        col = fzOver(float4(mint * a, a), col);
    }
    return col;
}

fragment half4 fzStageFragment(StageOut in [[stage_in]],
                               constant StageUniforms& u [[buffer(0)]],
                               constant float4* items [[buffer(1)]],
                               texture2d<half> photo [[texture(0)]],
                               texture2d<half> rock0 [[texture(1)]],
                               texture2d<half> rock1 [[texture(2)]],
                               texture2d<half> rock2 [[texture(3)]],
                               texture2d<half> rock3 [[texture(4)]],
                               texture2d<half> rock4 [[texture(5)]],
                               texture2d<half> rock5 [[texture(6)]]) {
    constexpr sampler s(address::clamp_to_zero, filter::linear, mip_filter::linear);
    constexpr sampler edge(address::clamp_to_edge, filter::linear, mip_filter::linear);
    float2 p = in.position.xy / u.view.z;
    float px = 1.0 / u.view.z;
    float t = u.view.w;
    float k = u.orb.w;
    int rockCount = int(u.counts.x);
    int dustCount = int(u.counts.y);
    int segmentCount = int(u.counts.z);
    int spotCount = int(u.counts.w);
    constant float4* dust = items + rockCount * 4;
    constant float4* segments = dust + dustCount;
    constant float4* spots = segments + segmentCount * 2;
    float awake = u.state.y;
    float2 origin = u.photo.xy;
    float pxScale = u.photo.z;
    float2 local = p - origin;
    // Everything at the pedestal's depth grows with the push from the middle of its top: undo it.
    float2 q = u.push.xy + (p - u.push.xy) / (1.0 + u.push.z);
    float4 col = float4(0.0);

    // The sky above the photo: its top edge carried on up the screen, darker going up, graded like the
    // photo. It reaches under the photo's own fade at its top.
    float skyOn = u.sky.w;
    float photoTop = u.sky.z;
    if (skyOn > 0.002 && p.y < photoTop + u.fade.y * 0.05) {
        float sx = (p.x - u.camera.x * 0.06 - u.sky.x) / u.sky.y;
        float3 c = float3(photo.sample(edge, float2(sx, 0.012), level(5.0)).rgb);
        float reach = max(photoTop, 0.0) + 420.0;
        float v = clamp((p.y - u.camera.y * 0.06 - (photoTop - reach)) / reach, 0.0, 1.0);
        c *= 0.5 + 0.5 * v;
        c = mix(float3(dot(c, FZ_LUMA)), c, float3(0.5 + 0.5 * awake)) * (0.62 + 0.38 * awake);
        // As wide as the photo, with its side fade on iPad.
        float sides = clamp(sx / 0.14, 0.0, 1.0) * clamp((1.0 - sx) / 0.14, 0.0, 1.0);
        float a = skyOn * mix(step(0.0, sx) * step(sx, 1.0), sides, u.fade.z);
        col = float4(c, 1.0) * a;
    }

    // The photo, lit by the orb, pushed in when Today is pulled down, faded at its edges.
    float m = fzPhotoFade(local, u.fade, u.pedPx.xy * pxScale) * u.photo.w;
    if (m > 0.002) {
        float2 src = fzUnpush(local, float4(u.push.xy - origin, u.push.zw), pxScale, u.depthPx, u.pedPx);
        float depth = fzWorldDepth(src / pxScale, u.depthPx, u.pedPx);
        // The mip level for its size on screen (it's shown a little smaller than its pixels).
        float lod = log2(max(1.0, 1.0 / (pxScale * u.view.z)));
        float4 c = float4(photo.sample(s, (src - u.camera.xy * depth) / u.fade.xy, level(lod)));
        if (c.a > 0.002) {
            float3 lit = fzWorld(c.rgb / c.a, origin + src, t, u.state.x, awake, u.state.z, u.state.w, u.orbView.z,
                                 u.orb.xy, u.orb.z, u.ring.xy, u.ring.zw, u.top.xy, u.top.z, u.top.w, k);
            col = fzOver(float4(lit * c.a, c.a) * m, col);
        }
    }

    // The night sky where the photo goes black: faint stars that barely move with the camera (they're
    // far), and a soft haze where the light comes down from. Gone before the mountain tops.
    if (skyOn > 0.002) {
        float fadeEnd = photoTop + 70.0 * k;
        if (p.y < fadeEnd) {
            float2 sp = p - u.camera.xy * 0.03;
            float star = fzStars(sp, t, k, px) * (1.0 - smoothstep(photoTop - 10.0, fadeEnd, sp.y)) * (0.6 + 0.4 * awake);
            float width = u.orbView.w;
            float2 hc = float2(width * 0.5, photoTop - 160.0);
            float2 he = (p - hc) / float2(width * 0.9, 260.0);
            float haze = (0.05 + 0.05 * awake) * max(0.0, 1.0 - length(p - hc) / (width * 0.9))
                       * (1.0 - smoothstep(0.92, 1.0, length(he))) * (1.0 - smoothstep(photoTop, fadeEnd, p.y));
            col.rgb += (float3(star) + float3(0.749, 0.910, 0.824) * haze) * skyOn;
        }
    }

    // The shaft of light from above, and the ring powering on.
    if (u.shaft.x > 0.002) {
        float2 ringAtRest = u.ring.xy - u.camera.xy * u.push.w;
        col.rgb += float3(0.867, 0.961, 0.902) * fzShaft(q - u.shaft.yz, ringAtRest, u.top.x, k, px) * u.shaft.x;
    }
    if (u.glow.y > 0.002 || u.glow.z > 0.002) {
        float reach = 10.0 * k;
        float2 rd = abs(q - u.ring.xy) - u.ring.zw;
        if (rd.x < reach && rd.y < reach) {
            col.rgb += fzRingGlow(q, u.ring, u.glow.x, u.glow.y, u.glow.z, k, px).rgb;
        }
    }

    col = fzRocks(col, p, items, rockCount, 0.0, s, rock0, rock1, rock2, rock3, rock4, rock5);

    // Dust in the light, and the lightning down into the ring (and to a finger).
    if (dustCount > 0 && q.y > u.dustBox.x - px && q.y < u.dustBox.y + px) {
        col.rgb += float3(fzDust(q, dust, dustCount, px));
    }
    if (q.x > u.boltBox.x && q.y > u.boltBox.y && q.x < u.boltBox.z && q.y < u.boltBox.w) {
        col.rgb += fzLightning(q, segments, segmentCount, spots, spotCount, k, px).rgb;
    }

    // The glass and the orb.
    float formed = u.orbView.y;
    if (formed > 0.001) {
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

    col = fzRocks(col, p, items, rockCount, 1.0, s, rock0, rock1, rock2, rock3, rock4, rock5);
    // Light adds without covering (rgb above alpha is how a premultiplied layer adds).
    return half4(clamp(col, 0.0, 1.0));
}
