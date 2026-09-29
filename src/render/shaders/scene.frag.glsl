#version 300 es
precision highp float;

out vec4 outColor;

uniform vec2 uResolution;   // backing-store pixels
uniform int uMode;          // 0 archimedean, 1 logarithmic, 2 concentric, 3 power law
uniform float uExponent;    // power-law exponent k (radial = density * rho^k)
uniform float uArms;
uniform float uDensity;
uniform float uCenterSpread; // c in rho = sqrt(r^2 + c^2); 0 = unmodified
uniform float uBalance;     // share of each cycle taken by the arm stripe
uniform float uCenterTaper; // 0..1, how much the arm width shrinks towards the centre
uniform float uSoftness;    // 0..1, extra edge blur
uniform float uZoom;
uniform float uFlowPhase;   // cycles, wrapped at a multiple of the arm count
uniform float uTwist;       // +1 or -1 (mirror)
uniform float uHueShift;    // radians

// Band colours: band 0 = arms, band 1 = gaps. Up to 3 colours each.
uniform vec3 uArmColors[3];
uniform vec3 uGapColors[3];
uniform int uArmCount;
uniform int uGapCount;
uniform int uArmColorMode;  // 0 static, 1 gradient, 2 cycle, 3 kaleidoscopic
uniform int uGapColorMode;
uniform float uArmShift;    // palette steps
uniform float uGapShift;
uniform vec3 uAvgColor;     // used where stripes get thinner than a pixel

const float TAU = 6.283185307179586;
const float KALEIDO_SECTORS = 6.0;
const float GRADIENT_SCALE = 1.5; // palette steps per unit of distance from centre
const float TAPER_RADIUS = 1.0;   // arms reach full width at this distance (short screen half = 1)

vec3 palAt(int band, float i) {
  int n = band == 0 ? uArmCount : uGapCount;
  int k = int(mod(i, float(n)));
  return band == 0 ? uArmColors[k] : uGapColors[k];
}

// Palette sampled at a continuous position: integer positions are pure colours,
// fractional positions crossfade (used by gradients and by colour shifting).
vec3 palMix(int band, float x) {
  float i0 = floor(x);
  return mix(palAt(band, i0), palAt(band, i0 + 1.0), x - i0);
}

// k: index of the stripe this pixel belongs to; g: gradient coordinate; sector: kaleidoscope sector.
vec3 bandColor(int band, float k, float g, float sector) {
  int mode = band == 0 ? uArmColorMode : uGapColorMode;
  float s = band == 0 ? uArmShift : uGapShift;
  // Stripe k and k + arms are the same arm continuing across the atan seam,
  // so the arm identity is k mod arms. Rings (concentric) are all distinct.
  float armId = uMode == 2 ? k : mod(k, uArms);
  float x;
  if (mode == 0) x = armId + s;
  else if (mode == 1) x = g - s;
  else if (mode == 2) x = s;
  else x = sector + armId + s;
  return palMix(band, x);
}

// Rotate a colour around the grey axis (Rodrigues' rotation).
vec3 hueRotate(vec3 c, float a) {
  const vec3 k = vec3(0.57735026919);
  float ca = cos(a), sa = sin(a);
  return c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca);
}

float edge(float x, float e) {
  return smoothstep(-e, e, x);
}

void main() {
  float minRes = min(uResolution.x, uResolution.y);
  // Short side of the screen spans [-1, 1].
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / (0.5 * minRes) / uZoom;
  float pixel = 2.0 / (minRes * uZoom); // uv units per screen pixel

  float r = max(length(p), 1e-5);
  float theta = atan(p.y, p.x) * uTwist;

  // Radial distance softened near the centre: rho = sqrt(r^2 + c^2) keeps stripes
  // from bunching up where the pattern's radial frequency would otherwise explode.
  float c = uCenterSpread;
  float rho = sqrt(r * r + c * c);
  float drho = r / rho; // d(rho)/dr

  // Pattern coordinate v (one cycle = one arm + one gap) and |grad v| per uv unit.
  // The angular and radial gradients are orthogonal, so their magnitudes add in quadrature.
  float radial, dRadial;
  if (uMode == 1) {
    radial = uDensity * 0.5 * log(rho);
    dRadial = uDensity * 0.5 * drho / rho;
  } else if (uMode == 3) {
    float pk = pow(rho, uExponent);
    radial = uDensity * (pk - pow(c, uExponent));
    dRadial = uDensity * uExponent * pk / rho * drho;
  } else {
    radial = uDensity * (rho - c); // "- c" keeps rings anchored at the centre
    dRadial = uDensity * drho;
  }
  float angular = 0.0, dAngular = 0.0;
  if (uMode != 2) {
    angular = uArms * theta / TAU;
    dAngular = uArms / (TAU * r);
  }
  float v = angular + radial + uFlowPhase; // increasing phase moves stripes inward
  float dv = sqrt(dAngular * dAngular + dRadial * dRadial) * pixel; // cycles per pixel

  // Geometry: arm occupies [0, b) of each cycle, gap occupies [b, 1).
  // Taper narrows the arm towards the centre so the arms converge to a point.
  float k = floor(v);
  float f = v - k;
  float taper = pow(clamp(r / TAPER_RADIUS, 0.0, 1.0), 0.6);
  float b = uBalance * (1.0 - uCenterTaper * (1.0 - taper));
  float thinnest = min(uBalance, 1.0 - uBalance);
  // Antialiasing filter spans one pixel, widened by softness. It may exceed a thin arm's
  // width, so arms from the neighbouring cycles are included and coverage stays a box-filter
  // average (a sub-pixel arm fades out instead of flickering).
  float e = max(min(0.5 * dv + 0.5 * uSoftness * thinnest, 0.5), 1e-5);
  float armCoverage = clamp(
      edge(f + 1.0, e) - edge(f + 1.0 - b, e)
    + edge(f, e) - edge(f - b, e)
    + edge(f - 1.0, e) - edge(f - 1.0 - b, e), 0.0, 1.0);

  // Near a cycle boundary the neighbouring arm/gap is the one being blended in.
  float armK = f > 0.5 * (1.0 + b) ? k + 1.0 : k;
  float gapK = f < 0.5 * b ? k - 1.0 : k;

  float g = rho * GRADIENT_SCALE;
  // Sector boundaries include the atan seam (theta = ±pi), hiding the arm-index jump there.
  float sector = floor(fract(theta / TAU) * KALEIDO_SECTORS);

  vec3 col = mix(bandColor(1, gapK, g, sector), bandColor(0, armK, g, sector), armCoverage);

  // Only where a whole arm+gap cycle shrinks to ~1–2px (the very centre, extreme
  // density) fade to the average colour instead of producing moiré.
  col = mix(col, uAvgColor, smoothstep(0.6, 1.0, dv));

  if (uHueShift != 0.0) col = clamp(hueRotate(col, uHueShift), 0.0, 1.0);

  // ±0.5 LSB dither (interleaved gradient noise) breaks up 8-bit banding in gradients,
  // which video encoders would otherwise turn into visible steps. Static per pixel so it
  // doesn't add frame-to-frame noise for the encoder.
  float dither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  col += (dither - 0.5) / 255.0;

  outColor = vec4(col, 1.0);
}
