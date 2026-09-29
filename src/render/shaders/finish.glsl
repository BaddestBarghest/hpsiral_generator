// Finishing steps shared by the scene shader (single-pass drawing, when no afterimage needs
// the frame kept) and the post shader's final pass: vignette, text, beat pulses, text flash
// and dither. Spliced into both shaders by the renderer; expects `uResolution`.
//
// Which text source is used is fixed per compiled variant (TEXT_MODE, see Renderer), not a
// runtime branch: some drivers (e.g. SwiftShader, Chrome's software fallback) pay for a
// texture read in a branch even when it's never taken.

#ifndef GLOW
#define GLOW 0
#endif
#if GLOW
uniform sampler2D uBloom;     // the blurred image, at reduced resolution
uniform float uGlow;          // 0..2 strength
uniform vec3 uGlowColor;      // tint (white = the stripes' own colours)
#endif

uniform float uVignette;      // 0..1 strength
uniform float uVignetteSize;  // radius where the vignette is halfway (short screen half = 1)
uniform vec3 uVignetteColor;

// TEXT_MODE: 0 = no text, 1 = the premultiplied text texture, placed and faded here,
// 2 = a prepared text layer (with its own afterimage), already placed, read 1:1.
uniform sampler2D uText;
uniform float uTextAlpha;     // mode 1 (and the post shader's text pass)
uniform float uTextScale;     // zoom about the anchor
uniform vec2 uTextAnchor;     // screen point the text is zoomed about (pixels, y up)
uniform vec2 uTextOrigin;     // point of the text texture drawn at the anchor

uniform float uInvert;        // 0..1 beat inversion
uniform float uFlash;         // 0..1 beat flash / strobe
uniform vec3 uFlashColor;
uniform float uTextFlash;     // 0..1 "flash when text appears"
uniform vec3 uTextFlashColor;
uniform bool uDither;

/** The text texture placed, zoomed and faded for this pixel (premultiplied). */
vec4 placedText(vec2 frag) {
  vec2 src = (frag - uTextAnchor) / uTextScale + uTextOrigin;
  vec2 tuv = vec2(src.x / uResolution.x, 1.0 - src.y / uResolution.y);
  if (any(lessThan(tuv, vec2(0.0))) || any(greaterThan(tuv, vec2(1.0)))) return vec4(0.0);
  return textureLod(uText, tuv, 0.0) * uTextAlpha;
}

vec3 finish(vec3 col) {
#if GLOW
  // Screen blend: light spills over dark areas without blowing out the bright ones.
  vec3 bloom = textureLod(uBloom, gl_FragCoord.xy / uResolution, 0.0).rgb * uGlowColor;
  col = 1.0 - (1.0 - col) * (1.0 - min(bloom * uGlow, 1.0));
#endif

  if (uVignette > 0.0) {
    float minRes = min(uResolution.x, uResolution.y);
    float d = length((gl_FragCoord.xy - 0.5 * uResolution) / (0.5 * minRes));
    float amount = uVignette * smoothstep(uVignetteSize * 0.55, uVignetteSize * 1.15, d);
    col = mix(col, uVignetteColor, amount);
  }

  // Text sits above the vignette so it stays readable at the edges.
#if TEXT_MODE == 1
  vec4 t = placedText(gl_FragCoord.xy);
  col = col * (1.0 - t.a) + t.rgb;
#elif TEXT_MODE == 2
  vec4 t = texelFetch(uText, ivec2(gl_FragCoord.xy), 0);
  col = col * (1.0 - t.a) + t.rgb;
#endif

  // Beat pulses and the text flash cover everything, text included.
  col = mix(col, 1.0 - col, uInvert);
  col = mix(col, uFlashColor, uFlash);
  col = mix(col, uTextFlashColor, uTextFlash);

  if (uDither) {
    // ±0.5 LSB interleaved-gradient-noise dither breaks up 8-bit banding in gradients,
    // which video encoders would otherwise turn into visible steps. Static per pixel.
    float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    col += (n - 0.5) / 255.0;
  }
  return col;
}
