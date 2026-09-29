#version 300 es
// Variant switches (defined by the renderer): S2 = draw the auxiliary spiral,
// FINISH = drawing straight to the screen, so apply the finishing steps here (TEXT_MODE: see finish.glsl).
precision highp float;

out vec4 outColor;

uniform vec2 uResolution;   // backing-store pixels
uniform float uZoom;

// Geometry shared by both spirals.
uniform int uShape;          // 0 round, 1 polygon
uniform float uSides;
uniform float uExponent;     // power-law exponent k (radial = density * rho^k)
uniform float uCenterSpread; // c in rho = sqrt(r^2 + c^2); 0 = unmodified
uniform float uCenterTaper;  // 0..1, how much arm width shrinks towards the centre
uniform float uSoftness;     // 0..1, extra edge blur
uniform float uTwist;        // turns of extra rotation per unit of distance
uniform float uWobble;       // 0..1 ripple amplitude
uniform float uWobbleFreq;   // ripples per unit of distance (or around the circle for rings)
uniform float uWobblePhase;  // cycles

struct Spiral {
  int mode;       // 0 archimedean, 1 logarithmic, 2 concentric, 3 power law
  float arms;
  float density;
  float flow;     // cycles, wrapped at a multiple of the arm count
  float mirror;   // +1 or -1
  float width;    // share of each cycle taken by the arm stripe
};
uniform Spiral uSpiral[2];

// Colour bands: 0 = spiral 1 arms, 1 = spiral 1 gaps, 2 = spiral 2 arms. Up to 3 colours each.
uniform vec3 uColors[9];
uniform int uCount[3];
uniform int uColorMode[3];   // 0 static, 1 gradient, 2 cycle, 3 kaleidoscopic
uniform float uShift[3];     // palette steps
uniform vec3 uAvg1;          // spiral 1 average colour (anti-moiré fade)
uniform vec3 uAvg2;          // spiral 2 average arm colour

uniform float uS2Opacity;
uniform int uS2Blend;        // 0 normal, 1 add, 2 multiply, 3 screen, 4 difference

uniform float uHueShift;     // radians

#if FINISH
#include "finish.glsl"
#endif

const float TAU = 6.283185307179586;
const float KALEIDO_SECTORS = 6.0;
const float GRADIENT_SCALE = 1.5; // palette steps per unit of distance from centre
const float TAPER_RADIUS = 1.0;   // arms reach full width at this distance (short screen half = 1)
const float WOBBLE_TURNS = 0.15;  // arm displacement at full wobble, in turns

vec3 palAt(int band, float i) {
  int n = uCount[band];
  int k = int(mod(i, float(n)));
  return uColors[band * 3 + k];
}

// Palette at a continuous position: integers are pure colours, fractions crossfade.
vec3 palMix(int band, float x) {
  float i0 = floor(x);
  return mix(palAt(band, i0), palAt(band, i0 + 1.0), x - i0);
}

// k: index of the stripe the pixel belongs to; g: gradient coordinate; sector: kaleidoscope sector.
vec3 bandColor(int band, Spiral sp, float k, float g, float sector) {
  int mode = uColorMode[band];
  float s = uShift[band];
  // Stripe k and k + arms are the same arm continuing across the atan seam,
  // so the arm identity is k mod arms. Rings (concentric) are all distinct.
  float armId = sp.mode == 2 ? k : mod(k, sp.arms);
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

// Box-filtered coverage of the arm [0, b) at cycle position f, filter half-width e.
// Neighbouring cycles are included because e may exceed a thin arm's width.
float armCoverage(float f, float b, float e) {
  return clamp(
      edge(f + 1.0, e) - edge(f + 1.0 - b, e)
    + edge(f, e) - edge(f - b, e)
    + edge(f - 1.0, e) - edge(f - 1.0 - b, e), 0.0, 1.0);
}

struct Field {
  float v;      // pattern coordinate: one cycle = one arm + one gap
  float dv;     // cycles per screen pixel (for antialiasing)
  float rho;    // softened radial distance
  float theta;  // angle including mirror
  float r;      // plain distance from centre
};

// p: position in pattern space; pixel: pattern-space units per screen pixel.
Field spiralField(vec2 p, Spiral sp, float pixel) {
  Field F;
  F.r = max(length(p), 1e-5);
  float thetaRaw = atan(p.y, p.x);
  F.theta = thetaRaw * sp.mirror;

  // Polygon: measure distance along each edge's normal so contours become straight edges.
  float rs = F.r;
  if (uShape == 1) {
    float seg = TAU / uSides;
    float a = mod(thetaRaw, seg) - 0.5 * seg;
    rs = F.r * cos(a) / cos(0.5 * seg);
  }
  // Softened radius keeps stripes from bunching up where radial frequency explodes.
  float c = uCenterSpread;
  F.rho = sqrt(rs * rs + c * c);

  float radial;
  if (sp.mode == 1) radial = sp.density * 0.5 * log(F.rho);
  else if (sp.mode == 3) radial = sp.density * (pow(F.rho, uExponent) - pow(c, uExponent));
  else radial = sp.density * (F.rho - c); // "- c" keeps rings anchored at the centre

  // Twist and wobble bend the arms; everything here is continuous (no atan seam), so
  // screen-space derivatives give its gradient exactly.
  float bend;
  if (sp.mode == 2) {
    // Rings ripple radially; a whole number of ripples keeps them seamless around the circle.
    bend = uWobble * 0.3 * sin(round(uWobbleFreq) * thetaRaw - TAU * uWobblePhase);
  } else {
    bend = sp.arms * (uTwist * F.rho + uWobble * WOBBLE_TURNS * sin(TAU * (F.rho * uWobbleFreq - uWobblePhase)));
  }
  float smoothPart = radial + bend + sp.flow; // increasing flow moves stripes inward

  float angular = 0.0;
  vec2 gradAngular = vec2(0.0);
  if (sp.mode != 2) {
    angular = sp.arms * F.theta / TAU;
    // d(theta)/dp = (-y, x) / r^2, analytic because atan jumps at the seam.
    gradAngular = sp.arms * sp.mirror / TAU * vec2(-p.y, p.x) / (F.r * F.r) * pixel;
  }
  F.v = angular + smoothPart;
  F.dv = length(vec2(dFdx(smoothPart), dFdy(smoothPart)) + gradAngular);
  return F;
}

float armWidth(Spiral sp, float r) {
  float taper = pow(clamp(r / TAPER_RADIUS, 0.0, 1.0), 0.6);
  return sp.width * (1.0 - uCenterTaper * (1.0 - taper));
}

float filterWidth(float dv, float baseWidth) {
  float thinnest = min(baseWidth, 1.0 - baseWidth);
  return max(min(0.5 * dv + 0.5 * uSoftness * thinnest, 0.5), 1e-5);
}

float kaleidoSector(float theta) {
  // Sector boundaries include the atan seam (theta = ±pi), hiding the arm-index jump there.
  return floor(fract(theta / TAU) * KALEIDO_SECTORS);
}

vec3 blend(vec3 base, vec3 top, float a, int mode) {
  vec3 mixed;
  if (mode == 1) mixed = base + top;
  else if (mode == 2) mixed = base * top;
  else if (mode == 3) mixed = 1.0 - (1.0 - base) * (1.0 - top);
  else if (mode == 4) mixed = abs(base - top);
  else mixed = top;
  return mix(base, clamp(mixed, 0.0, 1.0), a);
}

void main() {
  float minRes = min(uResolution.x, uResolution.y);
  // Short side of the screen spans [-1, 1].
  vec2 screen = (gl_FragCoord.xy - 0.5 * uResolution) / (0.5 * minRes);
  vec2 p = screen / uZoom;
  float pixel = 2.0 / (minRes * uZoom); // pattern units per screen pixel

  // ── Spiral 1: arms over gaps ────────────────────────────────────────────
  Spiral s1 = uSpiral[0];
  Field F = spiralField(p, s1, pixel);
  float k = floor(F.v);
  float f = F.v - k;
  float b = armWidth(s1, F.r);
  float cov = armCoverage(f, b, filterWidth(F.dv, s1.width));
  // Near a cycle boundary the neighbouring arm/gap is the one being blended in.
  float armK = f > 0.5 * (1.0 + b) ? k + 1.0 : k;
  float gapK = f < 0.5 * b ? k - 1.0 : k;
  float g = F.rho * GRADIENT_SCALE;
  float sector = kaleidoSector(F.theta);
  vec3 col = mix(bandColor(1, s1, gapK, g, sector), bandColor(0, s1, armK, g, sector), cov);
  // Where a whole cycle shrinks to ~1-2px, fade to the average colour instead of moiré.
  col = mix(col, uAvg1, smoothstep(0.6, 1.0, F.dv));

  // ── Auxiliary spiral: arms only, blended over the main spiral ───────────
#if S2
  {
    Spiral s2 = uSpiral[1];
    Field F2 = spiralField(p, s2, pixel);
    float k2 = floor(F2.v);
    float f2 = F2.v - k2;
    float b2 = armWidth(s2, F2.r);
    float fade2 = smoothstep(0.6, 1.0, F2.dv);
    float cov2 = mix(armCoverage(f2, b2, filterWidth(F2.dv, s2.width)), b2, fade2);
    float armK2 = f2 > 0.5 * (1.0 + b2) ? k2 + 1.0 : k2;
    vec3 c2 = mix(bandColor(2, s2, armK2, F2.rho * GRADIENT_SCALE, kaleidoSector(F2.theta)), uAvg2, fade2);
    col = blend(col, c2, cov2 * uS2Opacity, uS2Blend);
  }
#endif

  if (uHueShift != 0.0) col = clamp(hueRotate(col, uHueShift), 0.0, 1.0);

#if FINISH
  col = finish(col);
#endif
  outColor = vec4(col, 1.0);
}
