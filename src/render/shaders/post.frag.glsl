#version 300 es
// Variant switch (defined by the renderer): PASS = 0 spiral afterimage (into history),
// 1 final output (to screen; TEXT_MODE: see finish.glsl), 2 text afterimage (premultiplied, into the text history).
precision highp float;

out vec4 outColor;

uniform vec2 uResolution;
uniform sampler2D uSource;    // pass 0: the new scene; pass 1: the spiral image to present
uniform sampler2D uHistory;   // pass 0/2: the previous afterimage
uniform float uTrailMix;      // pass 0/2: weight of the previous afterimage (0 = none)

#include "finish.glsl"

// 8-bit feedback can stall: once a step rounds to nothing, a faint ghost stays forever.
// Moving at least one level per frame guarantees every echo fades out completely.
const float LSB = 1.0 / 255.0;

void main() {
  // Every target matches the screen size, so each pixel reads exactly its own texel.
  ivec2 px = ivec2(gl_FragCoord.xy);

#if PASS == 0
  // Afterimage: echo of previous frames fading out over time.
  vec3 col = texelFetch(uSource, px, 0).rgb;
  vec3 d = (texelFetch(uHistory, px, 0).rgb - col) * uTrailMix;
  outColor = vec4(col + sign(d) * max(abs(d) - LSB, 0.0), 1.0);
#elif PASS == 2
  // Text afterimage: the current text over its fading echoes.
  vec4 t = placedText(gl_FragCoord.xy);
  vec4 prev = max(texelFetch(uHistory, px, 0) * uTrailMix - LSB, 0.0);
  outColor = t + prev * (1.0 - t.a);
#else
  outColor = vec4(finish(texelFetch(uSource, px, 0).rgb), 1.0);
#endif
}
