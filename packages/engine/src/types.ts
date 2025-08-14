export interface EngineConfig {
  canvas: HTMLCanvasElement;
  preferWebGPU: boolean;
  antialias: boolean;
  powerPreference: 'default' | 'high-performance' | 'low-power';
  adaptToDeviceRatio: boolean;
  preserveDrawingBuffer: boolean;
  stencil: boolean;
  premultipliedAlpha: boolean;
  alpha: boolean;
  desynchronized: boolean;
  audioEngine: boolean;
  deterministicLockstep: boolean;
  lockstepMaxSteps: number;
}

export interface RenderConfig {
  width: number;
  height: number;
  devicePixelRatio: number;
  maxFPS: number;
  vsync: boolean;
  shadowMapSize: number;
  maxLights: number;
  fog: {
    enabled: boolean;
    density: number;
    color: [number, number, number];
  };
}

export interface WebGPUCapabilities {
  supported: boolean;
  limits: GPUSupportedLimits | null;
  features: GPUSupportedFeatures | null;
}

export interface WebGLCapabilities {
  supported: boolean;
  version: 1 | 2;
  extensions: string[];
  maxTextureSize: number;
  maxCombinedTextureImageUnits: number;
  maxVertexAttribs: number;
}
