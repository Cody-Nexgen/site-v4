// The focus timer in 3D: a glass tube bent into a ring on a dark machined plate, tilted back like the
// pedestal's top, filling with the orb's light as you drag (FocusDial.swift). The drawing itself
// (`fzDial`) is in OrbShared.h, shared with the browser renderer (ios/Tools/render-dial.mjs).
#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

#include "OrbShared.h"

/// fill: 0 to 1 round the ring. tilt: the phone's tilt, about -1 to 1, for the light to move.
[[ stitchable ]] half4 focusDial(float2 position, half4 color, float2 size, float fill, float time, float2 tilt) {
    float side = min(size.x, size.y);
    float2 uv = (position - size * 0.5) / (side * 0.5);
    uv.y = -uv.y;
    return half4(fzDial(uv, clamp(fill, 0.0, 1.0), time, tilt, 2.0 / side));
}
