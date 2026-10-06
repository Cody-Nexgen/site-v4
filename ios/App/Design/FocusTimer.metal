// The focus timer as a thing you could hold (FocusTimer.swift): a machined block with a smoked-glass
// display and glowing segment digits in the colour wheel. The drawing (`fzDevice`) is in OrbShared.h,
// shared with the browser renderer (ios/Tools/render-device.mjs).
#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

#include "OrbShared.h"

/// value: minutes, seconds, how lit the colon is, how much the digits flash. tilt: the phone's tilt,
/// about -1 to 1. px: one pixel in points.
[[ stitchable ]] half4 focusTimer(float2 position, half4 color, float2 size, float4 value, float time, float2 tilt, float px) {
    return half4(fzDevice(position, size, value, time, tilt, px));
}
