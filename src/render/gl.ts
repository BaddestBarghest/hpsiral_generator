export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

/** Full-screen triangle generated from gl_VertexID; no vertex buffers needed. */
export const FULLSCREEN_VS = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export function createContext(canvas: AnyCanvas): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false, // edges are antialiased analytically in the shader
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  }) as WebGL2RenderingContext | null;
  if (!gl) throw new Error('WebGL2 is not available in this browser.');
  return gl;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`Shader compile failed:\n${log}`);
  }
  return sh;
}

/** An RGBA8 texture with a framebuffer, sized to the canvas, for multi-pass rendering. */
export interface RenderTarget {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  width: number;
  height: number;
}

export function createTarget(gl: WebGL2RenderingContext, width: number, height: number): RenderTarget {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
  // Same size as the screen, so no filtering is ever needed.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const framebuffer = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { texture, framebuffer, width, height };
}

export function deleteTarget(gl: WebGL2RenderingContext, t: RenderTarget | null): void {
  if (!t) return;
  gl.deleteFramebuffer(t.framebuffer);
  gl.deleteTexture(t.texture);
}

export interface Program {
  program: WebGLProgram;
  loc(name: string): WebGLUniformLocation | null;
}

export function createProgram(gl: WebGL2RenderingContext, vs: string, fs: string): Program {
  const program = gl.createProgram()!;
  const v = compile(gl, gl.VERTEX_SHADER, vs);
  const f = compile(gl, gl.FRAGMENT_SHADER, fs);
  gl.attachShader(program, v);
  gl.attachShader(program, f);
  gl.linkProgram(program);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
    throw new Error(`Program link failed:\n${gl.getProgramInfoLog(program)}`);
  }
  const cache = new Map<string, WebGLUniformLocation | null>();
  return {
    program,
    loc(name) {
      if (!cache.has(name)) cache.set(name, gl.getUniformLocation(program, name));
      return cache.get(name)!;
    },
  };
}
