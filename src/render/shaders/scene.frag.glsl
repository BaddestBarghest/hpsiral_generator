#version 300 es
precision highp float;

out vec4 outColor;

uniform vec2 uResolution;   // backing-store pixels
uniform int uMode;          // 0 archimedean, 1 logarithmic, 2 concentric
uniform float uArms;
uniform float uDensity;
uniform float uCenterSpread; // c in rho = sqrt(r^2 + c^2); 0 = unmodified
uniform float uBalance;     // share of the cycle taken by the first half of the palette
uniform float uSoftness;    // 0..1, extra edge blur in band units
uniform float uZoom;
uniform float uFlowPhase;   // cycles, [0, 1)
uniform float uTwist;       // +1 or -1 (mirror)
uniform vec3 uPalette[8];
uniform int uPaletteSize;
uniform vec3 uPaletteAvg;   // used where bands get thinner than a pixel
uniform int uColorMode;     // 0 bands, 1 gradient
uniform float uHueShift;    // radians

const float TAU = 6.283185307179586;

vec3 pal(float i) {
  int n = uPaletteSize;
  int k = int(mod(i, float(n)));
  return uPalette[k];
}

// Rotate a colour around the grey axis (Rodrigues' rotation).
vec3 hueRotate(vec3 c, float a) {
  const vec3 k = vec3(0.57735026919);
  float ca = cos(a), sa = sin(a);
  return c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca);
}

void main() {
  float minRes = min(uResolution.x, uResolution.y);
  // Short side of the screen spans [-1, 1].
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / (0.5 * minRes) / uZoom;
  float pixel = 2.0 / (minRes * uZoom); // uv units per screen pixel

  float r = max(length(p), 1e-5);
  float theta = atan(p.y, p.x) * uTwist;

  // Pattern coordinate v (one cycle = one full palette) and |grad v| per uv unit.
  // The angular and radial gradients are orthogonal, so their magnitudes add in quadrature.
  // Radial distance softened near the centre: rho = sqrt(r^2 + c^2) keeps stripes
  // from bunching up where the pattern's radial frequency would otherwise explode.
  float c = uCenterSpread;
  float rho = sqrt(r * r + c * c);
  float drho = r / rho; // d(rho)/dr
  float radial, dRadial;
  if (uMode == 1) {
    radial = uDensity * 0.5 * log(rho);
    dRadial = uDensity * 0.5 * drho / rho;
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
  float dv = sqrt(dAngular * dAngular + dRadial * dRadial) * pixel; // v per pixel

  // Balance warp: first half of the bands occupies `uBalance` of each cycle.
  float f = fract(v);
  float b = uBalance;
  float w = f < b ? 0.5 * f / b : 0.5 + 0.5 * (f - b) / (1.0 - b);
  float warpSlope = f < b ? 0.5 / b : 0.5 / (1.0 - b);

  float n = float(uPaletteSize);
  float u = w * n;
  float du = dv * warpSlope * n; // band units per pixel
  float idx = floor(u);
  float t = u - idx;

  vec3 col;
  if (uColorMode == 1) {
    col = mix(pal(idx), pal(idx + 1.0), t);
  } else {
    // Antialiased edge: filter spans one pixel, plus user softness.
    float e = min(0.5 * du + 0.5 * uSoftness, 0.5);
    if (t < 0.5) {
      col = mix(pal(idx - 1.0), pal(idx), smoothstep(-e, e, t));
    } else {
      col = mix(pal(idx + 1.0), pal(idx), smoothstep(-e, e, 1.0 - t));
    }
  }

  // Where bands shrink below ~2px (spiral centre, extreme density) fade to the
  // average colour instead of producing moiré.
  col = mix(col, uPaletteAvg, smoothstep(0.35, 1.0, du));

  if (uHueShift != 0.0) col = clamp(hueRotate(col, uHueShift), 0.0, 1.0);
  outColor = vec4(col, 1.0);
}
