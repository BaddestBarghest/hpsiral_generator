#version 300 es
precision highp float;

out vec4 outColor;

uniform vec2 uResolution;
uniform int uPass;            // 0 = afterimage feedback (into history), 1 = final output (to screen)
uniform sampler2D uSource;    // pass 0: the new scene; pass 1: the image to present
uniform sampler2D uHistory;   // pass 0: the previous afterimage
uniform float uTrailMix;      // pass 0: weight of the previous afterimage (0 = none)
uniform float uVignette;      // pass 1: 0..1 strength
uniform float uVignetteSize;  // pass 1: radius where the vignette is halfway (short screen half = 1)
uniform vec3 uVignetteColor;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 col = texture(uSource, uv).rgb;

  if (uPass == 0) {
    // Afterimage: echo of previous frames fading out over time.
    outColor = vec4(mix(col, texture(uHistory, uv).rgb, uTrailMix), 1.0);
    return;
  }

  if (uVignette > 0.0) {
    float minRes = min(uResolution.x, uResolution.y);
    float d = length((gl_FragCoord.xy - 0.5 * uResolution) / (0.5 * minRes));
    float amount = uVignette * smoothstep(uVignetteSize * 0.55, uVignetteSize * 1.15, d);
    col = mix(col, uVignetteColor, amount);
  }

  // ±0.5 LSB dither (see scene shader); applied here when post-processing is active.
  float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  col += (n - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}
