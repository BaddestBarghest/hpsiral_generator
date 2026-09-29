#version 300 es
precision highp float;

out vec4 outColor;

uniform vec2 uResolution;
// 0 = spiral afterimage (into history), 1 = final output (to screen),
// 2 = text afterimage (premultiplied, into the text history)
uniform int uPass;
uniform sampler2D uSource;    // pass 0: the new scene; pass 1: the spiral image to present
uniform sampler2D uHistory;   // pass 0/2: the previous afterimage
uniform float uTrailMix;      // pass 0/2: weight of the previous afterimage (0 = none)
uniform float uVignette;      // pass 1: 0..1 strength
uniform float uVignetteSize;  // pass 1: radius where the vignette is halfway (short screen half = 1)
uniform vec3 uVignetteColor;

// Text: pass 2 draws the text texture into the text layer; pass 1 lays that layer on top.
uniform sampler2D uText;      // pass 2: premultiplied text texture; pass 1: the text layer
uniform bool uTextOn;         // pass 1: whether there is a text layer
uniform float uTextAlpha;     // pass 2
uniform float uTextScale;     // pass 2: zoom about the anchor
uniform vec2 uTextAnchor;     // pass 2: screen point the text is zoomed about (pixels, y up)
uniform vec2 uTextOrigin;     // pass 2: point of the text texture drawn at the anchor

// Pass 1: beat pulses and the text flash, over everything (text included).
uniform float uInvert;
uniform float uFlash;
uniform vec3 uFlashColor;
uniform float uTextFlash;
uniform vec3 uTextFlashColor;

// 8-bit feedback can stall: once a step rounds to nothing, a faint ghost stays forever.
// Moving at least one level per frame guarantees every echo fades out completely.
const float LSB = 1.0 / 255.0;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  if (uPass == 0) {
    // Afterimage: echo of previous frames fading out over time.
    vec3 col = texture(uSource, uv).rgb;
    vec3 d = (texture(uHistory, uv).rgb - col) * uTrailMix;
    outColor = vec4(col + sign(d) * max(abs(d) - LSB, 0.0), 1.0);
    return;
  }

  if (uPass == 2) {
    vec2 src = (gl_FragCoord.xy - uTextAnchor) / uTextScale + uTextOrigin;
    vec2 tuv = vec2(src.x / uResolution.x, 1.0 - src.y / uResolution.y);
    vec4 t = vec4(0.0);
    if (all(greaterThanEqual(tuv, vec2(0.0))) && all(lessThanEqual(tuv, vec2(1.0)))) {
      t = texture(uText, tuv) * uTextAlpha;
    }
    vec4 prev = max(texture(uHistory, uv) * uTrailMix - LSB, 0.0);
    outColor = t + prev * (1.0 - t.a);
    return;
  }

  vec3 col = texture(uSource, uv).rgb;
  if (uVignette > 0.0) {
    float minRes = min(uResolution.x, uResolution.y);
    float d = length((gl_FragCoord.xy - 0.5 * uResolution) / (0.5 * minRes));
    float amount = uVignette * smoothstep(uVignetteSize * 0.55, uVignetteSize * 1.15, d);
    col = mix(col, uVignetteColor, amount);
  }

  // Text sits above the vignette so it stays readable at the edges.
  if (uTextOn) {
    vec4 t = texture(uText, uv); // premultiplied
    col = col * (1.0 - t.a) + t.rgb;
  }

  col = mix(col, 1.0 - col, uInvert);
  col = mix(col, uFlashColor, uFlash);
  col = mix(col, uTextFlashColor, uTextFlash);

  // ±0.5 LSB dither (see scene shader); applied here when post-processing is active.
  float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  col += (n - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}
