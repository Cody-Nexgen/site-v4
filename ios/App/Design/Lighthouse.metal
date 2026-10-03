// The FocuzNow lighthouse, rendered live: a moonlit tower with a glass lantern, a beam that sweeps
// through sea fog and low cloud, a rocky headland, and an ocean that mirrors it all.
// Drawn by LighthouseView (an MTKView). Units: screen heights, y up from the bottom.
#include <metal_stdlib>
using namespace metal;

struct FZUniforms {
    float2 size;     // drawable size in pixels
    float time;      // seconds (already scaled by speed)
    float power;     // lamp brightness, 0...1.3
    float phase;     // beam angle offset
    float lx;        // lighthouse x, fraction of width
    float wl;        // waterline at the rocks, fraction of height from the bottom
    float hz;        // horizon, fraction of height from the bottom
    float sc;        // lighthouse scale (tower is 0.4 * sc tall)
    float exposure;  // overall brightness (splash flash, fades)
    float3 lamp;     // lamp colour
};

struct FZScene { float T, LX, WL, HZ, SC, PW, PH; float3 lampC; };

struct FZOut { float4 position [[position]]; };

vertex FZOut fzLighthouseVertex(uint vid [[vertex_id]]) {
    float2 p = float2(float((vid << 1) & 2), float(vid & 2));
    FZOut o;
    o.position = float4(p * 2.0 - 1.0, 0.0, 1.0);
    return o;
}

static float fzHash(float2 p) {
    p = fract(p * float2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

static float fzNoise(float2 p) {
    float2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(fzHash(i), fzHash(i + float2(1, 0)), f.x),
               mix(fzHash(i + float2(0, 1)), fzHash(i + float2(1, 1)), f.x), f.y);
}

static float fzFbm(float2 p) {
    float v = 0.0, a = 0.5;
    const float2x2 m = float2x2(float2(1.6, 1.2), float2(-1.2, 1.6));
    for (int i = 0; i < 5; i++) { v += a * fzNoise(p); p = m * p; a *= 0.5; }
    return v;
}

static float towerBase(thread const FZScene& s) { return s.WL + s.SC * 0.085; }
static float towerTop(thread const FZScene& s) { return towerBase(s) + s.SC * 0.40; }
static float halfW(thread const FZScene& s, float y) {
    float k = clamp((y - towerBase(s)) / (towerTop(s) - towerBase(s)), 0.0, 1.0);
    return mix(s.SC * 0.046, s.SC * 0.030, k);
}
static float2 lampPos(thread const FZScene& s) { return float2(s.LX, towerTop(s) + s.SC * 0.040); }

static float headland(thread const FZScene& s, float x) {
    float d = (x - s.LX) / s.SC;
    float m = 0.092 * exp(-d * d / 0.05) + 0.03 * exp(-(d + 0.35) * (d + 0.35) / 0.02);
    return s.WL + s.SC * (m + 0.018 * (fzFbm(float2(x * 28.0, 1.0)) - 0.5) * smoothstep(0.0, 0.02, m));
}

// The rotating beam: a 3D direction swept around the tower, foreshortened on screen.
static float beam(thread const FZScene& s, float2 p, thread float& flash) {
    float2 L = lampPos(s);
    float ph = s.T * 0.55 + s.PH;
    float c = cos(ph), sn = sin(ph);
    float2 d = p - L;
    float dist = length(d);
    float sd = c < 0.0 ? -1.0 : 1.0;
    float along = d.x * sd;
    float len = 0.08 + 1.4 * abs(c);
    float spread = 0.05 + 0.55 * (1.0 - abs(c));
    float perp = d.y + along * 0.025;
    float hw = s.SC * 0.016 + max(along, 0.0) * spread * 0.6;
    float crossK = exp(-perp * perp / (hw * hw));
    float fog = 0.55 + 0.9 * fzFbm(float2(p.x * 5.0 - s.T * 0.04, p.y * 9.0));
    float b = along > 0.0 ? crossK * exp(-along / len) * fog * smoothstep(0.0, s.SC * 0.02, along) : 0.0;
    b *= (0.35 + 0.65 * abs(c)) * (sn < 0.0 ? 1.0 : 0.75);
    flash = pow(max(sn, 0.0), 24.0) * exp(-dist / (s.SC * 0.35));
    return b * s.PW;
}

static float3 sky(thread const FZScene& s, float2 p, float starFade) {
    float y = p.y - s.HZ;
    float3 col = mix(float3(0.075, 0.072, 0.068), float3(0.006, 0.006, 0.008), smoothstep(0.0, 0.45, y));
    // Stars
    float2 g = p * 220.0;
    float2 id = floor(g);
    float r = fzHash(id);
    if (r > 0.985) {
        float2 o = float2(fzHash(id + 3.1), fzHash(id + 7.7)) - 0.5;
        float st = exp(-length(fract(g) - 0.5 - o * 0.6) * 14.0);
        col += float3(0.95, 0.93, 0.88) * st * (0.4 + 0.6 * fzHash(id + 1.0)) * (0.7 + 0.3 * sin(s.T * 3.0 + r * 90.0)) * smoothstep(0.02, 0.25, y) * starFade;
    }
    // Low stratus, lit by the beam
    float cl = smoothstep(0.45, 0.85, fzFbm(float2(p.x * 2.2 + s.T * 0.012, p.y * 7.0)));
    cl *= smoothstep(0.0, 0.08, y) * (1.0 - smoothstep(0.35, 0.6, y));
    col = mix(col, float3(0.035, 0.034, 0.033), cl * 0.8);
    float fl;
    float b = beam(s, p, fl);
    col += s.lampC * b * (0.45 + cl * 1.2) + s.lampC * 0.12 * b * b;
    float2 L = lampPos(s);
    float dl = length(p - L);
    col += s.lampC * (exp(-dl / (s.SC * 0.010)) * 1.6 + exp(-dl / (s.SC * 0.07)) * 0.35 * s.PW + exp(-dl / (s.SC * 0.4)) * 0.08 * s.PW);
    col += s.lampC * fl * 1.4;
    return col;
}

// Tower, gallery, lantern and dome. Alpha in w.
static float4 tower(thread const FZScene& s, float2 p) {
    float y0 = towerBase(s), y1 = towerTop(s);
    float3 warm = s.lampC;
    float3 moon = normalize(float3(-0.65, 0.25, 0.72));
    if (p.y > y0 - s.SC * 0.02 && p.y < y1) {
        float w = halfW(s, p.y);
        float u = (p.x - s.LX) / w;
        if (abs(u) < 1.0) {
            float aa = smoothstep(1.0, 0.96, abs(u));
            float3 n = float3(u, 0.0, sqrt(1.0 - u * u));
            float dif = max(dot(n, moon), 0.0);
            float k = (p.y - y0) / (y1 - y0);
            bool band = fmod(floor(k * 6.0), 2.0) == 1.0 && k < 0.86;
            float3 paint = band ? float3(0.055, 0.053, 0.05) : float3(0.86, 0.84, 0.79);
            float weather = 0.82 + 0.18 * fzFbm(float2(u * 4.0, p.y / s.SC * 90.0)) - 0.08 * smoothstep(0.6, 1.0, fzFbm(float2(u * 9.0, p.y / s.SC * 30.0)));
            float3 c = paint * weather * (0.05 + 0.62 * dif) + paint * warm * 0.10 * s.PW * smoothstep(0.6, 1.0, k);
            c += paint * 0.05 * pow(1.0 - n.z, 3.0);
            float wy = fract(k * 6.0 + 0.5);
            if (abs(u) < 0.16 && wy > 0.42 && wy < 0.62 && k > 0.1 && k < 0.8) c = float3(0.02);
            if (abs(u) < 0.16 && k > 0.28 && k < 0.31) c = warm * 0.5;
            c *= mix(0.35, 1.0, smoothstep(0.0, 0.08, k));
            return float4(c, aa);
        }
    }
    float wt = halfW(s, y1);
    float dy = p.y - y1;
    if (dy > 0.0 && dy < s.SC * 0.008 && abs(p.x - s.LX) < wt * 1.5) return float4(float3(0.04), 1.0);
    if (dy > s.SC * 0.008 && dy < s.SC * 0.030 && abs(p.x - s.LX) < wt * 1.45) {
        float u = (p.x - s.LX) / (wt * 1.45);
        float bar = smoothstep(0.82, 0.9, fract(u * 7.0));
        if (bar > 0.5 || dy > s.SC * 0.027) return float4(float3(0.03), 1.0);
    }
    float lb = y1 + s.SC * 0.008, lt = y1 + s.SC * 0.072, wl = wt * 0.86;
    if (p.y > lb && p.y < lt && abs(p.x - s.LX) < wl) {
        float u = (p.x - s.LX) / wl;
        float v = (p.y - lb) / (lt - lb);
        float mull = smoothstep(0.9, 0.97, abs(fract(u * 1.5 + 0.5) * 2.0 - 1.0));
        float frame = step(v, 0.12) + step(0.93, v);
        float core = exp(-pow(length(float2(u * 0.8, (v - 0.55) * 1.3)), 2.0) * 3.0);
        float3 glass = warm * (0.9 + 0.6 * core) * (0.25 + 0.75 * min(s.PW, 1.0));
        return float4(mix(glass, float3(0.03), clamp(mull + frame, 0.0, 1.0)), 1.0);
    }
    float hd = s.SC * 0.034;
    float v = (p.y - lt) / hd;
    if (v > 0.0 && v < 1.0) {
        float w = wl * 1.08 * sqrt(max(1.0 - v * v, 0.0));
        if (abs(p.x - s.LX) < w) {
            float u = (p.x - s.LX) / w;
            float3 n = normalize(float3(u * 0.8, v, 0.6));
            return float4(float3(0.05) + warm * 0.06 * max(dot(n, moon), 0.0), 1.0);
        }
    }
    if (length(float2(p.x - s.LX, p.y - lt - hd - s.SC * 0.006)) < s.SC * 0.007) return float4(float3(0.05), 1.0);
    if (abs(p.x - s.LX) < s.SC * 0.0015 && p.y > lt + hd && p.y < lt + hd + s.SC * 0.03) return float4(float3(0.05), 1.0);
    return float4(0.0);
}

static float4 rock(thread const FZScene& s, float2 p) {
    float top = headland(s, p.x);
    if (p.y < top && p.y > s.WL - 0.002 && top > s.WL + 0.001) {
        float depth = (top - p.y) / s.SC;
        float t = fzFbm(p * float2(70.0, 110.0));
        float3 c = float3(0.028, 0.027, 0.025) * (0.6 + 0.9 * t);
        float dl = abs(p.x - s.LX) / s.SC;
        c += s.lampC * 0.14 * s.PW * exp(-depth * 60.0) * exp(-dl * 4.0);
        c += float3(0.4) * 0.06 * smoothstep(0.55, 0.7, t) * exp(-depth * 20.0);
        return float4(c, smoothstep(0.0, 0.0015, top - p.y));
    }
    return float4(0.0);
}

static float3 above(thread const FZScene& s, float2 p, float ar) {
    float3 c = sky(s, p, 1.0);
    float ridge = s.HZ + 0.006 + 0.014 * fzFbm(float2(p.x * 6.0, 3.0)) * smoothstep(0.55 * ar, 0.0, p.x);
    if (p.y < ridge && p.y > s.HZ - 0.001) {
        c = float3(0.018, 0.018, 0.017);
        float2 id = floor(float2(p.x * 400.0, p.y * 900.0));
        if (fzHash(id) > 0.993) c += float3(1.0, 0.85, 0.6) * 0.5;
    }
    float4 r = rock(s, p); c = mix(c, r.rgb, r.a);
    float4 t = tower(s, p); c = mix(c, t.rgb, t.a);
    return c;
}

fragment half4 fzLighthouseFragment(FZOut in [[stage_in]], constant FZUniforms& u [[buffer(0)]]) {
    float2 fc = float2(in.position.x, u.size.y - in.position.y);
    float2 p = fc / u.size.y;
    float ar = u.size.x / u.size.y;
    FZScene s;
    s.T = u.time; s.LX = u.lx * ar; s.WL = u.wl; s.HZ = u.hz; s.SC = u.sc; s.PW = u.power; s.PH = u.phase; s.lampC = u.lamp;

    float3 col;
    if (p.y > s.HZ) {
        col = above(s, p, ar);
    } else {
        // Ocean: perspective waves, mirror reflections, a glitter path under the lamp.
        float z = 1.0 / max(s.HZ - p.y, 0.002);
        float2 w = float2((p.x - s.LX) * z * 0.9, z * 1.6);
        float tt = s.T * 0.35;
        float2 sc = float2(1.0, 0.6);
        float2 drift = float2(0.0, tt);
        float h0 = fzFbm(w * sc + drift);
        float hx = fzFbm((w + float2(0.05, 0.0)) * sc + drift);
        float hy = fzFbm((w + float2(0.0, 0.05)) * sc + drift);
        float2 slope = float2(hx - h0, hy - h0) * 20.0;
        float nearK = clamp((s.HZ - p.y) / s.HZ, 0.0, 1.0);
        float2 dist = slope * float2(0.004, 0.012) * (0.3 + nearK * 2.0);
        float2 m = float2(p.x, 2.0 * s.WL - p.y) + dist;
        float2 ms = float2(p.x, 2.0 * s.HZ - p.y) + dist * 1.4;
        float3 refl = sky(s, ms, 0.0);
        if (p.y < s.WL) {
            float4 r = rock(s, m); refl = mix(refl, r.rgb, r.a);
            float4 t = tower(s, m); refl = mix(refl, t.rgb, t.a);
        }
        float fres = mix(0.65, 0.18, pow(nearK, 0.6));
        col = float3(0.006, 0.007, 0.008) + refl * fres;
        float lane = exp(-pow((p.x - s.LX) / (s.SC * 0.03 + (s.HZ - p.y) * 0.22), 2.0));
        float sp = smoothstep(0.62, 0.95, fzFbm(w * float2(3.0, 2.2) + float2(tt * 1.6, -tt) + slope * 0.2));
        col += s.lampC * sp * lane * (0.25 + 0.9 * s.PW) * (1.0 - nearK * 0.6);
        float top = headland(s, p.x);
        if (top > s.WL + 0.001 && p.y < s.WL) {
            float f = exp(-(s.WL - p.y) / 0.003) * smoothstep(0.45, 0.75, fzFbm(float2(p.x * 90.0, s.T * 0.8)));
            col += float3(0.5, 0.5, 0.48) * f * 0.5;
        }
        col = mix(col, float3(0.06, 0.058, 0.055), exp(-(s.HZ - p.y) * 90.0) * 0.6);
        float4 r0 = rock(s, p); col = mix(col, r0.rgb, r0.a);
        float4 t0 = tower(s, p); col = mix(col, t0.rgb, t0.a);
    }
    // Sea mist in front
    col += float3(0.05, 0.049, 0.047) * smoothstep(0.55, 0.9, fzFbm(float2(p.x * 1.5 - s.T * 0.03, p.y * 5.0))) * exp(-abs(p.y - s.WL) * 12.0);
    // Tone map, vignette, grain
    col = 1.0 - exp(-col * 1.25 * u.exposure);
    float2 q = in.position.xy / u.size;
    col *= 0.55 + 0.45 * pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.25);
    col += (fzHash(in.position.xy + fract(s.T) * 100.0) - 0.5) * 0.025;
    col = pow(max(col, 0.0), float3(0.95, 0.97, 1.02));
    return half4(half3(col), 1.0h);
}
