// Your focus orb, drawn on the GPU: a dark glass sphere holding live electricity. Lightning tendrils
// leave a white-hot core, fork, and strike the inside of the glass; faint veins crackle over the
// shell; a slow plasma haze turns inside; the rim catches the light. `energy` (0...1) is how charged
// it is: more tendrils, brighter strikes, a stronger glow. Touch it and, like a plasma globe, the
// tendrils bend to your finger and the glass glows under it.
//
// Used by FocusOrb.swift as a SwiftUI colour effect (Coach, the fallback stage). The orb itself
// (`fzOrb`) is in OrbShared.h, shared with the stage's Metal pass and the browser preview.
#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

#include "OrbShared.h"

/// touch: the finger relative to the centre (points) and 1 while it's down.
[[ stitchable ]] half4 focusOrb(float2 position, half4 color, float2 size, float time, float energy, float3 touch) {
    float side = min(size.x, size.y);
    float2 p = (position - size * 0.5) / (side * 0.5);
    float3 t = float3(touch.xy / (side * 0.5), touch.z);
    return half4(fzOrb(p, time, clamp(energy, 0.0, 1.0), 1.5 / side, t));
}
