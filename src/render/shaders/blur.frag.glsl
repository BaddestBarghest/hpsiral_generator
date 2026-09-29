#version 300 es
precision highp float;

// Glow blur at reduced resolution. DOWNSAMPLE = 1: average each 4x4 block of the full-size
// image (4 bilinear taps of 2x2 each), so thin stripes don't alias into blotches.
// DOWNSAMPLE = 0: one direction of a separable Gaussian blur.

out vec4 outColor;

uniform vec2 uResolution;   // size of the target being drawn
uniform sampler2D uSource;
uniform vec2 uStep;         // blur: distance between taps; downsample: one source texel (uv)

// 9 taps, Gaussian weights (sigma = 2 taps), normalised.
const float W[5] = float[5](0.20236, 0.17917, 0.12384, 0.06659, 0.02783);

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
#if DOWNSAMPLE
  vec3 sum = textureLod(uSource, uv + uStep * vec2(-1.0, -1.0), 0.0).rgb
           + textureLod(uSource, uv + uStep * vec2( 1.0, -1.0), 0.0).rgb
           + textureLod(uSource, uv + uStep * vec2(-1.0,  1.0), 0.0).rgb
           + textureLod(uSource, uv + uStep * vec2( 1.0,  1.0), 0.0).rgb;
  outColor = vec4(sum * 0.25, 1.0);
#else
  vec3 sum = textureLod(uSource, uv, 0.0).rgb * W[0];
  for (int i = 1; i < 5; i++) {
    vec2 o = uStep * float(i);
    sum += (textureLod(uSource, uv + o, 0.0).rgb + textureLod(uSource, uv - o, 0.0).rgb) * W[i];
  }
  outColor = vec4(sum, 1.0);
#endif
}
