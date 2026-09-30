#version 300 es
// Variant switches (defined by the renderer): GLOBE = the globe pattern is in use (its code is
// only compiled then); S2 = draw the auxiliary spiral,
// FINISH = drawing straight to the screen, so apply the finishing steps here (TEXT_MODE: see finish.glsl).
precision highp float;

out vec4 outColor;

uniform vec2 uResolution;   // backing-store pixels
uniform float uZoom;
uniform vec2 uCenter;       // pattern centre on screen (short screen half = 1, y up)
uniform mat2 uRotate;       // screen → pattern rotation (turns the pattern anticlockwise)

// Geometry shared by both spirals. The outline shape is fixed per compiled variant:
// SHAPE 0 round, 1 polygon, 2 star, 3 heart.
uniform float uSides;        // polygon sides, star points
uniform float uShapeDepth;   // star: how far the points cut in (0..1)
#if SHAPE == 3
uniform float uOutline[128]; // heart outline radius per direction (render/shapes.ts)
#endif
uniform float uCenterSpread; // c in rho = sqrt(r^2 + c^2); 0 = unmodified
uniform float uCenterTaper;  // 0..1, how much arm width shrinks towards the centre
uniform float uOuterTaper;   // 0..1, how much arm width shrinks towards the edge
uniform float uGradientScale; // gradient colour mode: palette steps per unit of distance from centre
uniform float uGlobeTilt;    // globe: spin axis tipped towards the viewer (radians), so a pole shows
uniform float uSoftness;     // 0..1, extra edge blur
uniform float uTwist;        // turns of extra rotation per unit of distance
uniform float uWobble;       // 0..1 ripple amplitude
uniform float uWobbleFreq;   // ripples per unit of distance (or around the circle for rings)
uniform float uWobblePhase;  // cycles

struct Spiral {
  int mode;       // 0 spiral, 2 concentric, 5 globe
  int curve;      // spiral arm curve (see armRadial): 0 linear, 1 logarithmic, 2 power, 3 inverse, 4 exponential, 5 ripple
  float curveA;   // the curve's parameters: power exponent, exponential growth, ripple amount
  float curveB;   // ripple: ripples per unit of distance
  float arms;
  float density;
  float flow;     // cycles, wrapped at a multiple of the arm count
  float mirror;   // +1 or -1
  float width;    // share of each cycle taken by the arm stripe
};
uniform Spiral uSpiral[2];

// Colour bands: 0 = spiral 1 arms, 1 = spiral 1 gaps, 2 = spiral 2 arms, one row each of a
// palette texture: 6 colours' worth (the palette repeated), 32 texels per colour, already
// blended in OKLCh on the CPU so blends between bright colours stay vivid (render/color.ts).
uniform sampler2D uPalette;
const float PALETTE_SAMPLES = 32.0;
const float PALETTE_WIDTH = 6.0 * PALETTE_SAMPLES;
uniform int uColorMode[3];   // 0 static, 1 gradient, 2 cycle, 3 kaleidoscopic
uniform float uShift[3];     // palette steps
uniform float uKaleidoTurn;  // kaleidoscope sectors' rotation, turns anticlockwise
uniform float uKaleidoSectors; // kaleidoscope sectors around the centre
uniform vec3 uAvg1;          // spiral 1 average colour (anti-moiré fade)
uniform vec3 uAvg2;          // spiral 2 average arm colour

uniform float uS2Opacity;
uniform int uS2Blend;        // 0 normal, 1 add, 2 multiply, 3 screen, 4 difference

uniform float uHueShift;     // radians

#if FINISH
#include "finish.glsl"
#endif

const float TAU = 6.283185307179586;

const float TAPER_RADIUS = 1.0;   // arms reach full width at this distance (short screen half = 1)
const float OUTER_TAPER_START = 0.2; // outer taper: arms start thinning here...
const float OUTER_TAPER_END = 1.9;   // ...and are thinnest here, about a wide screen's corner
const float WOBBLE_TURNS = 0.15;  // arm displacement at full wobble, in turns
const float TUNNEL_DEPTH = 0.5;   // inverse curve: rings per unit of density at distance 1 (they crowd towards the centre)
const float GLOBE_RADIUS = 0.9;   // globe: size (short screen half = 1)

const float GLOBE_WIND = 0.3;     // globe: how tightly the stripes wind towards the poles, per unit of density
const vec3 GLOBE_LIGHT = vec3(-0.36, 0.46, 0.81); // globe: light from the upper left, towards the viewer (unit length)

// Palette at a continuous position: integers are pure colours, fractions crossfade. The
// texture repeats, so any position wraps round the palette.
vec3 palMix(int band, float x) {
  vec2 uv = vec2((x * PALETTE_SAMPLES + 0.5) / PALETTE_WIDTH, (float(band) + 0.5) / 3.0);
  return textureLod(uPalette, uv, 0.0).rgb;
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
  float inside; // globe: 1 on the ball, 0 around it (1 for every other pattern)
  float shade;  // globe: lighting on the ball (1 elsewhere)
};

// A spiral arm's curve: cycles of the pattern between the centre and softened distance `rho`
// (times the density). Its slope is how tightly the arms wind there. Anchored to 0 at the
// centre where it can be (at rho = c). Mirrored in render/armCurves.ts for the preview.
float armRadial(Spiral sp, float rho, float c) {
  if (sp.curve == 1) return 0.5 * log(rho);
  if (sp.curve == 2) return pow(rho, sp.curveA) - pow(c, sp.curveA);
  // Inverse (tunnel): equal steps in depth (1 / distance), so rings crowd towards the vanishing point.
  if (sp.curve == 3) return -TUNNEL_DEPTH / rho;
  // Exponential: winds ever tighter outwards; starts as tight as linear at the centre.
  if (sp.curve == 4) return (exp(sp.curveA * rho) - exp(sp.curveA * c)) / sp.curveA;
  // Ripple: linear, with the winding alternately tighter and looser (never backwards: amount < 1).
  if (sp.curve == 5) {
    float w = TAU * sp.curveB;
    return rho - c + sp.curveA * (sin(w * rho) - sin(w * c)) / w;
  }
  return rho - c; // linear (Archimedean)
}

// p: position in pattern space; pixel: pattern-space units per screen pixel.
Field spiralField(vec2 p, Spiral sp, float pixel) {
  Field F;
  F.inside = 1.0;
  F.shade = 1.0;
  F.r = max(length(p), 1e-5);
  float thetaRaw = atan(p.y, p.x);
  F.theta = thetaRaw * sp.mirror;

#if GLOBE
  if (sp.mode == 5) {
    // Globe: its own mapping (outline shape, centre spread, twist and wobble don't apply).
    // Stripes wound round a spinning ball like loxodromes (lines crossing every
    // meridian at the same angle), converging on the poles.
    vec2 q = p / GLOBE_RADIUS;
    vec3 n = vec3(q, sqrt(max(1.0 - dot(q, q), 0.0)));
    float ct = cos(uGlobeTilt), st = sin(uGlobeTilt);
    vec3 w = vec3(n.x, ct * n.y + st * n.z, -st * n.y + ct * n.z); // spin axis = w.y
    vec2 u = normalize(vec2(w.x, w.z) + 1e-6);                       // (cos, sin) of longitude
    float lon = atan(u.y, u.x) * sp.mirror;
    float lat = clamp(w.y, -0.999, 0.999);
    float mercator = 0.5 * log((1.0 + lat) / (1.0 - lat));
    float smoothG = sp.density * GLOBE_WIND * mercator + sp.flow; // flow spins the ball
    // Longitude jumps at its seam; its gradient comes from its (cos, sin) instead, which doesn't.
    vec2 gradLon = vec2(u.x * dFdx(u.y) - u.y * dFdx(u.x), u.x * dFdy(u.y) - u.y * dFdy(u.x)) * sp.mirror;
    F.v = sp.arms * lon / TAU + smoothG;
    F.dv = length(vec2(dFdx(smoothG), dFdy(smoothG)) + sp.arms / TAU * gradLon);
    F.theta = lon;
    F.inside = 1.0 - smoothstep(GLOBE_RADIUS - pixel, GLOBE_RADIUS, F.r);
    // Soft lighting with a little rim so the ball reads as round.
    float light = max(dot(n, GLOBE_LIGHT), 0.0);
    F.shade = mix(1.0, 0.25 + 0.75 * light, F.inside);
    return F;
  }
#endif

  // Shapes: divide the distance by the outline's radius in this direction, so every contour
  // is a scaled copy of the outline.
  float rs = F.r;
#if SHAPE == 1
  // Polygon: measure distance along each edge's normal so contours become straight edges.
  float seg = TAU / uSides;
  float a = mod(thetaRaw, seg) - 0.5 * seg;
  rs = F.r * cos(a) / cos(0.5 * seg);
#elif SHAPE == 2
  // Star: straight edges from each point (radius 1, pointing up first) in to a valley.
  float seg = TAU / uSides;
  float halfSeg = 0.5 * seg;
  float a = abs(mod(thetaRaw - 0.25 * TAU + halfSeg, seg) - halfSeg);
  vec2 tip = vec2(1.0, 0.0);
  vec2 edge = (1.0 - uShapeDepth) * vec2(cos(halfSeg), sin(halfSeg)) - tip;
  vec2 dir = vec2(cos(a), sin(a));
  rs = F.r * (dir.x * edge.y - dir.y * edge.x) / (tip.x * edge.y - tip.y * edge.x);
#elif SHAPE == 3
  // Heart: outline traced on the CPU, one radius per direction.
  float h = fract(thetaRaw / TAU) * 128.0;
  int i0 = int(floor(h));
  rs = F.r / mix(uOutline[i0], uOutline[(i0 + 1) % 128], fract(h));
#endif
  // Softened radius keeps stripes from bunching up where radial frequency explodes.
  float c = uCenterSpread;
  F.rho = sqrt(rs * rs + c * c);

  float radial = sp.mode == 0 ? sp.density * armRadial(sp, F.rho, c) : sp.density * (F.rho - c);

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
  // Outer taper: thins from OUTER_TAPER_START out to nothing by the screen's corners.
  float outer = smoothstep(OUTER_TAPER_START, OUTER_TAPER_END, r);
  return sp.width * (1.0 - uCenterTaper * (1.0 - taper)) * (1.0 - uOuterTaper * outer);
}

float filterWidth(float dv, float baseWidth) {
  float thinnest = min(baseWidth, 1.0 - baseWidth);
  return max(min(0.5 * dv + 0.5 * uSoftness * thinnest, 0.5), 1e-5);
}

// Arm coverage of a pixel (0 = gap, 1 = arm), plus the stripe indices its arm and gap colours
// come from (near a cycle boundary, the neighbouring arm or gap is the one being blended in).
float coverage(Spiral sp, Field F, float b, out float armK, out float gapK) {
  float k = floor(F.v);
  float f = F.v - k;
  float cov = armCoverage(f, b, filterWidth(F.dv, sp.width));
  armK = f > 0.5 * (1.0 + b) ? k + 1.0 : k;
  gapK = f < 0.5 * b ? k - 1.0 : k;
  return cov * F.inside;
}

// theta: the spiral's (mirrored) angle; mirror: its sign, so the sectors turn the same way
// on screen for mirrored spirals. The arm index is continuous across the atan seam (it is
// taken mod arms), so the boundaries can sit anywhere.
float kaleidoSector(float theta, float mirror) {
  return floor(fract(theta / TAU - uKaleidoTurn * mirror) * uKaleidoSectors);
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
  // Move the pattern's centre, turn it, then zoom (rotation keeps distances, so `pixel` holds).
  vec2 p = uRotate * (screen - uCenter) / uZoom;
  float pixel = 2.0 / (minRes * uZoom); // pattern units per screen pixel

  // ── Spiral 1: arms over gaps ────────────────────────────────────────────
  Spiral s1 = uSpiral[0];
  Field F = spiralField(p, s1, pixel);
  float b = armWidth(s1, F.r);
  float armK, gapK;
  float cov = coverage(s1, F, b, armK, gapK);
  float g = F.rho * uGradientScale;
  float sector = kaleidoSector(F.theta, s1.mirror);
  vec3 col = mix(bandColor(1, s1, gapK, g, sector), bandColor(0, s1, armK, g, sector), cov);
  // Where a whole cycle shrinks to ~1-2px, fade to the average colour instead of moiré.
  col = mix(col, uAvg1, smoothstep(0.6, 1.0, F.dv) * F.inside);
  col *= F.shade;

  // ── Auxiliary spiral: arms only, blended over the main spiral ───────────
#if S2
  {
    Spiral s2 = uSpiral[1];
    Field F2 = spiralField(p, s2, pixel);
    float b2 = armWidth(s2, F2.r);
    float fade2 = smoothstep(0.6, 1.0, F2.dv);
    float armK2, gapK2;
    float cov2 = mix(coverage(s2, F2, b2, armK2, gapK2), b2 * F2.inside, fade2);
    vec3 c2 = mix(bandColor(2, s2, armK2, F2.rho * uGradientScale, kaleidoSector(F2.theta, s2.mirror)), uAvg2, fade2) * F2.shade;
    col = blend(col, c2, cov2 * uS2Opacity, uS2Blend);
  }
#endif

  if (uHueShift != 0.0) col = clamp(hueRotate(col, uHueShift), 0.0, 1.0);

#if FINISH
  col = finish(col);
#endif
  outColor = vec4(col, 1.0);
}
